import { isWebpackModule } from "@ast/util";
import { WebpackAstParser } from "@ast/webpack";
import { ModuleCache, ModuleDepManager } from "@modules/cache";
import { outputChannel } from "@modules/logging";
import { References } from "@type/ast";

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
            return await new WebpackAstParser(document.getText())
                .generateReferences(position);
        } catch (e) {
            outputChannel.error(String(e));
        }
    }
}
