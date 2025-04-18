import { AstParser } from "@ast/AstParser";
import {
    allEntries,
    Cache,
    CacheGetter,
    findObjectLiteralByKey,
    findParent,
    findReturnIdentifier,
    findReturnPropertyAccessExpression,
    getLeadingIdentifier,
    isSyntaxList,
    lastParent,
    zeroRange,
} from "@ast/util";
import { outputChannel } from "@extension";
import { ModuleCache, ModuleDepManager } from "@modules/cache";
import { format } from "@modules/format";
import { formatModule, mkStringUri } from "@modules/util";
import { sendAndGetData } from "@server/index";
import {
    Definitions,
    ExportMap,
    ExportRange,
    ModuleDeps,
    OLD_RawExportMap,
    RawExportMap,
    RawExportRange,
    References,
    Store,
} from "@type/ast";

import { isAccessorDeclaration } from "tsutils";
import { VariableInfo } from "tsutils/util/usage";
import {
    CallExpression,
    createSourceFile,
    Expression,
    Identifier,
    isArrowFunction,
    isBinaryExpression,
    isBlock,
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
    isPropertyAccessExpression,
    isPropertyAssignment,
    isSpreadAssignment,
    isVariableDeclaration,
    NewExpression,
    Node,
    ObjectLiteralExpression,
    PropertyAccessExpression,
    ScriptKind,
    ScriptTarget,
    SourceFile,
} from "typescript";
import { Location, Position, Range } from "vscode";

// FIXME: rewrite to use module cache

export class WebpackAstParser {
    /**
     * This is set on {@link ExportMap} when the default export is commonjs and has no properties, eg, string literal, function
     */
    static readonly SYM_CJS_DEFAULT: unique symbol = Symbol.for("CommonJS Default Export");

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
    get wreq(): Identifier | undefined {
        return this.findWebpackArg();
    }

    /** where {@link WebpackAstParser.wreq this.wreq} is used*/
    get uses(): VariableInfo | undefined {
        return this.wreq && this.vars.get(this.wreq);
    }



    public constructor(text: string) {
        // super(text);
    }

    protected override createSourceFile(): SourceFile {
        return createSourceFile("module.js", this.text, ScriptTarget.ESNext, true, ScriptKind.JS);
    }

    /**
     * @param paramIndex the index of the param 0, 1, 2 etc...
     * @param start finds a webpack arg from the source tree
     * @returns the identifier of the param if found or undef
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
    public getModulesThatThisModuleRequires(): ModuleDeps | null {
        if (!this.wreq || !this.uses)
            return null;

        // flatmaps because .map(...).filter(x => x !== false) isn't a valid typeguard
        /**
         * things like wreq(moduleid)
         */
        const wreqCalls = this.uses.uses
            .map((x) => x.location)
            .flatMap((v) => {
                const p = findParent(v, isCallExpression);

                if (!p || p.expression !== v)
                    return [];

                if (p.arguments.length === 1 && isNumericLiteral(p.arguments[0]))
                    return p.arguments[0].text;
                return [];
            });

