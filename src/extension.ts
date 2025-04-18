import { ReferenceProvider } from "@ast/webpack/lsp";

import { ExtensionContext, languages, Uri } from "vscode";


export function activate(context: ExtensionContext) {
    context.subscriptions.push(

        languages.registerReferenceProvider({ language: "javascript" }, new ReferenceProvider()),


    );

}

export function deactivate() {
}

