import { ExtensionContext, languages, Position, ReferenceProvider as IReferenceProvider, TextDocument, window } from "vscode";

import { Position as WP_Position } from "@vencord-companion/shared/Position";
import { isWebpackModule, WebpackAstParser } from "@vencord-companion/webpack-ast-parser";

import { webpackDefinitionsToVscodeDefinitions } from "@ast/util";
import { ModuleCache, ModuleDepManager } from "@modules/cache";
import { outputChannel } from "@modules/logging";
import { References } from "@type/ast";


export class ReferenceProvider implements IReferenceProvider {
    private constructor() { }

    async provideReferences(document: TextDocument, position: Position): References {
        if (!isWebpackModule(document.getText()))
            return;
        if (!await ModuleCache.hasCache()) {
            window.showErrorMessage("No Module Cache found, please download modules first");
            return;
        }
        if (!ModuleDepManager.hasModDeps()) {
            await ModuleDepManager.initModDeps({
                fromDisk: true,
            });
        }
        try {
            return webpackDefinitionsToVscodeDefinitions(await new WebpackAstParser(document.getText())
                .generateReferences(new WP_Position(position.line, position.character)));
        } catch (e) {
            window.showErrorMessage(String(e));
            outputChannel.error(String(e));
        }
    }

    public static register({ subscriptions }: ExtensionContext) {
        subscriptions.push(languages.registerReferenceProvider({ language: "javascript" }, new ReferenceProvider()));
    }
}
