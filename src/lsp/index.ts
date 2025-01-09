import { formatModule, mkStringUri, sendAndGetData } from "@server/webSocketServer";
import { assert, dir } from "console";
import { ModuleCache, ModuleDepManager } from "modules/cache";
import {
    collectVariableUsage,
    getTokenAtPosition,
    VariableInfo,
} from "tsutils";
import {
    BinaryExpression,
    CallExpression,
    createSourceFile,
    Identifier,
    isBinaryExpression,
    isCallExpression,
    isFunctionDeclaration,
    isFunctionExpression,
    isIdentifier,
    isNumericLiteral,
    isObjectLiteralExpression,
    isPropertyAccessExpression,
    isPropertyAssignment,
    isStringLiteral,
    isVariableDeclaration,
    Node,
    ObjectLiteralExpression,
    ScriptKind,
    ScriptTarget,
    SourceFile,
    StringLiteral,
    VariableDeclaration,
} from "typescript";
import * as vscode from "vscode";

import format from "../format";
import {
    findObjectLiteralByKey,
    findParrent,
    findReturnIdentifier,
    findReturnPropertyAccessExpression,
    findWebpackArg,
    getLeadingIdentifier,
    getModuleId,
    makeRange,
    zeroRange,
} from "./util";

type Definitions = Promise<
    vscode.Definition | vscode.LocationLink[] | null | undefined
