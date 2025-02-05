import { isStringLiteralLikeOrTemplateLiteralFragmentOrRegexLiteral, makeRange } from "@ast/util";
import { runtimeHashMessageKey } from "@modules/intlHash";
import { intlRegex } from "@modules/patches";
import { PromiseProivderResult } from "@type/index";

import { getTokenAtPosition } from "tsutils";
import { createSourceFile, isRegularExpressionLiteral, ScriptKind, ScriptTarget } from "typescript";
import { Hover, HoverProvider, MarkdownString, Position, TextDocument } from "vscode";

export class I18nHover implements HoverProvider {
    constructor() {
    }
    async provideHover(document: TextDocument, position: Position): PromiseProivderResult<Hover> {
        const sourceFile = createSourceFile("plugin.tsx", document.getText(), ScriptTarget.ES2020, true, ScriptKind.TSX);
        const offset = document.offsetAt(position);
        const token = getTokenAtPosition(sourceFile, offset, sourceFile);

        if (!token || !isStringLiteralLikeOrTemplateLiteralFragmentOrRegexLiteral(token)) return null;
        if (!token.text.includes("#{intl::")) return null;
        const intls = [...token.text.matchAll(intlRegex)];
        if (intls.length === 0) return null;
        /**
         * index from the start of the string. this would be 0 `"|as"`
         */
        const stringStartingIndex = token.getStart(sourceFile, true) - +isRegularExpressionLiteral(token);
        const stringIndex = offset - stringStartingIndex - 1;
        for (const { "0": { length }, index, "1": key } of intls) {
            if (stringIndex >= index && stringIndex <= index + length) {
                const hashedKey = runtimeHashMessageKey(key);
                const hasSpecialChars = !Number.isNaN(Number(hashedKey[0])) || hashedKey.includes("+") || hashedKey.includes("/");
                const range = makeRange({
                    pos: stringStartingIndex + index + 1,
                    end: stringStartingIndex + index + length + 1
                }, document.getText());
                return {
                    range,
                    contents: [new MarkdownString(hasSpecialChars ? `["${hashedKey}"]` : `.${hashedKey}`)]
                };
            }
        }
    }

}
