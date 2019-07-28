export interface Deferred<T> extends Promise<T> {
    resolve: (result?: T) => void;
    reject: (error: Error) => void;
}
export default function deferred<T = void>(): Deferred<T>;
