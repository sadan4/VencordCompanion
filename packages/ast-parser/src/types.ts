import { ArrowFunction, FunctionExpression, FunctionLikeDeclaration, Identifier, ModuleExportName, Node } from "typescript";

export type Functionish = FunctionLikeDeclaration | ArrowFunction | FunctionExpression;
export type AnyFunction = FunctionExpression | ArrowFunction;

export type AssertedType<
    T extends Function,
    E = any,
> =
    T extends (a: any) => a is infer R ? R extends E ? R : never : never;

export type CBAssertion<U = undefined, N = never> = <
    F extends (n: Node) => n is Node,
    R extends Node = AssertedType<F, Node>,
>(
    node: Node | N,
    func: F extends (n: Node) => n is R ? F : never
) => R | U;

export type Import = {
    default: boolean;
    source: string;
    namespace: boolean;
    orig?: ModuleExportName;
    as: Identifier;
};

export type WithParent<N, P> = Omit<N, "parent"> & {
    parent: P;
};

