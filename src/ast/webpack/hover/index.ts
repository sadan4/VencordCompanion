import { outputChannel } from "@extension";
import { isWebpackModule, WebpackAstParser } from "@vencord-companion/webpack-ast-parser";

import _mappings from "./mappings.json";

const mappings: Record<string, string | undefined> = _mappings;

import { toVscodeRange } from "@ast/util";
import { sendAndGetData } from "@server/index";
import { PromiseProviderResult } from "@type/index";

import { isElementAccessExpression, isIdentifier, isPropertyAccessExpression, isStringLiteralLike } from "typescript";
import { CancellationToken, Hover, HoverProvider, MarkdownString, Position, TextDocument } from "vscode";

export class WebpackI18nHover implements HoverProvider {
    async provideHover(
        document: TextDocument,
        position: Position,
        _token: CancellationToken,
    ): PromiseProviderResult<Hover> {
        if (!isWebpackModule(document.getText())) {
            return;
        }

        const parser = new WebpackAstParser(document.getText());
        const node = parser.getTokenAtPosition(position);

        if (!node) {
            return;
        }

        // intl calls are either \i.t.<key> or \i.t["key"]
        // node will be key, node.parent will be a property access or element access expression
        const { parent } = node;

        if (!isPropertyAccessExpression(parent) && !isElementAccessExpression(parent)) {
            return;
        }

        let hashedKey: string;

        if (isIdentifier(node)) {
            hashedKey = node.getText();
        } else if (isStringLiteralLike(node)) {
            hashedKey = node.text;
        } else {
            outputChannel.warn("[Webpack] [Hover]: i18n key is not identifier or string literal");
            return;
        }

        const maybeUnHashedKey = mappings[hashedKey];
        const resolvedString = new MarkdownString();

        try {
            const { data: { value } } = await sendAndGetData<"i18n">({
                type: "i18n",
                data: {
                    hashedKey,
                },
            });

            resolvedString.appendMarkdown(value);
        } catch (e) {
            outputChannel.warn("[Webpack] [Hover]: Failed to fetch i18n value", e);
            resolvedString.appendText("failed to fetch i18n value");
        }

        return {
            range: toVscodeRange(parser.makeRangeFromAstNode(node)),
            contents: [
                new MarkdownString(maybeUnHashedKey ?? "no mapping found"),
                resolvedString,
            ],
        };
    }
}
