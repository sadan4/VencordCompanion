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
    zeroRange,
} from "@ast/util";
import { outputChannel } from "@extension";
import { ModuleCache, ModuleDepManager } from "@modules/cache";
import { format } from "@modules/format";
import { formatModule, mkStringUri, sendAndGetData } from "@server/index";
import { AssertedType, Definitions, ExportMap, ModuleDeps, References } from "@type/ast";

import { VariableInfo } from "tsutils/util/usage";
import {
    CallExpression,
    createSourceFile,
    Identifier,
    isArrowFunction,
    isBinaryExpression,
    isCallExpression,
    isExpressionStatement,
    isFunctionDeclaration,
    isFunctionExpression,
    isIdentifier,
    isNumericLiteral,
    isObjectLiteralExpression,
    isPropertyAccessExpression,
    isPropertyAssignment,
    isStringLiteral,
    isVariableDeclaration,
    LiteralToken,
    Node,
    ObjectLiteralExpression,
    PropertyAssignment,
    ScriptKind,
    ScriptTarget,
    SourceFile,
} from "typescript";
import { Location, Position, Range } from "vscode";

// FIXME: rewrite to use module cache

export class WebpackAstParser extends AstParser {
    /**
     * This is set on {@link ExportMap} when the default export is commonjs and has no properties, eg, string literal, function
     */
    static SYM_CJS_DEFAULT = Symbol("CommonJS Default Export");

    /**
     * The webpack instance passed to this module
     *
     * The `n` of
     * ```
     * function (e, t, n) {
     // webpack module contents
     * }
     * ```
     */
    @CacheGetter()
    get wreq(): Identifier | undefined {
        return this.findWebpackArg();
    }

    /** where {@link WebpackAstParser.wreq this.wreq} is used*/
    @CacheGetter()
    get uses(): VariableInfo | undefined {
        return this.wreq && this.vars.get(this.wreq);
    }

    /**
     * The module id of the current module
     */
    @CacheGetter()
    get moduleId(): string | null {
        if (this.text.startsWith("// Webpack Module ")) {
            const [, id] = this.text.match(/^\/\/ Webpack Module (\d+) /) ?? [];

            return id || null;
        }
        return null;
    }

    public constructor(text: string) {
        super(text);
    }

    protected override createSourceFile(): SourceFile {
        return createSourceFile("module.js", this.text, ScriptTarget.ESNext, true, ScriptKind.JS);
    }

    /**
     * @param paramIndex the index of the param 0, 1, 2 etc...
     * @param start finds a webpack arg from the source tree
     * @returns the indenfiier of the param if found or undef
     */
    findWebpackArg(paramIndex = 2, start: Node = this.sourceFile): Identifier | undefined {
        for (const n of start.getChildren()) {
            if (isSyntaxList(n) || isExpressionStatement(n) || isBinaryExpression(n))
                return this.findWebpackArg(paramIndex, n);
            if (isFunctionExpression(n)) {
                if (n.parameters.length > 3 || n.parameters.length < paramIndex + 1)
                    return;

                const p = n.parameters[paramIndex].name;

                if (!p)
                    return;
                if (!isIdentifier(p))
                    return;
                return p;
            }
        }
    }

    @Cache()
    public getDeps(): ModuleDeps | null {
        if (!this.wreq || !this.uses)
            return null;

        // check if we're in the cache first
        if (ModuleDepManager.hasModDeps() && this.moduleId) {
            // FIXME: horror
            const guh = ModuleDepManager.getModDeps(this.moduleId);

            return {
                lazy: guh.lazyUses,
                sync: guh.syncUses,
            };
        }

        // flatmaps because .map(...).filter(x => x !== false) isn't a valid typeguard
        /**
         * things like wreq(moduleid)
         */
        const wreqCalls = this.uses.uses.map((x) => x.location)
            .flatMap((v) => {
                const p = findParrent(v, isCallExpression);

                if (!p || p.expression !== v)
                    return [];

                if (p.arguments.length === 1 && isNumericLiteral(p.arguments[0]))
                    return p.arguments[0].text;
                return [];
            });

        const lazyModules = this.uses.uses.map((x) => x.location)
            .flatMap((v) => {
                const [, prop] = getLeadingIdentifier(v);

                if (prop?.text !== "bind")
                    return [];

                const call = findParrent(v, isCallExpression);

                if (!call)
                    return [];

                if (call.arguments.length === 2 && isNumericLiteral(call.arguments[1]))
                    return call.arguments[1].text;
                return [];
            });

        return {
            lazy: lazyModules,
            sync: wreqCalls,
        };
    }

