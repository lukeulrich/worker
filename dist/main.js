"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const debug_1 = require("./debug");
const deferred_1 = require("./deferred");
const signals_1 = require("./signals");
const worker_1 = require("./worker");
const helpers_1 = require("./helpers");
const config_1 = require("./config");
const allWorkerPools = [];
exports._allWorkerPools = allWorkerPools;
debug_1.default("Booting worker");
let _registeredSignalHandlers = false;
let _shuttingDown = false;
function registerSignalHandlers() {
    if (_shuttingDown) {
        throw new Error("System has already gone into shutdown, should not be spawning new workers now!");
    }
    if (_registeredSignalHandlers) {
        return;
    }
    _registeredSignalHandlers = true;
    signals_1.default.forEach(signal => {
        debug_1.default("Registering signal handler for ", signal);
        const removeHandler = () => {
            debug_1.default("Removing signal handler for ", signal);
            process.removeListener(signal, handler);
        };
        const handler = function () {
            // eslint-disable-next-line no-console
            console.error(`Received '${signal}'; attempting graceful shutdown...`);
            setTimeout(removeHandler, 5000);
            if (_shuttingDown) {
                return;
            }
            _shuttingDown = true;
            Promise.all(allWorkerPools.map(pool => pool.gracefulShutdown(`Forced worker shutdown due to ${signal}`))).finally(() => {
                removeHandler();
                // eslint-disable-next-line no-console
                console.error(`Graceful shutdown attempted; killing self via ${signal}`);
                process.kill(process.pid, signal);
            });
        };
        process.on(signal, handler);
    });
}
function runTaskList(tasks, pgPool, options = {}) {
    debug_1.default(`Worker pool options are %O`, options);
    const { concurrency = config_1.CONCURRENT_JOBS } = options, workerOptions = tslib_1.__rest(options, ["concurrency"]);
    // Clean up when certain signals occur
    registerSignalHandlers();
    const promise = deferred_1.default();
    const workers = [];
    let listenForChangesClient = null;
    const unlistenForChanges = async () => {
        if (listenForChangesClient) {
            const client = listenForChangesClient;
            listenForChangesClient = null;
            // Subscribe to jobs:insert message
            try {
                await client.query('UNLISTEN "jobs:insert"');
            }
            catch (e) {
                // Ignore
            }
            await client.release();
        }
    };
    const listenForChanges = (err, client, release) => {
        if (err) {
            // eslint-disable-next-line no-console
            console.error(`Error connecting with notify listener (trying again in 5 seconds): ${err.message}`);
            // Try again in 5 seconds
            setTimeout(() => {
                pgPool.connect(listenForChanges);
            }, 5000);
            return;
        }
        listenForChangesClient = client;
        client.on("notification", () => {
            if (listenForChangesClient === client) {
                // Find a worker that's available
                workers.some(worker => worker.nudge());
            }
        });
        // Subscribe to jobs:insert message
        client.query('LISTEN "jobs:insert"');
        // On error, release this client and try again
        client.on("error", (e) => {
            // eslint-disable-next-line no-console
            console.error("Error with database notify listener", e.message);
            listenForChangesClient = null;
            try {
                release();
            }
            catch (e) {
                // eslint-disable-next-line no-console
                console.error("Error occurred releasing client: " + e.stack);
            }
            pgPool.connect(listenForChanges);
        });
        const supportedTaskNames = Object.keys(tasks);
        // eslint-disable-next-line no-console
        console.log(`Worker connected and looking for jobs... (task names: '${supportedTaskNames.join("', '")}')`);
    };
    // Create a client dedicated to listening for new jobs.
    pgPool.connect(listenForChanges);
    // This is a representation of us that can be interacted with externally
    const workerPool = {
        release: async () => {
            unlistenForChanges();
            promise.resolve();
            await Promise.all(workers.map(worker => worker.release()));
            const idx = allWorkerPools.indexOf(workerPool);
            allWorkerPools.splice(idx, 1);
        },
        // Make sure we clean up after ourselves even if a signal is caught
        async gracefulShutdown(message) {
            try {
                // Release all our workers' jobs
                const workerIds = workers.map(worker => worker.workerId);
                const jobsInProgress = workers
                    .map(worker => worker.getActiveJob())
                    .filter((job) => !!job);
                // Remove all the workers - we're shutting them down manually
                workers.splice(0, workers.length).map(worker => worker.release());
                debug_1.default("RELEASING THE JOBS", workerIds);
                const { rows: cancelledJobs } = await pgPool.query(`
          SELECT graphile_worker.fail_job(job_queues.locked_by, jobs.id, $2)
          FROM graphile_worker.jobs
          INNER JOIN graphile_worker.job_queues ON (job_queues.queue_name = jobs.queue_name)
          WHERE job_queues.locked_by = ANY($1::text[]) AND jobs.id = ANY($3::int[]);
        `, [workerIds, message, jobsInProgress.map(job => job.id)]);
                debug_1.default(cancelledJobs);
                debug_1.default("JOBS RELEASED");
            }
            catch (e) {
                console.error(e.message); // eslint-disable-line no-console
            }
            // Remove ourself from the list of worker pools
            this.release();
        },
        promise,
    };
    // Ensure that during a forced shutdown we get cleaned up too
    allWorkerPools.push(workerPool);
    // Spawn our workers; they can share clients from the pool.
    const withPgClient = helpers_1.makeWithPgClientFromPool(pgPool);
    for (let i = 0; i < concurrency; i++) {
        workers.push(worker_1.makeNewWorker(tasks, withPgClient, workerOptions));
    }
    // TODO: handle when a worker shuts down (spawn a new one)
    return workerPool;
}
exports.runTaskList = runTaskList;
exports.runTaskListOnce = (tasks, client, options = {}) => worker_1.makeNewWorker(tasks, helpers_1.makeWithPgClientFromClient(client), options, false)
    .promise;
//# sourceMappingURL=main.js.map