import { AnyFunction, AssertedType, CBAssertion, Functionish, Import, WithParent } from "./types";

import {
    Block,
    DefaultKeyword,
    forEachChild,
    Identifier,
    ImportClause,
    isBlock,
    isIdentifier,
    isImportClause,
    isImportDeclaration,
    isImportSpecifier,
    isNamespaceImport as _TS_isNamespaceImport,
    isPropertyAccessExpression,
    isReturnStatement,
    isTokenKind,
    NamespaceImport,
    Node,
    ObjectLiteralElementLike,
    ObjectLiteralExpression,
    PropertyAccessExpression,
    SourceFile,
    SyntaxKind,
    SyntaxList,
} from "typescript";

export const enum CharCode {
    /**
     * The `\n` character.
     */
    LineFeed = 10,
    /**
     * The `\r` character.
     */
    CarriageReturn = 13,
}

export function isEOL(char: number) {
    return char === CharCode.CarriageReturn || char === CharCode.LineFeed;
}

/**
 * given a function like this, returns the identifier for x
 * @example function(){
 * // any code here
 * return x;
 * }
 * @param func a function to get the return value of
 * @returns the return identifier, if any
 */
export function findReturnIdentifier(func: Functionish): Identifier | undefined {
    if (!func.body)
        return undefined;
    if (isBlock(func.body))
        return _findReturnIdentifier(func.body);
    if (isIdentifier(func.body))
        return func.body;
}

function _findReturnIdentifier(func: Block): Identifier | undefined {
    const lastStatement = func.statements.at(-1);

    if (
        !lastStatement
        || !isReturnStatement(lastStatement)
        || !lastStatement.expression
        || !isIdentifier(lastStatement.expression)
    )
        return undefined;

    return lastStatement.expression;
}

/**
 * given an object literal, returns the property assignment for `prop` if it exists
 *
 * if prop is defined more than once, returns the first
 * @example
 * {
 *  exProp: "examplePropValue"
 * }
 * @param prop exProp
 */
export function findObjectLiteralByKey(
    object: ObjectLiteralExpression,
    prop: string,
): ObjectLiteralElementLike | undefined {
    return object.properties.find((x) => x.name?.getText() === prop);
}

/**
 * first parent
 */
export const findParent: CBAssertion<undefined, undefined> = (node, func) => {
    if (!node)
        return undefined;
    while (!func(node)) {
        if (!node.parent)
            return undefined;
        node = node.parent;
    }
    return node;
};

// FIXME: try simplifying this
/**
 * @param node the node to start from
 * @param func a function to check if the parent matches
 */
export const lastParent: CBAssertion<undefined, undefined> = (node, func) => {
    if (!node)
        return undefined;
    if (!node.parent)
        return undefined;
    while (func(node.parent)) {
        if (!node.parent)
            break;
        node = node.parent;
    }
    return func(node) ? node : undefined;
};

export const lastChild: CBAssertion<undefined> = (node, func) => {
    if (!node)
        return undefined;

    const c = node.getChildren();

    if (c.length === 0) {
        if (func(node))
            return node;
        return undefined;
    }
    if (c.length === 1) {
        if (func(c[0]))
            return lastChild(c[0], func);
        if (func(node))
            return node;
        return undefined;
    }

    const x = one(c, func);

    if (x) {
        return lastChild(x, func);
    }
    if (func(node))
        return node;
    return undefined;
};

// FIXME: this seems really stupid
export function one<
    T,
    F extends (t: T) => t is T,
    R extends T = AssertedType<F, T>,
>(
    arr: readonly T[],
    func: F extends (t: T) => t is R ? F : never,
): R | undefined {
    const filter = arr.filter<R>(func);

    return (filter.length === 1 || undefined) && filter[0];
}

export function isDefaultImport(x: Identifier): x is WithParent<typeof x, ImportClause> {
    return isImportClause(x.parent);
}

/**
 * @param node any identifier in an import statment
 */
export function getImportName(node: Identifier): Pick<Import, "orig" | "as"> {
    // default or namespace
    if (isDefaultImport(node) || isNamespaceImport(node))
        return { as: node };

    const specifier = findParent(node, isImportSpecifier);

    if (!specifier)
        throw new Error("x is not in an import statment");
    return {
        orig: specifier.propertyName,
        as: specifier.name,
    };
}

// i fucking hate jsdoc
/**
 * given an access chain like `one.b.three.d` \@*returns* — `[one?, b?]`
 *
 * if b is returned, one is gaurenteed to be defined
 * @param node any node in the property access chain
 */
