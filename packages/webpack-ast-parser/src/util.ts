import { Position } from "@vencord-companion/shared/Position";
import { Range } from "@vencord-companion/shared/Range";

import { ExportMap } from "./types";

export function allEntries<T extends object, K extends keyof T & (string | symbol)>(obj: T): (readonly [K, T[K]])[] {
    const SYM_NON_ENUMERABLE = Symbol("non-enumerable");
    const keys: (string | symbol)[] = Object.getOwnPropertyNames(obj);

    keys.push(...Object.getOwnPropertySymbols(obj));

    return keys.map((key) => {
        const descriptor = Object.getOwnPropertyDescriptor(obj, key);

        if (!descriptor)
            throw new Error("Descriptor is undefined");

        if (!descriptor.enumerable)
            return SYM_NON_ENUMERABLE;

        return [key as K, (obj as any)[key] as T[K]] as const;
    })
        .filter((x) => x !== SYM_NON_ENUMERABLE);
}

export function allValues<T extends object>(obj: T): (T[keyof T])[] {
    return allEntries(obj)
        .map(([, v]) => v);
}

export function containsPosition(range: ExportMap<Range> | Range[], pos: Position): boolean {
    if (Array.isArray(range)) {
        return range.some((r) => r.contains(pos));
    }
    return allValues(range)
        .some((r) => containsPosition(r, pos));
}

/**
 * @param text the module text
 * @returns if the module text is a webpack module or an extracted find
 */
export function isWebpackModule(text: string) {
    return text.startsWith("// Webpack Module ")
      || text.substring(0, 100)
          .includes("//OPEN FULL MODULE:");
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

export function TAssert<T>(thing: any): asserts thing is T {
}
