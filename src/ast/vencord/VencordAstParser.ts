import {
    findObjectLiteralByKey,
    getImportName,
    getImportSource,
    isDefaultImport,
    isInImportStatment,
    isNotNull,
    makeRange,
    parsePatch,
    tryParseFunction,
    tryParseRegularExpressionLiteral,
    tryParseStringLiteral,
} from "@ast/util";
import { FindUse, Import, WithParent } from "@type/ast";
import { PatchData, TestFind } from "@type/server";

import { collectVariableUsage, DeclarationDomain, VariableInfo } from "tsutils";
import {
    CallExpression,
    createSourceFile,
    Identifier,
    isArrayLiteralExpression,
    isCallExpression,
    isObjectLiteralExpression,
    isPropertyAssignment,
    ObjectLiteralExpression,
    ScriptKind,
    ScriptTarget,
    SourceFile,
} from "typescript";
import { Location, Range, TextDocument, Uri, workspace } from "vscode";
export class VencordAstParser {
    private doc: TextDocument;
    private text: string;
    private sourceFile: SourceFile;
    private vars: Map<Identifier, VariableInfo>;
    private imports: Map<Identifier, Import>;
    private findCache?: FindUse[];
    private findUsesCache?: ReturnType<typeof this._getFindUses>;
    constructor(doc: { document: TextDocument; });
    constructor(doc: { document: TextDocument; }) {
        this.doc = doc.document;
        this.text = this.doc.getText();
        this.sourceFile = createSourceFile("plugin.tsx", this.text, ScriptTarget.ES2020, true, ScriptKind.TSX);
        this.vars = collectVariableUsage(this.sourceFile);
        this.imports = this.listImports();
    }
    public static async fromUri(uri: Uri) {
        return new VencordAstParser({ document: await workspace.openTextDocument(uri) });
    }
    private findDefinePlugin(): ObjectLiteralExpression | undefined {
        const define = [...this.imports.values()].find(x => {
            if (!x.default) return;
            if (x.source !== "@utils/types") return;
            return true;
        });
        if (!define) return;
        const uses = this.vars.get(define.as)?.uses;
        if (!uses) return;
        const definePlugin = uses.find(({ location }) => {
            if (!isCallExpression(location.parent)) return;
            return location.parent.arguments.length === 1 && isObjectLiteralExpression(location.parent.arguments[0]);
        });
        return (definePlugin?.location.parent as CallExpression).arguments[0] as ObjectLiteralExpression;
    }

    public getPatches(): (PatchData & { range: Range; })[] {
        const definePlugin = this.findDefinePlugin();
        if (!definePlugin) return [];
        const patchesProp = findObjectLiteralByKey(definePlugin, "patches");
        if (!patchesProp || !isPropertyAssignment(patchesProp) || !isArrayLiteralExpression(patchesProp.initializer)) return [];
        return patchesProp.initializer.elements
            .filter(isObjectLiteralExpression)
            .map(x => {
                const res = parsePatch(this.doc, x);
                if (!res) return null;
                return {
                    ...res,
                    range: makeRange(x.getChildAt(1), this.text)
                };
            })
            .filter(x => x !== null);
    }

    public isRootPluginFile(): boolean {
        return !!this.findDefinePlugin();
    }
    public getFinds() {
        if (this.findCache) return this.findCache;
        return (this.findCache = this._getFinds());
    }
    private _getFinds(): FindUse[] {
        return this.getFindUses().map<FindUse | false>(x => {
            const call = x.parent;
            if (call.arguments.length === 0) return false;
            const args = call.arguments.map(x => tryParseStringLiteral(x) ?? tryParseRegularExpressionLiteral(x) ?? tryParseFunction(this.doc, x));
            const range = makeRange(call, this.text);
            return {
                range,
                use: {
                    type: "testFind",
                    data: {
                        type: x.getText() as TestFind["data"]["type"],
                        args: args.filter(isNotNull)
                    }
                }
            };
        }).filter(x => x !== false);
    }
    private getFindUses(): ReturnType<typeof this._getFindUses> {
        if (this.findUsesCache) return this.findUsesCache;
        return (this.findUsesCache = this._getFindUses());
    }
    private _getFindUses(): WithParent<Identifier, CallExpression>[] {
        const imports = [...this.imports.entries()].flatMap(([k, v]) => {
            if (v.source !== "@webpack") return [];
            const origName = (v.orig ?? v.as).getText();
            if (!origName.startsWith("find")) return [];
            return k;
        });
        const toRet: WithParent<Identifier, CallExpression>[] = [];
        for (const i of imports) {
            const uses = this.vars.get(i)?.uses;
            if (!uses) continue;
            for (const { location } of uses) {
                if (!isCallExpression(location.parent)) continue;
                toRet.push(location as WithParent<Identifier, CallExpression>);
            }
        }
        return toRet;
    }
    /**
     * returns the string of the import location if it was
     */
    private isIdentifierImported(i: Identifier): Import | undefined {
        const { declarations, domain } = this.vars.get(i) ?? {};
        if (!declarations || declarations.length === 0) return;
        if (!(domain! & DeclarationDomain.Import)) return;
        const source = declarations.flatMap(x => {
            if (!isInImportStatment(x)) return [];
            return x;
        });
        if (source.length !== 1) return;
        const [importIdent] = source;
        return {
            default: isDefaultImport(importIdent),
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
