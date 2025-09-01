import { FunctionNode, RegexNode, StringNode } from "./types";

import { basename } from "path";

import {
    CompilerOptions,
    createPrinter,
    EmitHint,
    findConfigFile,
    isArrowFunction,
    isFunctionExpression,
    isRegularExpressionLiteral,
    isStringLiteral,
    Node,
    parseJsonConfigFileContent,
    readConfigFile,
    sys,
    transpileModule,
} from "typescript";


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
export function tryParseFunction(path: string, node: Node): FunctionNode | null {
    if (!isArrowFunction(node) && !isFunctionExpression(node))
        return null;

    const code = createPrinter()
        .printNode(EmitHint.Expression, node, node.getSourceFile());

    let compilerOptions: CompilerOptions = {};
    const tsConfigPath = findConfigFile(path, sys.fileExists);

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
