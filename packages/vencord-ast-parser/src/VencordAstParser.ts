import {
    AstParser,
    findObjectLiteralByKey,
    findParent,
    getImportName,
    getImportSource,
    Import,
    isDefaultImport,
    isInImportStatment,
    WithParent,
} from "@vencord-companion/ast-parser";
import { Cache, CacheGetter } from "@vencord-companion/shared/decorators";
import { Logger, NoopLogger } from "@vencord-companion/shared/Logger";

import { FindUse, FunctionNode, IFindType, IReplacement, PatchData, SourcePatch, StringNode, TestFind } from "./types";
import { tryParseRegularExpressionLiteral } from "./util";

import { readFile } from "node:fs/promises";
import { DeclarationDomain } from "ts-api-utils";
import {
    CallExpression,
    createPrinter,
    EmitHint,
    Expression,
    Identifier,
    isArrayLiteralExpression,
    isArrowFunction,
    isCallExpression,
    isFunctionExpression,
    isNamespaceImport,
    isObjectLiteralExpression,
    isPropertyAssignment,
    isRegularExpressionLiteral,
    isStringLiteral,
    isStringLiteralLike,
    isTemplateExpression,
    isVariableDeclaration,
    Node,
    ObjectLiteralExpression,
    ScriptTarget,
    transpileModule,
} from "typescript";


let logger: Logger = NoopLogger;

export function setLogger(newLogger: Logger) {
    logger = newLogger;
}

export class VencordAstParser extends AstParser {
    private readonly _path: string;

    public get path(): string {
        return this._path;
    }

    @CacheGetter()
    public get imports(): Map<Identifier, Import> {
        return this.listImports();
    }

    constructor(content: string, path: string) {
        super(content);
        this._path = path;
    }

    public static async fromPath(path: string) {
        return new VencordAstParser(await readFile(path, "utf-8"), path);
    }

    @Cache()
    private findDefinePlugin(): ObjectLiteralExpression | undefined {
        const define = [...this.imports.values()].find((x) => {
            if (!x.default)
                return;
            if (x.source !== "@utils/types")
                return;
            return true;
        });

        if (!define)
            return;

        const uses = this.vars.get(define.as)?.uses;

        if (!uses)
            return;

        const definePlugin = uses.find(({ location }) => {
            if (!isCallExpression(location.parent))
                return;
            return location.parent.arguments.length === 1 && isObjectLiteralExpression(location.parent.arguments[0]);
        });

        return (definePlugin?.location.parent as CallExpression).arguments[0] as ObjectLiteralExpression;
    }

    // TODO: work on files in the plugin folder but not the root plugin file
    public getPluginName(): string | null {
        const definePlugin = this.findDefinePlugin();

        if (!definePlugin)
            return null;

        const nameProp = findObjectLiteralByKey(definePlugin, "name");

        if (!nameProp || !isPropertyAssignment(nameProp) || !isStringLiteral(nameProp.initializer))
            return null;
        return nameProp.initializer.text;
    }

    @Cache()
    public getPatches(): SourcePatch[] {
        const definePlugin = this.findDefinePlugin();

        if (!definePlugin)
            return [];

        const patchesProp = findObjectLiteralByKey(definePlugin, "patches");

        if (!patchesProp || !isPropertyAssignment(patchesProp) || !isArrayLiteralExpression(patchesProp.initializer))
            return [];
        return patchesProp.initializer.elements
            .map((x, origIndex) => {
                if (!isObjectLiteralExpression(x))
                    return null;

                const res = this.parsePatch(x);

                if (!res)
                    return null;
                return {
                    ...res,
                    range: this.makeRangeFromAstNode(x.getChildAt(1)),
                    origIndex,
                };
            })
            .filter((x) => x !== null);
    }

    parseFind(patch: ObjectLiteralExpression): IFindType | null {
        const find = findObjectLiteralByKey(patch, "find");

        if (!find || !isPropertyAssignment(find))
            return null;
        if (!(isStringLiteral(find.initializer) || isRegularExpressionLiteral(find.initializer)))
            return null;

        return {
            findType: isStringLiteral(find.initializer) ? "string" : "regex",
            find: find.initializer.text,
        };
    }

    /**
     * Try to parse a string literal
     *
     * if it is a template literal, attempt to extract the string content by inlining variables
     */
    tryParseStringLiteral(node: Node): string | null {
        tryParse: if (isStringLiteralLike(node)) {
            return node.text;
            // resolve template literals if they are constant
        } else if (isTemplateExpression(node)) {
            const resolvedSpans = [] as string[];

            for (const span of node.templateSpans) {
                const spanExpr = span.expression;

                if (!this.isIdentifier(spanExpr)) {
                    logger.debug(`[VencordAstParser] Trying to parse template literal with non-identifier span: ${span.getText()}, FileName: ${span.getSourceFile().fileName}`);
                    break tryParse;
                }

                const usageInfo = this.getVarInfoFromUse(spanExpr);

                if (!usageInfo) {
                    break tryParse;
                } else if (usageInfo.declarations.length === 0) {
                    logger.trace(`[VencordAstParser] Could not resolve identifier ${spanExpr.text} to a variable declaration. Is it a global?`);
                    break tryParse;
                }

                const isConst = this.isConstDeclared(usageInfo);

                if (!isConst) {
                    break tryParse;
                }

                const decl = findParent(isConst[0], isVariableDeclaration);

                if (!decl) {
                    break tryParse;
                }

                const init = decl.initializer;

                if (!init) {
                    break tryParse;
                }

                const initValue = this.tryParseStringLiteral(init);

                // explicitly check for null to avoid empty string
                if (initValue == null) {
                    break tryParse;
                }

                resolvedSpans.push(initValue + span.literal.text);
            }

            return node.head.text + resolvedSpans.join("");
        }
        return null;
    }

