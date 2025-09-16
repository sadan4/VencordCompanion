import { onEditCallback, onOpenCallback } from "@ast/vencord/diagnostics";
import { I18nHover } from "@ast/vencord/hover";
import { PatchCodeLensProvider, PluginDefCodeLensProvider, WebpackCodeLensProvider } from "@ast/vencord/lenses";
import { WebpackI18nHover } from "@ast/webpack/hover";
import { PartialModuleJumpCodeLensProvider } from "@ast/webpack/lenses";
import { DefinitionProvider, ReferenceProvider } from "@ast/webpack/lsp";
import { ModuleCache, ModuleDepManager } from "@modules/cache";
import { outputChannel } from "@modules/logging";
import { PatchHelper } from "@modules/PatchHelper";
import { handleDiffPayload, handleExtractPayload, moduleCache, sendAndGetData, startWebSocketServer, stopWebSocketServer } from "@server";
import { treeDataProvider } from "@sidebar";
import { Discriminate } from "@type/server";
import { DisablePluginData, FindData, OutgoingMessage, PatchData } from "@type/server/send";
import { setLogger as setAstLogger } from "@vencord-companion/ast-parser";
import { SourcePatch } from "@vencord-companion/vencord-ast-parser";
import { setLogger as setWebpackLogger, WebpackAstParser } from "@vencord-companion/webpack-ast-parser";

import { Settings } from "./settings";

import * as child_process from "child_process";
import { promisify } from "util";

import { commands, ExtensionContext, languages, QuickPickItem, TextDocument, Uri, window as vscWindow, window, workspace } from "vscode";

export let extensionUri: Uri;
export let extensionPath: string;

const exec = promisify(child_process.exec);

