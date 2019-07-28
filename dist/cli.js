#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const getTasks_1 = require("./getTasks");
const index_1 = require("./index");
const yargs = require("yargs");
const config_1 = require("./config");
const argv = yargs
    .option("connection", {
    description: "Database connection string, defaults to the 'DATABASE_URL' envvar",
    alias: "c",
})
    .string("connection")
    .option("once", {
    description: "Run until there are no runnable jobs left, then exit",
    alias: "1",
    default: false,
})
    .boolean("once")
    .option("watch", {
    description: "[EXPERIMENTAL] Watch task files for changes, automatically reloading the task code without restarting worker",
    alias: "w",
    default: false,
})
    .boolean("watch")
    .option("jobs", {
    description: "number of jobs to run concurrently",
    alias: "j",
    default: config_1.CONCURRENT_JOBS,
})
    .option("poll-interval", {
    description: "how long to wait between polling for jobs in milliseconds (for jobs scheduled in the future/retries)",
    default: config_1.POLL_INTERVAL,
})
    .number("poll-interval")
    .option("migrate-only", {
    description: "Run database migrations, then exit",
    alias: "m",
    default: false,
})
    .boolean("migrate-only").argv;
const isInteger = (n) => {
    return isFinite(n) && Math.round(n) === n;
};
async function main() {
    const DATABASE_URL = argv.connection || process.env.DATABASE_URL || undefined;
    const MIGRATE_ONLY = argv.migrateOnly;
    const ONCE = argv.once || MIGRATE_ONLY;
    const WATCH = argv.watch;
    if (WATCH && ONCE) {
        throw new Error("Cannot specify both --watch and --once");
    }
    if (!DATABASE_URL) {
        throw new Error("Please use `--connection` flag or set `DATABASE_URL` envvar to indicate the PostgreSQL connection string.");
    }
    const watchedTasks = await getTasks_1.default(`${process.cwd()}/tasks`, WATCH);
    const options = {
        concurrency: isInteger(argv.jobs) ? argv.jobs : config_1.CONCURRENT_JOBS,
        pollInterval: isInteger(argv["poll-interval"])
            ? argv["poll-interval"]
            : config_1.POLL_INTERVAL,
        connectionString: DATABASE_URL,
        taskList: watchedTasks.tasks,
    };
    if (MIGRATE_ONLY) {
        await index_1.migrateOnly(options);
    }
    else if (ONCE) {
        await index_1.runOnce(options);
    }
    else {
        const { promise } = await index_1.run(options);
        // Continue forever(ish)
        await promise;
    }
}
main().catch(e => {
    console.error(e); // eslint-disable-line no-console
    process.exit(1);
});
//# sourceMappingURL=cli.js.map