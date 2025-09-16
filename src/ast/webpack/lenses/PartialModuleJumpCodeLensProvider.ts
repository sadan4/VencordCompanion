import { CodeLens, CodeLensProvider, ExtensionContext, languages, Position, ProviderResult, Range, TextDocument } from "vscode";

export class PartialModuleJumpCodeLensProvider implements CodeLensProvider {
    private constructor() { }

    provideCodeLenses(document: TextDocument): ProviderResult<CodeLens[]> {
        const text = document.getText();

        if (!(text.startsWith("// Webpack Module ") && text.substring(0, 100)
            .includes("//OPEN FULL MODULE: ")))
            return;

        const [, moduleId] = text.match(/^\/\/OPEN FULL MODULE: (\d{0,6})/m) ?? [];

        if (!moduleId)
            return;
        return [
            {
                range: new Range(new Position(1, 0), new Position(1, 1)),
                command: {
                    title: "Open Full Module",
                    command: "vencord-companion.extract",
                    arguments: [+moduleId],
                },
                isResolved: true,
            },
        ];
    }

    public static register({ subscriptions }: ExtensionContext) {
        subscriptions.push(languages.registerCodeLensProvider({ language: "javascript" }, new this()));
    }
}
