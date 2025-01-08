import {
    collectVariableUsage,
    getTokenAtPosition,
    VariableInfo,
} from "tsutils";
import {
    createSourceFile,
    Identifier,
    isVariableDeclaration,
    ScriptKind,
    ScriptTarget,
    SourceFile,
    VariableDeclaration,
} from "typescript";
import * as vscode from "vscode";

import { formatModule, mkStringUri, sendAndGetData } from "../server/webSocketServer";
import {
    findObjectLiteralByKey,
    findParrent,
    findReturnIdentifier,
    findWebpackArg,
    getLeadingIdentifier,
    getModuleId,
    makeRange,
    zeroRange,
} from "./util";
import ts = require("typescript");
import format from "../format";
import exp = require("constants");
import { lchown } from "fs";
import { ModuleCache, ModuleDepManager } from "modules/cache";

type Definitions = Promise<
    vscode.Definition | vscode.LocationLink[] | null | undefined
>;
type References = Promise<vscode.Location[] | null | undefined>;
export class ReferenceProvider implements vscode.ReferenceProvider {
    async provideReferences(document: vscode.TextDocument, position: vscode.Position, context: vscode.ReferenceContext, token: vscode.CancellationToken): References {
        if (!await ModuleCache.hasCache()) {
            vscode.window.showErrorMessage("No Module Cache found, please download modules first");
            return;
        }
        if (!ModuleDepManager.hasModDeps()) {
            await ModuleDepManager.initModDeps({
                fromDisk: true
            });
        }
    }

}
export class DefinitionProvider implements vscode.DefinitionProvider {
    async provideDefinition(
        document: vscode.TextDocument,
        position: vscode.Position
    ): Definitions {
        try {
            const text = document.getText();
            // not sure if substring is a good idea here
            // just dont want to search really long webpack modules
            if (
                !text.startsWith("//WebpackModule") ||
                text.substring(0, 100).includes("//OPEN FULL MODULE:")
            )
                return;
            return await new WebpackAstParser(text).generateDefinitions(
                document,
                position
            );
        } catch (e) {
            console.error(e);
        }
    }
}
interface ModuleDeps {
    lazy: string[];
    sync: string[];
}
interface ExportMap {
    // string literal is used for css class name exports
    [exposedName: string]: ts.Identifier | ts.StringLiteral;
}

// FIXME: rewrite to use module cache
export class WebpackAstParser {
    private text: string;
    private sourceFile: SourceFile;
    /** All vars in the file */
    private vars: Map<Identifier, VariableInfo>;
    /** The webpack instanse */
    private wreq: Identifier | undefined;
    /** where {@link WebpackAstParser.wreq this.wreq} is used*/
    private uses: VariableInfo | undefined;
    thisId: string | null;

    public constructor(text: string) {
        this.text = text;
        this.sourceFile = createSourceFile(
            "module.js",
            this.text,
            ScriptTarget.ESNext,
            true,
            ScriptKind.JS
        );

        this.thisId = WebpackAstParser.getModuleId(this.text);
        this.vars = collectVariableUsage(this.sourceFile);

        this.wreq = findWebpackArg(this.sourceFile);

        this.uses = this.wreq && this.vars.get(this.wreq);
    }

    private static getModuleId(mod: string): string | null {
        if (mod.startsWith("//WebpackModule")) {
            const [, id] = mod.match(/^\/\/WebpackModule(\d+)\n/) ?? [];
            return id || null;
        }
        return null;
    }

