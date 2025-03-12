import { getNumberAndColumnFromPos } from "@ast/lineUtil";
import { outputChannel } from "@modules/logging";

import { Cache, CacheGetter, CharCode, isEOL } from "./util";

import { collectVariableUsage, VariableInfo } from "tsutils/util/usage";
import { getTokenAtPosition } from "tsutils/util/util";
import {
    ArrowFunction,
    CallExpression,
    createSourceFile,
    Expression,
    FunctionDeclaration,
    FunctionExpression,
    Identifier,
    isArrowFunction,
    isBigIntLiteral,
    isFunctionDeclaration,
    isFunctionExpression,
    isFunctionLike,
    isJsxText,
    isNumericLiteral,
    isRegularExpressionLiteral,
    isStringLiteralLike,
    isVariableDeclaration,
    LiteralToken,
    Node,
    ReadonlyTextRange,
    ScriptKind,
    ScriptTarget,
    SourceFile,
    SyntaxKind,
} from "typescript";
import { Position, Range } from "vscode";

export class AstParser {
    public readonly text: string;

    @CacheGetter()
    public get sourceFile(): SourceFile {
        return this.createSourceFile();
    }

    /**
     * All the variables in the source file
     */
    @CacheGetter()
    public get vars(): Map<Identifier, VariableInfo> {
        return collectVariableUsage(this.sourceFile);
    }

    public getVarInfoFromUse(ident: Identifier): VariableInfo | undefined {
        const toRet = [...this.vars.values()].find((x) => x.uses.some((use) => use.location === ident));

        if (!toRet) {
            outputChannel.debug("getVarInfoFromUse: no variable info found for identifier");
        }
        return toRet;
    }

    public constructor(text: string) {
        this.text = text;
    }

    /**
     * given something like this
     * ```js
     * const bar = "foo";
     * const baz = bar;
     * const qux = baz;
     * ```
     * if given `qux` it will return `[bar, baz]`;
     *
     * fails on something where a variable is reassigned
     */
    public unwrapVariableDeclaration(ident: Identifier): Identifier[] | undefined {
        const arr: Identifier[] = [];
        let last = ident;

        while (true) {
            const [varDec, ...rest] = this.getVarInfoFromUse(last)?.declarations ?? [];

            if (!varDec)
                break;
            if (rest.length) {
                arr.length = 0;
                break;
            }
            arr.push(last = varDec);
        }
        if (arr.length !== 0)
            return arr;
        outputChannel.debug("Failed finding variable declaration");
    }

    public isCallExpression(node: Node | undefined): node is CallExpression {
        return node?.kind === SyntaxKind.CallExpression;
    }

    /**
     * given the `x` of
     * ```js
     * const x = {
     * foo: bar
     * }
     * ```
     * NOTE: this must be the exact x, not a use of it
     * @returns the expression {foo: bar}
     */
    public getVariableInitializer(ident: Identifier): Expression | undefined {
        const dec = ident.parent;

        if (!isVariableDeclaration(dec))
            return;
        return dec.initializer;
    }

    /**
     * Create the source file for this parser
     *
     * MUST SET PARENT NODES
     */
    @Cache()
    protected createSourceFile(): SourceFile {
        return createSourceFile("file.tsx",
            this.text,
            ScriptTarget.ESNext,
            true,
            ScriptKind.TSX);
    }

    /** Returns the token at or following the specified position or undefined if none is found inside `parent`. */
    public getTokenAtOffset(pos: number): Node | undefined {
        return getTokenAtPosition(this.sourceFile, pos, this.sourceFile, false);
    }

    public getTokenAtPosition(pos: Position): Node | undefined {
        return this.getTokenAtOffset(this.offsetAt(pos));
    }

    /**
     * convert two offsets to a range
     * DO NOT USE WITH AN AST NODE, IT WILL LEAD TO INCORRECT LOCATIONS
     * @see makeRangeFromAstNode
     */
    public makeRange({ pos, end }: ReadonlyTextRange): Range {
        return new Range(this.makeLocation(pos), this.makeLocation(end));
    }

    public makeRangeFromAstNode(node: Node) {
        return new Range(this.makeLocation(node.getStart(this.sourceFile)), this.makeLocation(node.end));
    }

    /**
     * convert an offset to a position
     * @param pos zero-based offset
     */
    public makeLocation(pos: number): Position {
        const { lineNumber, column } = getNumberAndColumnFromPos(this.text,
            pos);

        return new Position(lineNumber - 1, column - 1);
    }

    public makeRangeFromAnonFunction(func: FunctionExpression | ArrowFunction): Range {
        const { body: { pos } } = func;

        return this.makeRange({
            pos: func.getStart(),
            end: pos,
        });
    }

    public makeRangeFromFunctionDef(ident: Identifier): Range | undefined {
        const { declarations } = this.getVarInfoFromUse(ident) ?? {};

        if (!declarations) {
            outputChannel.debug("makeRangeFromFunctionDef: no declarations found for identifier");
            return undefined;
        }
        if (declarations.length !== 1) {
            outputChannel.debug("makeRangeFromFunctionDef: zero or multiple declarations found for identifier");
            return undefined;
        }
        if (declarations[0].parent && !isFunctionLike(declarations[0].parent)) {
            outputChannel.debug("makeRangeFromFunctionDef: dec. parent is not a function");
            return undefined;
        }
        return this.makeRangeFromAstNode(declarations[0]);
    }

    public isLiteralish(node: Node): node is LiteralToken {
        return isStringLiteralLike(node)
          || isNumericLiteral(node)
          || isBigIntLiteral(node)
          || isJsxText(node)
          || isRegularExpressionLiteral(node);
    }

    public isFunctionLike(node: Node): node is FunctionDeclaration | ArrowFunction | FunctionExpression {
        return isArrowFunction(node) || isFunctionDeclaration(node) || isFunctionExpression(node);
    }

    /**
     * Converts the position to a zero-based offset.
     * Invalid positions are adjusted as described in {@link Position.line}
     * and {@link Position.character}.
     *
     * @param position A position.
     * @return A valid zero-based offset.
     */
    // copied from vscode-languageserver-node
    public offsetAt(position: Position): number {
        const { lineOffsets } = this;

        if (position.line >= lineOffsets.length) {
            return this.text.length;
        } else if (position.line < 0) {
            return 0;
        }

        const lineOffset = lineOffsets[position.line];

        if (position.character <= 0) {
            return lineOffset;
        }

        const nextLineOffset
            = position.line + 1 < lineOffsets.length
                ? lineOffsets[position.line + 1]
                : this.text.length;

        const offset = Math.min(lineOffset + position.character,
            nextLineOffset);

        return this.ensureBeforeEOL(offset, lineOffset);
    }

    // methods copied from vscode-languageserver-node
    @CacheGetter()
    private get lineOffsets() {
        return this.computeLineOffsets(true);
    }

    private ensureBeforeEOL(offset: number, lineOffset: number): number {
        while (offset > lineOffset && isEOL(this.text.charCodeAt(offset - 1))) {
            offset--;
        }
        return offset;
    }

    private computeLineOffsets(isAtLineStart: boolean,
        textOffset = 0): number[] {
        const { text } = this;
        const result: number[] = isAtLineStart ? [textOffset] : [];

        for (let i = 0; i < text.length; i++) {
            const ch = text.charCodeAt(i);

            if (isEOL(ch)) {
                if (
                    ch === CharCode.CarriageReturn
                    && i + 1 < text.length
                    && text.charCodeAt(i + 1) === CharCode.LineFeed
                ) {
                    i++;
                }
                result.push(textOffset + i + 1);
            }
        }
        return result;
    }
}