    tryParseStringLiteralToStringNode(node: Node): StringNode | null {
        const str = this.tryParseStringLiteral(node);

        if (str == null)
            return null;

        return {
            type: "string",
            value: str,
        };
    }

    tryParseFunction(node: Node): FunctionNode | null {
        if (!isArrowFunction(node) && !isFunctionExpression(node))
            return null;

        const code = createPrinter()
            .printNode(EmitHint.Expression, node, node.getSourceFile());

        const res = transpileModule(code, {
            compilerOptions: {
                target: ScriptTarget.ESNext,
                strict: true,
            },
        });

        if (res.diagnostics && res.diagnostics.length > 0)
            return null;

        return {
            type: "function",
            value: res.outputText,
        };
    }

    parseReplace(node: Expression) {
        return this.tryParseStringLiteralToStringNode(node) ?? this.tryParseFunction(node);
    }

    parseMatch(node: Expression) {
        return this.tryParseStringLiteralToStringNode(node) ?? tryParseRegularExpressionLiteral(node);
    }

    parseReplacement(patch: ObjectLiteralExpression): IReplacement[] | null {
        const replacementObj = findObjectLiteralByKey(patch, "replacement");

        if (!replacementObj || !isPropertyAssignment(replacementObj))
            return null;

        const replacement = replacementObj.initializer;
        const replacements = isArrayLiteralExpression(replacement) ? replacement.elements : [replacement];

        if (!replacements.every(isObjectLiteralExpression))
            return null;

        const replacementValues = (replacements as ObjectLiteralExpression[]).map((r: ObjectLiteralExpression) => {
            const match = findObjectLiteralByKey(r, "match");
            const replace = findObjectLiteralByKey(r, "replace");

            if (!replace || !isPropertyAssignment(replace) || !match || !isPropertyAssignment(match))
                return null;

            const matchValue = this.parseMatch(match.initializer);

            if (!matchValue)
                return null;

            const replaceValue = this.parseReplace(replace.initializer);

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

    parsePatch(patch: ObjectLiteralExpression): PatchData | null {
        const find = this.parseFind(patch);
        const replacement = this.parseReplacement(patch);

        if (!replacement || !find)
            return null;

        return {
            ...find,
            replacement,
        };
    }


    /**
     * @returns true if this file is the entry point (if it has a definePlugin call)
     */
    public isRootPluginFile(): boolean {
        return !!this.findDefinePlugin();
    }

    @Cache()
    public getFinds(): FindUse[] {
        return this.getFindUses()
            .map<FindUse | false>((x) => {
                const call = x.parent;

                if (call.arguments.length === 0)
                    return false;

                const args = call.arguments.map((x) => {
                    return this.tryParseStringLiteralToStringNode(x)
                      ?? tryParseRegularExpressionLiteral(x)
                      ?? this.tryParseFunction(x);
                });

                const range = this.makeRangeFromAstNode(call);

                return {
                    range,
                    use: {
                        type: "testFind",
                        data: {
                            type: x.getText() as TestFind["data"]["type"],
                            args: args.filter((x) => x != null),
                        },
                    },
                };
            })
            .filter((x) => x !== false);
    }

    @Cache()
    private getFindUses(): WithParent<Identifier, CallExpression>[] {
        const imports = [...this.imports.entries()].flatMap(([k, v]) => {
            if (v.source !== "@webpack")
                return [];

            const origName = (v.orig ?? v.as).getText();

            if (!origName.startsWith("find"))
                return [];
            return k;
        });

        const toRet: WithParent<Identifier, CallExpression>[] = [];

        for (const i of imports) {
            const uses = this.vars.get(i)?.uses;

            if (!uses)
                continue;
            for (const { location } of uses) {
                if (!isCallExpression(location.parent))
                    continue;
                toRet.push(location as WithParent<Identifier, CallExpression>);
            }
        }
        return toRet;
    }

    /**
     * returns the import if this identifier is imported
     */
    private isIdentifierImported(i: Identifier): Import | undefined {
        const { declarations, domain } = this.vars.get(i) ?? {};

        if (!declarations || declarations.length === 0)
            return;
        if (!(domain! & DeclarationDomain.Import))
            return;

        const source = declarations.flatMap((x) => {
            if (!isInImportStatment(x))
                return [];
            return x;
        });

        if (source.length !== 1)
            return;

        const [importIdent] = source;

        return {
            default: isDefaultImport(importIdent),
            namespace: isNamespaceImport(importIdent),
            ...getImportName(importIdent),
            source: getImportSource(importIdent),
        };
    }

    private listImports(): Map<Identifier, Import> {
        return new Map([...this.vars.entries()].flatMap(([k]) => {
            const ret = this.isIdentifierImported(k);

            return ret ? [[k, ret]] : [];
        }));
    }
}
