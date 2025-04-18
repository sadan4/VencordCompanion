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

    /** where {@link WebpackAstParser.wreq this.wreq} is used*/
    get uses(): VariableInfo | undefined {
        return this.wreq && this.vars.get(this.wreq);
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

}
