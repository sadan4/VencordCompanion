import { reloadDiagnostics } from "@ast/vencord/diagnostics";
import { format } from "@modules/format";
import { outputChannel } from "@modules/logging";
import { areVersionsIncompatible, formatModule, mkStringUri, SemVerVersion } from "@modules/util";
import { Base, DiffModule, Discriminate, ExtractModuleR, FullIncomingMessage, IncomingMessage, OutgoingMessage } from "@type/server";

import { commands, window, workspace } from "vscode";
import { BufferLike, RawData, WebSocket, WebSocketServer } from "ws";

const MIN_CLIENT_VERSION: SemVerVersion = [0, 1, 1];
const SERVER_VERSION: SemVerVersion = [0, 4, 0];
const USERPLUGIN_LINK = "https://github.com/sadan4/vc-userDevTools/blob/main";

export let wss: WebSocketServer | undefined;

export let activeSocket: WebSocket | null = null;
export function hasConnection() {
    return activeSocket != null;
}

const onConnectCbs: ((sock: WebSocket) => void)[] = [];

export function onConnect(cb: (sock: WebSocket) => void) {
    onConnectCbs.push(cb);
}
export function removeOnConnect(cb: (sock: WebSocket) => void) {
    const index = onConnectCbs.indexOf(cb);

    if (index !== -1)
        onConnectCbs.splice(index, 1);
}

onConnectCbs.push(reloadDiagnostics);

const enum CloseCode {
    POLICY_VIOLATION = 1008,
    OUTDATED_CLIENT = 1009,
}

export const moduleCache: string[] = [];

let nonceCounter = 8485;

const defaultOpts: SendToSocketsOpts = {
    timeout: 5000,
};

// there is no autocomplete for this, https://github.com/microsoft/TypeScript/issues/52898
export function sendAndGetData<T extends IncomingMessage["type"] = never>(data: OutgoingMessage, opts?: SendToSocketsOpts): Promise<[T] extends [never] ? ({ ok: true; } & Base<Record<string, any>>) : Discriminate<IncomingMessage, T>> {
    const { timeout } = opts ?? defaultOpts;

    return new Promise((res, rej) => {
        setTimeout(rej.bind(null, "Timed Out"), timeout);
        sendToSockets(data, res, opts)
            .catch(rej);
    });
}
export interface SendToSocketsOpts {
    /**
     * in ms, defaults to 5000
     */
    timeout: number;
}

export async function sendToSockets(data: OutgoingMessage, dataCb?: (data: any) => void, opts?: SendToSocketsOpts) {
    const { timeout } = opts ?? defaultOpts;

    if (activeSocket == null) {
        throw new Error("No Discord Clients Connected! Make sure you have Discord open, and have the DevCompanion plugin enabled (see README for more info!)");
    }

    const nonce = nonceCounter++;

    (data as any).nonce = nonce;

    const promises = Array.from([activeSocket], (sock) => new Promise<void>((resolve, reject) => {
        function onMessage(data: RawData) {
            const msg = data.toString("utf-8");
            let parsed: FullIncomingMessage;

            try {
                parsed = JSON.parse(msg);
            } catch {
                outputChannel.error(`[WS] Invalid Response: ${msg}`);
                return reject(new Error(`Got Invalid Response: ${msg}`));
            }

            if (parsed.nonce !== nonce)
                return;

            cleanup();

            if (parsed.ok) {
                resolve();
                dataCb && dataCb(parsed);
            } else {
                reject(parsed.error);
            }
        }

        function onError(err: Error) {
            cleanup();
            reject(err);
        }

        function cleanup() {
            sock.off("message", onMessage);
            sock.off("error", onError);
        }


        sock.on("message", onMessage);
        sock.once("error", onError);

        setTimeout(() => {
            cleanup();
            reject(new Error("Timed out")); // Throw a new Error object instead of a string
        }, timeout);

        sock.send(JSON.stringify(data));
    }));

    await Promise.all(promises);
    return true;
}

async function isClientOutdated(): Promise<[boolean, SemVerVersion]> {
    const res = await sendAndGetData<"version">({
        type: "version",
        data: {
            server_version: SERVER_VERSION,
        },
    });

    const { clientVersion } = res.data;

    return [areVersionsIncompatible(MIN_CLIENT_VERSION, clientVersion), clientVersion];
}

