import { makeRange } from "@ast/util";
import { VencordAstParser } from "@ast/vencord";
import { outputChannel } from "@modules/logging";
import { formatModule, sendAndGetData } from "@server/index";
import { SourcePatch } from "@type/ast";
import { PromiseProivderResult } from "@type/index";
import { ExtractModuleR } from "@type/server";

import { format } from "./format";
import { canonicalizeMatch, canonicalizeReplace, parseMatch, parseReplace } from "./patches";

import DiffFunc, { DELETE, Diff } from "fast-diff";
import { nanoid } from "nanoid";
import {
    CancellationToken,
    commands,
    Event,
    EventEmitter,
    TabChangeEvent,
    TabInputText,
    TextDocument,
    TextDocumentChangeEvent,
    TextEditor,
    TextEditorRevealType,
    Uri,
    ViewColumn,
    window,
    workspace,
} from "vscode";
class LastTwo<T> {
    constructor(private one: T, private two: T) {
    }
    push(val: T) {
        this.one = this.two;
        this.two = val;
        return val;
    }
    get(): [T, T] {
        return [this.one, this.two];
    }
}
// uri format: vencord-patchhelper://patch/:id.js
export class PatchHelper {
    private _lastPatch!: SourcePatch;
    editor?: TextEditor;
    private get lastPatch(): SourcePatch {
        return this._lastPatch;
    }
    private set lastPatch(value: SourcePatch) {
        this._lastPatch = value;
        this.lastFindLength = this.ast
            .getPatches()
            .filter(e => e.find === value.find).length;
    }
    // uri.path > PatchHelper[]
    private static readonly activeWindows = new Map<Uri["path"], PatchHelper>();
    private static readonly activeWindowsById = new Map<string, PatchHelper>();
    private readonly id: string;
    private ast: VencordAstParser;
    private lastFindLength!: number;
    private moduleData?: ExtractModuleR["data"];
    private get displayUri() {
        return Uri.parse(`vencord-patchhelper://patch/${this.id}.js`);
    }
    public static async create(doc: TextDocument, lastPatch: SourcePatch) {
        if (PatchHelper.activeWindows.has(doc.uri.path)) {
            const active = PatchHelper.activeWindows.get(doc.uri.path)!;
            await active.setAndLoadPatch(lastPatch);
            return active;
        }
        const newHelper = new PatchHelper(doc, lastPatch);
        PatchHelper.activeWindows.set(doc.uri.path, newHelper);
        PatchHelper.activeWindowsById.set(PatchHelper.idFromUri(newHelper.displayUri), newHelper);
        await newHelper.setAndLoadPatch(lastPatch);
        return newHelper;
    }
    private async setAndLoadPatch(lastPatch: SourcePatch) {
        this.lastPatch = lastPatch;
        try {
            this.moduleData = (
                await sendAndGetData<"extract">({
                    type: "extract",
                    data: {
                        extractType: "search",
                        findType: lastPatch.findType,
                        usePatched: false,
                        idOrSearch: lastPatch.find,
                    },
                })
            ).data;
            PatchHelper.changeEmitter.fire(this.displayUri);
        } catch (e) {
            const message = `PatchHelper: Could not load the new patch, exiting. Error: ${e}`;
            outputChannel.error(message);
            window.showErrorMessage(message);
            this.end();
        }
    }
    private constructor(private readonly doc: TextDocument, lastPatch: SourcePatch) {
        this.id = nanoid();
        this.ast = new VencordAstParser(doc);
        this.lastPatch = lastPatch;
        outputChannel.debug(`Opening new patch helper for patch ${JSON.stringify(lastPatch)}, with id ${this.id} and for document ${doc.uri.path}`);
    }
    public async openModuleWindow() {
        if (!this.moduleData) {
            await this.setAndLoadPatch(this.lastPatch);
        }
        workspace.openTextDocument(this.displayUri).then(async doc => {
            this.editor = await window.showTextDocument(doc, ViewColumn.Beside, true);
        });
    }
    private onChange(newAst: VencordAstParser) {
        this.ast = newAst;
        const patch = this.findPatch();
        if (patch == null) {
            const message = `Lost patch with\nfind: ${this.lastPatch.find}\nnum replacements: ${this.lastPatch.replacement.length}\nindex: ${this.lastPatch.origIndex}`;
            outputChannel.info(message);
            window.showErrorMessage(message);
            this.end();
            return;
        }
        this.lastPatch = patch;
        PatchHelper.changeEmitter.fire(this.displayUri);
    }
    /**
     * closes this window, disables this patch helper, and removes itself from the map
     */
    private async end() {
        PatchHelper.activeWindows.delete(this.doc.uri.path);
        PatchHelper.activeWindowsById.delete(this.id);
        const tab = window.tabGroups.all
            .map(x => x.tabs)
            .flat()
            .find(
                tab =>
                    tab.input instanceof TabInputText &&
                    tab.input.uri.path === this.displayUri.path
            );
        if (tab) {
            outputChannel.debug(`closing tab with label ${tab.label}`);
            await window.tabGroups.close(tab);
        }
        outputChannel.debug(`ending patch helper with id ${this.id}`);
    }
    private async highlightChanges() {
        const [was, is] = this.lastPatchedModule.get();
        if (!was || !is || was === is) return void outputChannel.warn("no changes to highlight");
        const changes = DiffFunc(was, is);
        let i = -1;
        let cur: Diff;
        let pos = 0;
        while (++i < changes.length && !(cur = changes[i])[0])
            pos += cur[1].length;
        let end = pos;
        while ((cur = changes[i++])[0] && i < changes.length)
            cur[0] !== DELETE && (end += cur[1].length);

        const rangeToShow = makeRange({ pos, end }, is);
        if (!this.editor) return void outputChannel.warn("no editor to show changes");
        outputChannel.debug(`highlighting changes from ${pos} to ${end}`);
        this.editor.revealRange(rangeToShow, TextEditorRevealType.InCenter);
    }
    /**
     * finds the patch in a changed document
     *
     * check how many times our find appears, if >1, we need take a good guess or return null of there is no good guess
     */
    // TODO: make this more fault tolerant
    private findPatch(): SourcePatch | null {
        const patches = this.ast.getPatches();
        if (this.lastFindLength === 1) {
            const possibleByFind = patches.filter(
                e => e.find === this.lastPatch.find
            );
            if (possibleByFind.length === 1)
                return (this.lastPatch = possibleByFind[0]);
        }

        const strmatch = this.lastPatch.replacement
            .filter(e => e.match.type === "string")
            .map<string>(e => e.match.value as any);
        const regexmatch = this.lastPatch.replacement
            .filter(e => e.match.type === "regex")
            .map<string>(e => (e as any).match.value.pattern);

        const possibleCandidates = patches.filter(
            maybe =>
                maybe.find === this.lastPatch.find
                && Math.abs(maybe.replacement.length - this.lastPatch.replacement.length) < 2
                && maybe.replacement.some(maybeReplacement => {
                    if (maybeReplacement.match.type === "string") {
                        return strmatch.some(e2 => e2 === maybeReplacement.match.value);
                    } else {
                        const x = maybeReplacement.match.value.pattern;
                        return regexmatch.some(e2 => e2 === x);
                    }
                })
        );

        if (possibleCandidates.length === 1)
            return (this.lastPatch = possibleCandidates[0]);

        return null;
    }
    private lastPatchedModule = new LastTwo("", "");
    async patch(): PromiseProivderResult<string> {
        if (!this.moduleData) return null;
        let code = this.moduleData.module;
        for (let i = 0; i < this.lastPatch.replacement.length; i++) {
            const { match, replace } = this.lastPatch.replacement[i];
            try {
                const matcher = canonicalizeMatch(parseMatch(match));
                const replacer = canonicalizeReplace(parseReplace(replace), this.ast.getPluginName() || "MyPlugin");
                // @ts-expect-error stupid overloading
                const newsrc = code.replace(matcher, replacer);
                if (code === newsrc) throw `Patch ${JSON.stringify({ match, replace })} had no effect`;
                Function(newsrc);

                code = newsrc;
            } catch (e) {
                outputChannel.warn(`Error in patch ${i + 1}: ${e}`);
                continue;
            }
        }
        return this.lastPatchedModule.push(await format(formatModule(code, this.moduleData.moduleNumber, false)));
    }
    private static idFromUri(uri: Uri) {
        return uri.path.replace(/^\//, "");
    }
    // #region static handlers for vscode
    private static changeEmitter = new EventEmitter<Uri>();

    public static onDidChange: Event<Uri> = PatchHelper.changeEmitter.event;

    public static async provideTextDocumentContent(
        uri: Uri,
        _token: CancellationToken
    ): PromiseProivderResult<string> {
        try {
            const helper = PatchHelper.activeWindowsById.get(PatchHelper.idFromUri(uri));
            if (!helper) return null;
            const toRet = await helper.patch();
            helper.highlightChanges();
            return toRet;
        } catch (e) {
            outputChannel.error(e);
            return null;
        }
    }

    /**
     * @param e handle closing of our source documents
     */
    public static async onCloseDocument(e: TextDocument) {
        if (e.uri.scheme === "vencord-patchhelper") {
            const helper = PatchHelper.activeWindowsById.get(PatchHelper.idFromUri(e.uri));
            helper?.end();
        }
        const helper = PatchHelper.activeWindows.get(e.uri.path);
        helper?.end();
    }

    public static async changeDocument({ document }: TextDocumentChangeEvent) {
        try {
            const helper = PatchHelper.activeWindows.get(document.uri.path);
            if (!helper) return;
            const newast = new VencordAstParser(document);
            helper.onChange(newast);
        } catch (e) {
            window.showErrorMessage(String(e));
        }
    }
    /**
     * there is no way to open a document in read-only mode or set it via an URI
     *
     * wait for any of our editors to be opened, and set them to read only mode right away
     */
    public static changeActiveEditor(_editor: TextEditor | undefined): void {
        if (
            window.activeTextEditor?.document.uri.scheme === "vencord-patchhelper"
        ) {
            outputChannel.debug(`setting active editor with URI: (${window.activeTextEditor?.document.uri.toString()}) to read only`);
            commands.executeCommand(
                "workbench.action.files.setActiveEditorReadonlyInSession"
            );
        }
    }

    public static onTabClose({ closed }: TabChangeEvent) {
        closed.flatMap(({ input }) => {
            if (!(input instanceof TabInputText)) return [];
            return PatchHelper.activeWindowsById.get(PatchHelper.idFromUri(input.uri)) ?? [];
        }).forEach(x => x.end());
    }
    // #endregion
}
