// should be the same types as ./src/plugins/devCompanion.dev/types/recieve.ts in vencord
export type SearchData =
    | {
        extractType: "id";
        idOrSearch: number;
    }
    | (
        | {
            extractType: "search";
            /**
             * stringified regex
             */
            idOrSearch: string;
            findType: "regex";
        }
        | {
            extractType: "search";
            idOrSearch: string;
            findType: "string";
        }
    );

export type FindOrSearchData =
    | SearchData
    | ({
        extractType: "find";
    } & _PrefixKeys<_CapitalizeKeys<FindData>, "find">);

export type AnyFindType =
    `find${"Component" | "ByProps" | "Store" | "ByCode" | "ModuleId" | "ComponentByCode" | ""}${"Lazy" | ""}`;

export type StringNode = {
    type: "string";
    value: string;
};

export type RegexNode = {
    type: "regex";
    value: {
        pattern: string;
        flags: string;
    };
};

export type FunctionNode = {
    type: "function";
    value: string;
};

export type FindNode = StringNode | RegexNode | FunctionNode;

export type FindData = {
    type: AnyFindType;
    args: FindNode[];
};
export type IReplacement = {
    match: StringNode | RegexNode;
    replace: StringNode | FunctionNode;
};
export type IFindType = (
    | {
        findType: "string";
        find: string;
    }
    | {
        findType: "regex";
        /**
         * stringified regex
         */
        find: string;
    }
);
export type PatchData = IFindType & {
    replacement: IReplacement[];
};
export type DisablePluginData = {
    enabled: boolean;
    pluginName: string;
};

export type OutgoingMessage = DisablePlugin | RawId | DiffPatch | Reload | ExtractModule | TestPatch | TestFind | AllModules;
export type FullOutgoingMessage = OutgoingMessage & { nonce: number; };
// #region valid payloads
export type DisablePlugin = {
    type: "disable";
    data: DisablePluginData;
};

export type RawId = {
    type: "rawId";
    data: {
        id: number;
    };
};

export type DiffPatch = {
    type: "diff";
    data: SearchData;
};

export type Reload = {
    type: "reload";
    data: null;
};

export type ExtractModule = {
    type: "extract";
    // FIXME: update client code so you can just pass FindData here
    data: FindOrSearchData;
};

export type TestPatch = {
    type: "testPatch";
    data: PatchData;
};

export type TestFind = {
    type: "testFind";
    data: FindData;
};

export type AllModules = {
    type: "allModules";
    data: null;
};
// #endregion

type _PrefixKeys<
    T extends Record<string, any>,
    P extends string,
> = string extends P
    ? never
    : {
        [K in keyof T as K extends string ? `${P}${K}` : never]: T[K];
    };

type _CapitalizeKeys<T extends Record<string, any>> = {
    [K in keyof T as K extends string ? Capitalize<K> : never]: T[K];
};
