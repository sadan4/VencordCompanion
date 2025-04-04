/* eslint-disable prefer-rest-params */
import { LogOutputChannel, window } from "vscode";

const internalOutputChannel: LogOutputChannel = window.createOutputChannel("Vencord Companion", {
    log: true,
});

const consoleMethods = {
    log: "log",
    append: "log",
    appendLine: "log",
    debug: "debug",
    info: "info",
    warn: "warn",
    error: "error",
};

export const outputChannel: LogOutputChannel = new Proxy(internalOutputChannel, {
    get(target, p, r) {
        if (p in consoleMethods) {
            return function () {
                console[consoleMethods[p]](...arguments);
                return target[p].apply(r, arguments);
            };
        }
        return function () {
            return target[p].apply(r, arguments);
        };
    },
});
