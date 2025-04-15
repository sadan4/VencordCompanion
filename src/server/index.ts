import { reloadDiagnostics } from "@ast/vencord/diagnostics";
import { format } from "@modules/format";
import { outputChannel } from "@modules/logging";
import { formatModule, mkStringUri } from "@modules/util";
import { Base, DiffModule, Discriminate, ExtractModuleR, FullIncomingMessage, IncomingMessage, OutgoingMessage } from "@type/server";

import { handleReporterData } from "../reporter";

import { commands, workspace } from "vscode";
import { RawData, WebSocket, WebSocketServer } from "ws";

export let wss: WebSocketServer | undefined;

export const sockets = new Set<WebSocket>();
export function hasConnectons() {
    return sockets.size > 0;
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
}

export const moduleCache: string[] = [];

let nonceCounter = 8485;

const defaultOpts: SendToSocketsOpts = {
    timeout: 5000,
};

// there is no autocomplete for this, https://github.com/microsoft/TypeScript/issues/52898
export function sendAndGetData<T extends IncomingMessage["type"] = never>(data: OutgoingMessage, opts?: SendToSocketsOpts): Promise<[T] extends [never] ? Base & { ok: true; } : Discriminate<IncomingMessage, T>> {
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

    if (sockets.size === 0) {
        throw new Error("No Discord Clients Connected! Make sure you have Discord open, and have the DevCompanion plugin enabled (see README for more info!)");
    }

    const nonce = nonceCounter++;

    (data as any).nonce = nonce;

    const promises = Array.from(sockets, (sock) => new Promise<void>((resolve, reject) => {
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
        sockets.add(sock);
        onConnectCbs.forEach((cb) => cb(sock));

        sock.on("close", () => {
            outputChannel.warn("[WS] Connection Closed");
            sockets.delete(sock);
        });

        sock.on("message", (msg) => {
            try {
                outputChannel.trace(`[WS] RECV: ${msg.toString()}`);

                const rec: FullIncomingMessage = JSON.parse(msg.toString());

                switch (rec.type) {
                    case "report": {
                        handleReporterData(rec.data);
                        break;
                    }
                    // even if this is sent, we always want to update our internal list
                    case "moduleList": {
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

        sock.send = function (data) {
            outputChannel.trace(`[WS] SEND: ${data}`);
            // @ts-expect-error "Expected 3-4 arguments but got 2?????" No bestie it expects 2-3....
            originalSend.call(this, data);
        };
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
