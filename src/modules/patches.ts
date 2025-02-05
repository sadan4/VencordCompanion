/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2022 Vendicated and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2022 Vendicated and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/
/// <reference lib="es2021.string" />
import { FindNode } from "@type/server";

import { runtimeHashMessageKey } from "./intlHash";

export type VencordReplaceFn = (match: string, ...groups: any[]) => string;

export const intlRegex = /#{intl::([\w$+/]*)(?:::(\w+))?}/g;

export function canonicalizeMatch<T extends RegExp | string>(match: T): T {
    let partialCanon = typeof match === "string" ? match : match.source;
    partialCanon = partialCanon.replaceAll(intlRegex, (_, key, modifier) => {
        const hashed = modifier === "raw" ? key : runtimeHashMessageKey(key);

        const isString = typeof match === "string";
        const hasSpecialChars = !Number.isNaN(Number(hashed[0])) || hashed.includes("+") || hashed.includes("/");

        if (hasSpecialChars) {
            return isString
                ? `["${hashed}"]`
                : String.raw`(?:\["${hashed}"\])`.replaceAll("+", "\\+");
        }

        return isString ? `.${hashed}` : String.raw`(?:\.${hashed})`;
    });

    if (typeof match === "string") {
        return partialCanon as T;
    }

    const canonSource = partialCanon.replaceAll("\\i", String.raw`(?:[A-Za-z_$][\w$]*)`);
    return new RegExp(canonSource, match.flags) as T;
}

export function canonicalizeReplace<T extends string | VencordReplaceFn>(replace: T, pluginName: string): T {
    const self = `Vencord.Plugins.plugins[${JSON.stringify(pluginName)}]`;

    if (typeof replace !== "function")
        return replace.replaceAll("$self", self) as T;

    return ((...args) => replace(...args).replaceAll("$self", self)) as T;
}

export function parseMatch(node: FindNode): string | RegExp {
    return parseNode(node);
}

export function parseReplace(node: FindNode): string | VencordReplaceFn {
    return parseNode(node);
}
function parseNode(node: FindNode) {
    switch (node.type) {
        case "string":
            return node.value;
        case "regex":
            return new RegExp(node.value.pattern, node.value.flags);
        case "function":
            // We LOVE remote code execution
            // Safety: This comes from localhost only, which actually means we have less permissions than the source,
            // since we're running in the browser sandbox, whereas the sender has host access
            return (0, eval)(node.value);
        default:
            throw new Error("Unknown Node Type " + (node as any).type);
    }
}