    public async generateDefinitions(position: Position): Definitions {
        if (!this.uses)
            throw new Error("Wreq isn't used anywhere");

        // map the assignment of required modules to their uses
        const modules = new Map([...this.vars.entries()].filter(([k]) => {
            return this.uses!.uses.some((e) => {
                const node = findParrent(e.location, isVariableDeclaration);

                return node?.name === k;
            });
        }));

        const x = this.getTokenAtOffset(this.offsetAt(position));
        const [requiredModule, exportName] = getLeadingIdentifier(x);

        if (!requiredModule)
            return;

        const [, dec] = [...modules.entries()].find(([, v]) => {
            return v.uses.some(({ location }) => requiredModule === location);
        }) ?? [];

        const moduleId = this.getModuleId(dec);

        if (!moduleId)
            return;

        const res = await sendAndGetData<"rawId">({
            type: "rawId",
            data: {
                id: moduleId,
            },
        })
            .catch(console.error);

        if (res?.data === undefined)
            return;
        res.data = await format(formatModule(res.data, moduleId));
        return {
            range: exportName
                ? new WebpackAstParser(res.data)
                    .findExportLocation(exportName.text)
                : zeroRange,
            uri: mkStringUri(res.data),
        };
    }

    /**
     * gets the module id from a require
     * given
     * ```js
     * var mod = n(123456);
     * ```
     * @argument dec the variable info for that mod
     * @see {@link getVariableInitializer} which can than be passed into {@link vars|vars.get}
     * @returns `123456`
     */
    getModuleId(dec: VariableInfo | undefined): number | undefined {
        if (!dec)
            return undefined;
        if (dec.declarations.length !== 1)
            return undefined;

        const init = findParrent(dec.declarations[0], isVariableDeclaration)?.initializer;

        if (!init || !isCallExpression(init))
            return undefined;
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

        // TODO: support jumping from object literals
        for (const [name] of Object.entries(moduleExports)
            .filter(([, v]) => Array.isArray(v) && v.some((x) => {
                if (!x)
                    return;
                return x.contains(position);
            }))) {
            for (const mod of where?.sync ?? []) {
                const modText = await ModuleCache.getModuleFromNum(mod);

                if (!modText)
                    continue;

                const uses = new WebpackAstParser(modText)
                    .getUsesOfExport(this.moduleId, name);

                locs.push(...uses.map((x) => new Location(ModuleCache.getModuleURI(mod), x)));
            }
        }
        return locs;
    }

    @Cache()
    getExportMap(): ExportMap {
        return {
            ...this.getExportMapWreq_d() ?? {},
            ...this.getExportMapWreq_t() ?? {},
            ...this.getExportMapWreq_e() ?? {},
        };
    }

    /**
     * @param moduleId the module id that the export is from
     * @param exportName the string of the export
     * TODO: support nested exports eg: `wreq(123).ZP.storeMethod()`
     * @returns the ranges where the export is used in this file
     */
    getUsesOfExport(moduleId: string, exportName: string): Range[] {
        if (!this.wreq)
            throw new Error("Wreq is not used in this file");

        const uses: Range[] = [];

        for (const { location } of this.vars.get(this.wreq)?.uses ?? []) {
            if (!isCallExpression(location.parent))
                continue;
            if (location.parent.arguments[0].getText() !== moduleId)
                continue;

            const norm = location?.parent?.parent;

            if (norm && isVariableDeclaration(norm)) {
                if (!isIdentifier(norm.name))
                    continue;

                const importUses = this.vars.get(norm.name);

                for (const { location } of importUses?.uses ?? []) {
                    if (!isPropertyAccessExpression(location.parent))
                        continue;
                    if (!isIdentifier(location.parent.name))
                        continue;

                    if (location.parent.name.getText() !== exportName)
                        continue;

                    uses.push(this.makeRangeFromAstNode(location.parent.name));
                }
                continue;
            }

            const direct = location.parent;

            if (isCallExpression(direct)) {
                if (!isPropertyAccessExpression(direct.parent))
                    continue;
                if (!isIdentifier(direct.parent.name))
                    continue;

                if (direct.parent.name.text !== exportName)
                    continue;

                uses.push(this.makeRangeFromAstNode(direct.parent.name));
            }
        }
        return uses;
    }

