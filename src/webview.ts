/**
 * Manages react webview panels
 */
import { format } from "@modules/format";
import { handleExtractPayload, mkStringUri, sendAndGetData } from "@server";
import { EvaledPatch, ReporterData, WebviewMessage } from "@type/reporter";

import { extensionPath, extensionUri } from "./extension";

import { commands, Disposable, Uri, ViewColumn, WebviewPanel, window } from "vscode";

type Patch = { patch: EvaledPatch; };
type PluginName = { pluginName: string; };
type Diff = { oldModule: string, newModule: string; };
// TODO: add persistant state
export class ReporterPanel {
    /**
     * Track the currently panel. Only allow a single panel to exist at a time.
     */
    public static currentPanel: ReporterPanel | undefined;

    private static readonly viewType = "vencordReporter";

    private readonly _panel: WebviewPanel;
    private readonly _extensionUri: Uri;
    private readonly _extensionPath: string;
    private _disposables: Disposable[] = [];

    public static createOrShow(data: ReporterData) {
        const column = window.activeTextEditor ? window.activeTextEditor.viewColumn : undefined;

        // If we already have a panel, show it.
        // Otherwise, create a new panel.
        // dont create another panel with the same data
        if (ReporterPanel.currentPanel && !data) {
            ReporterPanel.currentPanel._panel.reveal(column);
        } else {
            ReporterPanel.currentPanel = new ReporterPanel(extensionUri, column || ViewColumn.One, data);
        }
    }

    private constructor(extensionUri: Uri, column: ViewColumn, data: ReporterData) {
        this._extensionUri = extensionUri;
        this._extensionPath = extensionPath;

        // Create and show a new webview panel
        this._panel = window.createWebviewPanel(ReporterPanel.viewType, "Vencord Reporter", column, {
            // Enable javascript in the webview
            enableScripts: true,

            // And restric the webview to only loading content from our extension's `media` directory.
            localResourceRoots: [
                Uri.joinPath(extensionUri, "dist/webview")
            ]
        });

        // Set the webview's initial html content
        this._panel.webview.html = this._getHtmlForWebview(data);

        // Listen for when the panel is disposed
        // This happens when the user closes the panel or when the panel is closed programatically
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        // Handle messages from the webview
        this._panel.webview.onDidReceiveMessage(async (message: WebviewMessage) => {
            try {
                switch (message.type) {
                    case "disable": {
                        const { pluginName, enabled }: PluginName & { enabled: boolean; } = message.data;
                        // DISABLE PLUGIN
                        await sendAndGetData({
                            type: "disable",
                            data: {
                                pluginName,
                                enabled
                            }
                        });
                        break;
                    }
                    case "jumpToPatch": {
                        const { patch }: Patch & PluginName = message.data;
                        // any attempt to get this to open without user interaction is a complete shitshow
                        // just use the builtin fuzzy finder and the patch find
                        // while there might be more than one find, the user can deal with that
                        commands.executeCommand("workbench.action.quickOpen", "%" + patch.find);
                        break;
                    }
                    case "extract": {
                        const { patch }: Patch = message.data;
                        if (Number.isNaN(Number(patch.id))) {
                            window.showErrorMessage("Module ID is not a number");
                            return;
                        }
                        try {
                            const r = await sendAndGetData<"extract">({
                                type: "extract",
                                data: {
                                    extractType: "id",
                                    idOrSearch: Number(patch.id),
                                    usePatched: null
                                }
                            });
                            handleExtractPayload(r);
                        } catch (e) {
                            window.showErrorMessage(String(e));
                        }
                        break;
                    }
                    case "diff": {
                        const { oldModule, newModule, id }: Diff & EvaledPatch = message.data;
                        // we cant format code with syntax errors
                        let sourceUri, patchedUri;
                        try {
                            sourceUri = mkStringUri(await format(oldModule));
                            patchedUri = mkStringUri(await format(newModule));
                        } catch (error) {
                            window.showErrorMessage(`Failed to format code, probably a syntax error, ${error}`);
                            sourceUri = mkStringUri(oldModule);
                            patchedUri = mkStringUri(newModule);
                        }
                        commands.executeCommand("vscode.diff", sourceUri, patchedUri, "Patch Diff: " + id);
                        break;
                    }
                    default: {
                        window.showErrorMessage("Unknown message type from webview, got : " + message.type);
                        break;
                    }
                }
            } catch (error) {
                window.showErrorMessage(String(error));
            }
        }, null, this._disposables);
    }

    public dispose() {
        ReporterPanel.currentPanel = undefined;

        // Clean up our resources
        this._panel.dispose();

        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }

    private _getHtmlForWebview(data: ReporterData) {
        const scriptPathOnDisk = Uri.joinPath(this._extensionUri, "dist/webview/index.js");
        const scriptUri = this._panel.webview.asWebviewUri(scriptPathOnDisk);
        const stylePathOnDisk = Uri.joinPath(this._extensionUri, "dist/webview/index.css");
        const styleUri = this._panel.webview.asWebviewUri(stylePathOnDisk);

        // Use a nonce to whitelist which scripts can be run
        const nonce = getNonce();

        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width,initial-scale=1,shrink-to-fit=no">
                <meta name="theme-color" content="#000000">
                <title>React App</title>
                <script nonce="${nonce}">window.reporterData = ${JSON.stringify(data)}</script>
                <link rel="stylesheet" type="text/css" href="${styleUri}">
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${this._panel.webview.cspSource} https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src ${this._panel.webview.cspSource} https:; script-src 'nonce-${nonce}';">

                <base href="${this._panel.webview.asWebviewUri(Uri.joinPath(this._extensionUri, "dist/webview"))}/">
            </head>

            <body>
                <noscript>You need to enable JavaScript to run this app.</noscript>
                <div id="root"></div>
                
                <script defer nonce="${nonce}" src="${scriptUri}"></script>
            </body>
            </html>`;
    }
}

function getNonce() {
    let text = "";
    const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
