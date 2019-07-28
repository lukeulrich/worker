"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = require("path");
const chokidar = require("chokidar");
const interfaces_1 = require("./interfaces");
const fs_1 = require("./fs");
const debug_1 = require("./debug");
const module_1 = require("./module");
function validTasks(obj) {
    const tasks = {};
    Object.keys(obj).forEach(taskName => {
        const task = obj[taskName];
        if (interfaces_1.isValidTask(task)) {
            tasks[taskName] = task;
        }
        else {
            // eslint-disable-next-line no-console
            console.warn(`Not a valid task '${taskName}' - expected function, received ${task ? typeof task : String(task)}.`);
        }
    });
    return tasks;
}
async function loadFileIntoTasks(tasks, filename, name = null, watch = false) {
    const replacementModule = watch
        ? await module_1.fauxRequire(filename)
        : require(filename);
    if (!replacementModule) {
        throw new Error(`Module '${filename}' doesn't have an export`);
    }
    if (name) {
        const task = replacementModule.default || replacementModule;
        if (interfaces_1.isValidTask(task)) {
            tasks[name] = task;
        }
        else {
            throw new Error(`Invalid task '${name}' - expected function, received ${task ? typeof task : String(task)}.`);
        }
    }
    else {
        Object.keys(tasks).forEach(taskName => {
            delete tasks[taskName];
        });
        if (!replacementModule.default ||
            typeof replacementModule.default === "function") {
            Object.assign(tasks, validTasks(replacementModule));
        }
        else {
            Object.assign(tasks, validTasks(replacementModule.default));
        }
    }
}
async function getTasks(taskPath, watch = false) {
    const pathStat = await fs_1.tryStat(taskPath);
    if (!pathStat) {
        throw new Error(`Could not find tasks to execute - '${taskPath}' does not exist`);
    }
    const watchers = [];
    let taskNames = [];
    const tasks = {};
    const debugSupported = () => {
        const oldTaskNames = taskNames;
        taskNames = Object.keys(tasks).sort();
        if (oldTaskNames.join(",") !== taskNames.join(",")) {
            debug_1.default(`Supported task names: '${taskNames.join("', '")}'`);
        }
    };
    if (pathStat.isFile()) {
        if (watch) {
            watchers.push(chokidar.watch(taskPath, { ignoreInitial: true }).on("all", () => {
                loadFileIntoTasks(tasks, taskPath, null, watch)
                    .then(debugSupported)
                    .catch(e => {
                    // eslint-disable-next-line no-console
                    console.error(`Error in ${taskPath}: ${e.message}`);
                });
            }));
        }
        // Try and require it
        await loadFileIntoTasks(tasks, taskPath, null, watch);
    }
    else if (pathStat.isDirectory()) {
        if (watch) {
            watchers.push(chokidar
                .watch(`${taskPath}/*.js`, {
                ignoreInitial: true,
            })
                .on("all", (event, eventFilePath) => {
                const taskName = path_1.basename(eventFilePath, ".js");
                if (event === "unlink") {
                    delete tasks[taskName];
                    debugSupported();
                }
                else {
                    loadFileIntoTasks(tasks, eventFilePath, taskName, watch)
                        .then(debugSupported)
                        .catch(e => {
                        // eslint-disable-next-line no-console
                        console.error(`Error in ${eventFilePath}: ${e.message}`);
                    });
                }
            }));
        }
        // Try and require its contents
        const files = await fs_1.readdir(taskPath);
        for (const file of files) {
            if (file.endsWith(".js")) {
                const taskName = file.substr(0, file.length - 3);
                try {
                    await loadFileIntoTasks(tasks, `${taskPath}/${file}`, taskName, watch);
                }
                catch (e) {
                    const message = `Error processing '${taskPath}/${file}': ${e.message}`;
                    if (watch) {
                        console.error(message); // eslint-disable-line no-console
                    }
                    else {
                        throw new Error(message);
                    }
                }
            }
        }
    }
    taskNames = Object.keys(tasks).sort();
    return {
        tasks,
        release: () => {
            watchers.forEach(watcher => watcher.close());
        },
    };
}
exports.default = getTasks;
//# sourceMappingURL=getTasks.js.map