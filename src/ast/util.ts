import { AnyFunction, AssertedType, CBAssertion, Functionish, FunctionNode, Import, RegexNode, StringNode, WithParent } from "@type/ast";
import { IFindType, IReplacement, PatchData } from "@type/server";

import { getNumberAndColumnFromPos } from "./lineUtil";

import { basename } from "path/posix";

import {
    Block,
    CompilerOptions,
    createPrinter,
    DefaultKeyword,
    EmitHint,
    Expression,
    findConfigFile,
    Identifier,
    ImportClause,
    isArrayLiteralExpression,
    isArrowFunction,
    isBlock,
    isFunctionExpression,
    isIdentifier,
    isImportClause,
    isImportDeclaration,
    isImportSpecifier,
    isNamespaceImport as _TS_isNamespaceImport,
    isObjectLiteralExpression,
    isPropertyAccessExpression,
    isPropertyAssignment,
    isRegularExpressionLiteral,
    isReturnStatement,
    isStringLiteral,
    isTemplateLiteralToken,
    NamedDeclaration,
    NamespaceImport,
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
    SyntaxList,
    sys,
    TemplateLiteralLikeNode,
    transpileModule,
} from "typescript";
import { Position, Range, TextDocument } from "vscode";

export * from "@ast/lineUtil";

export function parseFind(patch: ObjectLiteralExpression): IFindType | null {
    const find = patch.properties.find((p) => hasName(p, "find"));

    if (!find || !isPropertyAssignment(find))
        return null;
    if (!(isStringLiteral(find.initializer) || isRegularExpressionLiteral(find.initializer)))
        return null;

    return {
        findType: isStringLiteral(find.initializer) ? "string" : "regex",
        find: find.initializer.text,
    };
}

export function parseMatch(node: Expression) {
    return tryParseStringLiteral(node) ?? tryParseRegularExpressionLiteral(node);
}

export function parseReplace(document: TextDocument, node: Expression) {
    return tryParseStringLiteral(node) ?? tryParseFunction(document, node);
}

export function parseReplacement(document: TextDocument, patch: ObjectLiteralExpression): IReplacement[] | null {
    const replacementObj = patch.properties.find((p) => hasName(p, "replacement"));

    if (!replacementObj || !isPropertyAssignment(replacementObj))
        return null;

    const replacement = replacementObj.initializer;
    const replacements = isArrayLiteralExpression(replacement) ? replacement.elements : [replacement];

    if (!replacements.every(isObjectLiteralExpression))
        return null;

    const replacementValues = (replacements as ObjectLiteralExpression[]).map((r: ObjectLiteralExpression) => {
        const match = r.properties.find((p) => hasName(p, "match"));
        const replace = r.properties.find((p) => hasName(p, "replace"));

        if (!replace || !isPropertyAssignment(replace) || !match || !isPropertyAssignment(match))
            return null;

        const matchValue = parseMatch(match.initializer);

        if (!matchValue)
            return null;

        const replaceValue = parseReplace(document, replace.initializer);

        if (replaceValue == null)
            return null;

        return {
            match: matchValue,
            replace: replaceValue,
        };
    })
        .filter((x) => x != null);

    return replacementValues.length > 0 ? replacementValues : null;
}

export function parsePatch(document: TextDocument, patch: ObjectLiteralExpression): PatchData | null {
    const find = parseFind(patch);
    const replacement = parseReplacement(document, patch);

    if (!replacement || !find)
        return null;

    return {
        ...find,
        replacement,
    };
}


export function debounce<
    F extends (...args: any) => any,
>(func: F, delay = 300): (...args: Parameters<F>) => undefined {
    let timeout: NodeJS.Timeout;

    return function (...args: Parameters<F>): undefined {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), delay);
    };
}

export function debounceAsync<
    F extends (...args: any) => Promise<any>,
>(func: F, delay = 300): (...args: Parameters<F>) => void {
    // for some godforsaken reason it errors here if its let, but not a few lines up
    var timeout: NodeJS.Timeout;
    let running = false;

    return function (...args: Parameters<F>): undefined {
        if (running)
            return;
        running = true;
        clearTimeout(timeout);
        setTimeout(() => func(...args)
            .finally(() => void (running = false)), delay);
        return;
    };
}

/**
 * @param text the module text
 * @returns if the module text is a webpack module or an extracted find
 */
export function isWebpackModule(text: string) {
    return text.startsWith("// Webpack Module ")
      || text.substring(0, 100)
          .includes("//OPEN FULL MODULE:");
}


export function hasName(node: NamedDeclaration, name: string) {
    return node.name && isIdentifier(node.name) && node.name.text === name;
}

export function tryParseFunction(document: TextDocument, node: Node): FunctionNode | null {
    if (!isArrowFunction(node) && !isFunctionExpression(node))
        return null;

    const code = createPrinter()
        .printNode(EmitHint.Expression, node, node.getSourceFile());

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
        value: res.outputText,
    };
}

