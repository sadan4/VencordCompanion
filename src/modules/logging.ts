import { LogOutputChannel, window } from "vscode";

const internalOutputChannel: LogOutputChannel = window.createOutputChannel("Vencord Companion", {
    log: true
});
const consoleMethods = {
    log: "log",
    append: "log",
    appendLine: "log",
    trace: "trace",
    debug: "debug",
    info: "info",
    warn: "warn",
    error: "error"
};
export const outputChannel: LogOutputChannel = new Proxy(internalOutputChannel, {
    get(target, p) {
        if (p in consoleMethods) {
            return function () {
                console[consoleMethods[p]](...arguments);
                // @ts-expect-error
                return target[p].apply(this, arguments);
            };
        }
    }
});
