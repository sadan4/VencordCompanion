import { format } from "@modules/format";
import { outputChannel } from "@modules/logging";
import { mkStringUri } from "@modules/util";
import { Functionish } from "@type/ast";

import { Cache, CacheGetter, CharCode, isEOL } from "./util";

import { collectVariableUsage, VariableInfo } from "tsutils/util/usage";
import { getTokenAtPosition } from "tsutils/util/util";
import {
    AssignmentExpression,
    AssignmentOperatorToken,
    CallExpression,
    createSourceFile,
    Expression,
    Identifier,
    isArrowFunction,
    isBigIntLiteral,
    isBinaryExpression,
    isConstructorDeclaration,
    isFunctionDeclaration,
    isFunctionExpression,
    isFunctionLike,
    isGetAccessorDeclaration,
    isIdentifier,
    isJsxText,
    isMethodDeclaration,
    isNumericLiteral,
    isPropertyAccessExpression,
    isRegularExpressionLiteral,
    isSetAccessorDeclaration,
    isStringLiteralLike,
    isVariableDeclaration,
    LeftHandSideExpression,
    LiteralToken,
    MemberName,
    Node,
    PropertyAccessExpression,
    ReadonlyTextRange,
    ScriptKind,
    ScriptTarget,
    SourceFile,
    SyntaxKind,
    VariableDeclaration,
} from "typescript";
import { Position, Range, Uri } from "vscode";

export class AstParser {
    public static withFormattedText(text: string) {
        return new this(format(text));
    }

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

