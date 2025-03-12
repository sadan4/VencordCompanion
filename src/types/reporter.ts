export type ReplaceFn = (match: string, ...groups: string[]) => string;

export interface PatchReplacement {
    /** The match for the patch replacement. If you use a string it will be implicitly converted to a RegExp */
    match: string | RegExp;
    /** The replacement string or function which returns the string for the patch replacement */
    replace: string | ReplaceFn;
    /** A function which returns whether this patch replacement should be applied */
    predicate?(): boolean;
}


export interface Patch {
    plugin: string;
    /** A string or RegExp which is only include/matched in the module code you wish to patch. Prefer only using a RegExp if a simple string test is not enough */
    find: string | RegExp;
    /** The replacement(s) for the module being patched */
    replacement: PatchReplacement[];
    /** Whether this patch should apply to multiple modules */
    all?: boolean;
    /** Do not warn if this patch did no changes */
    noWarn?: boolean;
    /** Only apply this set of replacements if all of them succeed. Use this if your replacements depend on each other */
    group?: boolean;
    /** A function which returns whether this patch should be applied */
    predicate?(): boolean;
}

export type TypeWebpackSearchHistory = "find" | "findByProps" | "findByCode" | "findStore" | "findComponent" | "findComponentByCode" | "findExportedComponent" | "waitFor" | "waitForComponent" | "waitForStore" | "proxyLazyWebpack" | "LazyComponentWebpack" | "extractAndLoadChunks" | "mapMangledModule";

export interface EvaledPatch extends Patch {
    id: number | string;
}

export interface ReporterData {
    failedPatches: {
        foundNoModule: Patch[];
        hadNoEffect: EvaledPatch[];
        undoingPatchGroup: EvaledPatch[];
        erroredPatch: EvaledPatch[];
    };
    failedWebpack: Record<TypeWebpackSearchHistory, string[][]>;
}

export interface WebviewMessage {
    type: string;
    data: any;
}
