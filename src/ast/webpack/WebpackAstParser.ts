import { AstParser } from "@ast/AstParser";
import {
    allEntries,
    Cache,
    CacheGetter,
    findObjectLiteralByKey,
    findParrent,
    findReturnIdentifier,
    findReturnPropertyAccessExpression,
    getLeadingIdentifier,
    isSyntaxList,
    lastParrent,
    zeroRange,
} from "@ast/util";
import { outputChannel } from "@extension";
import { ModuleCache, ModuleDepManager } from "@modules/cache";
import { format } from "@modules/format";
import { formatModule, mkStringUri, sendAndGetData } from "@server/index";
import { Definitions, ExportMap, ExportRange, Functionish, ModuleDeps, RawExportMap, References, Store } from "@type/ast";

import { VariableInfo } from "tsutils/util/usage";
import {
    CallExpression,
    createSourceFile,
    Expression,
    Identifier,
    isArrowFunction,
    isBinaryExpression,
    isCallExpression,
    isClassDeclaration,
    isConstructorDeclaration,
    isExpressionStatement,
    isFunctionExpression,
    isIdentifier,
    isMethodDeclaration,
    isNewExpression,
    isNumericLiteral,
    isObjectLiteralExpression,
    isParenthesizedExpression,
    isPropertyAccessExpression,
    isPropertyAssignment,
    isStringLiteral,
    isVariableDeclaration,
    LiteralToken,
    NewExpression,
    Node,
    ObjectLiteralExpression,
    PropertyAccessExpression,
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

    public async getModulesThatRequireThisModule(): Promise<ModuleDeps | null> {
        if (!this.moduleId) {
            return null;
        }

        if (!ModuleDepManager.hasModDeps()) {
            await ModuleDepManager.initModDeps({ fromDisk: true });
        }

        const guh = ModuleDepManager.getModDeps(this.moduleId);

        return {
            lazy: guh.lazyUses,
            sync: guh.syncUses,
        };
    }

    // FIXME: THIS RETURNS TWO DIFFERENT THINGS BASED ON WHETHER THE CACHE IS INITIALIZED OR NOT
    // THAT ARE UNRELATED
    @Cache()
    public getModulesThatThisModuleRequires(): ModuleDeps | null {
        if (!this.wreq || !this.uses)
            return null;

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

        if (!ModuleDepManager.hasModDeps()) {
            await ModuleDepManager.initModDeps({ fromDisk: true });
        }

        const moduleExports = this.getExportMap();
        const where = await this.getModulesThatRequireThisModule();
        const locs: Location[] = [];

        // TODO: support jumping from object literals
        for (const [exportedName] of Object.entries(moduleExports)
            .filter(([, v]) => Array.isArray(v) && v.some((x) => {
                if (!x)
                    return;
                return x.contains(position);
            }))) {
            const seen: Record<string, Set<String>> = {};

            // the module id that is being searched for uses
            // the ID of the module that exportName will be imported from
            // the exported name to search
            type ElementType = [moduleId: string, importedId: string, exportName: string | symbol];

            const left: ElementType[]
                = where?.sync.map((x) => [x, this.moduleId!, exportedName] as const) ?? [];

            let cur: ElementType | undefined;

            while ((cur = left.pop())) {
                const [modId, importedId, exportedName] = cur;
                const modText = await ModuleCache.getModuleFromNum(modId);

                if (seen[importedId]?.has(modId)) {
                    continue;
                }
                (seen[importedId] ||= new Set()).add(modId);
                if (!modText)
                    continue;

                const parser = new WebpackAstParser(modText);
                const uses = parser.getUsesOfImport(importedId, exportedName);
                const exportedAs = parser.doesReExport(importedId, exportedName);

                if (exportedAs) {
                    const where = await parser.getModulesThatRequireThisModule();

                    left.push(...where?.sync.map((x) => [x, parser.moduleId!, exportedAs] as ElementType) ?? []);
                }

                locs.push(...uses.map((x) => new Location(ModuleCache.getModuleURI(modId), x)));
            }
        }
        return locs;
    }

    /**
     * @param moduleId the module id that {@link exportName} is from
     * @param exportName the name of the re-exported export
     */
    public doesReExport(moduleId: string, exportName: string | symbol):
      | string | symbol
      | undefined {
        // we can't re-export anything if we don't import anything
        if (!this.wreq || !this.moduleId)
            return;

        const decl = this.getImportedVar(moduleId);

        if (!decl)
            return;

        // FIXME: handle re-exports as cjs default, Object.entries ignores symbols
        const maybeReExports = Object.entries(this.getExportMapRaw())
            .filter(([, v]) => {
                if (isIdentifier(v)) {
                    return this.isUseOf(v, decl);
                } else if (isPropertyAccessExpression(v)) {
                    const [module, reExport] = getLeadingIdentifier(v);

                    if (!module)
                        return false;
                    // you cant discriminate against destructured unions
                    return this.isUseOf(module, decl) && reExport!.text === exportName;
                }
                outputChannel.warn(`Unhandled type for reExport: ${v.kind}`);
                return false;
            })
            .map(([k]) => k);

        if (maybeReExports.length !== 1) {
            if (maybeReExports.length > 1) {
                throw new Error(`Found more than one reExport for wreq(${moduleId}).${String(exportName)} in ${this.moduleId}`);
            }
            return;
        }
        return maybeReExports[0];
    }

    // TODO: add tests for this func
    /**
     * @returns a map of exported names to the nodes that they are exported from
     */
    @Cache()
    getExportMapRaw() {
        return {
            ...this.getExportMapRawWreq_d() ?? {},
            ...this.getExportMapRawWreq_t() ?? {},
            ...this.getExportMapRawWreq_e() ?? {},
        };
    }

    @Cache()
    public getExportMapRawWreq_d(): RawExportMap<Identifier | PropertyAccessExpression> | undefined {
        const wreqD = this.findWreq_d();

        if (!wreqD)
            return;

        const [, exports] = wreqD.arguments;

        return Object.fromEntries(exports.properties.map((x) => {
            if (!isPropertyAssignment(x) || !(isArrowFunction(x.initializer) || isFunctionExpression(x.initializer)))
                return false;

            const ret = findReturnIdentifier(x.initializer) ?? findReturnPropertyAccessExpression(x.initializer);

            return ret != null && [x.name.getText(), ret];
        })
            .filter((x) => x !== false));
    }

    @Cache()
    public getExportMapRawWreq_e(): RawExportMap<Expression> | undefined {
        const wreqE = this.findWreq_e();

        if (!wreqE)
            return;

        const uses = this.vars.get(wreqE);

        if (!uses)
            return;

        const exportAssignments = uses.uses
            .filter(({ location }) => {
                const [, moduleProp] = getLeadingIdentifier(location);

                return moduleProp?.text === "exports";
            })
            .map((x) => x.location)
            .map((x) => {
                let name: string | symbol | undefined
                    = this.flattenPropertyAccessExpression(lastParrent(x, isPropertyAccessExpression))?.[2]?.text;

                name ||= WebpackAstParser.SYM_CJS_DEFAULT;

                const ret = findParrent(x, isBinaryExpression)?.right;

                return ret && [name, ret] as const;
            })
            .filter((x) => x !== undefined);

        if (exportAssignments.length === 0)
            return;
        return Object.fromEntries(exportAssignments);
    }

    @Cache()
    public getExportMapRawWreq_t(): RawExportMap<Expression> | undefined {
        const wreqT = this.findWreq_t();

        if (!wreqT)
            return;

        const uses = this.vars.get(wreqT);

        if (!uses)
            return;

        return Object.fromEntries(uses.uses.map(({ location }): readonly [string, Expression] | undefined => {
            const [, exportAssignment] = getLeadingIdentifier(location);
            const binary = findParrent(location, isBinaryExpression);

            if (exportAssignment && binary?.right) {
                return [
                    exportAssignment.text,
                    binary.right,
                ];
            }
            return undefined;
        })
            .filter((x) => x !== undefined));
    }

    @Cache()
    getExportMap(): ExportMap {
        return {
            ...this.getExportMapWreq_d() ?? {},
            ...this.getExportMapWreq_t() ?? {},
            ...this.getExportMapWreq_e() ?? {},
        };
    }

    public getImportedVar(moduleId: string): Identifier | undefined {
        if (!this.wreq)
            throw new Error("Wreq is not used in this file");

        const uses = this.uses!.uses.find(({ location }) => {
            const call = findParrent(location, isCallExpression);

            return call?.arguments.length === 1 && call.arguments[0].getText() === moduleId;
        });

        const ret = findParrent(uses?.location, isVariableDeclaration)?.name;

        if (this.isIdentifier(ret))
            return ret;
    }

    /**
     * @param moduleId the imported module id where {@link exportName} is used
     * @param exportName the string of the exported name or {@link SYM_CJS_DEFAULT} for the default export
     * TODO: support nested exports eg: `wreq(123).ZP.storeMethod()`
     * @returns the ranges where the export is used in this file
     */
    getUsesOfImport(moduleId: string, exportName: string | symbol): Range[] {
        if (!this.wreq)
            throw new Error("Wreq is not used in this file");
        if (typeof exportName === "symbol" && exportName !== WebpackAstParser.SYM_CJS_DEFAULT) {
            throw new Error("Invalid symbol for exportName");
        }

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

                // handle things like `var foo = wreq(1), bar = wreq.n(foo)`
                nmd: {
                    if (importUses?.uses.length === 1) {
                        const loc = importUses.uses[0].location;
                        const call = findParrent(loc, isCallExpression);

                        if (!call || call.arguments.length !== 1 || call.arguments[0] !== loc)
                            break nmd;

                        // ensure the call is `n.n(...)`
                        const funcExpr = call.expression;

                        // ensure something like `foo.bar`
                        if (!isPropertyAccessExpression(funcExpr)
                          || !isIdentifier(funcExpr.name)
                          || !isIdentifier(funcExpr.expression))
                            break nmd;
                        // ensure the first part is wreq
                        if (!this.isUseOf(funcExpr.expression, this.wreq)
                          || funcExpr.name.text !== "n")
                            break nmd;

                        const decl = findParrent(funcExpr, isVariableDeclaration)?.name;

                        if (!decl || !isIdentifier(decl))
                            break nmd;

                        this.vars.get(decl)
                            ?.uses
                            ?.map((x) => x.location.parent)
                            .filter(isCallExpression)
                            .map((calledUse): Range[] | undefined => {
                                if (exportName === WebpackAstParser.SYM_CJS_DEFAULT) {
                                    // TODO: handle default exports other than just functions
                                    return isCallExpression(calledUse.parent)
                                        ? [this.makeRangeFromAstNode(calledUse)]
                                        : undefined;
                                } else if (typeof exportName === "string") {
                                    const expr = findParrent(calledUse, isPropertyAccessExpression);

                                    if (!(!!expr && expr.expression === calledUse && expr.name.text === exportName))
                                        return undefined;

                                    return [this.makeRangeFromAstNode(expr.name)];
                                }
                                throw new Error("Invalid exportName");
                            })
                            .filter((x) => x !== undefined)
                            .forEach((use) => {
                                const final = use.at(-1);

                                if (!final)
                                    throw new Error("Final is undefined, this should have been filtered out by the previous line as there should be no empty arrays");

                                uses.push(final);
                            });
                    }
                }

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
    makeExportMapRecursive(node: ObjectLiteralExpression): ExportMap;
    makeExportMapRecursive(node: LiteralToken): ExportRange;
    makeExportMapRecursive(node: PropertyAssignment): ExportRange;
    makeExportMapRecursive(node: Functionish): ExportRange;
    makeExportMapRecursive(node: CallExpression): ExportRange;
    makeExportMapRecursive(node: Node): ExportRange;
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
            ];
        } else if (this.isFunctionish(node)) {
            if (node.name) {
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
                return false;

            let lastNode: Node | undefined = findReturnIdentifier(x.initializer);

            lastNode ??= findReturnPropertyAccessExpression(x.initializer);

            let ret: ExportMap | ExportRange | undefined
                = this.tryParseStoreForExport(lastNode, [this.makeRangeFromAstNode(x.name)]);

            if (!ret)
                if (this.isIdentifier(lastNode))
                    ret = [this.makeRangeFromAstNode(x.name), this.makeRangeFromFunctionDef(lastNode)];
                else
                    ret = [undefined];

            return lastNode != null
                ? [x.name.getText(), ret]
                : false;
        })
            .filter((x) => x !== false) as any);
    }

    tryParseStoreForExport(node: Node | undefined, extraStoreLocs: Range[] = []): ExportMap | undefined {
        if (!node)
            return;

        if (!isIdentifier(node)) {
            outputChannel.debug("Could not find identifier for store export");
            return;
        }

        const decl = this.getVarInfoFromUse(node);

        if (!decl)
            return;

        const allUses = decl.uses
            .map(({ location }) => location)
            .concat(...decl.declarations);

        // find where it's set to the new store
        // there should never be more than one assignment
        const uses = allUses.filter((ident) => {
            return this.isVariableAssignmentLike(ident.parent);
        });

        if (uses.length === 0) {
            return;
        } else if (uses.length > 1) {
            outputChannel.warn(`Found more than one store assignment in module ${this.moduleId}, this should not happen`);
            return;
        }

        const [use] = uses;

        const initializer = (() => {
            if (isVariableDeclaration(use.parent)) {
                if (!use.parent.initializer) {
                    throw new Error("Variable declaration has no initializer, this should be filtered out by the previous isVariableAssignmentLike check");
                }
                return use.parent.initializer;
            } else if (this.isAssignmentExpression(use.parent)) {
                return use.parent.right;
            }
            throw new Error("Unexpected type for use, this should not happen");
        })();

        if (!isNewExpression(initializer))
            return;

        const store = this.tryParseStore(initializer);

        if (!store) {
            outputChannel.debug("Failed to parse store");
            return;
        }

        const ret: ExportMap = {};
        const def: Range[] = [];

        def.push(...extraStoreLocs);
        def.push(...store.store.map((x) => this.makeRangeFromAstNode(x)));
        ret[WebpackAstParser.SYM_CJS_DEFAULT] = def;
        for (const [name, loc] of allEntries(store.methods)) {
            const ranges = this.makeExportMapRecursive(loc)
                .filter((x) => x !== undefined);

            ret[name] = ranges;
        }
        for (const [name, loc] of allEntries(store.props)) {
            const ranges = this.makeExportMapRecursive(loc)
                .filter((x) => x !== undefined);

            ret[name] = ranges;
        }
        return ret;
    }

    // TODO: test this
    tryParseStore(storeInit: NewExpression): Store | undefined {
        const ret: Store = {
            store: [],
            fluxEvents: {},
            methods: {},
            props: {},
        };

        const storeVar = storeInit.expression;
        const args = storeInit.arguments;

        parseArgs: {
            if (!args)
                break parseArgs;

            if (args.length !== 2) {
                outputChannel.warn(`Incorrect number of arguments for a store instantiation, expected 2, found ${args?.length}`);
                break parseArgs;
            }

            const [,events] = args;

            if (!isObjectLiteralExpression(events)) {
                outputChannel.warn("Expected the flux events to be an object literal expression");
                break parseArgs;
            }
            // FIXME: extract into function
            for (const prop of events.properties) {
                if (!isPropertyAssignment(prop)) {
                    outputChannel.debug("found prob that is not a property assignment, this should be handled");
                    continue;
                }
                ret.fluxEvents[prop.name.getText()] = [prop.initializer];
                if (isIdentifier(prop.initializer)) {
                    const trail = this.unwrapVariableDeclaration(prop.initializer)
                        ?.toReversed();

                    if (trail)
                        ret.fluxEvents[prop.name.getText()].push(...trail);
                }
            }
        }
        if (!isIdentifier(storeVar)) {
            // TODO: parse this
            outputChannel.debug("anything than an identifier is not supported for store instantiations yet");
            return;
        }
        ret.store.push(storeVar);

        const storeVarInfo = this.getVarInfoFromUse(storeVar);

        if (!storeVarInfo || storeVarInfo.declarations.length === 0) {
            outputChannel.debug("Could not find store declaration");
            return;
        }
        if (storeVarInfo.declarations.length > 1) {
            outputChannel.warn("Found more than one store declaration, this should not happen");
            return;
        }

        const [decl] = storeVarInfo.declarations;

        ret.store.push(decl);

        const classDecl = decl.parent;

        if (!isClassDeclaration(classDecl)) {
            outputChannel.warn("Store decl is not a class");
            return;
        }

        // check if any of the extends clauses extend Store
        // TODO: make sure it does not extend a component
        const doesExtend = (classDecl.heritageClauses?.length ?? -1) > 0;

        if (!doesExtend) {
            outputChannel.debug("Store class does not extend Store");
            return;
        }

        for (const member of classDecl.members) {
            if (isMethodDeclaration(member)) {
                if (!member.body)
                    continue;
                ret.methods[member.name.getText()] = member;
                continue;
            } else if (isConstructorDeclaration(member)) {
                ret.store.push(member);
            } else if (isPropertyAssignment(member)) {
                ret.props[member.name.getText()] = member.initializer;
            } else {
                outputChannel.warn("Unhandled store member type. This should be handled");
            }
        }
        // since we cannot test if it extends a store, check if it has the required initialize method
        if (!("initialize" in ret.methods)) {
            outputChannel.warn("Store class does not have an initialize method");
            return;
        }
        return ret;
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
    findWreq_d(): (Omit<CallExpression, "arguments"> & { arguments: readonly [Identifier, ObjectLiteralExpression]; }) | undefined {
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
