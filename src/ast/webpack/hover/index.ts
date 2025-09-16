import { outputChannel } from "@extension";
import { isWebpackModule, WebpackAstParser } from "@vencord-companion/webpack-ast-parser";

import _mappings from "./mappings.json";

const mappings: Record<string, string | undefined> = _mappings;

import { toVscodeRange } from "@ast/util";
import { sendAndGetData } from "@server/index";
import { PromiseProviderResult } from "@type/index";

import { isElementAccessExpression, isIdentifier, isPropertyAccessExpression, isStringLiteralLike } from "typescript";
import { CancellationToken, commands, env, ExtensionContext, Hover, HoverProvider, languages, MarkdownString, Position, TextDocument, Uri } from "vscode";

interface CopyHoverDataArgs {
    hashedKey: string;
    maybeUnHashedKey: string | undefined;
}

export class WebpackI18nHover implements HoverProvider {
    private constructor() { }

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


        const copyString = new MarkdownString();

        const commandUri = WebpackI18nHover
            .createCommandUri({
                hashedKey,
                maybeUnHashedKey,
            })
            .toString();

        copyString.supportThemeIcons = true;
        copyString.isTrusted = {
            enabledCommands: [WebpackI18nHover.COMMAND_NAME],
        };

        copyString.appendMarkdown(`$(copy) [Copy As Find](${commandUri})`);

        return {
            range: toVscodeRange(parser.makeRangeFromAstNode(node)),
            contents: [
                new MarkdownString(maybeUnHashedKey ?? "no mapping found"),
                copyString,
                resolvedString,
            ],
        };
    }

    private static COMMAND_NAME = "vencord-user-companion.webpack-i18n-hover-copy";

    private static handleCopyHoverData({ hashedKey, maybeUnHashedKey }: CopyHoverDataArgs) {
        const toCopy = maybeUnHashedKey
            ? `#{intl::${maybeUnHashedKey}}`
            : `#{intl::${hashedKey}::raw}`;

        env.clipboard.writeText(toCopy);
    }

    private static createCommandUri(props: CopyHoverDataArgs): Uri {
        return Uri.parse(`command:${this.COMMAND_NAME}?${encodeURIComponent(JSON.stringify([props]))}`);
    }

    public static register({ subscriptions }: ExtensionContext) {
        subscriptions.push(languages.registerHoverProvider({ language: "javascript" }, new this()));
        subscriptions.push(commands.registerCommand(this.COMMAND_NAME, this.handleCopyHoverData));
    }
}
