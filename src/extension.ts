import { onEditCallback, onOpenCallback } from "@ast/vencord/diagnostics";
import { I18nHover } from "@ast/vencord/hover";
import { PatchCodeLensProvider, PluginDefCodeLensProvider, WebpackCodeLensProvider } from "@ast/vencord/lenses";
import { PartialModuleJumpCodeLensProvider } from "@ast/webpack/lenses";
import { DefinitionProvider, ReferenceProvider } from "@ast/webpack/lsp";
import { outputChannel } from "@modules/logging";
import { PatchHelper } from "@modules/PatchHelper";
import { handleDiffPayload, handleExtractPayload, moduleCache, sendAndGetData, startWebSocketServer, stopWebSocketServer } from "@server";
import { treeDataProvider } from "@sidebar";
import { SourcePatch } from "@type/ast";
import { Discriminate } from "@type/server";
import { DisablePluginData, FindData, OutgoingMessage, PatchData } from "@type/server/send";

import { startReporter } from "./reporter";

import { commands, ExtensionContext, languages, QuickPickItem, TextDocument, Uri, window as vscWindow, window, workspace } from "vscode";

export let extensionUri: Uri;
export let extensionPath: string;


export function activate(context: ExtensionContext) {
    extensionUri = context.extensionUri;
    extensionPath = context.extensionPath;
    startWebSocketServer();
    context.subscriptions.push(
        window.registerTreeDataProvider("vencordSettings", new treeDataProvider()),
        workspace.onDidChangeTextDocument(onEditCallback),
        workspace.onDidOpenTextDocument(onOpenCallback),
        workspace.onDidCloseTextDocument(PatchHelper.onCloseDocument),
        workspace.onDidChangeTextDocument(PatchHelper.changeDocument),
        window.onDidChangeActiveTextEditor(PatchHelper.changeActiveEditor),
        window.tabGroups.onDidChangeTabs(PatchHelper.onTabClose),
        languages.registerCodeLensProvider(
            { pattern: "**/{plugins,userplugins,plugins/_*}/{*.ts,*.tsx,**/index.ts,**/index.tsx}" },
            new PluginDefCodeLensProvider(),
        ),
        languages.registerCodeLensProvider(
            { pattern: "**/{plugins,userplugins,plugins/_*}/{*.ts,*.tsx,**/index.ts,**/index.tsx}" },
            new PatchCodeLensProvider(),
        ),
        languages.registerDefinitionProvider({ language: "javascript" }, new DefinitionProvider()),
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

