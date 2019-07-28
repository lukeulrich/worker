import { WithPgClient, Job, Helpers, TaskOptions } from "./interfaces";
import { Pool, PoolClient } from "pg";
export declare function makeAddJob(withPgClient: WithPgClient): (identifier: string, payload?: any, options?: TaskOptions) => Promise<Job>;
export declare function makeHelpers(job: Job, { withPgClient }: {
    withPgClient: WithPgClient;
}): Helpers;
export declare function makeWithPgClientFromPool(pgPool: Pool): <T>(callback: (pgClient: PoolClient) => Promise<T>) => Promise<T>;
export declare function makeWithPgClientFromClient(pgClient: PoolClient): <T>(callback: (pgClient: PoolClient) => Promise<T>) => Promise<T>;
