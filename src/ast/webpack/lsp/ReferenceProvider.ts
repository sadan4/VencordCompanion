import { webpackDefinitionsToVscodeDefinitions } from "@ast/util";
import { ModuleCache, ModuleDepManager } from "@modules/cache";
import { outputChannel } from "@modules/logging";
import { References } from "@type/ast";
import { Position as WP_Position } from "@vencord-companion/shared/Position";
import { isWebpackModule, WebpackAstParser } from "@vencord-companion/webpack-ast-parser";

import { Position, ReferenceProvider as IReferenceProvider, TextDocument, window } from "vscode";


export class ReferenceProvider implements IReferenceProvider {
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
}
