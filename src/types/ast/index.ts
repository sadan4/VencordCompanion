import { PatchData, TestFind } from "@type/server";

import {
    ArrowFunction,
    ConstructorDeclaration,
    FunctionExpression,
    FunctionLikeDeclaration,
    Identifier,
    ModuleExportName,
    Node,
    PropertyAssignment,
} from "typescript";
import { Definition, Location, LocationLink, Range } from "vscode";

export type AnyFunction = FunctionExpression | ArrowFunction;

export type WithParent<N, P> = Omit<N, "parent"> & {
    parent: P;
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

export type Import = {
    default: boolean;
    source: string;
    namespace: boolean;
    orig?: ModuleExportName;
    as: Identifier;
};

export type ExportRange = (Range | undefined)[];

export interface ExportMap {
    // ranges of code that will count as references to this export
    /**
     * the name of the export => array of ranges where it is defined, with the last one being the most specific
     */
    [exposedName: string | symbol]: ExportRange | ExportMap;
}

/**
 * {@link ExportMap}, but only has the first level of exports, and they are stored as nodes(most of the time)
 */
export interface RawExportMap<T> {
    [exposedName: string | symbol]: T;
}

export interface ModuleDeps {
    lazy: string[];
    sync: string[];
}

export type References = Promise<Location[] | null | undefined>;

export type Definitions = Promise<
    Definition | LocationLink[] | null | undefined
>;
export interface FunctionNode {
    type: "function";
    value: string;
}
export interface RegexNode {
    type: "regex";
    value: {
        pattern: string;
        flags: string;
    };
}
// FIXME: properly type this, use keyed types
export interface StringNode {
    type: "string";
    value: string;
}
export type AssertedType<T extends Function, E = any> = T extends (
    a: any
) => a is infer R ? R extends E ? R : never : never;

export type CBAssertion<U = undefined, N = never> = <
    F extends (n: Node) => n is Node,
    R extends Node = AssertedType<F, Node>,
>(
    node: Node | N,
    func: F extends (n: Node) => n is R ? F : never
) => R | U;

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
export type Functionish = FunctionLikeDeclaration | ArrowFunction | FunctionExpression;
