import { VencordAstParser } from "@ast/vencord";
import { SourcePatch } from "@type/ast";
import { PromiseProivderResult } from "@type/index";

import { CancellationToken, Event, TextDocument, TextDocumentContentProvider, Uri } from "vscode";
// uri format: vencord-patchhelper://
export interface PatchHelper extends TextDocumentContentProvider {
}

export class PatchHelper {
    private static readonly activeWindows = new Map<string, PatchHelper[]>();

    constructor(private readonly doc: TextDocument, private readonly initialPatch: SourcePatch) {
    }

    public async openModuleWindow() {

    }
    public static onDidChange?: Event<Uri>;
    public static async provideTextDocumentContent(uri: Uri, token: CancellationToken): PromiseProivderResult<string> {
        return;
    }
}

