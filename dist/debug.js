"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const debug_1 = require("debug");
exports.default = debug_1.default("graphile-worker");
const debuggers = {};
function debugFactory(namespace) {
    if (!debuggers[namespace]) {
        debuggers[namespace] = debug_1.default(`graphile-worker:${namespace}`);
    }
    return debuggers[namespace];
}
exports.debugFactory = debugFactory;
//# sourceMappingURL=debug.js.map