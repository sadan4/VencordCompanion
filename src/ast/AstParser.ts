import { getNumberAndColumnFromPos } from "@ast/lineUtil";

import { Cache, CacheGetter, CharCode, isEOL } from "./util";

import { collectVariableUsage, VariableInfo } from "tsutils/util/usage";
import { getTokenAtPosition } from "tsutils/util/util";
import {
    createSourceFile,
    Identifier,
    isFunctionDeclaration,
    Node,
    ReadonlyTextRange,
    ScriptKind,
    ScriptTarget,
    SourceFile,
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

    public constructor(text: string) {
        this.text = text;
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
     */
    public makeRange({ pos, end }: ReadonlyTextRange): Range {
        return new Range(this.makeLocation(pos), this.makeLocation(end));
    }
    /**
     * convert an offset to a position
     * @param pos zero-based offset
     */
    public makeLocation(pos: number): Position {
        const { lineNumber, column } = getNumberAndColumnFromPos(
            this.text,
            pos,
        );
        return new Position(lineNumber - 1, column - 1);
    }

    public makeRangeFromFuctionDef(ret: Identifier): Range | undefined {
        const uses = this.vars.get(ret)?.uses;
        if (!uses) return undefined;
        const def = uses.find(({ location }) =>
            isFunctionDeclaration(location.parent),
        );
        if (!def) return undefined;
        return this.makeRange(def.location);
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

        const nextLineOffset =
            position.line + 1 < lineOffsets.length
                ? lineOffsets[position.line + 1]
                : this.text.length;
        const offset = Math.min(
            lineOffset + position.character,
            nextLineOffset,
        );
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
    private computeLineOffsets(
        isAtLineStart: boolean,
        textOffset = 0,
    ): number[] {
        const { text } = this;
        const result: number[] = isAtLineStart ? [textOffset] : [];
        for (let i = 0; i < text.length; i++) {
            const ch = text.charCodeAt(i);
            if (isEOL(ch)) {
                if (
                    ch === CharCode.CarriageReturn &&
                    i + 1 < text.length &&
                    text.charCodeAt(i + 1) === CharCode.LineFeed
                ) {
                    i++;
                }
                result.push(textOffset + i + 1);
            }
        }
        return result;
    }
}
