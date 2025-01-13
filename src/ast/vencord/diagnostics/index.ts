import { debounce, debounceAsync } from "@ast/util";
import { VencordAstParser } from "@ast/vencord";
import { sendAndGetData } from "@server/index";

import { Diagnostic, DiagnosticSeverity, languages, Range, TextDocumentChangeEvent, TextEditor, Uri, window } from "vscode";

const diagnosticCollection = languages.createDiagnosticCollection("vencord-companion");

export function onEditorCb(e: TextDocumentChangeEvent) {
    if (!e) return;
    if (e.document.languageId !== "typescript"
        && e.document.languageId !== "typescriptreact") return;
    updateDiagnostics(e.document.uri);
}
const updateDiagnostics = debounceAsync(
    async function (e: Uri) {
        console.log("func called");
        const doc = await VencordAstParser.fromUri(e);
        console.log(doc.getFinds(), "g");
        const finds = (await Promise.all(
            doc.getFinds().map(async ({ range, use }) => ({
                range,
                use: await (sendAndGetData(use)
                    .then(e => null, (e: string) => e)),
            }))
        )).filter((e): e is { range: Range, use: string } => e.use !== null);
        console.log(finds, "finds");
        diagnosticCollection.set(e, finds.map(x => new Diagnostic(x.range, x.use, DiagnosticSeverity.Error)));
    },
    500
);

