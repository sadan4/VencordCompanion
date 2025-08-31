import { Range } from "@vencord-companion/shared/Range";
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
      /**
               * the find string
               */
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
/**
 * a parsed patch, as it appears in a source file
 */
export type SourcePatch = (PatchData & { range: Range;
    origIndex: number; });
export type FindUse = {
    range: Range;
    use: TestFind;
};

export type TestFind = {
    type: "testFind";
    data: FindData;
};
