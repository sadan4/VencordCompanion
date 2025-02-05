import { isWebpackModule } from "@ast/util";
import { WebpackAstParser } from "@ast/webpack";
import { outputChannel } from "@extension";
import { Definitions } from "@type/ast";

import { DefinitionProvider as IDefinitionProvider, Position, TextDocument } from "vscode";


export class DefinitionProvider implements IDefinitionProvider {
    async provideDefinition(
        document: TextDocument,
        position: Position
    ): Definitions {
        try {
            // not sure if substring is a good idea here
            // just dont want to search really long webpack modules
            if (!isWebpackModule(document))
                return;
            return await new WebpackAstParser(document).generateDefinitions(
                document,
                position
            );
        } catch (e) {
            outputChannel.appendLine(String(e));
        }
    }
}
