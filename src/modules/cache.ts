import { WebpackAstParser } from "@ast/webpack";
import { format } from "@modules/format";
import { outputChannel } from "@modules/logging";
import { BufferedProgressBar, exists, getCurrentFolder, isDirectory, ProgressBar, SecTo } from "@modules/util";
import { sendAndGetData } from "@server";

import { formatModule } from "./util";

import { mkdir, readdir, readFile, rm, writeFile } from "fs/promises";
import { join, resolve } from "path";

import { ProgressLocation, Uri, window } from "vscode";

class _ModuleCache {
    folder: string;
    baseFolder: string | undefined;

    get workspaceFolder() {
        if (this.baseFolder)
            return this.baseFolder;

        const toRet = getCurrentFolder();

        if (toRet == null) {
            throw new Error("You are not in a folder, try opening a file");
        }
        return toRet;
    }

    private get modpath() {
        return join(this.workspaceFolder, this.folder);
    }

    constructor({ folder = ".modules", baseFolder }: { folder?: string;
        baseFolder?: string; }) {
        this.baseFolder = baseFolder;
        this.folder = folder;
    }

    public getModuleURI(id: string) {
        return Uri.file(this.getModulePath(id));
    }

    public getModulePath(id: string): string {
        return resolve(join(this.modpath, `${id}.js`));
    }

    async downloadModules() {
        try {
            const before = performance.now();
            const moduleIds = await this.getModuleIDs();
            const modmap = await this.downloadModuleText(moduleIds);

            await this.formatModules(modmap);
            await this.writeModules(modmap);

            const after = performance.now();

            outputChannel.debug(`Downloading ${moduleIds.length} modules took ${after - before}ms`);
        } catch (error) {
            window.showErrorMessage(`Error downloading modules:\n${String(error)}`);
            outputChannel.error(String(error));
        }
    }

