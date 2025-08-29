import { Definition, Location, LocationLink } from "vscode";


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


export interface ReExport {
    /**
     * `1` in
     * ```js
     * var foo = wreq(1);
     * // ...
     * ```
     */
    fromModule: string;
    /**
     * the `foo` in
     * ```js
     * var foo = wreq(1);
     * foo.bar.baz.qux();
     * ```
     */
    importedName: string;
    /**
     * the `bar` in
     * ```js
     * var foo = wreq(1);
     * foo.bar.baz.qux();
     * ```
     */
    usedExport: string;
    /**
     * [`baz`, `qux`] in
     * ```js
     * var foo = wreq(1);
     * foo.bar.baz.qux();
     * ```
     * `undefined` in
     * ```js
     * var foo = wreq(2);
     * foo.bar();
     * ```
     */
    chain: string[] | undefined;
}

export interface FluxEvents {
    name: string;
    params?: [string, string | null][];
}
