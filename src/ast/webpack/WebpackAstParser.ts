import { AstParser } from "@ast/AstParser";
import {
    Cache,
    CacheGetter,
    findObjectLiteralByKey,
    findParrent,
    findReturnIdentifier,
    findReturnPropertyAccessExpression,
    getLeadingIdentifier,
    isSyntaxList,
    zeroRange
} from "@ast/util";
import { ModuleCache, ModuleDepManager } from "@modules/cache";
import { format } from "@modules/format";
import { formatModule, mkStringUri, sendAndGetData } from "@server/index";
import { Definitions, ExportMap, ModuleDeps, References } from "@type/ast";

import { VariableInfo } from "tsutils/util/usage";
import {
    CallExpression,
    createSourceFile,
    Identifier,
    isArrowFunction,
    isBinaryExpression,
    isCallExpression,
    isExpressionStatement,
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
} from "typescript";
import { Location, Position, Range } from "vscode";

// FIXME: rewrite to use module cache

export class WebpackAstParser extends AstParser {
    /** The webpack instanse */
    @CacheGetter()
    private get wreq(): Identifier | undefined {
        return this.findWebpackArg();
    }
    /** where {@link WebpackAstParser.wreq this.wreq} is used*/
    @CacheGetter()
    private get uses(): VariableInfo | undefined {
        return this.wreq && this.vars.get(this.wreq);
    }
    /**
     * The module id of the current module
     */
    @CacheGetter()
    private get moduleId(): string | null {
        if (this.text.startsWith("//WebpackModule")) {
            const [, id] = this.text.match(/^\/\/WebpackModule(\d+)\n/) ?? [];
            return id || null;
        }
        return null;
    }

    public constructor(text: string) {
        super(text);
    }

    protected createSourceFile(): SourceFile {
        return createSourceFile("module.js", this.text, ScriptTarget.ESNext, true, ScriptKind.JS);
    }

    /**
     * @param paramIndex the index of the param 0, 1, 2 etc...
     * @param start finds a webpack arg from the source tree
     * @returns the indenfiier of the param if found or undef
     */
    private findWebpackArg(
        paramIndex = 2,
        start: Node = this.sourceFile
    ): Identifier | undefined {
        for (const n of start.getChildren()) {
            if (isSyntaxList(n) || isExpressionStatement(n) || isBinaryExpression(n))
                return this.findWebpackArg(paramIndex, n);
            if (isFunctionExpression(n)) {
                if (n.parameters.length > 3 || n.parameters.length < paramIndex + 1)
                    return;
                const p = n.parameters[paramIndex].name;
                if (!p) return;
                if (!isIdentifier(p)) return;
                return p;
            }
        }
    }

    @Cache()
    public getDeps(): ModuleDeps | null {
        if (!this.wreq || !this.uses) return null;

        // check if we're in the cache first
        if (ModuleDepManager.hasModDeps() && this.moduleId) {
            // FIXME: horror
            const guh = ModuleDepManager.getModDeps(this.moduleId);
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
            const p = findParrent(v, isCallExpression);
            if (!p || p.expression !== v) return [];

            if (p.arguments.length === 1 && isNumericLiteral(p.arguments[0]))
                return p.arguments[0].text;
            return [];
        });