        const lazyModules = this.uses.uses
            .map((x) => x.location)
            .flatMap((v) => {
                const [, prop] = getLeadingIdentifier(v);

                if (prop?.text !== "bind")
                    return [];

                const call = findParent(v, isCallExpression);

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
                const node = findParent(e.location, isVariableDeclaration);

                return node?.name === k;
            });
        }));

        const x = this.getTokenAtOffset(this.offsetAt(position));
        const accessChain = findParent(x, isPropertyAccessExpression);

        if (!accessChain)
            return;

        const importChain = this.flattenPropertyAccessExpression(accessChain);

        if (!importChain)
            return;

        const [requiredModule, ...names] = importChain;

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
        if (names.length < 1) {
            return {
                range: zeroRange,
                uri: mkStringUri(res.data),
            };
        }

        const lastParser = new WebpackAstParser(res.data);

        const maybeRange: Range = lastParser
            .findExportLocation(names.map((x) => x.text));

        return {
            range: maybeRange,
            uri: lastParser.mkStringUri(),
        };
        // const maybeRange = new WebpackAstParser(res.data)
        //     .findExportLocation(names.map((x) => x.text));

        // if (maybeRange instanceof Range) {
        //     return {
        //         range: maybeRange,
        //         uri: mkStringUri(res.data),
        //     };
        // }
        // return {
        //     range:
        // names.length >= 1
        //     ? new WebpackAstParser(res.data)
        //         .findExportLocation(names.map((x) => x.text))
        //     : zeroRange,
        //     uri: mkStringUri(res.data),
        // };
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

        const init = findParent(dec.declarations[0], isVariableDeclaration)?.initializer;

        if (!init || !isCallExpression(init))
            return undefined;
        if (init.arguments.length !== 1 || !isNumericLiteral(init.arguments[0]))
            return undefined;

        const num = +init.arguments[0].text;

        return num;
    }

    public async generateReferences(position: Position): References {
        // if (!this.moduleId)
        //     throw new Error("Could not find module id of module to search for references of");

        // if (!ModuleDepManager.hasModDeps()) {
        //     await ModuleDepManager.initModDeps({ fromDisk: true });
        // }

        // const moduleExports = this.getExportMap();
        // const where = await this.getModulesThatRequireThisModule();
        // const locs: Location[] = [];

        // const exportedNames = Object.entries(moduleExports)
        //     .filter(([, v]) => Array.isArray(v) && v.some((x) => {
        //         if (!x)
        //             return;
        //         return x.contains(position);
        //     }));


        // TODO: support jumping from object literals
        for (const [exportedName] of []) {
            // const seen: Record<string, Set<String>> = {};

            // the module id that is being searched for uses
            // the ID of the module that exportName will be imported from
            // the exported name to search
            // type ElementType = [
            //     moduleId: string,
            //     importedId: string,
            //     exportName: string | symbol,
            // ];

            const left: ElementType[] = where?.sync.map((x) => [x, this.moduleId!, exportedName] as const) ?? [];
            // let cur: ElementType | undefined;

            // while ((cur = left.pop())) {
            //     const [modId, importedId, exportedName] = cur;
            //     const modText = await ModuleCache.getModuleFromNum(modId);

            //     if (seen[importedId]?.has(modId)) {
            //         continue;
            //     }
            //     (seen[importedId] ||= new Set()).add(modId);
            //     if (!modText)
            //         continue;

            //     const parser = new WebpackAstParser(modText);
            //     const uses = parser.getUsesOfImport(importedId, exportedName);
            //     const exportedAs = parser.doesReExport(importedId, exportedName);

            //     if (exportedAs) {
            //         const where = await parser.getModulesThatRequireThisModule();

            //         left.push(...where?.sync.map((x) => [x, parser.moduleId!, exportedAs] as ElementType) ?? []);
            //     }

            //     locs.push(...uses.map((x) => new Location(ModuleCache.getModuleURI(modId), x)));
            // }
        }
        // return locs;
    }

    /**
   * @param moduleId the module id that {@link exportName} is from
   * @param exportName the name of the re-exported export
   */
    public doesReExport(
        moduleId: string,
        exportName: string | symbol,
    ): string | symbol | undefined {
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
    getExportMapRaw() {
        return {
            ...this.getExportMapRawWreq_d() ?? {},
            ...this.getExportMapRawWreq_t() ?? {},
            ...this.getExportMapRawWreq_e() ?? {},
        };
    }

    public getExportMapRawWreq_d():
      | OLD_RawExportMap<Identifier | PropertyAccessExpression>
      | undefined {
        const wreqD = this.findWreq_d();

        if (!wreqD)
            return;

        const [, exports] = wreqD.arguments;

        return Object.fromEntries(exports.properties
            .map((x) => {
                if (
                    !isPropertyAssignment(x)
                    || !(
                        isArrowFunction(x.initializer)
                        || isFunctionExpression(x.initializer)
                    )
                )
                    return false;

                const ret
            = findReturnIdentifier(x.initializer)
              ?? findReturnPropertyAccessExpression(x.initializer);

                return ret != null && [x.name.getText(), ret];
            })
            .filter((x) => x !== false));
    }

    public getExportMapRawWreq_e(): OLD_RawExportMap<Expression> | undefined {
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
          = this.flattenPropertyAccessExpression(lastParent(x, isPropertyAccessExpression))?.[2]?.text;

                name ||= WebpackAstParser.SYM_CJS_DEFAULT;

                const ret = findParent(x, isBinaryExpression)?.right;

                return ret && ([name, ret] as const);
            })
            .filter((x) => x !== undefined);

        if (exportAssignments.length === 0)
            return;
        return Object.fromEntries(exportAssignments);
    }

    public getExportMapRawWreq_t(): OLD_RawExportMap<Expression> | undefined {
        const wreqT = this.findWreq_t();

        if (!wreqT)
            return;

        const uses = this.vars.get(wreqT);

        if (!uses)
            return;

        return Object.fromEntries(uses.uses
            .map(({ location }): readonly [string, Expression] | undefined => {
                const [, exportAssignment] = getLeadingIdentifier(location);
                const binary = findParent(location, isBinaryExpression);

                if (exportAssignment && binary?.right) {
                    return [exportAssignment.text, binary.right];
                }
                return undefined;
            })
            .filter((x) => x !== undefined));
    }

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
            const call = findParent(location, isCallExpression);

            return (
                call?.arguments.length === 1 && call.arguments[0].getText() === moduleId
            );
        });

        const ret = findParent(uses?.location, isVariableDeclaration)?.name;

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
                        const call = findParent(loc, isCallExpression);

                        if (
                            !call
                            || call.arguments.length !== 1
                            || call.arguments[0] !== loc
                        )
                            break nmd;

                        // ensure the call is `n.n(...)`
                        const funcExpr = call.expression;

                        // ensure something like `foo.bar`
                        if (
                            !isPropertyAccessExpression(funcExpr)
                            || !isIdentifier(funcExpr.name)
                            || !isIdentifier(funcExpr.expression)
                        )
                            break nmd;
                        // ensure the first part is wreq
                        if (
                            !this.isUseOf(funcExpr.expression, this.wreq)
                            || funcExpr.name.text !== "n"
                        )
                            break nmd;

                        const decl = findParent(funcExpr, isVariableDeclaration)?.name;

                        if (!decl || !isIdentifier(decl))
                            break nmd;

                        this.vars
                            .get(decl)
                            ?.uses?.map((x) => x.location.parent)
                            .filter(isCallExpression)
                            .map((calledUse): Range[] | undefined => {
                                if (exportName === WebpackAstParser.SYM_CJS_DEFAULT) {
                                    // TODO: handle default exports other than just functions
                                    return isCallExpression(calledUse.parent)
                                        ? [this.makeRangeFromAstNode(calledUse)]
                                        : undefined;
                                } else if (typeof exportName === "string") {
                                    const expr = findParent(
                                        calledUse,
                                        isPropertyAccessExpression,
                                    );

                                    if (
                                        !(
                                            !!expr
                                            && expr.expression === calledUse
                                            && expr.name.text === exportName
                                        )
                                    )
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

    getExportMapWreq_t(): ExportMap | undefined {
        const wreqT = this.findWreq_t();

        if (!wreqT)
            return undefined;

        const uses = this.vars.get(wreqT);

        if (!uses)
            return undefined;

        return Object.fromEntries(uses.uses
            .map(({ location }): [string, ExportMap[string]] | false => {
                const [, exportAssignment] = getLeadingIdentifier(location);
                const binary = findParent(location, isBinaryExpression);

                if (exportAssignment && binary && isIdentifier(binary?.right)) {
                    return [
                        exportAssignment.text,
                        [
                            this.makeRangeFromAstNode(exportAssignment),
                            this.makeRangeFromAstNode(binary.right),
                            this.makeRangeFromFunctionDef(binary.right),
                        ].filter((x) => !!x),
                    ];
                }
                return exportAssignment
                    ? [
                        exportAssignment.text,
                        [this.makeRangeFromAstNode(exportAssignment)],
                    ]
                    : false;
            })
            .filter((x) => x !== false) as any);
    }

    rawMakeExportMapRecursive(node: Node | undefined): RawExportMap | RawExportRange {
        if (!node)
            throw new Error("node should not be undefined");
        if (isObjectLiteralExpression(node)) {
            const props = node.properties
                .map((x): false | [string | symbol, RawExportMap[PropertyKey]][] => {
                    if (isSpreadAssignment(x)) {
                        if (!isIdentifier(x.expression)) {
                            outputChannel.error("Spread assignment is not an identifier, this should be handled");
                        }

                        const spread = this.rawMakeExportMapRecursive(x.expression);

                        if (Array.isArray(spread)) {
                            outputChannel.warn("Identifier in object spread is not an object, this should be handled");
                            return false;
                        }

                        const { [WebpackAstParser.SYM_CJS_DEFAULT]: _default, ...rest } = spread;

                        return Object.entries(rest);
                    }
                    return [[x.name.getText(), this.rawMakeExportMapRecursive(x)]];
                })
                .filter((x) => x !== false)
                .flat();

            if (props.length !== 0)
                props.push([WebpackAstParser.SYM_CJS_DEFAULT, [node.getChildAt(0)]]);

            return Object.fromEntries(props);
        } else if (this.isLiteralish(node)) {
            return [node];
        } else if (isPropertyAssignment(node)) {
            const objRange = this.rawMakeExportMapRecursive(node.initializer);

            if (Array.isArray(objRange))
                return [node.name, ...[objRange].flat()];
            return {
                [node.name.getText()]: objRange,
            };
        } else if (this.isFunctionish(node)) {
            wrapperFuncCheck: {
                if (!node.body)
                    break wrapperFuncCheck;
                // if the arrow function returns a simple identifier, use that
                if (isIdentifier(node.body) || isPropertyAccessExpression(node.body)) {
                    const ret = this.rawMakeExportMapRecursive(node.body);

                    if (allEntries(ret).length > 0)
                        return ret;
                }
                if (isBlock(node.body) && node.body.statements.length === 1) {
                    const ident = findReturnIdentifier(node);

                    if (!ident)
                        break wrapperFuncCheck;

                    const ret = this.rawMakeExportMapRecursive(ident);

                    if (allEntries(ret).length > 0)
                        return ret;
                }
            }
            if (node.name)
                return [node.name];
            return [node];
        } else if (isCallExpression(node)) {
            return [node];
        } else if (isIdentifier(node)) {
            const trail = this.unwrapVariableDeclaration(node);

            if (!trail || trail.length === 0) {
                outputChannel.warn("Could not find variable declaration for identifier");
                return [];
            }

            const last = this.getVariableInitializer(trail.at(-1)!);

            if (!last) {
                outputChannel.warn("Could not find initializer of identifier");
                return [trail.at(-1)!];
            }
            return this.rawMakeExportMapRecursive(last);
        }
        return [node];
    }

    rawMapToExportMap(map: RawExportRange): ExportRange;
    rawMapToExportMap(map: RawExportMap): ExportMap;
    rawMapToExportMap(map: RawExportMap | RawExportRange): ExportMap | ExportRange;
    rawMapToExportMap(map: RawExportMap | RawExportRange): ExportMap | ExportRange {
        if (Array.isArray(map)) {
            return map.map((node) => {
                if (this.isFunctionish(node) && !node.name) {
                    return this.makeRangeFromAnonFunction(node);
                }
                return this.makeRangeFromAstNode(node);
            });
        }
        return Object.fromEntries(allEntries(map)
            .map(([k, v]) => {
                return [k, this.rawMapToExportMap(v)];
            }));
    }

    /**
   * takes an expression, and maps it to ranges which it is in
   */
    makeExportMapRecursive(node: Node): ExportMap | ExportRange;
    makeExportMapRecursive(node: Node | undefined): ExportMap | ExportRange {
        if (!node)
            throw new Error("node should not be undefined / falsy");
        return this.rawMapToExportMap(this.rawMakeExportMapRecursive(node));
    }

    // FIXME: handle when there is more than one module.exports assignment, eg e = () => {}; e.foo = () => {};
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

        const exportObject = findParent(
            exportAssignment.location,
            isBinaryExpression,
        )?.right;

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

    getExportMapWreq_d(): ExportMap | undefined {
        const wreqD = this.findWreq_d();

        if (!wreqD)
            return;

        const [, exports] = wreqD.arguments;

        return Object.fromEntries(exports.properties
            .map((x): false | [string, ExportMap[string]] => {
                if (
                    !isPropertyAssignment(x)
                    || !(
                        isArrowFunction(x.initializer)
                        || isFunctionExpression(x.initializer)
                    )
                )
                    return false;

                let lastNode: Node | undefined = findReturnIdentifier(x.initializer);

                lastNode ??= findReturnPropertyAccessExpression(x.initializer);

                let ret: ExportMap | ExportRange | undefined
            = this.tryParseStoreForExport(lastNode, [this.makeRangeFromAstNode(x.name)]);

                ret ||= this.makeExportMapRecursive(x);
                // ensure we arent nested
                ret = (function nestLoop(curName: string | symbol, obj: ExportMap | ExportRange):
                    ExportMap | ExportRange {
                    if (Array.isArray(obj)) {
                        return obj;
                    }

                    const keys = allEntries(obj);

                    if (keys.length === 1) {
                        if (obj[curName]) {
                            return nestLoop(curName, obj[curName]);
                        }

                        const [[key]] = keys;

                        obj[key] = nestLoop(key, obj[key]);
                        return obj;
                    }
                    for (const [k] of keys) {
                        obj[k] = nestLoop(k, obj[k]);
                    }
                    return obj;
                })(x.name.getText(), ret);

                return lastNode != null ? [x.name.getText(), ret] : false;
            })
            .filter((x) => x !== false) as any);
    }

    tryParseStoreForExport(
        node: Node | undefined,
        extraStoreLocs: Range[] = [],
    ): ExportMap | undefined {
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
            const map = this.makeExportMapRecursive(loc);

            ret[name] = map;
        }
        for (const [name, loc] of allEntries(store.props)) {
            const map = this.makeExportMapRecursive(loc);

            ret[name] = map;
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

            const [, events] = args;

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
        // this is the best we can do to ensure something is a store
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
            } else if (isAccessorDeclaration(member)) {
                if (!member.body)
                    continue;
                ret.methods[member.name.getText()] = member;
            } else {
                outputChannel.warn("Unhandled store member type. This should be handled");
            }
        }
        return ret;
    }

    findExportLocation(exportNames: readonly (string | symbol)[]): Range {
        let cur: ExportMap | ExportRange = this.getExportMap();
        let range = zeroRange;
        let i = 0;

        while ((cur = cur[exportNames[i++]])) {
            if (Array.isArray(cur)) {
                const g = cur.at(-1);

                if (g)
                    range = g;
                else
                    outputChannel.error("Empty array of exports");
                break;
                // fallback to the most appropriate thing
                // most of the time, it's the default export
            } else if (Array.isArray(cur[WebpackAstParser.SYM_CJS_DEFAULT])) {
                const g = (cur[WebpackAstParser.SYM_CJS_DEFAULT] as ExportRange).at(-1);

                if (g)
                    range = g;
                else
                    outputChannel.error("Empty array of exports");
            }
        }
        return range;
    // return (
    //     this.tryFindExportwreq_d(exportName)
    //     || this.tryFindExportWreq_t(exportName)
    //     || this.tryFindExportsWreq_e(exportName)
    //     || zeroRange
    // );
    }

    findWreq_d():
    | (Omit<CallExpression, "arguments"> & {
        arguments: readonly [Identifier, ObjectLiteralExpression];
    })
    | undefined {
        if (this.uses) {
            const maybeWreqD = this.uses.uses.find((use) => getLeadingIdentifier(use.location)[1]?.text === "d")?.location.parent.parent;

            if (!maybeWreqD || !isCallExpression(maybeWreqD))
                return undefined;
            if (
                maybeWreqD.arguments.length !== 2
                || !isIdentifier(maybeWreqD.arguments[0])
                || !isObjectLiteralExpression(maybeWreqD.arguments[1])
            )
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
            const exportCallAssignment = findObjectLiteralByKey(
                wreq_dCall.arguments[1],
                exportName,
            );

            if (
                !exportCallAssignment
                || !isPropertyAssignment(exportCallAssignment)
                || !(
                    isFunctionExpression(exportCallAssignment.initializer)
                    || isArrowFunction(exportCallAssignment.initializer)
                )
            )
                return undefined;

            const exportVar = findReturnIdentifier(exportCallAssignment.initializer);

            if (exportVar) {
                const [exportDec]
          = [...this.vars.entries()].find(([, v]) => {
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

        const exportObject = findParent(
            exportAssignment.location,
            isBinaryExpression,
        )?.right;

        if (!exportObject || !isObjectLiteralExpression(exportObject))
            return undefined;

        const exportItem = findObjectLiteralByKey(exportObject, exportName);

        if (!exportItem)
            return undefined;

        return this.makeRangeFromAstNode(exportItem.name ?? exportItem);
    }
}
