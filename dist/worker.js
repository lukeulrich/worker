"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const debug_1 = require("./debug");
const config_1 = require("./config");
const assert = require("assert");
const deferred_1 = require("./deferred");
const helpers_1 = require("./helpers");
function makeNewWorker(tasks, withPgClient, options = {}, continuous = true) {
    const { pollInterval = config_1.POLL_INTERVAL, 
    // The `||0.1` is to eliminate the vanishingly-small possibility of Math.random() returning 0. Math.random() can never return 1.
    workerId = `worker-${String(Math.random() || 0.1).substr(2)}`, } = options;
    const promise = deferred_1.default();
    let activeJob = null;
    let doNextTimer = null;
    const cancelDoNext = () => {
        if (doNextTimer !== null) {
            clearTimeout(doNextTimer);
            doNextTimer = null;
            return true;
        }
        return false;
    };
    let active = true;
    const debug = (msg) => {
        debug_1.default("[Worker %s] %s", workerId, msg);
    };
    const release = () => {
        if (!active) {
            return;
        }
        active = false;
        if (cancelDoNext()) {
            // Nothing in progress; resolve the promise
            promise.resolve();
        }
        return promise;
    };
    debug(`Spawned`);
    let contiguousErrors = 0;
    let again = false;
    const doNext = async () => {
        again = false;
        cancelDoNext();
        assert(active, "doNext called when active was false");
        assert(!activeJob, "There should be no active job");
        // Find us a job
        try {
            const supportedTaskNames = Object.keys(tasks);
            assert(supportedTaskNames.length, "No runnable tasks!");
            const { rows: [jobRow], } = await withPgClient(client => client.query("SELECT * FROM graphile_worker.get_job($1, $2);", [
                workerId,
                supportedTaskNames,
            ]));
            activeJob = jobRow && jobRow.id ? jobRow : null;
        }
        catch (err) {
            if (continuous) {
                contiguousErrors++;
                debug(`Failed to acquire job: ${err.message} (${contiguousErrors}/${config_1.MAX_CONTIGUOUS_ERRORS})`);
                if (contiguousErrors >= config_1.MAX_CONTIGUOUS_ERRORS) {
                    promise.reject(new Error(`Failed ${contiguousErrors} times in a row to acquire job; latest error: ${err.message}`));
                    release();
                    return;
                }
                else {
                    if (active) {
                        // Error occurred fetching a job; try again...
                        doNextTimer = setTimeout(() => doNext(), pollInterval);
                    }
                    else {
                        promise.reject(err);
                    }
                    return;
                }
            }
            else {
                promise.reject(err);
                release();
                return;
            }
        }
        contiguousErrors = 0;
        // If we didn't get a job, try again later (if appropriate)
        if (!activeJob) {
            if (continuous) {
                if (active) {
                    // eslint-disable-next-line prefer-conditional-expression
                    if (again) {
                        // This could be a synchronisation issue where we were notified of
                        // the job but it's not visible yet, lets try again in just a
                        // moment.
                        doNext();
                    }
                    else {
                        doNextTimer = setTimeout(() => doNext(), pollInterval);
                    }
                }
                else {
                    promise.resolve();
                }
            }
            else {
                promise.resolve();
                release();
            }
            return;
        }
        // We did get a job then; store it into the current scope.
        const job = activeJob;
        // We may want to know if an error occurred or not
        let err = null;
        try {
            /*
             * Be **VERY** careful about which parts of this code can throw - we
             * **MUST** release the job once we've attempted it (success or error).
             */
            const startTimestamp = process.hrtime();
            try {
                debug(`Found task ${job.id} (${job.task_identifier})`);
                const task = tasks[job.task_identifier];
                assert(task, `Unsupported task '${job.task_identifier}'`);
                const helpers = helpers_1.makeHelpers(job, { withPgClient });
                await task(job.payload, helpers);
            }
            catch (error) {
                err = error;
            }
            const durationRaw = process.hrtime(startTimestamp);
            const duration = durationRaw[0] * 1e3 + durationRaw[1] * 1e-6;
            if (err) {
                const { message, stack } = err;
                // eslint-disable-next-line no-console
                console.error(`Failed task ${job.id} (${job.task_identifier}) with error ${err.message} (${duration.toFixed(2)}ms)${stack
                    ? `:\n  ${String(stack)
                        .replace(/\n/g, "\n  ")
                        .trim()}`
                    : ""}`);
                // TODO: retry logic, in case of server connection interruption
                await withPgClient(client => client.query("SELECT * FROM graphile_worker.fail_job($1, $2, $3);", [
                    workerId,
                    job.id,
                    message,
                ]));
            }
            else {
                if (!process.env.NO_LOG_SUCCESS) {
                    // eslint-disable-next-line no-console
                    console.log(`Completed task ${job.id} (${job.task_identifier}) with success (${duration.toFixed(2)}ms)`);
                }
                // TODO: retry logic, in case of server connection interruption
                await withPgClient(client => client.query("SELECT * FROM graphile_worker.complete_job($1, $2);", [
                    workerId,
                    job.id,
                ]));
            }
        }
        catch (fatalError) {
            const when = err ? `after failure '${err.message}'` : "after success";
            // eslint-disable-next-line no-console
            console.error(`Failed to release job '${job.id}' ${when}; committing seppuku\n${fatalError.message}`);
            promise.reject(fatalError);
            release();
            return;
        }
        finally {
            activeJob = null;
        }
        if (active) {
            doNext();
        }
        else {
            promise.resolve();
        }
    };
    const nudge = () => {
        assert(active, "nudge called after worker terminated");
        if (doNextTimer) {
            // Must be idle; call early
            doNext();
            return true;
        }
        else {
            again = true;
            // Not idle; find someone else!
            return false;
        }
    };
    // Start!
    doNext();
    const worker = {
        nudge,
        workerId,
        release,
        promise,
        getActiveJob: () => activeJob,
    };
    // For tests
    promise["worker"] = worker;
    return worker;
}
exports.makeNewWorker = makeNewWorker;
//# sourceMappingURL=worker.js.map