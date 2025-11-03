import { CancellationToken, ExtensionContext, Hover, HoverProvider, languages, MarkdownString, Position, TextDocument } from "vscode";

import { Position as WP_Position } from "@vencord-companion/shared/Position";
import { isWebpackModule, WebpackAstParser } from "@vencord-companion/webpack-ast-parser";

import { toVscodeRange } from "@ast/util";
import { PromiseProviderResult } from "@type/index";

export class WebpackExportHover implements HoverProvider {
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
        const [range, text] = await parser.generateHover(new WP_Position(position.line, position.character)) ?? [];

        if (!text) {
            return;
        }
        return {
            range: toVscodeRange(range!),
            contents: [new MarkdownString(text)],
        };
    }

    public static register({ subscriptions }: ExtensionContext) {
        subscriptions.push(languages.registerHoverProvider({ language: "javascript" }, new this()));
    }
}
