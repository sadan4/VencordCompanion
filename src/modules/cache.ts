import * as fs from "fs/promises";
import { join } from "path";
import { window, workspace } from "vscode";

import format from "../format";
import { formatModule, sendAndGetData } from "../webSocketServer";
import { BufferedProgressBar, exists, getCurrentFolder, ProgressBar, SecTo } from "./util";
export class ModuleCache {
    folder: string;
    workspaceFolder: string;

    constructor(folder?: string) {
        this.folder = folder || ".modules";
        this.workspaceFolder = getCurrentFolder()!;
        if (this.workspaceFolder == null) throw new Error("No folder found, please make sure you are in a workspace");
    }

    async downloadModules() {
        try {
            const moduleIds = await this.getModuleIDs();
            const modmap = await this.downloadModuleText(moduleIds);
            await this.formatModules(modmap);
            await this.writeModules(modmap);
        } catch (error) {
            console.error(error);
            window.showErrorMessage("Error downloading modules:\n" + String(error));
        }
    }
    private async writeModules(modmap: Record<string, string>) {
        const modpath = join(this.workspaceFolder, this.folder);
        if (!exists(modpath)) {
            throw new Error(".modules already exists, please run `vencord-companion.clearCache` first");
        }
        await fs.mkdir(modpath);
        let canceled = false;
        const progress = await new ProgressBar(Object.entries(modmap).length, "Writing modules", () => {
            canceled = true;
        }).start();
        for (const [id, text] of Object.entries(modmap)) {
            if(canceled) {
                throw new Error("Module writing canceled");
            }
            try {
                // FIXME: check if id has any invalid/malicious characters
                await fs.writeFile(join(modpath, id + ".js"), text);
                progress.increment();
            } catch (error) {
                progress.stop(error);
                throw error;
            }
        }
    }

    private async formatModules(modmap: Record<string, string>) {
        let canceled = false;
        const progress = await new BufferedProgressBar(Object.entries(modmap).length, "Formatting modules", () => {
            canceled = true;
        }).start();

        for (const [id, text] of Object.entries(modmap)) {
            if (canceled) {
                console.log("canceled");
                throw new Error("Module formatting canceled");
                break;
            }
            try {
                modmap[id] = await format(formatModule(text, id));
                progress.increment();
            } catch (error) {
                console.log("error");
                throw error;
            }
        }
    }

    private async downloadModuleText(moduleIDs: string[]) {
        let isCancelled = false;
        const progress = await new ProgressBar(moduleIDs.length, "Downloading modules", () => {
            isCancelled = true;
        }).start();

        const res: Record<string, string> = {};

        for (const id of moduleIDs) {
            if (isCancelled) {
                throw new Error("Module download canceled");
                break;
            }
            progress.increment();
            try {
                var { data: text } = await sendAndGetData({
                    type: "rawContent",
                    data: {
                        extractType: "id",
                        idOrSearch: +id
                    }
                });
            } catch (error) {
                progress.stop(error);
                throw error;
                break;
            }
            res[id] = text;
        }
        console.log(res);
        return res;
    }

    private async getModuleIDs() {
        const allModules = await sendAndGetData({
            type: "allModules",
            data: null
        }, {
            timeout: 120 * SecTo.MS
        });
        console.log(allModules);
        return allModules.data as string[];
    }

}
export class testProgressBar {
    constructor() {

    }
    async start() {
        const bar = new ProgressBar(4, "testing abc", () => {
            timeouts.map(clearTimeout);
            window.showInformationMessage("Canceled");
        });
        await bar.start();
        const timeouts: NodeJS.Timeout[] = [];
        timeouts.push(
            setTimeout(() => bar.increment(), 0),
            setTimeout(() => bar.increment(), 1000),
            setTimeout(() => bar.increment(), 2000),
            setTimeout(() => bar.increment(), 3000)
        );

    }
}
