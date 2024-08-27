/**
 * Manages react webview panels
 */
import path = require("path");
import * as vscode from "vscode"
import { extensionPath, extensionUri } from "./extension";
import { ReporterData, WebviewMessage } from "./types";
export class ReporterPanel {
	/**
	 * Track the currently panel. Only allow a single panel to exist at a time.
	 */
	public static currentPanel: ReporterPanel | undefined;

	private static readonly viewType = 'vencordReporter';

	private readonly _panel: vscode.WebviewPanel;
	private readonly _extensionUri: vscode.Uri;
	private readonly _extensionPath: string;
	private _disposables: vscode.Disposable[] = [];

	public static createOrShow(data: ReporterData) {
		const column = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.viewColumn : undefined;

		// If we already have a panel, show it.
		// Otherwise, create a new panel.
		// dont create another panel with the same data
		if (ReporterPanel.currentPanel && !data) {
			ReporterPanel.currentPanel._panel.reveal(column);
		} else {
			ReporterPanel.currentPanel = new ReporterPanel(extensionUri, column || vscode.ViewColumn.One, data);
		}
	}

	private constructor(extensionUri: vscode.Uri, column: vscode.ViewColumn, data: ReporterData) {
		this._extensionUri = extensionUri;
		this._extensionPath = extensionPath

		// Create and show a new webview panel
		this._panel = vscode.window.createWebviewPanel(ReporterPanel.viewType, "Vencord Reporter", column, {
			// Enable javascript in the webview
			enableScripts: true,

			// And restric the webview to only loading content from our extension's `media` directory.
			localResourceRoots: [
				vscode.Uri.joinPath(extensionUri, "dist/webview")
			]
		});

		// Set the webview's initial html content 
		this._panel.webview.html = this._getHtmlForWebview(data);

		// Listen for when the panel is disposed
		// This happens when the user closes the panel or when the panel is closed programatically
		this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

		// Handle messages from the webview
		this._panel.webview.onDidReceiveMessage((message: WebviewMessage) => {
			switch (message.type) {
				case "disable": {
					const { pluingName } = message.data;
					//DISABLE PLUGIN
					break;
				}
				case "gotopatch": {
					const { patch } = message.data;
					// jump to patch
					break;
				}
				case "extract": {
					const { moduleNumber } = message.data;
					break;
				}
				case "diff": {
					const {moduleNumber} = message.data;
					break;
				}
				default: {
					vscode.window.showErrorMessage("Unknown message type from webview, got : " + message.type)
					break;
				}
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
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const manifest = require(path.join(this._extensionPath, 'dist/webview', 'asset-manifest.json'));
		const mainScript = manifest['files']['main.js'];
		const mainStyle = manifest['files']['main.css'];

		const scriptPathOnDisk = vscode.Uri.joinPath(this._extensionUri, 'dist/webview', mainScript);
		const scriptUri = this._panel.webview.asWebviewUri(scriptPathOnDisk)
		const stylePathOnDisk = vscode.Uri.joinPath(this._extensionUri, 'dist/webview', mainStyle);
		const styleUri = this._panel.webview.asWebviewUri(stylePathOnDisk)

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

				<base href="${this._panel.webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'dist/webview'))}/">
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