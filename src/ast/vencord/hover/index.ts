import { AstParser } from "@ast/AstParser";
import { isStringLiteralLikeOrTemplateLiteralFragmentOrRegexLiteral } from "@ast/util";
import { runtimeHashMessageKey } from "@modules/intlHash";
import { intlRegex } from "@modules/patches";
import { PromiseProivderResult } from "@type/index";

import { isRegularExpressionLiteral } from "typescript";
import { Hover, HoverProvider, MarkdownString, Position, TextDocument } from "vscode";

export class I18nHover implements HoverProvider {
    async provideHover(document: TextDocument, position: Position): PromiseProivderResult<Hover> {
        const ast = new AstParser(document.getText());
        const offset = ast.offsetAt(position);
        const token = ast.getTokenAtOffset(offset);

        if (!token || !isStringLiteralLikeOrTemplateLiteralFragmentOrRegexLiteral(token)) return null;
        if (!token.text.includes("#{intl::")) return null;
        const intls = [...token.text.matchAll(intlRegex)];
        if (intls.length === 0) return null;
        /**
         * index from the start of the string. this would be 0 `"|as"`
         */
        const stringStartingIndex = token.getStart(ast.sourceFile, true) - +isRegularExpressionLiteral(token);
        const stringIndex = offset - stringStartingIndex - 1;
        for (const { "0": { length }, index, "1": key } of intls) {
            if (stringIndex >= index && stringIndex <= index + length) {
                const hashedKey = runtimeHashMessageKey(key);
                const hasSpecialChars = !Number.isNaN(Number(hashedKey[0])) || hashedKey.includes("+") || hashedKey.includes("/");
                const range = ast.makeRange({
                    pos: stringStartingIndex + index + 1,
                    end: stringStartingIndex + index + length + 1
                });
                return {
                    range,
                    contents: [new MarkdownString(hasSpecialChars ? `["${hashedKey}"]` : `.${hashedKey}`)]
                };
            }
        }
    }

}
