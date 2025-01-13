import { TestFind } from "@type/server";

import { Identifier, Node } from "typescript";
import { Definition, Location, LocationLink, Range } from "vscode";

export type FindUse = {
    range: Range;
    use: TestFind
};

export type Import = {
    default: boolean;
    source: string;
    from: string | {
        orig: Identifier;
        as: Identifier;
    }
};

export interface ExportMap {
    // ranges of code that will count as references to this export
    [exposedName: string]: (Range | undefined)[];
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

export type CBAssertion<U = undefined> = <
    F extends (n: Node) => n is Node,
    R extends Node = AssertedType<F, Node>,
>(
    node: Node,
    func: F extends (n: Node) => n is R ? F : never
) => R | U;

