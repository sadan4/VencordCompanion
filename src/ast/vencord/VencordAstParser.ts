import { findParrent, getImportName, getImportSource, isDefaultImport, isDefaultKeyword, isInImportStatment, isNotNull, makeRange, tryParseFunction, tryParseRegularExpressionLiteral, tryParseStringLiteral } from "@ast/util";
import { FindUse, Import } from "@type/ast";
import { TestFind } from "@type/server";

import { collectVariableUsage, DeclarationDomain, VariableInfo } from "tsutils";
import { CallExpression, createSourceFile, DefaultKeyword, Identifier, isCallExpression, isExportAssignment, isObjectLiteralExpression, ObjectLiteralExpression, ScriptKind, ScriptTarget, SourceFile } from "typescript";
import { TextDocument, Uri, workspace } from "vscode";
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
        const allVars = [...this.vars.keys()];

        // FIXME: allow for renaming of the definePlugin import
        const definePluginIdnet = allVars.find(v =>
            v.getText() === "definePlugin" && this.vars.get(v)!.domain === DeclarationDomain.Import);

        if (!definePluginIdnet) return;

        const useInDefault = this.vars.get(definePluginIdnet)!.uses.find(({ location }) => {
            const maybeExport = findParrent(location, isExportAssignment);
            if (!maybeExport) return;

            const maybeDefault = maybeExport.getChildren()[1];
            return maybeDefault && isDefaultKeyword(maybeDefault);
        })?.location as DefaultKeyword | undefined;

        if (!useInDefault || !isCallExpression(useInDefault.parent)) return;

        const firstArg = useInDefault.parent.arguments[0];

        return firstArg && isObjectLiteralExpression(firstArg) ? firstArg : undefined;
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
    private _getFindUses(): (Identifier & { parent: CallExpression })[] {
        return [...this.imports.entries()].flatMap(([k, v]) => {
            if (v.source !== "@webpack") return [];
            if (!isCallExpression(k.parent)) return [];
            const origName = ((typeof v.from === "string" && v.from) || (v.from as Exclude<typeof v.from, string>).orig.getText());
            if (!origName.startsWith("find")) return [];
            return k as Identifier & { parent: CallExpression };
        });
    }
    /**
     * returns the string of the import location if it was
     */
    private isIdentifierImported(i: Identifier): Import | undefined {
        const { declarations, domain } = this.vars.get(i) ?? {};
        if (!declarations || declarations.length === 0) return;
        if (domain !== DeclarationDomain.Import) return;
        const source = declarations.flatMap(x => {
            if (!isInImportStatment(x)) return [];
            return x;
        });
        if (source.length !== 1) return;
        const [importIdent] = source;
        return {
            default: isDefaultImport(importIdent),
            from: getImportName(importIdent),
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
