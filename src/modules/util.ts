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

export type SemVerVersion = readonly [major: number, minor: number, patch: number];

/**
 * Compares two semantic version arrays
 * @param a First version to compare
 * @param b Second version to compare
 * @returns 
 *  -1 if a < b
 *   0 if a = b
 *   1 if a > b
 */
export function compareVersions(a: SemVerVersion, b: SemVerVersion): 0 | -1 | 1 {
    // Compare major version
    if (a[0] < b[0])
        return -1;
    if (a[0] > b[0])
        return 1;

    // Major versions are equal, compare minor version
    if (a[1] < b[1])
        return -1;
    if (a[1] > b[1])
        return 1;

    // Minor versions are equal, compare patch version
    if (a[2] < b[2])
        return -1;
    if (a[2] > b[2])
        return 1;

    // All components are equal
    return 0;
}

/**
 * version are incompatible if the actual version is less than the minimum version
 * or the actual version has a higher major than the min version
 */
export function areVersionsIncompatible(minVersion: SemVerVersion, actualVersion: SemVerVersion): boolean {
    // Check if actual version is less than minimum version
    if (compareVersions(actualVersion, minVersion) === -1)
        return true;

    // Check if actual version has a higher major version than minimum version
    if (actualVersion[0] > minVersion[0])
        return true;

    // Versions are compatible
    return false;
}
