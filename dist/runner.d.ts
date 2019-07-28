import { Runner, RunnerOptions } from "./interfaces";
export declare const migrateOnly: (options: RunnerOptions) => Promise<void>;
export declare const runOnce: (options: RunnerOptions) => Promise<void>;
export declare const run: (options: RunnerOptions) => Promise<Runner>;
