import { vscodeAPI } from ".";
import { Patch } from "./types";

const ensureAPI = () => !vscodeAPI && console.trace("NO VSCODE API FOUND")

export function disablePlugin(pluginName: string) {
    ensureAPI()
    vscodeAPI?.postMessage({
        type: "disable",
        data: {
            pluginName,
            enabled: false
        }
    })
}

export function enablePlugin(pluginName: string) {
    ensureAPI();
    vscodeAPI?.postMessage({
        type: "disable",
        data: {
            pluginName,
            enabled: true
        }
    })
}

export function jumpToPatch(pluginName: string, patch: Patch) {
    ensureAPI();
    vscodeAPI?.postMessage({
        type: "jumpToPatch",
        data: {
            pluginName,
            patch
        }
    })
}

export function diffPatch(patch: Patch) {
    ensureAPI();
    vscodeAPI?.postMessage({
        type: "diff",
        data: patch
    })
}
export function extractPatch(patch: Patch) {
    ensureAPI();
    vscodeAPI?.postMessage({
        type: "extract",
        data: {
            patch
        }
    })
}
