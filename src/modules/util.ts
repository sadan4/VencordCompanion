import { PathLike } from "fs";
import { stat } from "fs/promises";

import { CancellationToken, Progress, ProgressLocation, ProgressOptions, Uri, window, workspace } from "vscode";


export class ProgressBar {
    /**
     * WARNING: the user pressing cancel only makes this this promise reject.
     *
     * It does not stop the underlying action
     */
    static forSingleFunc<T>(opts: ProgressOptions, func: () => PromiseLike<T>): PromiseLike<T> {
        return window.withProgress(opts, (p, c) => {
            return new Promise((res, rej) => {
                c.onCancellationRequested(() => rej(new Error("Cancelled by user")));
                func()
                    .then(res, rej);
            });
        });
    }

    private onCancel: () => void = () => void 0;
    private message: string;
    protected total: number;
    protected count = 0;
    private promise: any;
    protected resolve: any;
    private reject: any;
    protected progress?: Progress<{
        increment: number;
        message: string;
    }>;
    private calcelationtoken?: CancellationToken;

    /**
     * @param total if true, only message will be shown. **If true, {@link finish} must be called when done**
     * @param message the message to show
     * @param onCancel called when the user presses the cancel button, the promise will already be rejected
     */
    constructor(total: number, message: string, onCancel: () => void) {
        this.total = total;
        this.message = message;
        this.onCancel = onCancel;

        const [promise, resolve, reject] = resolvers();

        this.promise = promise;
        this.resolve = resolve;
        this.reject = reject;
    }

    makeTitle() {
        return `${this.count}/${this.total}`;
    }

    start(): Promise<this> {
        const [ready, res, rej] = resolvers();

        setTimeout(() => rej(new Error("Timeout")), 1000 * 5);
        window.withProgress({
            location: ProgressLocation.Notification,
            title: this.message,
            cancellable: true,
        }, (p, c) => {
            this.progress = p;
            this.calcelationtoken = c;
            this.calcelationtoken.onCancellationRequested(() => {
                this.onCancel();
                this.reject("Canceled");
            });
            res(this);
            return this.promise;
        })
            .then(void 0, () => { });
        return ready;
    }

    finish() {
        this.resolve();
    }

    stop(e: any) {
        if (!this.progress)
            throw new Error("Progress not started");

        this.reject(e);
    }

    increment() {
        if (!this.progress)
            throw new Error("Progress not started");

        this.count++;
        this.progress.report({
            increment: 100 / this.total,
            message: this.makeTitle(),
        });
        if (this.count === this.total)
            this.resolve();
    }
}
// needed because some things(formatting) report too fast for vscode to handle
export class BufferedProgressBar extends ProgressBar {
    private markers: number[];

    constructor(total: number, message: string, onCancel: () => void) {
        super(total, message, onCancel);
        this.markers = getPercentMarkers(total);
    }

    public override async increment() {
        if (!this.progress)
            throw new Error("Progress not started");
        this.count++;
        if (this.markers.some((v) => this.count === v))
            await new Promise((res) => setTimeout(res, 0));
        this.progress.report({
            increment: 100 / this.total,
            message: this.makeTitle(),
        });
        if (this.count === this.total)
            this.resolve();
    }
}
function resolvers<T>() {
    let reject;
    let resolve;

    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });

    return [promise, resolve, reject];
}

export enum SecTo {
    MS = 1000,
    SEC = 1,
    MIN = (1 / 60),
}

function getPercentMarkers(num: number): number[] {
    if (num < 100)
        return Array.from({ length: num }, (_, i) => i + 1);

    const interval = num / 100; // Calculate the interval between each point
    const points: number[] = [];

    for (let i = 1; i <= 100; i++) {
        const point = i * interval;

        points.push(point | 0);
    }

    return points;
}
export function getCurrentFolder() {
    return workspace.workspaceFolders?.[0]?.uri.fsPath;
}

export async function exists(path: PathLike) {
    try {
        return !!await stat(path);
    } catch {
        return false;
    }
}
/**
 * **PATH MUST EXIST**
 *
 * \@throws if the path doesnt exist
 *
 * use {@link exists} to check if it exists
 */
export async function isDirectory(path: PathLike) {
    return (await stat(path)).isDirectory();
}
/**
 * **does not** format the modules code see {@link format} for more code formating

 * takes the raw contents of a module and prepends a header
 * @param moduleContents the module
 * @param moduleId the module id
 * @param isFind if the module is coming from a find
    eg: is it a partial module
 * @returns a string with the formatted module
 */

export function formatModule(moduleContents: string, moduleId: string | number | undefined = "000000", isFind?: boolean): string {
    if (isFind)
        return `// Webpack Module ${moduleId} \n${isFind ? `//OPEN FULL MODULE: ${moduleId}\n` : ""}//EXTRACED WEPBACK MODULE ${moduleId}\n 0,\n${moduleContents}`;
    return moduleContents;
}
/**
 * converts a string into a URI that will resolve to a file with the contents of the string
 * @param patched the contents of the file
 * @param filename the name of the file
 * @param filetype the file extension
 * @returns the Uri for the file
 */

export function mkStringUri(patched: any, filename = "module", filetype = "js"): Uri {
    const SUFFIX = `/${filename}.${filetype}`;

    if (filename.indexOf("/") !== -1 || filetype.indexOf("/") !== -1)
        throw new Error(`Filename and filetype must not contain \`/\`. Got: ${SUFFIX.substring(1)}`);

    const PREFIX = "vencord-companion://b64string/";
    const a = Buffer.from(patched);

    return Uri.parse(PREFIX + a.toString("base64url") + SUFFIX);
}