    async clearCache() {
        if (!await this.hasCache()) {
            throw new Error("No cache to clear");
        }
        return rm(this.modpath, {
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
        return await readFile(join(this.modpath, `${id}.js`), {
            encoding: "utf-8",
        });
    }

    private async writeModules(modmap: Record<string, string>) {
        if (await exists(this.modpath)) {
            throw new Error(".modules already exists, please run `vencord-companion.clearCache` first");
        }
        await mkdir(this.modpath);

        let canceled = false;

        const progress = await new ProgressBar(Object.entries(modmap).length, "Writing modules", () => {
            canceled = true;
        })
            .start();

        for (const [id, text] of Object.entries(modmap)) {
            if (canceled) {
                throw new Error("Module writing canceled");
            }
            try {
                // FIXME: check if id has any invalid/malicious characters
                await writeFile(join(this.modpath, `${id}.js`), text);
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
        })
            .start();

        const startTime = performance.now();

        for (const [id, text] of Object.entries(modmap)) {
            if (canceled) {
                throw new Error("Module formatting canceled");
            }
            modmap[id] = format(formatModule(text, id));
            await progress.increment();
        }

        const endTime = performance.now();

        outputChannel.debug(`Formatting modules took ${endTime - startTime}ms`);
    }

    private async downloadModuleText(moduleIDs: string[]) {
        let isCancelled = false;

        const progress = await new ProgressBar(moduleIDs.length, "Downloading modules", () => {
            isCancelled = true;
        })
            .start();

        const res: Record<string, string> = {};

        for (const id of moduleIDs) {
            if (isCancelled) {
                throw new Error("Module download canceled");
                break;
            }
            progress.increment();

            let text: string;

            try {
                [{ data: { module: text } }] = [
                    await sendAndGetData<"extract">({
                        type: "extract",
                        data: {
                            extractType: "id",
                            idOrSearch: +id,
                            usePatched: null,
                        },
                    }),
                ];
            } catch (error) {
                progress.stop(error);
                throw error;
                break;
            }
            res[id] = text;
        }
        return res;
    }

    private async getModuleIDs() {
        const allModules = await sendAndGetData<"moduleList">({
            type: "allModules",
            data: null,
        }, {
            timeout: 120 * SecTo.MS,
        });

        return allModules.data.modules;
    }
}

const MODULE_ID_FILE_REGEX = /(\d+)\.js/;

type DepsGeneratorOpts =
  & {
      noCache?: boolean;
  }
  & (
    | {
        modmap: Record<string, string>;
    }
    | {
        fromDisk: true;
        folder?: string;
        baseFolder?: string;
    }
);

type MainDeps = Record<string, {
    /**
     * the modules that require this module syncranously
     */
    syncUses: string[];
    /**
     * the modules that require this module lazily
     */
    lazyUses: string[];
}>;

interface KeyModules {
    fluxDispatcherClass: [moduleId: string, exportName: string | symbol][];
}

interface CacheData {
    mainDeps: MainDeps;
    keyModules: KeyModules;
}

export class ModuleDepManager {
    private static SYM_CJS_DEFAULT_PLACEHOLDER = "SYMBOL(SYM_CJS_DEFAULT)";
    static DEFAULT_FOLDER = ".modules";
    static CACHE_FILE_NAME = "cache.json";
    private static modCache: MainDeps | null = null;
    private static keyModules: KeyModules | null = null;
    private modmap?: Record<string, string>;
    currentFolder: string;
    moduleFolder: string;
    useCache: boolean;

    public static getModDeps(moduleid: string) {
        if (this.hasModDeps()) {
            return this.modCache![moduleid];
        }
        throw new Error("Module Deps not initialized");
    }

    public static hasModDeps() {
        return !!this.modCache;
    }

    public static hasKeyModules() {
        return !!this.keyModules;
    }

    // FIXME: setting to start caching when a webpack module is opened / when the vencord workspace is opened
    public static async initModDeps(opts: DepsGeneratorOpts) {
        if (this.hasModDeps()) {
            return;
        }

        const inst = new this(opts);
        let maybeCache: CacheData | undefined;

        if (inst.useCache && (maybeCache = await inst.tryReadCache())) {
            outputChannel.info("ModuleDepManager#generateDeps: Using cached deps");
            this.modCache = maybeCache.mainDeps;
            this.keyModules = maybeCache.keyModules;
            return;
        }

        this.modCache = await inst
            .generateDeps();
        this.keyModules = await inst
            .generateKeyModules();

        await inst.writeCache();
    }

    constructor(opts: DepsGeneratorOpts) {
        this.currentFolder = ("baseFolder" in opts && opts.baseFolder) || getCurrentFolder()!;
        this.moduleFolder = ("folder" in opts && opts.folder) || ModuleDepManager.DEFAULT_FOLDER;
        this.useCache = !opts.noCache;
        if (this.currentFolder == null)
            throw new Error("No folder found, please make sure you are in a workspace");
        if ("modmap" in opts) {
            this.modmap = opts.modmap;
        }
    }

    private canonicalizeKeyModules(keyModules: KeyModules) {
        keyModules.fluxDispatcherClass = keyModules.fluxDispatcherClass.map(([moduleId, exportName]) => {
            if (exportName === ModuleDepManager.SYM_CJS_DEFAULT_PLACEHOLDER) {
                exportName = WebpackAstParser.SYM_CJS_DEFAULT;
            }
            return [moduleId, exportName];
        });
    }

    private async tryReadCache(): Promise<undefined | CacheData> {
        // check if the deps are cached first, if so, load them
        const cacheFile = join(this.currentFolder, this.moduleFolder, ModuleDepManager.CACHE_FILE_NAME);

        if (this.useCache && await exists(cacheFile)) {
            const file = await readFile(cacheFile, "utf-8");
            const cachedData = JSON.parse(file) as CacheData;

            this.canonicalizeKeyModules(cachedData.keyModules);

            outputChannel.info("ModuleDepManager#generateDeps: Loading deps from cache file");
            return cachedData;
        }
    }

    private async writeCache() {
        if (!this.useCache) {
            return;
        }
        if (!ModuleDepManager.hasModDeps()) {
            throw new Error("ModuleDepManager#writeCache: No deps to write");
        }

        const cacheFile = join(this.currentFolder, this.moduleFolder, ModuleDepManager.CACHE_FILE_NAME);

        const data = JSON.stringify({
            mainDeps: ModuleDepManager.modCache!,
            keyModules: ModuleDepManager.keyModules!,
        } satisfies CacheData);

        await writeFile(cacheFile, data, "utf-8");
    }

    private async generateDeps(): Promise<MainDeps> {
        // FIXME: horror
        const ret: MainDeps = ModuleDepManager.makeDepsMap();

        const retKeyModules: KeyModules = {
            fluxDispatcherClass: [],
        };

        let cancelled = false;

        const progress = await new BufferedProgressBar(Object.entries(await this.getModmap()).length, "Parsing Modules", () => {
            cancelled = true;
        })
            .start();

        for (const [id, text] of Object.entries(await this.getModmap())) {
            if (cancelled) {
                throw new Error("canceled by user");
            }
            try {
                const parser = new WebpackAstParser(text);

                {
                    const deps = parser.getModulesThatThisModuleRequires();

                    for (const syncDep of deps?.sync ?? []) {
                        ret[syncDep].syncUses.push(id);
                    }
                    for (const lazyDep of deps?.lazy ?? []) {
                        ret[lazyDep].lazyUses.push(id);
                    }
                }
                await progress.increment();
            } catch (e) {
                progress.stop(e);
                outputChannel.error(e);
                window.showErrorMessage((e as Error)?.message);
                throw e;
            }
        }

        return ret;
    }

    private async generateKeyModules(): Promise<KeyModules> {
        const ret: KeyModules = {
            fluxDispatcherClass: [],
        };

        let cancelled = false;

        const progress = await new BufferedProgressBar(Object.entries(await this.getModmap()).length, "Locating Key Modules", () => {
            cancelled = true;
        })
            .start();

        for (const [id, text] of Object.entries(await this.getModmap())) {
            if (cancelled) {
                throw new Error("canceled by user");
            }
            try {
                const parser = new WebpackAstParser(text);

                {
                    const fluxDispatcherModuleExport = parser.isFluxDispatcherModule();

                    if (fluxDispatcherModuleExport != null) {
                        ret.fluxDispatcherClass.push([id, fluxDispatcherModuleExport]);

                        (await parser.getAllReExportsForExport(fluxDispatcherModuleExport))
                            .filter(([, exportChain]) => exportChain.length === 1)
                            .forEach(([moduleId, [exportName]]) => {
                                if (typeof exportName === "symbol") {
                                    exportName = ModuleDepManager.SYM_CJS_DEFAULT_PLACEHOLDER;
                                }
                                ret.fluxDispatcherClass.push([moduleId, exportName]);
                            });
                    }
                }
                await progress.increment();
            } catch (e) {
                progress.stop(e);
                outputChannel.error(e);
                window.showErrorMessage((e as Error)?.message);
                throw e;
            }
        }

        return ret;
    }

    private static makeDepsMap(): MainDeps {
        const target = {} satisfies MainDeps;

        return new Proxy(target, {
            get(target, prop, rec) {
                if (typeof prop === "string" && prop.match(/\d+/)) {
                    if (!Reflect.has(target, prop)) {
                        const val = ({
                            lazyUses: [],
                            syncUses: [],
                        } satisfies MainDeps[string]);

                        Reflect.set(target, prop, val, rec);
                        return val;
                    }
                }
                return Reflect.get(target, prop, rec);
            },
        });
    }

    protected async getModmap(): Promise<Record<string, string>> {
        if (this.modmap) {
            return this.modmap;
        }

        const toRet = {};
        const modpath = join(this.currentFolder, this.moduleFolder);
        const validPath = await exists(modpath) && await isDirectory(modpath);

        if (!validPath)
            throw new Error(`modpath is not valid. got: ${modpath}`);

        const files = await ProgressBar.forSingleFunc({
            location: ProgressLocation.Notification,
            cancellable: true,
            title: "reading module list",
        }, () => readdir(modpath));

        let cancelled = false;

        const progress = await new ProgressBar(files.length, "loading files", () => {
            cancelled = true;
        })
            .start();

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
                const text = await readFile(filepath, {
                    encoding: "utf-8",
                });

                toRet[modId] = text;
            } catch (error) {
                progress.stop(error);
                throw error;
            }
        }
        return (this.modmap = toRet);
    }
}
export class testProgressBar {
    constructor() {

    }

    async start() {
        const timeouts: NodeJS.Timeout[] = [];

        const bar = new ProgressBar(4, "testing abc", () => {
            timeouts.map(clearTimeout);
            window.showInformationMessage("Canceled");
        });

        await bar.start();
        timeouts.push(
            setTimeout(() => bar.increment(), 0),
            setTimeout(() => bar.increment(), 1000),
            setTimeout(() => bar.increment(), 2000),
            setTimeout(() => bar.increment(), 3000),
        );
    }
}

export const ModuleCache = new _ModuleCache({
    folder: ".modules",
});
