import { debounceAsync, zeroRange } from "@ast/util";
import { VencordAstParser } from "@ast/vencord";
import { outputChannel } from "@modules/logging";
import { sendAndGetData, sockets } from "@server/index";

import { Diagnostic, DiagnosticSeverity, languages, Range, TextDocument, TextDocumentChangeEvent, Uri } from "vscode";

const diagnosticCollection = languages.createDiagnosticCollection("vencord-companion");
const runtimeErrorWarning = new Diagnostic(zeroRange, "An error occured, check the log for more info", DiagnosticSeverity.Warning);
const zeroClientsWarning = new Diagnostic(zeroRange, "No clients connected", DiagnosticSeverity.Warning);

export const updateDiagnostics = debounceAsync(updateDiagnosticsImmediately, 1500);
export function onEditCallback(e: TextDocumentChangeEvent) {
    if (!e)
        return;
    return onOpenCallback(e.document);
}

export function onOpenCallback(e: TextDocument) {
    // when the editor is first opened, the files will be plaintext
    // for some other reason, the file all end in .git
    if (e.languageId !== "typescript" && e.languageId !== "typescriptreact" && !e.fileName.match(/\.tsx?(?:\.git)?$/))
        return;
    updateDiagnostics(e.uri);
}

export function reloadDiagnostics() {
    for (const [uri] of diagnosticCollection) {
        updateDiagnosticsImmediately(uri);
    }
}
async function updateDiagnosticsImmediately(e: Uri) {
    if (sockets.size === 0) {
        diagnosticCollection.set(e, [zeroClientsWarning]);
        return;
    }

    const doc = await VencordAstParser.fromUri(e);

    // Set to filter duplicate error / no client warnings
    const diagnostics = Array.from(new Set((await Promise.all([
        makeFindDiagnostic(doc),
        makePatchDiagnostic(doc),
    ])).flat()));

    diagnosticCollection.set(e, diagnostics);
}
async function makePatchDiagnostic(doc: VencordAstParser): Promise<Diagnostic[]> {
    try {
        return (
            await Promise.all(doc.getPatches()
                .map(async ({ range, ...data }) => ({
                    range,
                    message: await sendAndGetData({
                        type: "testPatch",
                        data,
                    })
                        .then(
                            () => { },
                            (e: string | Error) => (typeof e === "string" ? e : e?.message),
                        ),
                })))
        )
            .filter((e): e is {
                range: Range;
                message: string;
            } => e.message != null)
            .map(({ range, message }) => ({
                range,
                message,
                severity: DiagnosticSeverity.Error,
                source: "Vencord-Companion",
                code: "patch",
            }));
    } catch (e) {
        outputChannel.error(e);
        return [runtimeErrorWarning];
    }
}
async function makeFindDiagnostic(doc: VencordAstParser): Promise<Diagnostic[]> {
    try {
        return (
            await Promise.all(doc.getFinds()
                .map(async ({ range, use }) => ({
                    range,
                    message: await sendAndGetData(use)
                        .then(
                            () => { },
                            (e: string | Error) => (typeof e === "string" ? e : e?.message),
                        ),
                })))
        )
            .filter((e): e is {
                range: Range;
                message: string;
            } => e.message != null)
            .map(({ range, message }) => ({
                range,
                severity: DiagnosticSeverity.Error,
                message,
                source: "Vencord-Companion",
                code: "find",
            }));
    } catch (e) {
        outputChannel.error(e);
        return [runtimeErrorWarning];
    }
}