>;
type References = Promise<vscode.Location[] | null | undefined>;
export class ReferenceProvider implements vscode.ReferenceProvider {
    async provideReferences(document: vscode.TextDocument, position: vscode.Position, context: vscode.ReferenceContext, token: vscode.CancellationToken): References {
        const y = require("path");
        if (!await ModuleCache.hasCache()) {
            vscode.window.showErrorMessage("No Module Cache found, please download modules first");
            return;
        }
        if (!ModuleDepManager.hasModDeps()) {
            await ModuleDepManager.initModDeps({
                fromDisk: true
            });
        }
        try {
            return await new WebpackAstParser(document.getText()).generateReferences(document, position);
        } catch (e) {
            console.error(e);
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
    // ranges of code that will count as references to this export
    [exposedName: string]: (vscode.Range | undefined)[];
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
    private thisId: string | null;

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
    public getDeps(): ModuleDeps | null {
        if (!this.wreq || !this.uses) return null;

        // check if we're in the cache first
        if (ModuleDepManager.hasModDeps() && this.thisId) {
            // FIXME: horror
            const guh = ModuleDepManager.getModDeps(this.thisId);
            return {
                lazy: guh.lazyUses,
                sync: guh.syncUses
            };
        }
        // flatmaps because .map(...).filter(x => x !== false) isnt a valid typeguard
        /**
         * things like wreq(moduleid)
         */
        const wreqCalls = this.uses.uses.map(x => x.location).flatMap(v => {
            const p = findParrent<CallExpression>(v, n => isCallExpression(n));
            if (!p || p.expression !== v) return [];

            if (p.arguments.length === 1 && isNumericLiteral(p.arguments[0]))
                return p.arguments[0].text;
            return [];
        });

        const lazyModules = this.uses.uses.map(x => x.location).flatMap(v => {
            const [, prop] = getLeadingIdentifier(v);
            if (prop?.text !== "bind") return [];
            const call = findParrent<CallExpression>(v, n => isCallExpression(n));
            if (!call) return [];

            if (call.arguments.length === 2 && isNumericLiteral(call.arguments[1]))
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

    public async generateReferences(document: vscode.TextDocument, position: vscode.Position): References {
        if (!this.thisId)
            throw new Error("Could not find module id of module to search for references of");
        const moduleExports = this.getExportMap();
        const where = this.getDeps();
        const locs: vscode.Location[] = [];

        console.log(moduleExports);
        for (const [name] of Object.entries(moduleExports).filter(([, v]) => v.some(x => {
            if(!x) return;
            console.log(x), console.log(position);
            return x.contains(position);
        }))) {
            console.log("Fond mod");
            for (const mod of where?.sync ?? []) {
                const modText = await ModuleCache.getModuleFromNum(mod);
                if (!modText) continue;
                const uses = new WebpackAstParser(modText).getUsesOfExport(this.thisId, name);
                locs.push(...uses.map(x =>
                    new vscode.Location(ModuleCache.getModuleURI(mod), x)));
            }
        }
        return locs;
    }

    public getExportMap(): ExportMap {
        return Object.assign({}, this.getExportMapWreq_d() ?? {}, this.getExportMapWreq_t() ?? {}, this.getExportMapWreq_e() ?? {});
    }

    private getUsesOfExport(moduleId: string, exportName: string): vscode.Range[] {
        if (!this.wreq) throw new Error("Wreq is not used in this file");
        const uses: vscode.Range[] = [];
        for (const { location } of this.vars.get(this.wreq)?.uses ?? []) {

            if (!isCallExpression(location.parent)) continue;
            if (location.parent.arguments[0].getText() !== moduleId) continue;

            const norm = location?.parent?.parent;
            if (norm && isVariableDeclaration(norm)) {
                if (!isIdentifier(norm.name)) continue;

                const importUses = this.vars.get(norm.name);

                for (const { location } of importUses?.uses ?? []) {
                    if (!isPropertyAccessExpression(location.parent)) continue;
                    if (!isIdentifier(location.parent.name)) continue;

                    if (location.parent.name.getText() !== exportName) continue;

                    uses.push(makeRange(location.parent.name, this.text));
                }
                continue;
            }
            const direct = location.parent;
            if (isCallExpression(direct)) {
                if (!isPropertyAccessExpression(direct.parent)) continue;
                if (!isIdentifier(direct.parent.name)) continue;

                if (direct.parent.name.text !== exportName) continue;

                uses.push(makeRange(direct.parent.name, this.text));
            }
        }
        return uses;
    }

    private getExportMapWreq_t(): ExportMap | undefined {
        const wreqT = this.findWreq_t();

        if (!wreqT) return undefined;

        const uses = this.vars.get(wreqT);

        if (!uses) return undefined;

        return Object.fromEntries(uses.uses.map(({ location }): [string, ExportMap[string]] | false => {
            const [, exportAssignment] = getLeadingIdentifier(location);
            const binary = findParrent<BinaryExpression>(location, isBinaryExpression);
            if (exportAssignment && binary && isIdentifier(binary?.right)) {
                return [exportAssignment.text, [makeRange(exportAssignment, this.text), makeRange(binary.right, this.text), this.makeRangeFromFuctionDef(binary.right)]];
            }
            return exportAssignment ? [exportAssignment.text, [makeRange(exportAssignment, this.text)]] : false;
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

        const exportObject = findParrent<BinaryExpression | undefined>(
            exportAssignment.location, isBinaryExpression
        )?.right;

        if (!exportObject || !isObjectLiteralExpression(exportObject))
            return undefined;

        return Object.fromEntries(exportObject.properties.map((x): false | [string, ExportMap[string]] => {
            // wreq.e is used for css class name exports
            if (!isPropertyAssignment(x) || (!isStringLiteral(x.initializer) && !isIdentifier(x.initializer))) return false;
            return [x.name.getText(), [makeRange(x.initializer, this.text)]];
        }).filter(x => x !== false));
    }
    private getExportMapWreq_d(): ExportMap | undefined {
        const wreqD = this.findWreq_d();
        if (!wreqD) return;
        const [, exports] = wreqD.arguments;
        return Object.fromEntries(exports.properties.map((x): false | [string, ExportMap[string]] => {
            if (!isPropertyAssignment(x) || !isFunctionExpression(x.initializer)) return false as const;
            let ret: Node| undefined = findReturnIdentifier(x.initializer);
            ret ??= findReturnPropertyAccessExpression(x.initializer);
            return ret != null ? [x.name.getText(), [makeRange(x.name, this.text), isIdentifier(ret) ? this.makeRangeFromFuctionDef(ret) : undefined]] : false as const;
        }).filter(x => x !== false));
    }
    private makeRangeFromFuctionDef(ret: Identifier): vscode.Range | undefined {
        const uses = this.vars.get(ret)?.uses;
        if (!uses) return undefined;
        const def = uses.find(({ location }) => isFunctionDeclaration(location.parent));
        if (!def) return undefined;
        return makeRange(def.location, this.text);
    }

    public findExportLocation(exportName: string): vscode.Range {
        return (
            this.tryFindExportwreq_d(exportName) ||
            this.tryFindExportWreq_t(exportName) ||
            this.tryFindExportsWreq_e(exportName) ||
            zeroRange
        );
    }
    private findWreq_d(): (CallExpression & { arguments: [Identifier, ObjectLiteralExpression, ...any]; }) | undefined {
        if (this.uses) {
            const maybeWreqD = this.uses.uses.find(use =>
                getLeadingIdentifier(use.location)[1]?.text === "d"
            )?.location.parent.parent;
            if (!maybeWreqD || !isCallExpression(maybeWreqD)) return undefined;
            if (maybeWreqD.arguments.length !== 2 ||
                !isIdentifier(maybeWreqD.arguments[0]) ||
                !isObjectLiteralExpression(maybeWreqD.arguments[1])
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
                !isPropertyAssignment(exportCallAssignment) ||
                !isFunctionExpression(exportCallAssignment.initializer)
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

        const exportObject = findParrent<BinaryExpression | undefined>(
            exportAssignment.location,
            isBinaryExpression
        )?.right;

        if (!exportObject || !isObjectLiteralExpression(exportObject))
            return undefined;

        const exportItem = findObjectLiteralByKey(exportObject, exportName);

        if (!exportItem) return undefined;

        return makeRange(exportItem.name ?? exportItem, this.text);
    }
}