export async function activate(context: ExtensionContext) {
    setAstLogger(outputChannel);
    setWebpackLogger(outputChannel);
    WebpackAstParser.setDefaultModuleCache({
        async getLatestModuleFromNum(id) {
            const { data } = await sendAndGetData<"rawId">({
                type: "rawId",
                data: {
                    id: +id,
                },
            });

            return data;
        },
        getModuleFilepath(id) {
            return ModuleCache.getModulePath(id);
        },
        getModuleFromNum(id) {
            return ModuleCache.getModuleFromNum(id);
        },
    });
    WebpackAstParser.setDefaultModuleDepManager({
        getModDeps(moduleId) {
            return ModuleDepManager.getModDeps(moduleId);
        },
    });
    extensionUri = context.extensionUri;
    extensionPath = context.extensionPath;
    if (await isVencordRepo())
        startWebSocketServer();

    WebpackI18nHover.register(context);

    context.subscriptions.push(
        window.registerTreeDataProvider("vencordSettings", new treeDataProvider()),
        workspace.onDidChangeTextDocument(onEditCallback),
        workspace.onDidOpenTextDocument(onOpenCallback),
        workspace.onDidCloseTextDocument(PatchHelper.onCloseDocument),
        workspace.onDidChangeTextDocument(PatchHelper.changeDocument),
        window.onDidChangeActiveTextEditor(PatchHelper.changeActiveEditor),
        window.tabGroups.onDidChangeTabs(PatchHelper.onTabClose),
        languages.registerCodeLensProvider(
            { pattern: "**/{*plugins,plugins/_*}/{*.ts,*.tsx,**/index.ts,**/index.tsx}" },
            new PluginDefCodeLensProvider(),
        ),
        languages.registerCodeLensProvider(
            { pattern: "**/{*plugins,plugins/_*}/{*.ts,*.tsx,**/index.ts,**/index.tsx}" },
            new PatchCodeLensProvider(),
        ),
        languages.registerDefinitionProvider({ language: "javascript" }, new DefinitionProvider()),
        languages.registerReferenceProvider({ language: "javascript" }, new ReferenceProvider()),

        languages.registerCodeLensProvider({ language: "typescript" }, WebpackCodeLensProvider),
        languages.registerCodeLensProvider({ language: "typescriptreact" }, WebpackCodeLensProvider),
        languages.registerCodeLensProvider({ language: "javascript" }, new PartialModuleJumpCodeLensProvider()),
        languages.registerHoverProvider({ language: "typescript" }, new I18nHover()),
        languages.registerHoverProvider({ language: "typescriptreact" }, new I18nHover()),
        workspace.registerTextDocumentContentProvider("vencord-patchhelper", PatchHelper),
        workspace.registerTextDocumentContentProvider("vencord-companion", {
            provideTextDocumentContent(uri) {
                // FIXME: full uri shows up in title bar
                const newLocal = Buffer.from(uri.path.substring(1, uri.path.lastIndexOf("/")), "base64url");

                return newLocal.toString();
            },
        }),
        commands.registerCommand("vencord-companion.openPatchHelper", async (doc: TextDocument, patch: SourcePatch) => {
            if (!doc) {
                outputChannel.warn("Could not find source document");
                window.showErrorMessage("Could not find source document");
                return;
            }

            const helper = await PatchHelper.create(doc, patch);

            helper.openModuleWindow();
        }),
        commands.registerCommand("vencord-companion.diffModule", async (args) => {
            if (args) {
                try {
                    const r = await sendAndGetData<"diff">({
                        type: "diff",
                        data: {
                            extractType: "id",
                            idOrSearch: args,
                        },
                    });

                    handleDiffPayload(r);
                } catch (e) {
                    outputChannel.error(String(e));
                    window.showErrorMessage(String(e));
                }
                return;
            }

            // FIXME: refactor to generic quicpick class with these features
            const quickPick = window.createQuickPick();

            quickPick.placeholder = "module ID";
            quickPick.canSelectMany = false;

            const items: QuickPickItem[] = [
                {
                    label: "",
                    alwaysShow: false,
                },
                {
                    label: "",
                    kind: -1,
                },
                ...moduleCache.map((m) => ({ label: m })),
            ];

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
                    const r = await sendAndGetData<"diff">({
                        type: "diff",
                        data: {
                            extractType: "id",
                            idOrSearch: +modId,
                        },
                    });

                    handleDiffPayload(r);
                } catch (error) {
                    outputChannel.error(String(error));
                    vscWindow.showErrorMessage(String(error));
                }
            });
        }),
        commands.registerCommand("vencord-companion.diffModuleSearch", async (args: string, findType: "string" | "regex") => {
            if (args) {
                try {
                    const r = await sendAndGetData<"diff">({
                        type: "diff",
                        data: {
                            extractType: "search",
                            findType,
                            idOrSearch: args,
                        },
                    });

                    handleDiffPayload(r);
                    return;
                } catch (e) {
                    outputChannel.error(String(e));
                    window.showErrorMessage(String(e));
                }
                return;
            }

            const input = await window.showInputBox();

            if (!input) {
                outputChannel.warn("No Input Provided");
                return window.showErrorMessage("No Input Provided");
            }
            try {
                const r = await sendAndGetData<"diff">({
                    type: "diff",
                    data: {
                        extractType: "search",
                        findType: "string",
                        idOrSearch: input,
                    },
                });

                handleDiffPayload(r);
            } catch (e) {
                outputChannel.error(String(e));
                vscWindow.showErrorMessage(String(e));
            }
        }),
        commands.registerCommand("vencord-companion.extractFind", async (args: Discriminate<OutgoingMessage, "extract">) => {
            if (!args) {
                outputChannel.warn("No Data Provided");
                vscWindow.showErrorMessage("No Data Provided");
                return;
            }
            try {
                const r = await sendAndGetData<"extract">(args);

                handleExtractPayload(r);
            } catch (e) {
                outputChannel.error(String(e));
                vscWindow.showErrorMessage(String(e));
            }
        }),
        commands.registerCommand("vencord-companion.extract", async (args: number) => {
            if (args) {
                try {
                    const r = await sendAndGetData<"extract">({
                        type: "extract",
                        data: {
                            extractType: "id",
                            idOrSearch: args,
                            usePatched: null,
                        },
                    });

                    handleExtractPayload(r);
                    return;
                } catch (e) {
                    outputChannel.error(String(e));
                    window.showErrorMessage(String(e));
                }
                return;
            }

            const quickPick = window.createQuickPick();

            quickPick.placeholder = "module ID";
            quickPick.canSelectMany = false;

            const items: QuickPickItem[] = [
                {
                    label: "",
                    alwaysShow: false,
                },
                {
                    label: "",
                    kind: -1,
                },
                ...moduleCache.map((m) => {
                    return { label: m };
                }),
            ];

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
                    const r = await sendAndGetData<"extract">({
                        type: "extract",
                        data: {
                            extractType: "id",
                            idOrSearch: +modId,
                            usePatched: null,
                        },
                    });

                    handleExtractPayload(r);
                } catch (e) {
                    outputChannel.error(String(e));
                    vscWindow.showErrorMessage(String(e));
                }
            });
        }),
        commands.registerCommand("vencord-companion.extractSearch", async (args: string, findType: "string" | "regex") => {
            if (args) {
                try {
                    const r = await sendAndGetData<"extract">({
                        type: "extract",
                        data: {
                            extractType: "search",
                            findType,
                            idOrSearch: args,
                            usePatched: null,
                        },
                    });

                    handleExtractPayload(r);
                } catch (e) {
                    outputChannel.error(String(e));
                    window.showErrorMessage(String(e));
                }
                return;
            }

            const input = await window.showInputBox();

            if (!input)
                return window.showErrorMessage("No Input Provided");
            try {
                const r = await sendAndGetData<"extract">({
                    type: "extract",
                    data: {
                        extractType: "search",
                        findType: "string",
                        idOrSearch: input,
                        usePatched: null,
                    },
                });

                handleExtractPayload(r);
            } catch (e) {
                outputChannel.error(String(e));
                vscWindow.showErrorMessage(String(e));
            }
        }),
        commands.registerCommand("vencord-companion.disablePlugin", async (data: DisablePluginData) => {
            try {
                if (!data)
                    throw new Error("No args passed.");
                await sendAndGetData({
                    type: "disable",
                    data,
                });
            } catch (e) {
                outputChannel.error(String(e));
                vscWindow.showErrorMessage(String(e));
            }
        }),
        commands.registerCommand("vencord-companion.testPatch", async (patch: PatchData) => {
            try {
                await sendAndGetData({
                    type: "testPatch",
                    data: patch,
                });
                vscWindow.showInformationMessage("Patch OK!");
            } catch (e) {
                outputChannel.info(`Patch failed: ${e}`);
                vscWindow.showErrorMessage(`Patch failed: ${e}`);
            }
        }),

        commands.registerCommand("vencord-companion.testFind", async (find: FindData) => {
            try {
                await sendAndGetData({
                    type: "testFind",
                    data: find,
                });
                vscWindow.showInformationMessage("Find OK!");
            } catch (e) {
                outputChannel.info(`Find bad: ${e}`);
                vscWindow.showErrorMessage(`Find bad: ${e}`);
            }
        }),
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

async function isVencordRepo(): Promise<boolean> {
    const workspaceFolder = workspace.workspaceFolders?.[0];

    if (!workspaceFolder)
        return false;

    if (Settings.showSidebar) {
        return true;
    }

    try {
        const cwd = workspaceFolder.uri.fsPath;

        const remotes = (await exec("git remote -v", { cwd })).stdout
            .toString()
            .toLowerCase();

        return remotes.includes("vencord");
    } catch (e) {
        outputChannel.warn("isVencordRepo: error running git remote -v", e);
        return false;
    }
}
