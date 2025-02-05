import { AnyFunction, AssertedType, CBAssertion, FunctionNode, Import, RegexNode, StringNode } from "@type/ast";
import { IFindType, IReplacement, PatchData } from "@type/server";

import { getNumberAndColumnFromPos } from "./lineUtil";

import { basename } from "path/posix";

import {
    isSyntaxList,
    VariableInfo,
} from "tsutils";
import {
    Block,
    CompilerOptions,
    createPrinter,
    DefaultKeyword,
    EmitHint,
    Expression,
    findConfigFile,
    Identifier,
    isArrayLiteralExpression,
    isArrowFunction,
    isBinaryExpression,
    isBlock,
    isCallExpression,
    isExpressionStatement,
    isFunctionExpression,
    isIdentifier,
    isImportClause,
    isImportDeclaration,
    isImportSpecifier,
    isNumericLiteral,
    isObjectLiteralExpression,
    isPropertyAccessExpression,
    isPropertyAssignment,
    isRegularExpressionLiteral,
    isReturnStatement,
    isStringLiteral,
    isTemplateLiteralToken,
    isVariableDeclaration,
    NamedDeclaration,
    Node,
    ObjectLiteralElementLike,
    ObjectLiteralExpression,
    parseJsonConfigFileContent,
    PropertyAccessExpression,
    readConfigFile,
    ReadonlyTextRange,
    RegularExpressionLiteral,
    StringLiteral,
    SyntaxKind,
    sys,
    TemplateLiteralLikeNode,
    transpileModule,
} from "typescript";
import { Position, Range, TextDocument } from "vscode";

function parseFind(patch: ObjectLiteralExpression): IFindType | null {
    const find = patch.properties.find(p => hasName(p, "find"));
    if (!find || !isPropertyAssignment(find)) return null;
    if (!(isStringLiteral(find.initializer) || isRegularExpressionLiteral(find.initializer))) return null;

    return {
        findType: isStringLiteral(find.initializer) ? "string" : "regex",
        find: find.initializer.text
    };
}

function parseMatch(node: Expression) {
    return tryParseStringLiteral(node) ?? tryParseRegularExpressionLiteral(node);
}

function parseReplace(document: TextDocument, node: Expression) {
    return tryParseStringLiteral(node) ?? tryParseFunction(document, node);
}

function parseReplacement(document: TextDocument, patch: ObjectLiteralExpression): IReplacement[] | null {
    const replacementObj = patch.properties.find(p => hasName(p, "replacement"));

    if (!replacementObj || !isPropertyAssignment(replacementObj)) return null;

    const replacement = replacementObj.initializer;

    const replacements = isArrayLiteralExpression(replacement) ? replacement.elements : [replacement];
    if (!replacements.every(isObjectLiteralExpression)) return null;

    const replacementValues = (replacements as ObjectLiteralExpression[]).map((r: ObjectLiteralExpression) => {
        const match = r.properties.find(p => hasName(p, "match"));
        const replace = r.properties.find(p => hasName(p, "replace"));

        if (!replace || !isPropertyAssignment(replace) || !match || !isPropertyAssignment(match)) return null;

        const matchValue = parseMatch(match.initializer);
        if (!matchValue) return null;

        const replaceValue = parseReplace(document, replace.initializer);
        if (replaceValue == null) return null;

        return {
            match: matchValue,
            replace: replaceValue
        };
    }).filter(isNotNull);

    return replacementValues.length > 0 ? replacementValues : null;
}

export function parsePatch(document: TextDocument, patch: ObjectLiteralExpression): PatchData | null {
    const find = parseFind(patch);
    const replacement = parseReplacement(document, patch);

    if (!replacement || !find) return null;

    return {
        ...find,
        replacement
    };
}

export * from "@ast/lineUtil";

export function debounce<F extends (...args: any) => any>(func: F, delay = 300): (...args: Parameters<F>) => undefined {
    let timeout: NodeJS.Timeout;
    return function (...args: Parameters<F>): undefined {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), delay);
    };
}