    public async getDeps(): Promise<ModuleDeps | null> {
        if (!this.wreq || !this.uses) return null;

        // flatmaps because .map(...).filter(x => x !== false) isnt a valid typeguard
        /**
         * things like wreq(moduleid)
         */
        const wreqCalls = this.uses.uses.map(x => x.location).flatMap(v => {
            const p = findParrent<ts.CallExpression>(v, n => ts.isCallExpression(n));
            if (!p || p.expression !== v) return [];

            if (p.arguments.length === 1 && ts.isNumericLiteral(p.arguments[0]))
                return p.arguments[0].text;
            return [];
        });

        const lazyModules = this.uses.uses.map(x => x.location).flatMap(v => {
            const [, prop] = getLeadingIdentifier(v);
            if (prop?.text !== "bind") return [];
            const call = findParrent<ts.CallExpression>(v, n => ts.isCallExpression(n));
            if (!call) return [];

            if (call.arguments.length === 2 && ts.isNumericLiteral(call.arguments[1]))
                return call.arguments[1].text;
            return [];
        });

        return {
            lazy: lazyModules,
            sync: wreqCalls
        };
    }

    public async generateDefinitions(
        document: vscode.TextDocument,
        position: vscode.Position
    ): Definitions {
        if (!this.uses) throw new Error("Wreq isnt used anywhere");

        // map the assignment of required modules to their uses
        const modules = new Map(
            [...this.vars.entries()].filter(([k]) => {
                return this.uses!.uses.some(e => {
                    const node = findParrent<VariableDeclaration>(
                        e.location,
                        isVariableDeclaration
                    );
                    return node?.name === k;
                });
            })
        );

        const x = getTokenAtPosition(
            this.sourceFile,
            document.offsetAt(position),
            this.sourceFile
        );

        const [requiredModule, exportName] = getLeadingIdentifier(x);

        if (!requiredModule) return;

        const [, dec] =
            [...modules.entries()].find(([, v]) => {
                return v.uses.some(({ location }) => requiredModule === location);
            }) ?? [];

        const moduleId = getModuleId(dec, exportName);

        if (!moduleId) return;
        const res = await sendAndGetData<"rawId">({
            type: "rawId",
            data: {
                id: moduleId,
            },
        }).catch(console.error);
        if (res?.data === undefined) return;
        res.data = await format(formatModule(res.data, moduleId));
        return {
            range: exportName
                ? new WebpackAstParser(res.data).findExportLocation(exportName.text)
                : zeroRange,
            uri: mkStringUri(res.data),
        };
    }
    public getExportMap() {
        return Object.assign({}, this.getExportMapWreq_d() ?? {}, this.getExportMapWreq_t() ?? {}, this.getExportMapWreq_e() ?? {});
    }

    private getExportMapWreq_t(): ExportMap | undefined {
        const wreqT = this.findWreq_t();

        if (!wreqT) return undefined;

        const uses = this.vars.get(wreqT);

        if (!uses) return undefined;

        return Object.fromEntries(uses.uses.map(({ location }) => {
            const [, exportAssignment] = getLeadingIdentifier(location);
            const binary = findParrent<ts.BinaryExpression>(location, ts.isBinaryExpression);
            if (exportAssignment && binary && ts.isIdentifier(binary?.right)) {
                return [exportAssignment.text, binary.right];
            }
            return exportAssignment ? [exportAssignment.text, location] : false;
        }).filter(x => x !== false));
    }
    private getExportMapWreq_e(): ExportMap | undefined {
        const wreqE = this.findWreq_e();

        if (!wreqE) return undefined;

        const uses = this.vars.get(wreqE);

        if (!uses) return undefined;

        const exportAssignment = uses.uses.find(({ location }) => {
            const [, moduleProp] = getLeadingIdentifier(location);
            return moduleProp?.text === "exports";
        });

        if (!exportAssignment) return undefined;

        const exportObject = findParrent<ts.BinaryExpression | undefined>(
            exportAssignment.location, ts.isBinaryExpression
        )?.right;

        if (!exportObject || !ts.isObjectLiteralExpression(exportObject))
            return undefined;

        return Object.fromEntries(exportObject.properties.map((x): false | [string, ExportMap[string]] => {
            // wreq.e is used for css class name exports
            if (!ts.isPropertyAssignment(x) || (!ts.isStringLiteral(x.initializer) && !ts.isIdentifier(x.initializer))) return false;
            return [x.name.getText(), x.initializer];
        }).filter(x => x !== false));
    }
    private getExportMapWreq_d(): ExportMap | undefined {
        const wreqD = this.findWreq_d();
        if (!wreqD) return;
        const [, exports] = wreqD.arguments;
        return Object.fromEntries(exports.properties.map(x => {
            if (!ts.isPropertyAssignment(x) || !ts.isFunctionExpression(x.initializer)) return false as const;
            const ret = findReturnIdentifier(x.initializer);
            return ret != null ? [x.name.getText(), ret] as const : false as const;
        }).filter(x => x !== false));
    }

