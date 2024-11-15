import { ShellExecution, tasks, window } from "vscode";

import { sendToSockets } from "./server/webSocketServer";
import { ReporterData } from "./types";
import { ReporterPanel } from "./webview";
// 1. rebuild with reporter
// 2. send reload command
// 3. await results back from vencord
// 4. rebuild without reporter
// 5. send reload command
// 6. display results
export let running = false;
export async function startReporter() {
    try {
        if (running) {
            running = false;
            throw new Error("The reporter is currently running, please wait.\nIf you think this is a bug, please report this.");
        }

        running = true;
        const task = await getReporterTask();

        // used to kill watch tasks
        ensureOnlyTask();

        await tasks.executeTask(task);
        // cant find a way to await the vscode task finish
        await new Promise(r => setTimeout(r, 1000));
        await sendToSockets({
            type: "reload",
            data: undefined
        });
    } catch (e) {
        window.showErrorMessage(String(e));
        // peak logic
        running = !running;
    }
}
export async function handleAfterRecive(data: ReporterData) {
    running = false;
    try {
        const task = await getNormalBuildTask();
        ensureOnlyTask();

        await tasks.executeTask(task);
        // cant find a way to await the vscode task finish
        await new Promise(r => setTimeout(r, 1000));
        await sendToSockets({
            type: "reload",
            data: undefined
        });
        ReporterPanel.createOrShow(data);
    } catch (error) {
        window.showErrorMessage(String(error));
    }
}
async function getNormalBuildTask() {
    const task = (await tasks.fetchTasks()).filter(t => t.execution instanceof ShellExecution && t.execution.commandLine?.includes("build") && t.execution.commandLine?.includes("--dev") && !t.execution.commandLine?.includes("--companion-test"));
    if (task.length === 0)
        throw new Error("No build task found");
    if (task.length > 1)
        throw new Error("More than one task found");
    return task[0];
}
async function getReporterTask() {
    const task = (await tasks.fetchTasks()).filter(t => t.execution instanceof ShellExecution && String(t.execution.commandLine).includes("--companion-test"));
    if (task.length === 0)
        throw new Error("No build task found");
    if (task.length > 1)
        throw new Error("More than one task found");
    return task[0];
}

/**
 * ensures there are no other tasks running, if so, ends them
 */
function ensureOnlyTask() {
    if (tasks.taskExecutions.length === 0)
        return;
    tasks.taskExecutions.forEach(t => t.terminate());
}
