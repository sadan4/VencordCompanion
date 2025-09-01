export function debounce<
    F extends (...args: any) => any,
>(func: F, delay = 300): (...args: Parameters<F>) => undefined {
    let timeout: NodeJS.Timeout;

    return function (...args: Parameters<F>): undefined {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), delay);
    };
}

export function debounceAsync<
    F extends (...args: any) => Promise<any>,
>(func: F, delay = 300): (...args: Parameters<F>) => void {
    // for some godforsaken reason it errors here if its let, but not a few lines up
    var timeout: NodeJS.Timeout;
    let running = false;

    return function (...args: Parameters<F>): undefined {
        if (running)
            return;
        running = true;
        clearTimeout(timeout);
        setTimeout(() => func(...args)
            .finally(() => void (running = false)), delay);
        return;
    };
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

export function runtime_assert(condition: any, message: string = ""): asserts condition {
    if (!condition) {
        throw new Error(`Runtime assertion failed: ${message}`);
    }
}
