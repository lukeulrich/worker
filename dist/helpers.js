"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const debug_1 = require("./debug");
function makeAddJob(withPgClient) {
    return (identifier, payload = {}, options = {}) => {
        return withPgClient(async (pgClient) => {
            const { rows } = await pgClient.query(`
        select * from graphile_worker.add_job(
          identifier => $1::text,
          payload => $2::json,
          queue_name => coalesce($3::text, public.gen_random_uuid()::text),
          run_at => coalesce($4::timestamptz, now()),
          max_attempts => coalesce($5::int, 25)
        );
        `, [
                identifier,
                JSON.stringify(payload),
                options.queueName || null,
                options.runAt ? options.runAt.toISOString() : null,
                options.maxAttempts || null,
            ]);
            const job = rows[0];
            return job;
        });
    };
}
exports.makeAddJob = makeAddJob;
function makeHelpers(job, { withPgClient }) {
    return {
        job,
        debug: debug_1.debugFactory(`${job.task_identifier}`),
        withPgClient,
        addJob: makeAddJob(withPgClient),
    };
}
exports.makeHelpers = makeHelpers;
function makeWithPgClientFromPool(pgPool) {
    return async (callback) => {
        const client = await pgPool.connect();
        try {
            return await callback(client);
        }
        finally {
            await client.release();
        }
    };
}
exports.makeWithPgClientFromPool = makeWithPgClientFromPool;
function makeWithPgClientFromClient(pgClient) {
    return async (callback) => {
        return callback(pgClient);
    };
}
exports.makeWithPgClientFromClient = makeWithPgClientFromClient;
//# sourceMappingURL=helpers.js.map