    @Cache()
    getExportMapWreq_t(): ExportMap | undefined {
        const wreqT = this.findWreq_t();

        if (!wreqT)
            return undefined;

        const uses = this.vars.get(wreqT);

        if (!uses)
            return undefined;

        return Object.fromEntries(uses.uses.map(({ location }): [string, ExportMap[string]] | false => {
            const [, exportAssignment] = getLeadingIdentifier(location);
            const binary = findParrent(location, isBinaryExpression);

            if (exportAssignment && binary && isIdentifier(binary?.right)) {
                return [
                    exportAssignment.text,
                    [
                        this.makeRangeFromAstNode(exportAssignment),
                        this.makeRangeFromAstNode(binary.right),
                        this.makeRangeFromFunctionDef(binary.right),
                    ],
                ];
            }
            return exportAssignment ? [exportAssignment.text, [this.makeRangeFromAstNode(exportAssignment)]] : false;
        })
            .filter((x) => x !== false) as any);
    }

    /**
     * takes an expression, and maps it to ranges which it is in
     */
    makeExportMapRecursive(node: PropertyAssignment): ExportMap[keyof ExportMap];
    makeExportMapRecursive(node: LiteralToken): ExportMap[keyof ExportMap];
    makeExportMapRecursive(node: ObjectLiteralExpression): ExportMap;
    makeExportMapRecursive(node: AssertedType<AstParser["isFunctionLike"]>): ExportMap[keyof ExportMap];
    makeExportMapRecursive(node: Node): ExportMap[keyof ExportMap] | ExportMap;
    makeExportMapRecursive(node: Node): ExportMap | ExportMap[keyof ExportMap] {
        if (isObjectLiteralExpression(node)) {
            return Object.fromEntries(node.properties.map((x): false | [string, ExportMap[string]] => {
                // wreq.e is used for css class name exports
                if (!isPropertyAssignment(x) || (!isStringLiteral(x.initializer) && !isIdentifier(x.initializer)))
                    return false;
                return [x.name.getText(), this.makeExportMapRecursive(x)];
            })
                .filter((x) => x !== false) as any);
        } else if (this.isLiteralish(node)) {
            return [this.makeRangeFromAstNode(node)];
        } else if (isPropertyAssignment(node)) {
            return [
                this.makeRangeFromAstNode(node.name),
                ...[this.makeExportMapRecursive(node.initializer)].flat(),
            ] as ExportMap[keyof ExportMap];
        } else if (this.isFunctionLike(node)) {
            if (isFunctionDeclaration(node)) {
                if (!node.name)
                    throw new Error("Function declaration has no name, and is not anonymous function");
                return [this.makeRangeFromAstNode(node.name)];
            }
            return [this.makeRangeFromAnonFunction(node)];
        } else if (isCallExpression(node)) {
            return [this.makeRangeFromAstNode(node)];
        } else if (isIdentifier(node)) {
            const trail = this.unwrapVariableDeclaration(node);

            if (!trail || trail.length === 0) {
                outputChannel.warn("Could not find variable declaration for identifier");
                return [];
            }

            const last = this.getVariableInitializer(trail.at(-1)!);

            if (!last) {
                outputChannel.warn("Could not find initializer of identifier");
                return [];
            }
            return this.makeExportMapRecursive(last);
        }
        return [this.makeRangeFromAstNode(node)];
    }

    // FIXME: handle when there is more than one module.exports assignment, eg e = () => {}; e.foo = () => {};
    @Cache()
    getExportMapWreq_e(): ExportMap | undefined {
        const wreqE = this.findWreq_e();

        if (!wreqE)
            return undefined;

        const uses = this.vars.get(wreqE);

        if (!uses)
            return undefined;

        const exportAssignment = uses.uses.find(({ location }) => {
            const [, moduleProp] = getLeadingIdentifier(location);

            return moduleProp?.text === "exports";
        });

        if (!exportAssignment)
            return undefined;

        const exportObject = findParrent(exportAssignment.location, isBinaryExpression)?.right;

        if (!exportObject) {
            outputChannel.debug("Could not find export object");
            return undefined;
        }

        const exports = this.makeExportMapRecursive(exportObject);

        if (Array.isArray(exports)) {
            return {
                [WebpackAstParser.SYM_CJS_DEFAULT]: exports,
            };
        }
        return exports;
    }

