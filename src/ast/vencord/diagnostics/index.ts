import { TextDocumentChangeEvent, TextEditor, window } from "vscode";

// const openDocuments: Record<string,
export function onEditorCb(e: TextDocumentChangeEvent) {
    if (!e) return;
    if (e.document.languageId !== "typescript"
        && e.document.languageId !== "typescriptreact") return;
    window.showInformationMessage("editor changes");
}
function updateDiagnostics() {

}


