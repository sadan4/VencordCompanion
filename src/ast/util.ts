import * as Shared from "@vencord-companion/shared/Range";

import { getNumberAndColumnFromPos } from "./lineUtil";

import {
    isRegularExpressionLiteral,
    isStringLiteral,
    isTemplateLiteralToken,
    Node,
    ReadonlyTextRange,
    RegularExpressionLiteral,
    StringLiteral,
    TemplateLiteralLikeNode,
} from "typescript";
import { Position, Range } from "vscode";

export * from "@ast/lineUtil";

/**
 *  return a vscode.Range based of node.pos and node.end
 *  @param text the document that node is in
 */
export function makeRange(node: ReadonlyTextRange, text: string): Range {
    return new Range(makeLocation(node.pos, text), makeLocation(node.end, text));
}

export function toVscodeRange(r: Shared.IRange): Range {
    return new Range(r.start.line, r.start.character, r.end.line, r.end.character);
}

/**
 *  returns a vscode.Position based of pos
 *  @param pos absolute offset
 *  @param text the document to take the offset from
 */
export function makeLocation(pos: number, text: string): Position {
    const loc = getNumberAndColumnFromPos(text, pos);

    return new Position(loc.lineNumber - 1, loc.column - 1);
}

export function isStringLiteralLikeOrTemplateLiteralFragmentOrRegexLiteral(node: Node):
    node is TemplateLiteralLikeNode | StringLiteral | RegularExpressionLiteral {
    if (isStringLiteral(node))
        return true;
    if (isTemplateLiteralToken(node))
        return true;
    if (isRegularExpressionLiteral(node))
        return true;
    return false;
}
