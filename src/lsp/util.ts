import {
    collectVariableUsage,
    isSyntaxList,
    VariableInfo,
    VariableUse,
} from "tsutils";
import {
    FunctionExpression,
    Identifier,
    isBinaryExpression,
    isCallExpression,
    isExpressionStatement,
    isFunctionExpression,
    isIdentifier,
    isNumericLiteral,
    isPropertyAccessExpression,
    isReturnStatement,
    isVariableDeclaration,
    Node,
    ObjectLiteralExpression,
    PropertyAccessExpression,
    PropertyAssignment,
    SourceFile,
    SyntaxKind,
    transform,
    VariableDeclaration,
} from "typescript";
import * as vscode from "vscode";

import { getNumberAndColumnFromPos } from "./lineUtil";

export const zeroRange = new vscode.Range(
    new vscode.Position(0, 0),
    new vscode.Position(0, 0)
);

export function findParrent<T extends Node | undefined = Node>(
    node: Node,
    func: ((node: Node) => boolean)
): T | undefined {
    while (!func(node)) {
        if (!node.parent) return undefined;
        node = node.parent;
    }
    return node as T;
}

type NodeFunc = (node: Node) => boolean;

/**
 * @param node the node to start from
 * @param func a function to check if the parrent matches
 */
export function lastParrent<T extends Node = Node>(
    node: Node,
    func: NodeFunc
): T | undefined {
    if (!node.parent) return undefined;
    while (func(node.parent)) {
        if (!node.parent) return node as T;
        node = node.parent;
    }
    return node as T;
}

export function lastChild<T extends Node = Node>(
    node: Node | undefined,
    func: NodeFunc
): T | undefined {
    if (!node) return undefined;
    const c = node.getChildren();
    if (c.length === 0) {
        if (func(node)) return node as T;
        return undefined;
    }
    if (c.length === 1) {
        if (func(c[0])) return lastChild(c[0], func);
        if (func(node)) return node as T;
        return undefined;
    }
    const x = one(c, func);
    if (x) {
        return lastChild(x, func);
    }
    if (func(node)) return node as T;
    return undefined;
}
// FIXME: this seems really stupid
function one<T>(arr: Array<T>, func: (t: T) => boolean): T | undefined {
    const filter = arr.filter(func);
    return (filter.length === 1 || undefined) && filter[0];
}
// i fucking hate jsdoc
// FIXME: type the return for this
/**
 * given an access chain like `one.b.three.d` \@*returns* — `[one?, b?]`
 *
 * if b is returned, one is gaurenteed to be defined
 * @param node any node in the property access chain
 */
export function getLeadingIdentifier(
    node: Node | undefined
): [Identifier | undefined, Identifier | undefined] {
    if (!node) return [node, undefined];
    const { expression: module, name: wpExport } =
        lastChild<PropertyAccessExpression>(
            lastParrent(node, isPropertyAccessExpression),
            isPropertyAccessExpression
        ) ?? {};
    if (!module || !isIdentifier(module)) return [undefined, undefined];
    return [
        module,
        wpExport ? (isIdentifier(wpExport) ? wpExport : undefined) : undefined,
    ];
}

/**
 * @param node finds a webpack arg from the source tree
 * @param paramIndex the index of the param 0, 1, 2 etc...
 * @returns the indenfiier of the param if found or undef
 */
export function findWebpackArg(
    node: Node,
    paramIndex = 2
): Identifier | undefined {
    for (const n of node.getChildren()) {
        if (isSyntaxList(n) || isExpressionStatement(n) || isBinaryExpression(n))
            return findWebpackArg(n, paramIndex);
        if (isFunctionExpression(n)) {
            if (n.parameters.length > 3 || n.parameters.length < paramIndex + 1)
                return;
            const p = n.parameters[paramIndex].name;
            if (!p) return;
            if (!isIdentifier(p)) return;
            return p;
        }
    }
}

export function getModuleId(
    dec: VariableInfo | undefined,
    wpExport: Identifier | undefined
): undefined | number {
    if (!dec) return undefined;
    if (dec.declarations.length !== 1) return undefined;
    const init = findParrent<VariableDeclaration>(
        dec.declarations[0],
        isVariableDeclaration
    )?.initializer;
    if (!init || !isCallExpression(init)) return undefined;
    if (init.arguments.length !== 1 || !isNumericLiteral(init.arguments[0]))
        return undefined;
    const num = +init.arguments[0].text;
    // window.showInformationMessage(`${num}\n${wpExport?.text || "No export found"}`);
    return num;
}

export type Definitions = vscode.ProviderResult<
    vscode.Definition | vscode.DefinitionLink[]
>;

export function findExportLocation(
    exportFile: SourceFile,
    wpExportName: string
): vscode.Range | undefined {
    const vars = collectVariableUsage(exportFile);
    const wreq = findWebpackArg(exportFile);
    if (!wreq) {
        console.error(new Error("could not find wreq"));
        return;
    }
    console.log(vars.get(wreq));
    return;
}


/**
 * given an object literal, returns the property assignment for `prop` if it exsists
 *
 * if prop is defined more than once, returns the first
 * @example
 * {
 *  exprop: "examplePropValue"
 * }
 * @param prop exprop
 */
export function findObjectLiteralByKey(
    object: ObjectLiteralExpression,
    prop: string
) {
    return object.properties.find(x => x.name?.getText() === prop);
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
export function findReturnIdentifier(
    func: FunctionExpression
): Identifier | undefined {
    const lastStatment = func.body.statements.at(-1);

    if (
        !lastStatment ||
        !isReturnStatement(lastStatment) ||
        !lastStatment.expression ||
        !isIdentifier(lastStatment.expression)
    )
        return undefined;

    return lastStatment.expression;
}

export function findReturnPropertyAccessExpression(func: FunctionExpression): PropertyAccessExpression | undefined {
    const lastStatment = func.body.statements.at(-1);

    if (
        !lastStatment ||
        !isReturnStatement(lastStatment) ||
        !lastStatment.expression ||
        !isPropertyAccessExpression(lastStatment.expression)
    ) return undefined;

    return lastStatment.expression;
}
/**
 *  return a vscode.Range based of node.pos and node.end
 *  @param text the document that node is in
 */
export function makeRange(node: Node, text: string): vscode.Range {
    return new vscode.Range(
        makeLocation(node.pos, text),
        makeLocation(node.end, text)
    );
}

/**
 *  returns a vscode.Position based of pos
 *  @param pos absolute offset
 *  @param text the document to take the offset from
 */
export function makeLocation(pos: number, text: string): vscode.Position {
    const loc = getNumberAndColumnFromPos(text, pos);
    return new vscode.Position(loc.lineNumber - 1, loc.column - 1);
}