    @Cache()
    getExportMapWreq_d(): ExportMap | undefined {
        const wreqD = this.findWreq_d();

        if (!wreqD)
            return;

        const [, exports] = wreqD.arguments;

        return Object.fromEntries(exports.properties.map((x): false | [string, ExportMap[string]] => {
            if (!isPropertyAssignment(x) || !(isArrowFunction(x.initializer) || isFunctionExpression(x.initializer)))
                return false as const;

            let ret: Node | undefined = findReturnIdentifier(x.initializer);

            ret ??= findReturnPropertyAccessExpression(x.initializer);
            return ret != null
                ? [
                    x.name.getText(),
                    [
                        this.makeRangeFromAstNode(x.name),
                        isIdentifier(ret) ? this.makeRangeFromFunctionDef(ret) : undefined,
                    ],
                ]
                : false as const;
        })
            .filter((x) => x !== false) as any);
    }

    findExportLocation(exportName: string): Range {
        return (
            this.tryFindExportwreq_d(exportName)
            || this.tryFindExportWreq_t(exportName)
            || this.tryFindExportsWreq_e(exportName)
            || zeroRange
        );
    }

    @Cache()
    findWreq_d(): (CallExpression & { arguments: [Identifier, ObjectLiteralExpression, ...any]; }) | undefined {
        if (this.uses) {
            const maybeWreqD = this.uses.uses.find((use) => getLeadingIdentifier(use.location)[1]?.text === "d")?.location.parent.parent;

            if (!maybeWreqD || !isCallExpression(maybeWreqD))
                return undefined;
            if (maybeWreqD.arguments.length !== 2
              || !isIdentifier(maybeWreqD.arguments[0])
              || !isObjectLiteralExpression(maybeWreqD.arguments[1]))
                return undefined;
            return maybeWreqD as any;
        }
    }

    tryFindExportwreq_d(exportName: string): Range | undefined {
        if (this.uses) {
            const wreq_dCall = this.findWreq_d();

            if (!wreq_dCall)
                return undefined;

            // the a: function(){return b;} of wreq.d
            const exportCallAssignment = findObjectLiteralByKey(wreq_dCall.arguments[1], exportName);

            if (!exportCallAssignment
              || !isPropertyAssignment(exportCallAssignment)
              || !(isFunctionExpression(exportCallAssignment.initializer)
                || isArrowFunction(exportCallAssignment.initializer)))
                return undefined;

            const exportVar = findReturnIdentifier(exportCallAssignment.initializer);

            if (exportVar) {
                const [exportDec] = [...this.vars.entries()].find(([, v]) => {
                    return v.uses.some((use) => use.location === exportVar);
                }) ?? [];

                if (!exportDec)
                    return undefined;

                return this.makeRangeFromAstNode(exportDec);
            }

            const reExport = findReturnPropertyAccessExpression(exportCallAssignment.initializer);

            if (reExport) {
                return this.makeRangeFromAstNode(reExport.name);
            }
        }
    }

    @Cache()
    findWreq_t(): Identifier | undefined {
        return this.findWebpackArg(1);
    }

    tryFindExportWreq_t(exportName: string): Range | undefined {
        const wreq_t = this.findWreq_t();

        if (!wreq_t)
            return undefined;

        const uses = this.vars.get(wreq_t);

        if (!uses)
            return undefined;

        const exports = uses.uses.find(({ location }) => {
            const [, exportAssignment] = getLeadingIdentifier(location);

            return exportAssignment?.text === exportName;
        });

        return exports ? this.makeRangeFromAstNode(exports.location) : undefined;
    }

    findWreq_e(): Identifier | undefined {
        return this.findWebpackArg(0);
    }

    tryFindExportsWreq_e(exportName: string): Range | undefined {
        const wreq_e = this.findWreq_e();

        if (!wreq_e)
            return undefined;

        const uses = this.vars.get(wreq_e);

        if (!uses)
            return undefined;

        const exportAssignment = uses.uses.find(({ location }) => {
            const [, moduleProp] = getLeadingIdentifier(location);

            return moduleProp?.text === "exports";
        });

        if (!exportAssignment)
            return undefined;

        const exportObject = findParrent(exportAssignment.location, isBinaryExpression)?.right;

        if (!exportObject || !isObjectLiteralExpression(exportObject))
            return undefined;

        const exportItem = findObjectLiteralByKey(exportObject, exportName);

        if (!exportItem)
            return undefined;

        return this.makeRangeFromAstNode(exportItem.name ?? exportItem);
    }
}