    // FIXME: add tests for this
    /**
     * @param use a use of a variable
     * @param decl a declaration of a variable
     * @returns true of the use is a use of the declaration, false otherwise
     */
    public isUseOf(use: Identifier, decl: Identifier): boolean {
        if (!decl || !use)
            return false;

        const varInfo = this.vars.get(decl);

        if (!varInfo)
            return false;

        return varInfo.uses.some(({ location }) => location === use);
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
     * Returns an {@link Uri} for this file that can be used
     * to open this file.
     */
    public mkStringUri(): Uri {
        return mkStringUri(this.text);
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

    public isVariableAssignmentLike(node: Node | undefined):
    node is
    | (
      & Omit<VariableDeclaration, "name" | "initializer">
      & {
          name: Identifier;
          initilizer: Exclude<VariableDeclaration["initializer"], undefined>;
      }
    )
    | (Omit<AssignmentExpression<AssignmentOperatorToken>, "left"> & { left: Identifier; }) {
        if (!node)
            return false;

        if (isVariableDeclaration(node)) {
            return isIdentifier(node.name) && !!node.initializer;
        } else if (isBinaryExpression(node)) {
            return this.isAssignmentExpression(node);
        }
        return false;
    }

    public isAssignmentExpression(node: Node | undefined):
     node is AssignmentExpression<AssignmentOperatorToken> {
        if (!node || !isBinaryExpression(node) || !isIdentifier(node.left))
            return false;


        switch (node.operatorToken.kind) {
            case SyntaxKind.EqualsToken:
            case SyntaxKind.PlusEqualsToken:
            case SyntaxKind.MinusEqualsToken:
            case SyntaxKind.AsteriskAsteriskEqualsToken:
            case SyntaxKind.AsteriskEqualsToken:
            case SyntaxKind.SlashEqualsToken:
            case SyntaxKind.PercentEqualsToken:
            case SyntaxKind.AmpersandEqualsToken:
            case SyntaxKind.BarEqualsToken:
            case SyntaxKind.CaretEqualsToken:
            case SyntaxKind.LessThanLessThanEqualsToken:
            case SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken:
            case SyntaxKind.GreaterThanGreaterThanEqualsToken:
            case SyntaxKind.BarBarEqualsToken:
            case SyntaxKind.AmpersandAmpersandEqualsToken:
            case SyntaxKind.QuestionQuestionEqualsToken:
                return true;
            default:
                return false;
        }
    }

    // TODO: add tests for this
    /**
     * @param expr the property access expression to flatten
     *
     * given a property access expression like `foo.bar.baz.qux`
     * 
     * @returns the identifiers [`foo`, `bar`, `baz`, `qux`]
     * 
     * given another property access expression like `foo.bar.baz[0].qux.abc`
     * 
     * @returns the elementAccessExpression, followed by the identifiers [`foo.bar.baz[0]`, `qux`, `abc`]
     */
    public flattenPropertyAccessExpression(expr: PropertyAccessExpression | undefined):
      | readonly [LeftHandSideExpression, ...MemberName[]]
      | undefined {
        if (!expr)
            return undefined;

        const toRet = [] as any as [LeftHandSideExpression, ...MemberName[]];
        let cur = expr;

        do {
            toRet.unshift(cur.name);
            if (isIdentifier(cur.expression)) {
                toRet.unshift(cur.expression);
                return toRet;
            }
            if (!isPropertyAccessExpression(cur.expression)) {
                toRet.unshift(cur.expression);
                return;
            }
        } while ((cur = cur.expression));
    }

    /**
     * Create the source file for this parser
     *
     * MUST SET PARENT NODES
     */
    @Cache()
    protected createSourceFile(): SourceFile {
        return createSourceFile(
            "file.tsx",
            this.text,
            ScriptTarget.ESNext,
            true,
            ScriptKind.TSX,
        );
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
        return new Range(this.positionAt(pos), this.positionAt(end));
    }

    public makeRangeFromAstNode(node: Node) {
        return new Range(this.positionAt(node.getStart(this.sourceFile)), this.positionAt(node.end));
    }

    public makeRangeFromAnonFunction(func: Functionish): Range {
        const { pos } = func.body ?? { pos: func.getEnd() };

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

    public isFunctionish(node: Node): node is Functionish {
        return (
            isFunctionDeclaration(node)
            || isMethodDeclaration(node)
            || isGetAccessorDeclaration(node)
            || isSetAccessorDeclaration(node)
            || isConstructorDeclaration(node)
            || isFunctionExpression(node)
            || isArrowFunction(node)
        );
    }

    public isIdentifier(node: Node | undefined): node is Identifier {
        return !!node && isIdentifier(node);
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

        const offset = Math.min(lineOffset + position.character, nextLineOffset);

        return this.ensureBeforeEOL(offset, lineOffset);
    }

    // methods copied from vscode-languageserver-node
    @CacheGetter()
    private get lineOffsets() {
        return this.computeLineOffsets(true);
    }

    @CacheGetter()
    public get lineCount() {
        return this.lineOffsets.length;
    }

    private ensureBeforeEOL(offset: number, lineOffset: number): number {
        while (offset > lineOffset && isEOL(this.text.charCodeAt(offset - 1))) {
            offset--;
        }
        return offset;
    }

    private computeLineOffsets(isAtLineStart: boolean, textOffset = 0): number[] {
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

    /**
     * Converts a zero-based offset to a position.
     *
     * @param offset A zero-based offset.
     * @return A valid {@link Position position}.
     * @example The text document "ab\ncd" produces:
     * position { line: 0, character: 0 } for `offset` 0.
     * position { line: 0, character: 1 } for `offset` 1.
     * position { line: 0, character: 2 } for `offset` 2.
     * position { line: 1, character: 0 } for `offset` 3.
     * position { line: 1, character: 1 } for `offset` 4.
     */
    public positionAt(offset: number): Position {
        offset = Math.max(Math.min(offset, this.text.length), 0);

        const { lineOffsets } = this;

        let low = 0,
            high = lineOffsets.length;

        if (high === 0) {
            return new Position(0, offset);
        }
        while (low < high) {
            const mid = Math.floor((low + high) / 2);

            if (lineOffsets[mid] > offset) {
                high = mid;
            } else {
                low = mid + 1;
            }
        }

        // low is the least x for which the line offset is larger than the current offset
        // or array.length if no line offset is larger than the current offset
        const line = low - 1;

        offset = this.ensureBeforeEOL(offset, lineOffsets[line]);
        return new Position(line, offset - lineOffsets[line]);
    }
}
