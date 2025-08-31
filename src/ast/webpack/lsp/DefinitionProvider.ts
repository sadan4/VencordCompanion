import { webpackDefinitionsToVscodeDefinitions } from "@ast/util";
import { outputChannel } from "@modules/logging";
import { Definitions } from "@type/ast";
import { Position as WP_Position } from "@vencord-companion/shared/Position";
import { isWebpackModule, WebpackAstParser } from "@vencord-companion/webpack-ast-parser";

import { DefinitionProvider as IDefinitionProvider, Position, TextDocument } from "vscode";


export class DefinitionProvider implements IDefinitionProvider {
    async provideDefinition(document: TextDocument, position: Position): Definitions {
        try {
            if (!isWebpackModule(document.getText()))
                return;
            return webpackDefinitionsToVscodeDefinitions(await new WebpackAstParser(document.getText())
                .generateDefinitions(new WP_Position(position.line, position.character)));
        } catch (e) {
            outputChannel.error(e);
        }
    }
}
