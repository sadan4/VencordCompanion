import { VencordAstParser } from "@ast/vencord";
import { SourcePatch } from "@type/ast";
import { PromiseProivderResult } from "@type/index";

import { nanoid } from "nanoid";
import { CancellationToken, Event, EventEmitter, TextDocument, TextDocumentChangeEvent, Uri, window, workspace } from "vscode";
class ArrayMap<K, V> extends Map<K, V[]> {
    /**
     * Removes a value from the array associated with the specified key.
     * @param key - The key whose associated array the value should be removed from.
     * @param val - The value to be removed from the array.
     * @returns `true` if the value was successfully removed, `false` otherwise.
     */
    public remove(key: K, val: V): boolean {
        const arr = this.get(key);
        if (arr.length === 0) return false;
        const i = arr.indexOf(val);
        if (i === -1) return false;
        arr.splice(i, 1);
        return true;
    }
    /**
     * @param key key of map
     * @param value value to push
     * @returns new length of map[key]
     */
    public push(key: K, value: V): number {
        return this.get(key).push(value);
    }
    /**
     * @param key key of map
     * @returns array for key, creating and setting if it doesnt exist
     */
    override get(key: K): V[] {
        return super.get(key) ?? this.set(key, []).get(key);
    }
}
// uri format: vencord-patchhelper://patch/:id
export class PatchHelper {
    private _lastPatch!: SourcePatch;
    private get lastPatch(): SourcePatch {
        return this._lastPatch;
    }
    private set lastPatch(value: SourcePatch) {
        this._lastPatch = value;
        this.lastFindLength = this.ast.getPatches().filter(e => e.find === value.find).length;
    }
    // uri.path > PatchHelper[]
    private static readonly activeWindows = new ArrayMap<Uri["path"], PatchHelper>();
    private static readonly activeWindowsById = new Map<PatchHelper["id"], PatchHelper>();
    private readonly id: string;
    private ast: VencordAstParser;
    private lastFindLength!: number;
    private get displayUri() {
        return Uri.parse(`vencord-patchhelper://patch/${this.id}`);
    }
    constructor(doc: TextDocument, lastPatch: SourcePatch) {
        this.id = nanoid();
        this.ast = new VencordAstParser(doc);
        this.lastPatch = lastPatch;
    }
    public async openModuleWindow() {
        workspace.openTextDocument(this.displayUri)
    }
    onChange(newAst: VencordAstParser) {
        this.ast = newAst;
        const patch = this.findPatch();
        if(patch == null) {
            window.showErrorMessage(`Lost patch with\nfind: ${this.lastPatch.find}\nnum replacements: ${this.lastPatch.replacement.length}\nindex: ${this.lastPatch.origIndex}`);
            this.end();
            return;
        }
        this.lastPatch = patch;
    }
    /**
     * closes this window, disables this patch helper, and removes itself from the map
     */
    private async end() {
    }

    private static changeEmitter = new EventEmitter<Uri>();

    public static onDidChange: Event<Uri> = this.changeEmitter.event;

    public static async provideTextDocumentContent(uri: Uri, token: CancellationToken): PromiseProivderResult<string> {
        const helper = PatchHelper.activeWindowsById.get(uri.path);
        if (!helper) return null;
        return await helper.patch();
    }

    /**
     * finds the patch in a changed document
     *
     * check how many times our find appears, if >1, we need take a good guess or return null of there is no good guess
     */
    private findPatch(): SourcePatch | null {
        const patches = this.ast.getPatches();
        if (this.lastFindLength === 1) {
            const possibleByFind = patches.filter(e => e.find === this.lastPatch.find);
            if (possibleByFind.length === 1) return this.lastPatch = possibleByFind[0];
        }

        const strmatch = this.lastPatch.replacement.filter(e => e.match.type === "string").map<string>(e => e.match.value as any);
        const regexmatch = this.lastPatch.replacement.filter(e => e.match.type === "regex").map<string>(e => (e as any).match.value.pattern);

        const possibleCandidates = patches.filter(maybe =>
            maybe.find === this.lastPatch.find
            && Math.abs(maybe.replacement.length - this.lastPatch.replacement.length) < 2
            && maybe.replacement.some(maybeReplacement => {
                if (maybeReplacement.match.type === "string") {
                    return strmatch.some(e2 => e2 === maybeReplacement.match.value);
                } else {
                    const x = maybeReplacement.match.value.pattern;
                    return regexmatch.some(e2 => e2 === x);
                }
            }));

        if (possibleCandidates.length === 1)
            return this.lastPatch = possibleCandidates[0];

        return null;
    }

    async patch(): PromiseProivderResult<string> {
        throw new Error("Method not implemented.");
    }

    public static async closeDocument(e: TextDocument) {
        const helpers = PatchHelper.activeWindows.get(e.uri.path);
        helpers.forEach(e => e.end());
    }

    public static async changeDocument(e: TextDocumentChangeEvent) {
        const helpers = PatchHelper.activeWindows.get(e.document.uri.path);
        if (helpers.length === 0) return;
        const newast = new VencordAstParser(e);
        helpers.forEach(e => e.onChange(newast));
    }
}
