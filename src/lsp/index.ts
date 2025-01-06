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
    isWreq_d,
    makeRange,
    zeroRange,
} from "./util";
import ts = require("typescript");
import format from "../format";
import exp = require("constants");
import { lchown } from "fs";

type Definitions = Promise<
    vscode.Definition | vscode.LocationLink[] | null | undefined
>;

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

    public constructor(text: string) {
        this.text = text;
        this.sourceFile = createSourceFile(
            "module.js",
            this.text,
            ScriptTarget.ESNext,
            true,
            ScriptKind.JS
        );
        this.vars = collectVariableUsage(this.sourceFile);

        this.wreq = findWebpackArg(this.sourceFile);

        this.uses = this.wreq && this.vars.get(this.wreq);
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
        const res = await sendAndGetData<{ data: string; }>({
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

    public findExportLocation(exportName: string): vscode.Range {
        return (
            this.tryFindExportwreq_d(exportName) ||
            this.tryFindExportWreq_t(exportName) ||
            this.tryFindExportsWreq_e(exportName) ||
            zeroRange
        );
    }

    private tryFindExportwreq_d(exportName: string): vscode.Range | undefined {
        if (this.uses) {
            const wreq_dCall = this.uses.uses.find(isWreq_d)?.location.parent.parent;
            if (!wreq_dCall || !ts.isCallExpression(wreq_dCall)) return undefined;

            if (
                wreq_dCall.arguments.length !== 2 ||
                !ts.isIdentifier(wreq_dCall.arguments[0]) ||
                !ts.isObjectLiteralExpression(wreq_dCall.arguments[1])
            )
                return undefined;

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

    private tryFindExportWreq_t(exportName: string): vscode.Range | undefined {
        const wreq_t = findWebpackArg(this.sourceFile, 1);

        if (!wreq_t) return undefined;

        const uses = this.vars.get(wreq_t);

        if (!uses) return undefined;

        const exports = uses.uses.find(({ location }) => {
            const [, exportAssignment] = getLeadingIdentifier(location);
            return exportAssignment?.text === exportName;
        });

        return exports ? makeRange(exports.location, this.text) : undefined;
    }

    private tryFindExportsWreq_e(exportName: string): vscode.Range | undefined {
        const wreq_e = findWebpackArg(this.sourceFile, 0);

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
