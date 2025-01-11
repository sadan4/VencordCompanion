import { findParrent, isDefaultKeyword } from "@ast/util";

import { collectVariableUsage, DeclarationDomain, VariableInfo } from "tsutils";
import { createSourceFile, DefaultKeyword, Identifier, isCallExpression, isExportAssignment, isObjectLiteralExpression, ObjectLiteralExpression, ScriptKind, ScriptTarget, SourceFile } from "typescript";
import { TextDocument, Uri, workspace } from "vscode";

export default class VencordAstParser {
    private text: string;
    private sourceFile: SourceFile;
    vars: Map<Identifier, VariableInfo>;
    constructor(doc: string);
    constructor(doc: { document: TextDocument; });
    constructor(doc: string | { document: TextDocument; }) {
        if (typeof doc === "string") {
            this.text = doc;
        } else {
            this.text = doc.document.getText();
        }
        this.sourceFile = createSourceFile("plugin.tsx", this.text, ScriptTarget.ES2020, true, ScriptKind.TSX);
        this.vars = collectVariableUsage(this.sourceFile);
    }
    public static async fromUri(uri: Uri) {
        return new VencordAstParser((Buffer.from(await workspace.fs.readFile(uri)).toString("utf8")));
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
    // public hasFinds(): boolean {

    // }
}
