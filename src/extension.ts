import { ReferenceProvider } from "@ast/webpack/lsp";
import { outputChannel } from "@modules/logging";
import { stopWebSocketServer } from "@server";


import { ExtensionContext, languages, Uri } from "vscode";

export let extensionUri: Uri;
export let extensionPath: string;


export function activate(context: ExtensionContext) {
    extensionUri = context.extensionUri;
    extensionPath = context.extensionPath;
    context.subscriptions.push(

        languages.registerReferenceProvider({ language: "javascript" }, new ReferenceProvider()),


    );

}

export function deactivate() {
    stopWebSocketServer();
}
export {
    outputChannel,
};

