import { CancellationToken, CodeLens, CodeLensProvider, Position, ProviderResult, Range, TextDocument } from "vscode";

export class PartialModuleJumpCodeLensProvider implements CodeLensProvider {
    provideCodeLenses(document: TextDocument, _token: CancellationToken): ProviderResult<CodeLens[]> {
        const text = document.getText();
        if (!(text.startsWith("//WebpackModule") && text.substring(0, 100).includes("//OPEN FULL MODULE: "))) return;

        const moduleId = (text.match(/^\/\/OPEN FULL MODULE: (\d{0,6})/m) ?? [])[1];
        if (!moduleId) return;
        return [{
            range: new Range(new Position(1, 0), new Position(1, 1)),
            command: {
                title: "Open Full Module",
                command: "vencord-companion.extract",
                arguments: [+moduleId],
            },
            isResolved: true
        }];
    }
}