export function startWebSocketServer() {
    wss = new WebSocketServer({
        port: 8485,
    });

    wss.on("connection", (sock, req) => {
        if (req.headers.origin) {
            try {
                switch (new URL(req.headers.origin).hostname) {
                    case "discord.com":
                    case "canary.discord.com":
                    case "ptb.discord.com":
                        break;
                    default:
                        throw new Error("Invalid origin");
                }
            } catch {
                outputChannel.error(`[WS] Rejected request from invalid or disallowed origin: ${req.headers.origin}`);
                sock.close(CloseCode.POLICY_VIOLATION, "Invalid or disallowed origin");
                return;
            }
        }

        outputChannel.info(`[WS] New Connection (Origin: ${req.headers.origin || "-"})`);
        activeSocket = sock;
        onConnectCbs.forEach((cb) => cb(sock));

        sock.on("close", () => {
            outputChannel.warn("[WS] Connection Closed");
            activeSocket = null;
        });

        sock.on("message", (msg) => {
            try {
                outputChannel.trace(`[WS] RECV: ${msg.toString()}`);

                const rec: FullIncomingMessage = JSON.parse(msg.toString());

                switch (rec.type) {
                    // @ts-expect-error no longer in types, but want to show error message anyway
                    case "report": {
                        window.showErrorMessage("The Reporter feature is now removed from vencord companion");
                        break;
                    }
                    // even if this is sent, we always want to update our internal list
                    case "moduleList": {
                        if (!rec.ok) {
                            throw new Error(rec.error);
                        }

                        const m = rec.data;

                        // should be something like ["123", "58913"]
                        moduleCache.length = 0;
                        moduleCache.push(...m.modules);
                        break;
                    }
                    default:
                }
            } catch (e) {
                outputChannel.error(String(e));
            }
        });

        sock.on("error", (err) => {
            console.error("[Vencord Companion WS", err);
            outputChannel.error(`[WS] Error: ${err}`);
        });

        const originalSend = sock.send;

        sock.send = function (data: BufferLike) {
            outputChannel.trace(`[WS] SEND: ${data}`);
            // @ts-expect-error overloads are weird
            // eslint-disable-next-line prefer-rest-params
            originalSend.apply(this, arguments);
        };
        setTimeout(async () => {
            try {
                const [isOutdated, clientVersion] = await isClientOutdated();

                if (isOutdated) {
                    activeSocket?.close(CloseCode.OUTDATED_CLIENT, "Client is outdated, please update from https://github.com/sadan4/vc-userDevTools/blob/main");
                    window.showErrorMessage("Vencord Compaion: Your client is out of date, please update your userplugin from https://github.com/sadan4/vc-userDevTools/blob/main", "Open Link")
                        .then((button) => {
                            if (button === "Open Link") {
                                commands.executeCommand("vscode.open", USERPLUGIN_LINK);
                            }
                        });
                    activeSocket = null;
                    outputChannel.warn("[WS] Client is outdated, clientVersion: ", clientVersion);
                } else {
                    outputChannel.info("[WS] Client is up to date, clientVersion: ", clientVersion);
                }
            } catch (e) {
                outputChannel.error(`[WS] Error ensuring version: ${e}`);
                window.showWarningMessage("Vencord Companion: Unable to ensure client is up to date, you should update from https://github.com/sadan4/vc-userDevTools/blob/main", "Open Link")
                    .then((button) => {
                        if (button === "Open Link") {
                            commands.executeCommand("vscode.open", USERPLUGIN_LINK);
                        }
                    });
                activeSocket?.close(CloseCode.OUTDATED_CLIENT, "Unable to ensure client is up to date");
                activeSocket = null;
                return;
            }
        });
    });

    wss.on("error", (err) => {
        console.error("[Vencord Companion WS", err);
        outputChannel.error(`[WS] Error: ${err}`);
    });

    wss.once("listening", () => {
        outputChannel.info("[WS] Listening on port 8485");
    });

    wss.on("close", () => {
        outputChannel.warn("[WS] Closed");
    });
}
export async function handleDiffPayload({ data }: DiffModule) {
    const sourceUri = mkStringUri(await format(formatModule(data.source, data.moduleNumber)));
    const patchedUri = mkStringUri(await format(formatModule(data.patched, data.moduleNumber)));

    commands.executeCommand("vscode.diff", sourceUri, patchedUri, `Patch Diff: ${data.moduleNumber}`);
}
export async function handleExtractPayload({ data }: ExtractModuleR): Promise<void> {
    if (!data.module)
        return;

    const moduleText = formatModule(data.module, data.moduleNumber, data.find);

    workspace.openTextDocument({
        content: await format(moduleText || "//ERROR: NO DATA RECIVED\n//This module may be lazy loaded"),
        language: "javascript",
    })
        .then((e) => commands.executeCommand("vscode.open", e.uri));
}
export function stopWebSocketServer() {
    wss?.close();
    wss = undefined;
}
