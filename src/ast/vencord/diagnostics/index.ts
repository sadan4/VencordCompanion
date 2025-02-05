import { debounceAsync, zeroRange } from "@ast/util";
import { VencordAstParser } from "@ast/vencord";
import { sendAndGetData, sockets } from "@server/index";

import { Diagnostic, DiagnosticSeverity, languages, Range, TextDocument, TextDocumentChangeEvent, Uri } from "vscode";

const diagnosticCollection = languages.createDiagnosticCollection("vencord-companion");

export function onEditCallback(e: TextDocumentChangeEvent) {
    if (!e) return;
    return onOpenCallback(e.document);
}

export function onOpenCallback(e: TextDocument) {
    // when the editor is first opened, the files will be plaintext
    // for some other reason, the file all end in .git
    if (e.languageId !== "typescript" && e.languageId !== "typescriptreact" && !e.fileName.match(/\.tsx?(?:\.git)?$/)) return;
    updateDiagnostics(e.uri);
}

export function reloadDiagnostics() {
    for (const [uri] of diagnosticCollection) {
        updateDiagnosticsImeaditely(uri);
    }
}
export const updateDiagnostics = debounceAsync(
    updateDiagnosticsImeaditely,
    1500
);
async function updateDiagnosticsImeaditely(e: Uri) {
    if (sockets.size === 0) {
        diagnosticCollection.set(e, [makeNoClientsWarning()]);
        return;
    }
    const doc = await VencordAstParser.fromUri(e);
    const diagnostics = (await Promise.all([makeFindDiagnostic(doc), makePatchDiagnostic(doc)])).flat();
    diagnosticCollection.set(e, diagnostics);
}
async function makePatchDiagnostic(doc: VencordAstParser): Promise<Diagnostic[]> {
    return (
        await Promise.all(
            doc.getPatches().map(async ({ range, ...data }) => ({
                range,
                message: await sendAndGetData({
                    type: "testPatch",
                    data,
                }).then(
                    () => {},
                    (e: string | Error) => (typeof e === "string" ? e : e?.message)
                ),
            }))
        )
    )
        .filter((e): e is { range: Range; message: string; } => e.message !== null)
        .map(({ range, message }) => ({
            range: range,
            message: message,
            severity: DiagnosticSeverity.Error,
            source: "Vencord-Companion",
            code: "patch",
        }));
}
async function makeFindDiagnostic(doc: VencordAstParser): Promise<Diagnostic[]> {
    return (
        await Promise.all(
            doc.getFinds().map(async ({ range, use }) => ({
                range,
                message: await sendAndGetData(use).then(
                    () => {},
                    (e: string | Error) => (typeof e === "string" ? e : e?.message)
                ),
            }))
        )
    )
        .filter((e): e is { range: Range; message: string; } => e.message !== null)
        .map(({ range, message }) => ({
            range: range,
            severity: DiagnosticSeverity.Error,
            message: message,
            source: "Vencord-Companion",
            code: "find",
        }));
}
function makeNoClientsWarning(): Diagnostic {
    return new Diagnostic(zeroRange, "No clients connected", DiagnosticSeverity.Warning);
}
