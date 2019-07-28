/// <reference types="debug" />
import { PoolClient, Pool } from "pg";
import { IDebugger } from "./debug";
export declare type WithPgClient = <T = void>(callback: (pgClient: PoolClient) => Promise<T>) => Promise<T>;
export declare type AddJobFunction = (identifier: string, payload?: any, options?: TaskOptions) => Promise<Job>;
export interface Helpers {
    job: Job;
    debug: IDebugger;
    withPgClient: WithPgClient;
    addJob: AddJobFunction;
}
export declare type Task = (payload: unknown, helpers: Helpers) => void | Promise<void>;
export declare function isValidTask(fn: any): fn is Task;
export interface TaskList {
    [name: string]: Task;
}
export interface WatchedTaskList {
    tasks: TaskList;
    release: () => void;
}
export interface Job {
    id: number;
    queue_name: string;
    task_identifier: string;
    payload: unknown;
    priority: number;
    run_at: Date;
    attempts: number;
    last_error: string | null;
    created_at: Date;
    updated_at: Date;
}
export interface Worker {
    nudge: () => boolean;
    workerId: string;
    release: () => void;
    promise: Promise<void>;
    getActiveJob: () => Job | null;
}
export interface WorkerPool {
    release: () => Promise<void>;
    gracefulShutdown: (message: string) => Promise<void>;
    promise: Promise<void>;
}
export interface Runner {
    stop: () => Promise<void>;
    addJob: AddJobFunction;
    promise: Promise<void>;
}
export interface TaskOptions {
    /**
     * The queue to run this task under
     */
    queueName?: string;
    /**
     * A Date to schedule this task to run in the future
     */
    runAt?: Date;
    /**
     * How many retries should this task get? (Default: 25)
     */
    maxAttempts?: number;
}
export interface WorkerSharedOptions {
    /**
     * How long to wait between polling for jobs in milliseconds (for jobs scheduled in the future/retries)
     */
    pollInterval?: number;
}
export interface WorkerOptions extends WorkerSharedOptions {
    /**
     * An identifier for this specific worker; if unset then a random ID will be assigned. Do not assign multiple workers the same worker ID!
     */
    workerId?: string;
}
export interface WorkerPoolOptions extends WorkerSharedOptions {
    /**
     * Number of jobs to run concurrently
     */
    concurrency?: number;
}
export interface RunnerOptions extends WorkerPoolOptions {
    /**
     * Task names and handler, e.g. from `getTasks` (use this if you need watch mode)
     */
    taskList?: TaskList;
    /**
     * Each file in this directory will be used as a task handler
     */
    taskDirectory?: string;
    /**
     * A PostgreSQL connection string to the database containing the job queue
     */
    connectionString?: string;
    /**
     * A pg.Pool instance to use instead of the `connectionString`
     */
    pgPool?: Pool;
}
