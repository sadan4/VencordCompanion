import { outputChannel } from "@modules/logging";
import { BufferedProgressBar, exists, getCurrentFolder, isDirectory, ProgressBar, SecTo } from "@modules/util";
import { Format } from "@sadan4/devtools-pretty-printer";
import { sendAndGetData } from "@server";
import { formatModule, ModuleDep, WebpackAstParser } from "@vencord-companion/webpack-ast-parser";

import { mkdir, readdir, readFile, rm, writeFile } from "fs/promises";
import { join, resolve } from "path";

import { ProgressLocation, window } from "vscode";

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

    public getModuleURL(id: string): URL {
        return new URL(`file://${this.getModulePath(id)}`);
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

            outputChannel.debug(`[perf] Downloading, formatting and writing ${moduleIds.length} modules took ${after - before}ms`);
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
        const modmapEntries = Object.entries(modmap);

        const progress = await new ProgressBar(modmapEntries.length, "Writing modules", () => {
            canceled = true;
        })
            .start();

        const before = performance.now();

        for (const [id, text] of modmapEntries) {
            if (canceled) {
                throw new Error("Module writing canceled");
            }
            try {
                if (id.includes("/") || id.includes("\\")) {
                    throw new Error(`Invalid module ID: ${id}`);
                }
                await writeFile(join(this.modpath, `${id}.js`), text);
                progress.increment();
            } catch (error) {
                progress.stop(error);
                throw error;
            }
        }

        const after = performance.now();

        outputChannel.debug(`[perf] Writing ${modmapEntries.length} modules took ${after - before}ms`);
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
            modmap[id] = Format(formatModule(text, id));
            await progress.increment();
        }

        const endTime = performance.now();

        outputChannel.debug(`[perf] Formatting modules took ${endTime - startTime}ms`);
    }

    private async downloadModuleText(moduleIDs: string[]) {
        let isCancelled = false;

        const progress = await new ProgressBar(moduleIDs.length, "Downloading modules", () => {
            isCancelled = true;
        })
            .start();

        const res: Record<string, string> = {};
        const before = performance.now();

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

        const after = performance.now();

        outputChannel.debug(`[perf] Downloading ${moduleIDs.length} modules took ${after - before}ms`);

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

type MainDeps = Record<string, ModuleDep>;

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
    // underscore so it's above the numbered modules
    static CACHE_FILE_NAME = "_cache.json";
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

        let parsers: WebpackAstParser[];

        [this.modCache, parsers] = await inst
            .generateDeps();
        this.keyModules = await inst
            .generateKeyModules(parsers);

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

        // We don't want to use the cache in tests because we actually want to test the parsing
        if (IS_TEST === false && this.useCache && await exists(cacheFile)) {
            const file = await readFile(cacheFile, "utf-8");
            const cachedData = JSON.parse(file) as CacheData;

            this.canonicalizeKeyModules(cachedData.keyModules);

            outputChannel.info("ModuleDepManager#tryReadCache: Loading deps from cache file");
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

    private async generateDeps(): Promise<[MainDeps, WebpackAstParser[]]> {
        // FIXME: horror
        const ret: MainDeps = ModuleDepManager.makeDepsMap();
        let cancelled = false;
        const modmap = await this.getModmap();
        const retParsers = [] as WebpackAstParser[];

        const progress = await new BufferedProgressBar(Object.entries(modmap).length, "Parsing Modules", () => {
            cancelled = true;
        })
            .start();

        const start = performance.now();

        for (const [id, text] of Object.entries(modmap)) {
            if (cancelled) {
                throw new Error("canceled by user");
            }
            try {
                const parser = new WebpackAstParser(text);

                retParsers.push(parser);

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

        const end = performance.now();

        outputChannel.debug(`[perf] Generating Module Dependencies took ${end - start}ms`);

        return [ret, retParsers];
    }

    private async generateKeyModules(parsers: WebpackAstParser[]): Promise<KeyModules> {
        const ret: KeyModules = {
            fluxDispatcherClass: [],
        };

        let cancelled = false;

        const progress = await new BufferedProgressBar(parsers.length, "Locating Key Modules", () => {
            cancelled = true;
        })
            .start();

        const start = performance.now();

        for (const parser of parsers) {
            if (cancelled) {
                throw new Error("canceled by user");
            }
            try {
                {
                    const fluxDispatcherModuleExport = parser.isFluxDispatcherModule();

                    if (fluxDispatcherModuleExport != null) {
                        if (parser.moduleId == null) {
                            throw new Error("Module ID is not set for module");
                        }
                        ret.fluxDispatcherClass.push([parser.moduleId, fluxDispatcherModuleExport]);

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

        const end = performance.now();

        outputChannel.debug(`[perf] Locating Key Modules took ${end - start}ms`);

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