export function debounceAsync<F extends (...args: any) => Promise<any>>(func: F, delay = 300): (...args: Parameters<F>) => void {
    // for some godforsaken reason it errors here if its let, but not a few lines up
    var timeout: NodeJS.Timeout;
    let running = false;
    return function (...args: Parameters<F>): undefined {
        if (running) return;
        running = true;
        clearTimeout(timeout);
        setTimeout(() => func(...args).finally(() => running = false), delay);
        return;
    };
}

export function isWebpackModule(text: string | TextDocument | { document: TextDocument; }) {
    if (typeof text === "string") void 0;
    else if ("document" in text) text = text.document.getText();
    else text = text.getText();

    return text.startsWith("//WebpackModule") || text.substring(0, 100).includes("//OPEN FULL MODULE:");
}


export function hasName(node: NamedDeclaration, name: string) {
    return node.name && isIdentifier(node.name) && node.name.text === name;
}

export function isNotNull<T>(value: T): value is Exclude<T, null | undefined> {
    return value != null;
}

export function tryParseFunction(document: TextDocument, node: Node): FunctionNode | null {
    if (!isArrowFunction(node) && !isFunctionExpression(node))
        return null;

    const code = createPrinter().printNode(EmitHint.Expression, node, node.getSourceFile());

    let compilerOptions: CompilerOptions = {};

    const tsConfigPath = findConfigFile(document.fileName, sys.fileExists);
    if (tsConfigPath) {
        const configFile = readConfigFile(tsConfigPath, sys.readFile);
        compilerOptions = parseJsonConfigFileContent(configFile.config, sys, basename(tsConfigPath)).options;
    }

    const res = transpileModule(code, { compilerOptions });
    if (res.diagnostics && res.diagnostics.length > 0)
        return null;

    return {
        type: "function",
        value: res.outputText
    };
}

export function tryParseStringLiteral(node: Node): StringNode | null {
    if (!isStringLiteral(node)) return null;

    return {
        type: "string",
        value: node.text
    };
}

export function tryParseRegularExpressionLiteral(node: Node): RegexNode | null {
    if (!isRegularExpressionLiteral(node))
        return null;

    const m = node.text.match(/^\/(.+)\/(.*?)$/);
    return m && {
        type: "regex",
        value: {
            pattern: m[1],
            flags: m[2]
        }
    };
}


export const zeroRange = new Range(
    new Position(0, 0),
    new Position(0, 0)
);

export function isDefaultKeyword(n: Node): n is DefaultKeyword {
    return n.kind === SyntaxKind.DefaultKeyword;
}

/**
 * first parent
 */
export const findParrent: CBAssertion = (node, func) => {
    while (!func(node)) {
        if (!node.parent) return undefined;
        node = node.parent;
    }
    return node;
};

// FIXME: try simplifying this
/**
 * @param node the node to start from
 * @param func a function to check if the parrent matches
 */
export const lastParrent: CBAssertion = (node, func) => {
    if (!node.parent) return undefined;
    while (func(node.parent)) {
        if (!node.parent) break;
        node = node.parent;
    }
    return func(node) ? node : undefined;
};

export const lastChild: CBAssertion<undefined> = (node, func) => {
    if (!node) return undefined;
    const c = node.getChildren();
    if (c.length === 0) {
        if (func(node)) return node;
        return undefined;
    }
    if (c.length === 1) {
        if (func(c[0])) return lastChild(c[0], func);
        if (func(node)) return node;
        return undefined;
    }
    const x = one(c, func);
    if (x) {
        return lastChild(x, func);
    }
    if (func(node)) return node;
    return undefined;
};

// FIXME: this seems really stupid
function one<T, F extends (t: T) => t is T, R extends T = AssertedType<F, T>>(
    arr: readonly T[],
    func: F extends (t: T) => t is R ? F : never
): R | undefined {
    const filter = arr.filter<R>(func);
    return (filter.length === 1 || undefined) && filter[0];
}