    public findExportLocation(exportName: string): vscode.Range {
        return (
            this.tryFindExportwreq_d(exportName) ||
            this.tryFindExportWreq_t(exportName) ||
            this.tryFindExportsWreq_e(exportName) ||
            zeroRange
        );
    }
    private findWreq_d(): (ts.CallExpression & { arguments: [ts.Identifier, ts.ObjectLiteralExpression, ...any]; }) | undefined {
        if (this.uses) {
            const maybeWreqD = this.uses.uses.find(use =>
                getLeadingIdentifier(use.location)[1]?.text === "d"
            )?.location.parent.parent;
            if (!maybeWreqD || !ts.isCallExpression(maybeWreqD)) return undefined;
            if (maybeWreqD.arguments.length !== 2 ||
                !ts.isIdentifier(maybeWreqD.arguments[0]) ||
                !ts.isObjectLiteralExpression(maybeWreqD.arguments[1])
            ) return undefined;
            return maybeWreqD as any;
        }
    }
    private tryFindExportwreq_d(exportName: string): vscode.Range | undefined {
        if (this.uses) {
            const wreq_dCall = this.findWreq_d();
            if (!wreq_dCall) return undefined;

            // the a: function(){return b;} of wreq.d
            const exportCallAssignment = findObjectLiteralByKey(
                wreq_dCall.arguments[1],
                exportName
            );

            if (
                !exportCallAssignment ||
                !ts.isPropertyAssignment(exportCallAssignment) ||
                !ts.isFunctionExpression(exportCallAssignment.initializer)
            )
                return undefined;

            const exportVar = findReturnIdentifier(exportCallAssignment.initializer);

            const [exportDec] =
                [...this.vars.entries()].find(([, v]) => {
                    return v.uses.some(use => use.location === exportVar);
                }) ?? [];

            if (!exportDec) return undefined;

            return makeRange(exportDec, this.text);
        }
    }

    private findWreq_t(): Identifier | undefined {
        return findWebpackArg(this.sourceFile, 1);
    }
    private tryFindExportWreq_t(exportName: string): vscode.Range | undefined {
        const wreq_t = this.findWreq_t();

        if (!wreq_t) return undefined;

        const uses = this.vars.get(wreq_t);

        if (!uses) return undefined;

        const exports = uses.uses.find(({ location }) => {
            const [, exportAssignment] = getLeadingIdentifier(location);
            return exportAssignment?.text === exportName;
        });

        return exports ? makeRange(exports.location, this.text) : undefined;
    }
    private findWreq_e(): Identifier | undefined {
        return findWebpackArg(this.sourceFile, 0);
    }
    private tryFindExportsWreq_e(exportName: string): vscode.Range | undefined {
        const wreq_e = this.findWreq_e();

        if (!wreq_e) return undefined;

        const uses = this.vars.get(wreq_e);

        if (!uses) return undefined;

        const exportAssignment = uses.uses.find(({ location }) => {
            const [, moduleProp] = getLeadingIdentifier(location);
            return moduleProp?.text === "exports";
        });

        if (!exportAssignment) return undefined;

        const exportObject = findParrent<ts.BinaryExpression | undefined>(
            exportAssignment.location,
            ts.isBinaryExpression
        )?.right;

        if (!exportObject || !ts.isObjectLiteralExpression(exportObject))
            return undefined;

        const exportItem = findObjectLiteralByKey(exportObject, exportName);

        if (!exportItem) return undefined;

        return makeRange(exportItem.name ?? exportItem, this.text);
    }
}
