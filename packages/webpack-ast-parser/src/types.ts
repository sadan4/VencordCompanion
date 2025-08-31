import { IRange, Range } from "@vencord-companion/shared/Range";

import { ConstructorDeclaration, FunctionLikeDeclaration, Identifier, Node, PropertyAssignment } from "typescript";
export type ExportMap<T> = {
    [exportedName: string | symbol]: T[] | ExportMap<T>;
};

export type RawExportRange = Node[];

export type RawExportMap = ExportMap<Node>;

export type ExportRange = Range[];

// ranges of code that will count as references to this export
/**
 * the name of the export => array of ranges where it is defined, with the last one being the most specific
 */
export type RangeExportMap = ExportMap<Range>;

/**
 * {@link RangeExportMap}, but only has the first level of exports, and they are stored as nodes(most of the time)
 */
export type OLD_RawExportMap<T> = {
    [exposedName: string | symbol]: T;
};

export interface ModuleDep {
    /**
     * the modules that require this module synchronously
     */
    syncUses: string[];
    /**
     * the modules that require this module lazily
     */
    lazyUses: string[];
}

export interface IModuleDepManager {
    getModDeps(moduleId: string): ModuleDep;
}

export interface IModuleCache {
    /**
     * normally just query the client for the latest version of said module
     * 
     * Throw an error if the module is not found
     */
    getLatestModuleFromNum(id: string | number): Promise<string>;
    /**
     * throw if not found
     */
    getModuleFromNum(id: string): Promise<string>;
    getModuleFilepath(id: string): string | undefined;
}

/**
 * not to be confused with {@link ModuleDep}
 */
export interface ModuleDeps {
    lazy: string[];
    sync: string[];
}

export type Location = {
    locationType: "file_path";
    filePath: string;
} | {
    locationType: "inline";
    content: string;
};

export type MainDeps = Record<string, ModuleDep>;

export type Definition = Location & {
    range: IRange;
};

export type Reference = Location & {
    range: IRange;
};

export interface Store {
    fluxEvents: {
        [name: string]: Node[];
    };
    /**
     * the store itself
     * starts with the foo from `new foo(a, {b})`
     * 
     * then has the class name itself (most likely foo again)
     * 
     * ends with the constructor/initialize function (if any)
     */
    store: (Identifier | ConstructorDeclaration)[];
    methods: {
        [name: string]: FunctionLikeDeclaration;
    };
    props: {
        [name: string]: PropertyAssignment["initializer"];
    };
}
