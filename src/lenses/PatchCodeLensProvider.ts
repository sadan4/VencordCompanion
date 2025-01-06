
import { ArrayLiteralExpression, createSourceFile, Expression, IntersectionTypeNode, isArrayLiteralExpression, isCallExpression, isExportAssignment, isIdentifier, isIntersectionTypeNode, isObjectLiteralExpression, isPropertyAssignment, isRegularExpressionLiteral, isStringLiteral, isTypeReferenceNode, isVariableDeclaration, isVariableStatement, Node, ObjectLiteralExpression, ScriptTarget, TypeReferenceNode } from "typescript";
import { CodeLens, CodeLensProvider, Range, TextDocument } from "vscode";

import { IFindType, IReplacement, PatchData, TestPatch } from "../server/types/send";
import { hasName, isNotNull, tryParseFunction, tryParseRegularExpressionLiteral, tryParseStringLiteral } from "./helpers";

function parseFind(patch: ObjectLiteralExpression): IFindType | null {
    const find = patch.properties.find(p => hasName(p, "find"));
    if (!find || !isPropertyAssignment(find)) return null;
    if (!(isStringLiteral(find.initializer) || isRegularExpressionLiteral(find.initializer))) return null;

    return {
        findType: isStringLiteral(find.initializer) ? "string" : "regex",
        find: find.initializer.text
    };
}

function parseMatch(node: Expression) {
    return tryParseStringLiteral(node) ?? tryParseRegularExpressionLiteral(node);
}

function parseReplace(document: TextDocument, node: Expression) {
    return tryParseStringLiteral(node) ?? tryParseFunction(document, node);
}

function parseReplacement(document: TextDocument, patch: ObjectLiteralExpression): IReplacement[] | null {
    const replacementObj = patch.properties.find(p => hasName(p, "replacement"));

    if (!replacementObj || !isPropertyAssignment(replacementObj)) return null;

    const replacement = replacementObj.initializer;

    const replacements = isArrayLiteralExpression(replacement) ? replacement.elements : [replacement];
    if (!replacements.every(isObjectLiteralExpression)) return null;

    const replacementValues = (replacements as ObjectLiteralExpression[]).map((r: ObjectLiteralExpression) => {
        const match = r.properties.find(p => hasName(p, "match"));
        const replace = r.properties.find(p => hasName(p, "replace"));

        if (!replace || !isPropertyAssignment(replace) || !match || !isPropertyAssignment(match)) return null;

        const matchValue = parseMatch(match.initializer);
        if (!matchValue) return null;

        const replaceValue = parseReplace(document, replace.initializer);
        if (replaceValue == null) return null;

        return {
            match: matchValue,
            replace: replaceValue
        };
    }).filter(isNotNull);

    return replacementValues.length > 0 ? replacementValues : null;
}

// FIXME: remove any
function parsePatch(document: TextDocument, patch: ObjectLiteralExpression): PatchData | null {
    const find = parseFind(patch);
    const replacement = parseReplacement(document, patch);

    if (!replacement || !find) return null;

    return {
        ...find,
        replacement
    };
}

const enum ParseResult {
    NOT_FOUND,
    INVALID
}


const recursivelyFindType = (node: TypeReferenceNode | IntersectionTypeNode, typeName: string): TypeReferenceNode | undefined => {
    if (!isIntersectionTypeNode(node) && isTypeReferenceNode(node)) {
        if (isIdentifier(node.typeName) && node.typeName.text === typeName) return node;
        else return;
    }

    for (const type of node.types) {
        if (isTypeReferenceNode(type) && type.typeArguments) {
            for (const typeArg of type.typeArguments) {
                if (isTypeReferenceNode(typeArg) || isIntersectionTypeNode(typeArg)) {
                    const result = recursivelyFindType(typeArg, typeName);
                    if (result) return result;
                }
            }
        }
        if (isTypeReferenceNode(type) && isIdentifier(type.typeName) && type.typeName.text === typeName) {
            return type;
        } else if (isIntersectionTypeNode(type)) {
            const t = recursivelyFindType(type, typeName);
            if (t) return t;
        }
    }
};


function parsePossiblePatches(node: Node): ArrayLiteralExpression | ParseResult {
    let pluginObj: Expression | undefined = undefined;

    if (isVariableStatement(node)) {
        for (const decl of node.declarationList.declarations) {
            if (isVariableDeclaration(decl) && decl.type && decl.initializer && isObjectLiteralExpression(decl.initializer)) {
                if (isTypeReferenceNode(decl.type) || isIntersectionTypeNode(decl.type)) {
                    const type = recursivelyFindType(decl.type, "PluginDef");
                    if (type) {
                        pluginObj = decl.initializer;
                        break;
                    }
                }
            }
        }
    }

    if (!pluginObj) {
        if (!isExportAssignment(node) || !isCallExpression(node.expression)) return ParseResult.NOT_FOUND;

        const callExpr = node.expression;
        if (!isIdentifier(callExpr.expression) || callExpr.expression.text !== "definePlugin") return ParseResult.NOT_FOUND;

        pluginObj = node.expression.arguments[0];
    }

    if (!isObjectLiteralExpression(pluginObj)) return ParseResult.INVALID;

    const patchesObj = pluginObj.properties.find(p => hasName(p, "patches"));
    if (!patchesObj) return ParseResult.INVALID;

    const patchesArray = isPropertyAssignment(patchesObj) ? patchesObj.initializer : patchesObj;

    return isArrayLiteralExpression(patchesArray) ? patchesArray : ParseResult.INVALID;
}

export class PatchCodeLensProvider implements CodeLensProvider {
    check(text: string) {
        return text.includes("definePlugin") && text.includes("patches:");
    }

    provideCodeLenses(document: TextDocument) {
        const text = document.getText();

        if (!this.check(text)) return [];

        const file = createSourceFile(document.fileName, text, ScriptTarget.Latest);
        const children = file.getChildAt(0).getChildren();

        for (const node of children) {
            const patchesArray = parsePossiblePatches(node);
            if (patchesArray === ParseResult.NOT_FOUND) continue;
            if (patchesArray === ParseResult.INVALID) return [];

            const lenses = [] as CodeLens[];
            for (const patch of patchesArray.elements) {
                if (!isObjectLiteralExpression(patch)) continue;

                const data = parsePatch(document, patch);
                if (!data) continue;

                const range = new Range(document.positionAt(patch.properties.pos), document.positionAt(patch.properties.end));
                lenses.push(new CodeLens(range, {
                    title: "View Module",
                    command: "vencord-companion.extractSearch",
                    arguments: [data.find, data.findType],
                    tooltip: "View Module"
                }));
                lenses.push(new CodeLens(range, {
                    title: "Diff Module",
                    command: "vencord-companion.diffModuleSearch",
                    arguments: [data.find, data.findType],
                    tooltip: "Diff Module"
                }));
                lenses.push(new CodeLens(range, {
                    title: "Test Patch",
                    command: "vencord-companion.testPatch",
                    arguments: [data],
                    tooltip: "Test Patch"
                }));
            }
            return lenses;
        }

        return [];
    }
}