export function getLeadingIdentifier(node: Node | undefined):
  readonly [Identifier, undefined]
  | readonly [Identifier, Identifier]
  | readonly [undefined, undefined] {
    if (!node)
        return [node, undefined];

    const { expression: module, name: wpExport } = (() => {
        const lastP = lastParent(node, isPropertyAccessExpression);

        return lastP && lastChild(lastP, isPropertyAccessExpression);
    })() ?? {};

    if (!module || !isIdentifier(module))
        return [undefined, undefined];
    return [
        module,
        wpExport ? isIdentifier(wpExport) ? wpExport : undefined : undefined,
    ];
}

export function isInImportStatment(x: Node): boolean {
    return findParent(x, isImportDeclaration) != null;
}

/**
 * @param x an identifier in the import statment, not just any imported identifier
 * @returns the source of the import statment
 * @example
 * ```
 * import { x } from "source"
 * ```
 * @returns "source"
 */
export function getImportSource(x: Identifier): string {
    const clause = findParent(x, isImportDeclaration);

    if (!clause)
        throw new Error("x is not in an import statment");
    // getText returns with quotes, but the prop text does not have them ????
    return clause.moduleSpecifier.getText()
        .slice(1, -1);
}

export function isNamespaceImport(x: Identifier): x is WithParent<typeof x, NamespaceImport> {
    return _TS_isNamespaceImport(x.parent);
}

export function isDefaultKeyword(n: Node): n is DefaultKeyword {
    return n.kind === SyntaxKind.DefaultKeyword;
}


export function isSyntaxList(node: Node): node is SyntaxList {
    return node.kind === SyntaxKind.SyntaxList;
}

/**
 * given a function like
 * ```ts
 * function myFunc() {
 * // any code here
 * return a.b; // can be anything else, eg a.b.c a.b[anything]
 * }
 * ```
 * @returns the returned property access expression, if any
 **/
export function findReturnPropertyAccessExpression(func: AnyFunction): PropertyAccessExpression | undefined {
    if (isBlock(func.body))
        return _findReturnPropertyAccessExpression(func.body);
    if (isPropertyAccessExpression(func.body))
        return func.body;
}

function _findReturnPropertyAccessExpression(func: Block): PropertyAccessExpression | undefined {
    const lastStatment = func.statements.at(-1);

    if (
        !lastStatment
        || !isReturnStatement(lastStatment)
        || !lastStatment.expression
        || !isPropertyAccessExpression(lastStatment.expression)
    )
        return undefined;

    return lastStatment.expression;
}

/* !
 * taken from tsutils, license below
 * The MIT License (MIT)
 * 
 * Copyright (c) 2017 Klaus Meinhardt
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

export function getTokenAtPosition(
    parent: Node,
    pos: number,
    sourceFile?: SourceFile,
    allowJsDoc?: boolean,
): Node | undefined {
    if (pos < parent.pos || pos >= parent.end) {
        return;
    }
    if (isTokenKind(parent.kind)) {
        return parent;
    }
    return _getTokenAtPosition(parent, pos, sourceFile ?? parent.getSourceFile(), allowJsDoc === true);
}

function _getTokenAtPosition(node: Node, pos: number, sourceFile: SourceFile, allowJsDoc: boolean): Node | undefined {
    if (!allowJsDoc) {
        // if we are not interested in JSDoc, we can skip to the deepest AST node at the given position
        node = getAstNodeAtPosition(node, pos)!;
        if (isTokenKind(node.kind)) {
            return node;
        }
    }
    outer: while (true) {
        for (const child of node.getChildren()) {
            if (child.end > pos && (allowJsDoc || child.kind !== SyntaxKind.JSDoc)) {
                if (isTokenKind(child.kind)) {
                    return child;
                }
                node = child;
                continue outer;
            }
        }
        return;
    }
}

/** Returns the deepest AST Node at `pos`. Returns undefined if `pos` is outside of the range of `node` */
export function getAstNodeAtPosition(node: Node, pos: number): Node | undefined {
    if (node.pos > pos || node.end <= pos) {
        return;
    }
    while (isNodeKind(node.kind)) {
        const nested = forEachChild(node, (child) => (child.pos <= pos && child.end > pos ? child : undefined));

        if (nested === undefined) {
            break;
        }
        node = nested;
    }
    return node;
}

/**
 * stolen form tsutils, seems sketchy
 */
function isNodeKind(kind: SyntaxKind) {
    return kind >= SyntaxKind.FirstNode;
}
