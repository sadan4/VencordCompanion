import { isWebpackModule } from "@ast/util";
import { WebpackAstParser } from "@ast/webpack";
import { outputChannel } from "@modules/logging";
import { Definitions } from "@type/ast";

import { DefinitionProvider as IDefinitionProvider, Position, TextDocument } from "vscode";


export class DefinitionProvider implements IDefinitionProvider {
    async provideDefinition(document: TextDocument, position: Position): Definitions {
        try {
            if (!isWebpackModule(document.getText()))
                return;
            return await new WebpackAstParser(document.getText())
                .generateDefinitions(position);
        } catch (e) {
            outputChannel.error(e);
        }
    }
}
