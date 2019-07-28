"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert = require("assert");
const pg_1 = require("pg");
const getTasks_1 = require("./getTasks");
const main_1 = require("./main");
const helpers_1 = require("./helpers");
const migrate_1 = require("./migrate");
const processOptions = async (options) => {
    const releasers = [];
    const release = () => Promise.all(releasers.map(fn => fn()));
    try {
        assert(!!options.taskDirectory !== !!options.taskList, "Exactly one of either taskDirectory or taskList should be set");
        let taskList;
        if (options.taskList) {
            taskList = options.taskList;
        }
        else if (options.taskDirectory) {
            const watchedTasks = await getTasks_1.default(options.taskDirectory, false);
            releasers.push(() => watchedTasks.release());
            taskList = watchedTasks.tasks;
        }
        else {
            throw new Error("You must specify either `options.taskList` or `options.taskDirectory`");
        }
        assert(!!options.pgPool !== !!options.connectionString, "Exactly one of either pgPool or connectionString should be set");
        let pgPool;
        if (options.pgPool) {
            pgPool = options.pgPool;
        }
        else if (options.connectionString) {
            pgPool = new pg_1.Pool({ connectionString: options.connectionString });
            releasers.push(() => pgPool.end());
        }
        else if (process.env.DATABASE_URL) {
            pgPool = new pg_1.Pool({ connectionString: process.env.DATABASE_URL });
            releasers.push(() => pgPool.end());
        }
        else {
            throw new Error("You must either specify `pgPool` or `connectionString`, or you must make the `DATABASE_URL` environmental variable available.");
        }
        const withPgClient = helpers_1.makeWithPgClientFromPool(pgPool);
        // Migrate
        await withPgClient(client => migrate_1.migrate(client));
        return { taskList, pgPool, withPgClient, release };
    }
    catch (e) {
        release();
        throw e;
    }
};
exports.migrateOnly = async (options) => {
    const { release } = await processOptions(options);
    await release();
};
exports.runOnce = async (options) => {
    const { taskList, withPgClient, release } = await processOptions(options);
    await withPgClient(client => main_1.runTaskListOnce(taskList, client, options));
    await release();
};
exports.run = async (options) => {
    const { taskList, pgPool, withPgClient, release } = await processOptions(options);
    const workerPool = main_1.runTaskList(taskList, pgPool, options);
    let running = true;
    return {
        async stop() {
            if (running) {
                throw new Error("Runner is already stopped");
            }
            else {
                running = false;
                await workerPool.release();
                await release();
            }
        },
        addJob: helpers_1.makeAddJob(withPgClient),
        promise: workerPool.promise,
    };
};
//# sourceMappingURL=runner.js.map