import { FunctionNode, IFindType, IReplacement, PatchData, RegexNode, StringNode } from "./types";

import { basename } from "path";

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
    NamedDeclaration,
    Node,
    ObjectLiteralExpression,
    parseJsonConfigFileContent,
    readConfigFile,
    sys,
    transpileModule,
} from "typescript";

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

export function parseReplace(filepath: string, node: Expression) {
    return tryParseStringLiteral(node) ?? tryParseFunction(filepath, node);
}

export function parseReplacement(filepath: string, patch: ObjectLiteralExpression): IReplacement[] | null {
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

        const replaceValue = parseReplace(filepath, replace.initializer);

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

export function parsePatch(filepath: string, patch: ObjectLiteralExpression): PatchData | null {
    const find = parseFind(patch);
    const replacement = parseReplacement(filepath, patch);

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

export function tryParseFunction(filepath: string, node: Node): FunctionNode | null {
    if (!isArrowFunction(node) && !isFunctionExpression(node))
        return null;

    const code = createPrinter()
        .printNode(EmitHint.Expression, node, node.getSourceFile());

    let compilerOptions: CompilerOptions = {};
    const tsConfigPath = findConfigFile(filepath, sys.fileExists);

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
