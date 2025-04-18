import { onEditCallback, onOpenCallback } from "@ast/vencord/diagnostics";
import { PatchCodeLensProvider, PluginDefCodeLensProvider } from "@ast/vencord/lenses";
import { DefinitionProvider, ReferenceProvider } from "@ast/webpack/lsp";
import { outputChannel } from "@modules/logging";
import { PatchHelper } from "@modules/PatchHelper";
import { startWebSocketServer, stopWebSocketServer } from "@server";
import { treeDataProvider } from "@sidebar";


import { ExtensionContext, languages, Uri, window, workspace } from "vscode";

export let extensionUri: Uri;
export let extensionPath: string;


export function activate(context: ExtensionContext) {
    extensionUri = context.extensionUri;
    extensionPath = context.extensionPath;
    startWebSocketServer();
    context.subscriptions.push(

        languages.registerReferenceProvider({ language: "javascript" }, new ReferenceProvider()),


    );
    if (window.activeTextEditor) {
        onOpenCallback(window.activeTextEditor.document);
    }
}

export function deactivate() {
    stopWebSocketServer();
}
export {
    outputChannel,
};

