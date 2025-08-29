import { toVscodeRange } from "@ast/util";
import { VencordAstParser } from "@vencord-companion/vencord-ast-parser";

import { CodeLens, CodeLensProvider, TextDocument } from "vscode";

export class PatchCodeLensProvider implements CodeLensProvider {
    provideCodeLenses(document: TextDocument) {
        const lenses: CodeLens[] = [];
        const file = new VencordAstParser(document.getText(), document.uri.fsPath);
        const patches = file.getPatches();

        for (const { range, ...data } of patches) {
            lenses.push(new CodeLens(toVscodeRange(range), {
                title: "View Module",
                command: "vencord-companion.extractSearch",
                arguments: [data.find, data.findType],
                tooltip: "View Module",
            }));
            lenses.push(new CodeLens(toVscodeRange(range), {
                title: "Diff Module",
                command: "vencord-companion.diffModuleSearch",
                arguments: [data.find, data.findType],
                tooltip: "Diff Module",
            }));
            lenses.push(new CodeLens(toVscodeRange(range), {
                title: "Test Patch",
                command: "vencord-companion.testPatch",
                arguments: [data],
                tooltip: "Test Patch",
            }));
            lenses.push(new CodeLens(toVscodeRange(range), {
                title: "Open in Patch Helper",
                tooltip: "Opens the patch in patch helper, if another patch from this file is already open, it will be replaced",
                command: "vencord-companion.openPatchHelper",
                arguments: [document, data],
            }));
        }
        return lenses;
    }
}
