import { FunctionNode, RegexNode, StringNode } from "@type/ast";
import { IFindType, IReplacement, PatchData } from "@type/server";

import { getNumberAndColumnFromPos } from "./lineUtil";

import { basename } from "path/posix";

import {
    CompilerOptions,
    createPrinter,
    EmitHint,
    Expression,
    findConfigFile,
    isArrayLiteralExpression,
    isArrowFunction,
    isFunctionExpression,
    isIdentifier,
    isObjectLiteralExpression,
    isPropertyAssignment,
    isRegularExpressionLiteral,
    isStringLiteral,
    isTemplateLiteralToken,
    NamedDeclaration,
    Node,
    ObjectLiteralExpression,
    parseJsonConfigFileContent,
    readConfigFile,
    ReadonlyTextRange,
    RegularExpressionLiteral,
    StringLiteral,
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
