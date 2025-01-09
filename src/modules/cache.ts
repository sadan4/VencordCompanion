import * as fs from "fs/promises";
import { join, normalize, resolve } from "path";
import { ProgressLocation, Uri, window, workspace } from "vscode";

import format from "../format";
import { WebpackAstParser } from "../lsp";
import { formatModule, sendAndGetData } from "../server/webSocketServer";
import { BufferedProgressBar, exists, getCurrentFolder, isDirectory, ProgressBar, SecTo } from "./util";

class _ModuleCache {
    folder: string;
    get workspaceFolder() {
        const toRet = getCurrentFolder();
        if (toRet == null) {
            throw new Error("You are not in a folder, try opening a file");
        }
        return toRet;
    }
    private get modpath() {
        return join(this.workspaceFolder, this.folder);
    }
    constructor(folder?: string) {
        this.folder = folder || ".modules";
    }

    public getModuleURI(id: string) {
        return Uri.file(this.getModulePath(id));
    }

    public getModulePath(id: string): string {
        return resolve(join(this.modpath, id + ".js"));
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

    async clearCache() {
        if (!await this.hasCache()) {
            throw new Error("No cache to clear");
        }
        return fs.rm(this.modpath, {
            recursive: true,
            force: false,
        });
    }

    async hasCache() {
        return await exists(this.modpath);
    }

    public async getModuleFromNum(id: string): Promise<string> {
        if (!await this.hasCache()) {
            throw new Error("Module cache not found");
        }
        return await fs.readFile(join(this.modpath, id + ".js"), {
            encoding: "utf-8"
        });
    }

    private async writeModules(modmap: Record<string, string>) {
        if (await exists(this.modpath)) {
            throw new Error(".modules already exists, please run `vencord-companion.clearCache` first");
        }
        await fs.mkdir(this.modpath);
        let canceled = false;
        const progress = await new ProgressBar(Object.entries(modmap).length, "Writing modules", () => {
            canceled = true;
        }).start();
        for (const [id, text] of Object.entries(modmap)) {
            if (canceled) {
                throw new Error("Module writing canceled");
            }
            try {
                // FIXME: check if id has any invalid/malicious characters
                await fs.writeFile(join(this.modpath, id + ".js"), text);
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
                await progress.increment();
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
                var { data: text } = await sendAndGetData<"rawId">({
                    type: "rawId",
                    data: {
                        id: +id
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
        const allModules = await sendAndGetData<"moduleList">({
            type: "allModules",
            data: null
        }, {
            timeout: 120 * SecTo.MS
        });
        return allModules.data.modules;
    }

}
const MODULE_ID_FILE_REGEX = /(\d+)\.js/;
type DepsGeneratorOpts =
    | {
        modmap: Record<string, string>;
    }
    | {
        fromDisk: true,
        folder?: string;
    };
type AllDeps = Record<string, {
    /**
     * the modules that require this module syncranously
     */
    syncUses: string[];
    /**
     * the modules that require this module lazily
     */
    lazyUses: string[];
}>;
/**
 * **YOU MUST CALL {@link ready} IF YOU PASS A FOLDER**
**/
export class ModuleDepManager {
    private static modCache: AllDeps | null = null;
    modmap!: Record<string, string>;
    private readyPromise;
    currentFolder: string;

    public static getModDeps(moduleid: string) {
        if (this.hasModDeps()) {
            return this.modCache![moduleid];
        }
        throw new Error("Module Deps not initialized");
    }
    public static hasModDeps() {
        return !!this.modCache;
    }

    // FIXME: setting to start caching when a webpack module is opened / when the vencord workspace is opened
    public static async initModDeps(opts: DepsGeneratorOpts) {
        this.modCache = await (await new this(opts).ready()).gererateDeps();
    }
    constructor(opts: DepsGeneratorOpts) {
        this.currentFolder = getCurrentFolder()!;
        if (this.currentFolder == null)
            throw new Error("No folder found, please make sure you are in a workspace");
        if ("modmap" in opts) {
            this.modmap = opts.modmap;
        } else if (opts.fromDisk) {
            this.readyPromise = this.generateModmap(opts.folder || ".modules")
                .then(v => this.modmap = v);
        }
    }

    public async ready() {
        this.readyPromise && await this.readyPromise;
        return this;
    }
    public async gererateDeps() {
        // FIXME: horror
        const toRet: AllDeps = ModuleDepManager.makeDepsMap();
        let cancelled = false;
        const progress = await new BufferedProgressBar(Object.entries(this.modmap).length, "Parsing Modules", () => {
            cancelled = true;
        }).start();
        for (const [id, text] of Object.entries(this.modmap)) {
            if (cancelled) {
                throw new Error("canceled by user");
            }
            try {
                const deps = new WebpackAstParser(text).getDeps();
                for (const syncDep of deps?.sync ?? []) {
                    toRet[syncDep].syncUses.push(id);
                }
                for (const lazyDep of deps?.lazy ?? []) {
                    toRet[lazyDep].lazyUses.push(id);
                }
                await progress.increment();
            } catch (e) {
                progress.stop(e);
                throw e;
            }
        }
        return toRet;
    }

    private static makeDepsMap(): AllDeps {
        const target = {};
        return new Proxy(target, {
            get(target, prop, rec) {
                if (typeof prop === "string" && prop.match(/\d+/)) {
                    if (!Reflect.has(target, prop)) {
                        const val = ({
                            lazyUses: [],
                            syncUses: []
                        } satisfies AllDeps[string]);
                        Reflect.set(target, prop, val, rec);
                        return val;
                    }
                }
                return Reflect.get(target, prop, rec);
            }
        });
    }

    protected async generateModmap(folder: string) {
        const toRet = {};
        const modpath = join(this.currentFolder, folder);
        const validPath = await exists(modpath) && await isDirectory(modpath);
        if (!validPath) throw new Error("modpath is not valid. got: " + modpath);

        const files = await ProgressBar.forSingleFunc({
            location: ProgressLocation.Notification,
            cancellable: true,
            title: "reading module list"
        }, () => fs.readdir(modpath));
        let cancelled = false;
        const progress = await new ProgressBar(files.length, "loading files", () => {
            cancelled = true;
        }).start();

        for (const file of files) {
            if (cancelled) {
                throw new Error("reading files cancelled by user");
            }
            try {
                const filepath = join(modpath, file);
                if (await isDirectory(filepath)) {
                    progress.increment();
                    continue;
                }
                const modId = file.match(MODULE_ID_FILE_REGEX)?.[1];
                if (!modId) {
                    progress.increment();
                    continue;
                }
                progress.increment();
                // FIXME: add abort singal
                const text = await fs.readFile(filepath, {
                    encoding: "utf-8",
                });
                toRet[modId] = text;
            } catch (error) {
                progress.stop(error);
                throw error;
            }
        }
        return toRet;
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

export const ModuleCache = new _ModuleCache(".modules");
