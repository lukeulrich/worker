"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function deferred() {
    let resolve;
    let reject;
    return Object.assign(new Promise((_resolve, _reject) => {
        resolve = _resolve;
        reject = _reject;
    }), 
    // @ts-ignore Non-sense, these aren't used before being defined.
    { resolve, reject });
}
exports.default = deferred;
//# sourceMappingURL=deferred.js.map