        const lazyModules = this.uses.uses.map(x => x.location).flatMap(v => {
            const [, prop] = getLeadingIdentifier(v);
            if (prop?.text !== "bind") return [];
            const call = findParrent(v, isCallExpression);
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
        position: Position
    ): Definitions {
        if (!this.uses) throw new Error("Wreq isnt used anywhere");

        // map the assignment of required modules to their uses
        const modules = new Map(
            [...this.vars.entries()].filter(([k]) => {
                return this.uses!.uses.some(e => {
                    const node = findParrent(
                        e.location,
                        isVariableDeclaration
                    );
                    return node?.name === k;
                });
            })
        );

        const x = this.getTokenAtOffset(this.offsetAt(position));

        const [requiredModule, exportName] = getLeadingIdentifier(x);

        if (!requiredModule) return;

        const [, dec] = [...modules.entries()].find(([, v]) => {
            return v.uses.some(({ location }) => requiredModule === location);
        }) ?? [];

        const moduleId = this.getModuleId(dec);

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

    private getModuleId(dec: VariableInfo | undefined): number | undefined {
        if (!dec) return undefined;
        if (dec.declarations.length !== 1) return undefined;
        const init = findParrent(
            dec.declarations[0],
            isVariableDeclaration
        )?.initializer;
        if (!init || !isCallExpression(init)) return undefined;
        if (init.arguments.length !== 1 || !isNumericLiteral(init.arguments[0]))
            return undefined;
        const num = +init.arguments[0].text;
        return num;
    }

    public async generateReferences(position: Position): References {
        if (!this.moduleId)
            throw new Error("Could not find module id of module to search for references of");
        const moduleExports = this.getExportMap();
        const where = this.getDeps();
        const locs: Location[] = [];

        for (const [name] of Object.entries(moduleExports).filter(([, v]) => v.some(x => {
            if (!x) return;
            return x.contains(position);
        }))) {
            for (const mod of where?.sync ?? []) {
                const modText = await ModuleCache.getModuleFromNum(mod);
                if (!modText) continue;
                const uses = new WebpackAstParser(modText).getUsesOfExport(this.moduleId, name);
                locs.push(...uses.map(x => new Location(ModuleCache.getModuleURI(mod), x)));
            }
        }
        return locs;
    }

    @Cache()
    public getExportMap(): ExportMap {
        return Object.assign({}, this.getExportMapWreq_d() ?? {}, this.getExportMapWreq_t() ?? {}, this.getExportMapWreq_e() ?? {});
    }

    private getUsesOfExport(moduleId: string, exportName: string): Range[] {
        if (!this.wreq) throw new Error("Wreq is not used in this file");
        const uses: Range[] = [];
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

                    uses.push(this.makeRange(location.parent.name));
                }
                continue;
            }
            const direct = location.parent;
            if (isCallExpression(direct)) {
                if (!isPropertyAccessExpression(direct.parent)) continue;
                if (!isIdentifier(direct.parent.name)) continue;

                if (direct.parent.name.text !== exportName) continue;

                uses.push(this.makeRange(direct.parent.name));
            }
        }
        return uses;
    }

    @Cache()
    private getExportMapWreq_t(): ExportMap | undefined {
        const wreqT = this.findWreq_t();

        if (!wreqT) return undefined;

        const uses = this.vars.get(wreqT);

        if (!uses) return undefined;

        return Object.fromEntries(uses.uses.map(({ location }): [string, ExportMap[string]] | false => {
            const [, exportAssignment] = getLeadingIdentifier(location);
            const binary = findParrent(location, isBinaryExpression);
            if (exportAssignment && binary && isIdentifier(binary?.right)) {
                return [exportAssignment.text, [this.makeRange(exportAssignment), this.makeRange(binary.right), this.makeRangeFromFuctionDef(binary.right)]];
            }
            return exportAssignment ? [exportAssignment.text, [this.makeRange(exportAssignment)]] : false;
        }).filter(x => x !== false) as any);
    }
    @Cache()
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

        const exportObject = findParrent(
            exportAssignment.location, isBinaryExpression
        )?.right;

        if (!exportObject || !isObjectLiteralExpression(exportObject))
            return undefined;

        return Object.fromEntries(exportObject.properties.map((x): false | [string, ExportMap[string]] => {
            // wreq.e is used for css class name exports
            if (!isPropertyAssignment(x) || (!isStringLiteral(x.initializer) && !isIdentifier(x.initializer))) return false;
            return [x.name.getText(), [this.makeRange(x.initializer)]];
        }).filter(x => x !== false) as any);
    }
    @Cache()
    private getExportMapWreq_d(): ExportMap | undefined {
        const wreqD = this.findWreq_d();
        if (!wreqD) return;
        const [, exports] = wreqD.arguments;
        return Object.fromEntries(exports.properties.map((x): false | [string, ExportMap[string]] => {
            if (!isPropertyAssignment(x) || !(isArrowFunction(x.initializer) || isFunctionExpression(x.initializer))) return false as const;
            let ret: Node | undefined = findReturnIdentifier(x.initializer);
            ret ??= findReturnPropertyAccessExpression(x.initializer);
            return ret != null ? [x.name.getText(), [this.makeRange(x.name), isIdentifier(ret) ? this.makeRangeFromFuctionDef(ret) : undefined]] : false as const;
        }).filter(x => x !== false) as any);
    }

    public findExportLocation(exportName: string): Range {
        return (
            this.tryFindExportwreq_d(exportName) ||
            this.tryFindExportWreq_t(exportName) ||
            this.tryFindExportsWreq_e(exportName) ||
            zeroRange
        );
    }
    @Cache()
    private findWreq_d(): (CallExpression & { arguments: [Identifier, ObjectLiteralExpression, ...any]; }) | undefined {
        if (this.uses) {
            const maybeWreqD = this.uses.uses.find(use => getLeadingIdentifier(use.location)[1]?.text === "d"
            )?.location.parent.parent;
            if (!maybeWreqD || !isCallExpression(maybeWreqD)) return undefined;
            if (maybeWreqD.arguments.length !== 2 ||
                !isIdentifier(maybeWreqD.arguments[0]) ||
                !isObjectLiteralExpression(maybeWreqD.arguments[1])) return undefined;
            return maybeWreqD as any;
        }
    }
    private tryFindExportwreq_d(exportName: string): Range | undefined {
        if (this.uses) {
            const wreq_dCall = this.findWreq_d();
            if (!wreq_dCall) return undefined;

            // the a: function(){return b;} of wreq.d
            const exportCallAssignment = findObjectLiteralByKey(
                wreq_dCall.arguments[1],
                exportName
            );

            if (!exportCallAssignment ||
                !isPropertyAssignment(exportCallAssignment) ||
                !(isFunctionExpression(exportCallAssignment.initializer)
                    || isArrowFunction(exportCallAssignment.initializer)))
                return undefined;

            const exportVar = findReturnIdentifier(exportCallAssignment.initializer);
            if (exportVar) {

                const [exportDec] = [...this.vars.entries()].find(([, v]) => {
                    return v.uses.some(use => use.location === exportVar);
                }) ?? [];

                if (!exportDec) return undefined;

                return this.makeRange(exportDec);
            }
            const reExport = findReturnPropertyAccessExpression(exportCallAssignment.initializer);
            if (reExport) {
                return this.makeRange(reExport.name);
            }
        }
    }

    @Cache()
    private findWreq_t(): Identifier | undefined {
        return this.findWebpackArg(1);
    }
    private tryFindExportWreq_t(exportName: string): Range | undefined {
        const wreq_t = this.findWreq_t();

        if (!wreq_t) return undefined;

        const uses = this.vars.get(wreq_t);

        if (!uses) return undefined;

        const exports = uses.uses.find(({ location }) => {
            const [, exportAssignment] = getLeadingIdentifier(location);
            return exportAssignment?.text === exportName;
        });

        return exports ? this.makeRange(exports.location) : undefined;
    }
    private findWreq_e(): Identifier | undefined {
        return this.findWebpackArg(0);
    }
    private tryFindExportsWreq_e(exportName: string): Range | undefined {
        const wreq_e = this.findWreq_e();

        if (!wreq_e) return undefined;

        const uses = this.vars.get(wreq_e);

        if (!uses) return undefined;

        const exportAssignment = uses.uses.find(({ location }) => {
            const [, moduleProp] = getLeadingIdentifier(location);
            return moduleProp?.text === "exports";
        });

        if (!exportAssignment) return undefined;

        const exportObject = findParrent(
            exportAssignment.location,
            isBinaryExpression
        )?.right;

        if (!exportObject || !isObjectLiteralExpression(exportObject))
            return undefined;

        const exportItem = findObjectLiteralByKey(exportObject, exportName);

        if (!exportItem) return undefined;

        return this.makeRange(exportItem.name ?? exportItem);
    }
}
