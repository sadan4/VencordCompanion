import { isWebpackModule } from "@ast/util";
import { WebpackAstParser } from "@ast/webpack";
import { ModuleCache, ModuleDepManager } from "@modules/cache";
import { outputChannel } from "@modules/logging";
import { References } from "@type/ast";

import { CancellationToken, Position, ReferenceContext, ReferenceProvider as IReferenceProvider, TextDocument, window } from "vscode";


export class ReferenceProvider implements IReferenceProvider {
    // from API
    // eslint-disable-next-line max-params
    async provideReferences(document: TextDocument, position: Position, _context: ReferenceContext, _token: CancellationToken): References {
        if(!isWebpackModule(document.getText())) return;
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
            return await new WebpackAstParser(document.getText()).generateReferences(position);
        } catch (e) {
            outputChannel.error(String(e));
        }
    }

}