export function tryParseStringLiteral(node: Node): StringNode | null {
    if (!isStringLiteral(node))
        return null;

    return {
        type: "string",
        value: node.text,
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
            flags: m[2],
        },
    };
}


export const zeroRange = new Range(new Position(0, 0), new Position(0, 0));

export function isDefaultKeyword(n: Node): n is DefaultKeyword {
    return n.kind === SyntaxKind.DefaultKeyword;
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

export function isSyntaxList(node: Node): node is SyntaxList {
    return node.kind === SyntaxKind.SyntaxList;
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
    const lastStatment = func.statements.at(-1);

    if (
        !lastStatment
        || !isReturnStatement(lastStatment)
        || !lastStatment.expression
        || !isIdentifier(lastStatment.expression)
    )
        return undefined;

    return lastStatment.expression;
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

/**
 *  return a vscode.Range based of node.pos and node.end
 *  @param text the document that node is in
 */
export function makeRange(node: ReadonlyTextRange, text: string): Range {
    return new Range(makeLocation(node.pos, text), makeLocation(node.end, text));
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

export function isDefaultImport(x: Identifier): x is WithParent<typeof x, ImportClause> {
    return isImportClause(x.parent);
}

export function isNamespaceImport(x: Identifier): x is WithParent<typeof x, NamespaceImport> {
    return _TS_isNamespaceImport(x.parent);
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

export function isStringLiteralLikeOrTemplateLiteralFragmentOrRegexLiteral(node: Node):
    node is TemplateLiteralLikeNode | StringLiteral | RegularExpressionLiteral {
    if (isStringLiteral(node))
        return true;
    if (isTemplateLiteralToken(node))
        return true;
    if (isRegularExpressionLiteral(node))
        return true;
    return false;
}

const SYM_UNCACHED = Symbol("uncached");

/**
 * Caches the result of a function and provides an option to invalidate the cache.
 *
 * Only works on methods with no parameters
 *
 * @param invalidate An optional array of functions that a function to invalidate the cache will be pushed to.
 * @returns A decorator function that can be used to cache the result of a method.
 */
export function Cache(invalidate?: (() => void)[]) {
    type _<P extends () => any> = (...args: Parameters<P>) => ReturnType<P>;

    return function <
        P extends () => any,
    >(
        target: Object,
        propertyKey: string | symbol,
        descriptor: TypedPropertyDescriptor<_<P>>,
    ):
        TypedPropertyDescriptor<_<P>> | void {
        const sym = Symbol(`cache-${propertyKey.toString()}`);

        target[sym] = SYM_UNCACHED;

        type A = Parameters<P>;

        type R = ReturnType<P>;

        const orig = descriptor.value;

        if (typeof orig !== "function") {
            throw new Error("Not a function");
        }
        descriptor.value = function (...args: A): R {
            if (this[sym] === SYM_UNCACHED) {
                invalidate?.push(() => {
                    this[sym] = SYM_UNCACHED;
                });
                this[sym] = orig.apply(this, args);
            }
            return this[sym];
        };
    };
}
/**
 * Same thing as {@link Cache} but for getters.
 */
export function CacheGetter(invalidate?: (() => void)[]) {
    return function <T>(
        target: Object,
        propertyKey: string | symbol,
        descriptor: TypedPropertyDescriptor<T>,
    ):
        TypedPropertyDescriptor<T> | void {
        const sym = Symbol(`cache-${propertyKey.toString()}`);

        target[sym] = SYM_UNCACHED;

        const orig = descriptor?.get;

        if (typeof orig !== "function") {
            throw new Error("Not a getter");
        }
        descriptor.get = function (): T {
            if (this[sym] === SYM_UNCACHED) {
                invalidate?.push(() => {
                    this[sym] = SYM_UNCACHED;
                });
                this[sym] = orig.apply(this);
            }
            return this[sym];
        };
        return descriptor;
    };
}

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

export function TAssert<T>(thing: T): void {
    return void thing;
}


// TODO: add tests for this
export function allEntries<T extends object, K extends keyof T & (string | symbol)>(obj: T): (readonly [K, T[K]])[] {
    const SYM_NON_ENUMERABLE = Symbol("non-enumerable");
    const keys: (string | symbol)[] = Object.getOwnPropertyNames(obj);

    keys.push(...Object.getOwnPropertySymbols(obj));

    return keys.map((key) => {
        const descriptor = Object.getOwnPropertyDescriptor(obj, key);

        if (!descriptor)
            throw new Error("Descriptor is undefined");

        if (!descriptor.enumerable)
            return SYM_NON_ENUMERABLE;

        return [key as K, obj[key] as T[K]] as const;
    })
        .filter((x) => x !== SYM_NON_ENUMERABLE);
}
export function TypeAssert<T>(v: any): asserts v is T {
}
