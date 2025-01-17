import { DisablePluginData } from "@type/server";

import {
  createSourceFile,
  isCallExpression,
  isExportAssignment,
  isIdentifier,
  isObjectLiteralExpression,
  isPropertyAssignment,
  isStringLiteral,
  Node,
  ObjectLiteralExpression,
  ScriptTarget,
  StringLiteral,
} from "typescript";
import { CodeLens, CodeLensProvider, ProviderResult, Range, TextDocument } from "vscode";

enum ParseResult {
    INVALID,
    NOT_FOUND
}
function isSerialziable(node: Node): asserts node is StringLiteral {
    if (!(isStringLiteral(node))) throw new Error("node is not serializable");
}
function parseObjLiteralExpr<T extends readonly string[]>(expr: ObjectLiteralExpression, search: [...T]): { [key in T[number]]: string } {
    const toRet: Record<string, string> = {};
    for (const node of expr.properties) {
        if (!isPropertyAssignment(node)) continue;
        if (!isIdentifier(node.name)) continue;
        if (!search.includes(node.name.text)) continue;
        isSerialziable(node.initializer);
        toRet[node.name.text] = node.initializer.text;
    }
    if (search.some(v => !(toRet[v]))) throw new Error("Not all search values found");
    return toRet as any;
}
function parsePossiblePatches(node: Node): {
    posStart: number,
    posEnd: number,
    pluginName: string
} | ParseResult {
    if (!isExportAssignment(node))
        return ParseResult.NOT_FOUND;
    if (!isCallExpression(node.expression))
        return ParseResult.NOT_FOUND;
    if (!isIdentifier(node.expression.expression))
        return ParseResult.NOT_FOUND;
    if (node.expression.expression.text !== "definePlugin")
        return ParseResult.NOT_FOUND;
    if (!isObjectLiteralExpression(node.expression.arguments[0]))
        return ParseResult.INVALID;
    let pluginDef;
    try {
        pluginDef = parseObjLiteralExpr(node.expression.arguments[0], ["name"]);
    } catch (_error) {
        return ParseResult.INVALID;
    }
    return {
        pluginName: pluginDef.name,
        posStart: node.expression.pos,
        posEnd: node.expression.end
    };
}

export class PluginDefCodeLensProvider implements CodeLensProvider {
    check(text: string) {
        return text.includes("definePlugin") && text.includes("name:");
    }
    provideCodeLenses(doc: TextDocument): ProviderResult<CodeLens[]> {
        const text = doc.getText();
        if (!this.check(text)) return [];
        const file = createSourceFile(doc.fileName, text, ScriptTarget.Latest);

        const children = file.getChildAt(0).getChildren();

        const lenses: CodeLens[] = [];
        for (const node of children) {
            const patchesArray = parsePossiblePatches(node);
            if (patchesArray === ParseResult.INVALID) return [];
            if (patchesArray === ParseResult.NOT_FOUND) continue;
            const range = new Range(doc.positionAt(patchesArray.posStart), doc.positionAt(patchesArray.posEnd));
            lenses.push(new CodeLens(range, {
                title: "Disable Plugin",
                command: "vencord-companion.disablePlugin",
                arguments: [{
                    pluginName: patchesArray.pluginName,
                    enabled: false
                } satisfies DisablePluginData]
            }));
            lenses.push(new CodeLens(range, {
                title: "Enable Plugin",
                command: "vencord-companion.disablePlugin",
                arguments: [{
                    pluginName: patchesArray.pluginName,
                    enabled: true
                } satisfies DisablePluginData]
            }));
        }
        return lenses;
    }
}
