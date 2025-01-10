import { assert, dir } from "console";
import { ModuleCache, ModuleDepManager } from "modules/cache";
import {
    StringLiteral,
} from "typescript";
import * as vscode from "vscode";

import { WebpackAstParser } from "./WebpackAstParser";

export type Definitions = Promise<
    vscode.Definition | vscode.LocationLink[] | null | undefined
>;
export type References = Promise<vscode.Location[] | null | undefined>;
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
export interface ModuleDeps {
    lazy: string[];
    sync: string[];
}
export interface ExportMap {
    // ranges of code that will count as references to this export
    [exposedName: string]: (vscode.Range | undefined)[];
}

