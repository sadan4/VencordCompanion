import { AstParser } from "@ast/AstParser";
import {
    Cache,
    CacheGetter,
    findObjectLiteralByKey,
    getImportName,
    getImportSource,
    isDefaultImport,
    isInImportStatment,
    isNamespaceImport,
    parsePatch,
    tryParseFunction,
    tryParseRegularExpressionLiteral,
    tryParseStringLiteral,
} from "@ast/util";
import { FindUse, Import, SourcePatch, WithParent } from "@type/ast";
import { TestFind } from "@type/server";

import { DeclarationDomain } from "tsutils/util/usage";
import {
    CallExpression,
    Identifier,
    isArrayLiteralExpression,
    isCallExpression,
    isObjectLiteralExpression,
    isPropertyAssignment,
    isStringLiteral,
    ObjectLiteralExpression,
} from "typescript";
import { TextDocument, Uri, workspace } from "vscode";
export class VencordAstParser extends AstParser {
    private doc: TextDocument;

    @CacheGetter()
    public get imports(): Map<Identifier, Import> {
        return this.listImports();
    }

    constructor(doc: TextDocument) {
        super(doc.getText());
        this.doc = doc;
    }

    public static async fromUri(uri: Uri) {
        return new VencordAstParser(await workspace.openTextDocument(uri));
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

                const res = parsePatch(this.doc, x);

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
                    return tryParseStringLiteral(x)
                      ?? tryParseRegularExpressionLiteral(x)
                      ?? tryParseFunction(this.doc, x);
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
