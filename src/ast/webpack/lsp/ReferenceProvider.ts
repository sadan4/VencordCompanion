import { isWebpackModule } from "@ast/util";
import { WebpackAstParser } from "@ast/webpack";
import { outputChannel } from "@extension";
import { ModuleCache, ModuleDepManager } from "@modules/cache";
import { References } from "@type/ast";

import { CancellationToken, Position, ReferenceContext, ReferenceProvider as IReferenceProvider, TextDocument, window } from "vscode";


export class ReferenceProvider implements IReferenceProvider {
    async provideReferences(document: TextDocument, position: Position, _context: ReferenceContext, _token: CancellationToken): References {
        if(!isWebpackModule(document)) return;
        if (!await ModuleCache.hasCache()) {
            window.showErrorMessage("No Module Cache found, please download modules first");
            return;
        }
        if (!ModuleDepManager.hasModDeps()) {
            await ModuleDepManager.initModDeps({
                fromDisk: true
            });
        }
        try {
            return await new WebpackAstParser(document).generateReferences(document, position);
        } catch (e) {
            outputChannel.appendLine(String(e));
        }
    }

}