// i fucking hate jsdoc
/**
 * given an access chain like `one.b.three.d` \@*returns* — `[one?, b?]`
 *
 * if b is returned, one is gaurenteed to be defined
 * @param node any node in the property access chain
 */
export function getLeadingIdentifier(
    node: Node | undefined
): readonly [Identifier, undefined] | readonly [Identifier, Identifier] | readonly [undefined, undefined] {
    if (!node) return [node, undefined];
    const { expression: module, name: wpExport } = (() => {
        const lastP = lastParrent(node, isPropertyAccessExpression);
        return (lastP && lastChild(lastP, isPropertyAccessExpression));
    })() ?? {};
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

export function getModuleId(dec: VariableInfo | undefined): number | undefined {
    if (!dec) return undefined;
    if (dec.declarations.length !== 1) return undefined;
    const init = findParrent(
        dec.declarations[0],
        isVariableDeclaration
    )?.initializer;
    if (!init || !isCallExpression(init)) return undefined;
    if (init.arguments.length !== 1 || !isNumericLiteral(init.arguments[0]))
        return undefined;
    const num = +init.arguments[0].text;
    return num;
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
): ObjectLiteralElementLike | undefined {
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
    func: AnyFunction
): Identifier | undefined {
    if(isBlock(func.body)) return _findReturnIdentifier(func.body);
    if(isIdentifier(func.body)) return func.body;
}
function _findReturnIdentifier(
    func: Block
): Identifier | undefined {
    const lastStatment = func.statements.at(-1);

    if (
        !lastStatment ||
        !isReturnStatement(lastStatment) ||
        !lastStatment.expression ||
        !isIdentifier(lastStatment.expression)
    )
        return undefined;

    return lastStatment.expression;
}

export function findReturnPropertyAccessExpression(func: AnyFunction): PropertyAccessExpression | undefined {
    if(isBlock(func.body)) return _findReturnPropertyAccessExpression(func.body);
    if(isPropertyAccessExpression(func.body)) return func.body;
}

export function _findReturnPropertyAccessExpression(func: Block): PropertyAccessExpression | undefined {
    const lastStatment = func.statements.at(-1);

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
export function makeRange(node: ReadonlyTextRange, text: string): Range {
    return new Range(
        makeLocation(node.pos, text),
        makeLocation(node.end, text)
    );
}

/**
 *  returns a vscode.Position based of pos
 *  @param pos absolute offset
 *  @param text the document to take the offset from
 */
export function makeLocation(pos: number, text: string): Position {
    const loc = getNumberAndColumnFromPos(text, pos);
    return new Position(loc.lineNumber - 1, loc.column - 1);
}

export function isInImportStatment(x: Node): boolean {
    return findParrent(x, isImportDeclaration) != null;
}

export function getImportSource(x: Identifier): string {
    const clause = findParrent(x, isImportDeclaration);
    if (!clause) throw new Error("x is not in an import statment");
    // getText returns with quotes, but the prop text does not have them ????
    return clause.moduleSpecifier.getText().slice(1, -1);
}

export function isDefaultImport(x: Identifier): boolean {
    return isImportClause(x.parent);
}

export function getImportName(x: Identifier): Pick<Import, "orig" | "as"> {
    if (isImportClause(x.parent)) return { as: x };
    const specifier = findParrent(x, isImportSpecifier);
    if (!specifier) throw new Error("x is not in an import statment");
    return {
        orig: specifier.propertyName,
        as: specifier.name
    };
}

export function isStringLiteralLikeOrTemplateLiteralFragmentOrRegexLiteral(node: Node): node is TemplateLiteralLikeNode | StringLiteral | RegularExpressionLiteral {
    if(isStringLiteral(node)) return true;
    if (isTemplateLiteralToken(node)) return true;
    if (isRegularExpressionLiteral(node)) return true;
    return false;
}
