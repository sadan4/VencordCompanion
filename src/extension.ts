import { Discriminate } from "@server/types";
import { DisablePluginData, FindData, OutgoingMessage, PatchData } from "@server/types/send";
import { moduleCache, sendToSockets, startWebSocketServer, stopWebSocketServer } from "@server/webSocketServer";
import treeDataProvider from "sidebar";
import { commands, ExtensionContext, extensions, languages, QuickPickItem, Uri, window as vscWindow, window, workspace } from "vscode";

import PartialModuleJumpCodeLensProvider from "./lenses/PartialModuleJumpCodeLensProvider";
import { PatchCodeLensProvider } from "./lenses/PatchCodeLensProvider";
import PluginDefCodeLensProvider from "./lenses/PluginDefCodeLensProvider";
import { WebpackCodeLensProvider } from "./lenses/WebpackCodeLensProvider";
import { DefinitionProvider } from "./lsp";
import { ModuleCache, ModuleDepManager } from "./modules/cache";
import { startReporter } from "./reporter";
export let extensionUri: Uri;
export let extensionPath: string;
export function activate(context: ExtensionContext) {
	extensionUri = context.extensionUri;
	extensionPath = context.extensionPath;
	startWebSocketServer();
	context.subscriptions.push(
		window.registerTreeDataProvider("vencordSettings", new treeDataProvider()),
		languages.registerCodeLensProvider(
			{ pattern: "**/{plugins,userplugins,plugins/_*}/{*.ts,*.tsx,**/index.ts,**/index.tsx}" },
			new PluginDefCodeLensProvider()
		),
		languages.registerCodeLensProvider(
			{ pattern: "**/{plugins,userplugins,plugins/_*}/{*.ts,*.tsx,**/index.ts,**/index.tsx}" },
			new PatchCodeLensProvider()
		),
		languages.registerDefinitionProvider({ language: "javascript" }, new DefinitionProvider),

		languages.registerCodeLensProvider({ language: "typescript" }, WebpackCodeLensProvider),
		languages.registerCodeLensProvider({ language: "typescriptreact" }, WebpackCodeLensProvider),
		languages.registerCodeLensProvider({ language: "javascript" }, new PartialModuleJumpCodeLensProvider),

		commands.registerCommand("vencord-companion.runReporter", startReporter),
		workspace.registerTextDocumentContentProvider("vencord-companion", {
			async provideTextDocumentContent(uri) {
				// FIXME: full uri shows up in title bar
				const newLocal = Buffer.from(uri.path.substring(1, uri.path.lastIndexOf("/")), "base64url");
				return newLocal.toString();
			},
		}),
		commands.registerCommand("vencord-companion.initDeps", async () => {
			await ModuleDepManager.initModDeps({
				fromDisk: true
			});
		}),
		commands.registerCommand("vencord-companion.testDeps", async () => {
			const currentDoc = window.activeTextEditor?.document.getText();
			if (!currentDoc) {
				return window.showErrorMessage("No active document");
			}
			const moduleId = currentDoc.match(/^\/\/WebpackModule(\d+)/)?.[1];
			if (!moduleId) {
				return window.showErrorMessage("not a webpack module");
			}
			if (!ModuleDepManager.hasModDeps()) {
				await ModuleDepManager.initModDeps({
					fromDisk: true
				});
			}
			const data = ModuleDepManager.getModDeps(moduleId);
			window.showInformationMessage(`Deps for module ${moduleId}\nLazyDeps: ${data.lazyUses}\nSyncDeps: ${data.syncUses}`);
		}),
		commands.registerCommand("vencord-companion.cacheModules", async () => {
			await ModuleCache.downloadModules();
		}),
		commands.registerCommand("vencord-companion.diffModule", async args => {
			if (args)
				return sendToSockets({
					type: "diff",
					data: {
						extractType: "id",
						idOrSearch: args
					}
				}).catch(e => window.showErrorMessage(String(e)));
			const quickPick = window.createQuickPick();
			quickPick.placeholder = "module ID";
			quickPick.canSelectMany = false;
			const items: QuickPickItem[] = [{ label: "", alwaysShow: false }, { label: "", kind: -1 }, ...(moduleCache.map(m => ({ label: m })))];
			quickPick.items = items;
			quickPick.onDidChangeValue(() => {
				if (!moduleCache.includes(quickPick.value)) {
					items[0].label = quickPick.value;
					items[0].alwaysShow = true;

				} else {
					items[0].alwaysShow = false;
				}
				quickPick.items = items;
			});
			quickPick.show();
			quickPick.onDidAccept(async () => {
				const modId = quickPick.value;
				quickPick.dispose();
				if (!modId || isNaN(+modId))
					return vscWindow.showErrorMessage("No Module ID provided");
				try {
					await sendToSockets({
						type: "diff",
						data: {
							extractType: "id",
							idOrSearch: +modId
						},
					});
				} catch (error) {
					vscWindow.showErrorMessage(String(error));
				}
			});


		}),
		commands.registerCommand("vencord-companion.diffModuleSearch", async (args: string, findType: "string" | "regex") => {
			if (args)
				return sendToSockets({
					type: "diff",
					data: {
						extractType: "search",
						findType,
						idOrSearch: args
					}
				}).catch(e => window.showErrorMessage(String(e)));
			const input = await window.showInputBox();
			if (!input)
				return window.showErrorMessage("No Input Provided");
			try {
				await sendToSockets({
					type: "diff",
					data: {
						extractType: "search",
						findType: "string",
						idOrSearch: input
					}
				});
			} catch (error) {
				vscWindow.showErrorMessage(String(error));
			}
		}),
		commands.registerCommand("vencord-companion.extractFind", async (args: Discriminate<OutgoingMessage, "extract">) => {
			if (!args)
				return vscWindow.showErrorMessage("No Data Provided");
			sendToSockets(args).catch(e => window.showErrorMessage(String(e)));
		}),
		commands.registerCommand("vencord-companion.extract", async (args: number) => {
			if (args)
				return sendToSockets({
					type: "extract",
					data: {
						extractType: "id",
						idOrSearch: args
					}
				}).catch(e => window.showErrorMessage(String(e)));
			const quickPick = window.createQuickPick();
			quickPick.placeholder = "module ID";
			quickPick.canSelectMany = false;
			const items: QuickPickItem[] = [{ label: "", alwaysShow: false }, { label: "", kind: -1 }, ...(moduleCache.map(m => { return { label: m }; }))];
			quickPick.items = items;
			quickPick.onDidChangeValue(() => {
				if (!moduleCache.includes(quickPick.value)) {
					items[0].label = quickPick.value;
					items[0].alwaysShow = true;

				} else {
					items[0].alwaysShow = false;
				}
				quickPick.items = items;
			});
			quickPick.show();
			quickPick.onDidAccept(async () => {
				const modId = quickPick.value;
				quickPick.dispose();
				if (!modId || isNaN(+modId))
					return vscWindow.showErrorMessage("No Module ID provided");
				try {
					await sendToSockets({
						type: "extract",
						data: {
							extractType: "id",
							idOrSearch: +modId
						},
					});
				} catch (error) {
					vscWindow.showErrorMessage(String(error));
				}
			});

		}),
		commands.registerCommand("vencord-companion.extractSearch", async (args: string, findType: "string" | "regex") => {
			if (args)
				return sendToSockets({
					type: "extract",
					data: {
						extractType: "search",
						findType,
						idOrSearch: args
					}
				}).catch(e => window.showErrorMessage(String(e)));
			const input = await window.showInputBox();
			if (!input)
				return window.showErrorMessage("No Input Provided");
			try {
				await sendToSockets({
					type: "extract",
					data: {
						extractType: "search",
						findType: "string",
						idOrSearch: input
					}
				});
			} catch (error) {
				vscWindow.showErrorMessage(String(error));
			}
		}),
		commands.registerCommand("vencord-companion.disablePlugin", async (data: DisablePluginData) => {
			try {
				if (!data) throw new Error("No args passed.");
				await sendToSockets({
					type: "disable",
					data
				});
			} catch (error) {
				vscWindow.showErrorMessage(String(error));
			}
		}),
		commands.registerCommand("vencord-companion.testPatch", async (patch: PatchData) => {
			try {
				await sendToSockets({ type: "testPatch", data: patch });
				vscWindow.showInformationMessage("Patch OK!");
			} catch (err) {
				vscWindow.showErrorMessage("Patch failed: " + String(err));
			}
		}),

		commands.registerCommand("vencord-companion.testFind", async (find: FindData) => {
			try {
				await sendToSockets({
					type: "testFind",
					data: find,
				});
				vscWindow.showInformationMessage("Find OK!");
			} catch (err) {
				vscWindow.showErrorMessage("Find bad: " + String(err));
			}
		}),
	);
}

export function deactivate() {
	stopWebSocketServer();
}
