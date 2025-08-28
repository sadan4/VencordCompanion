import { Position } from "@vencord-companion/shared/Position";

import { AstParser } from "./AstParser";

import { readFileSync } from "fs";
import { join } from "path";

import { SyntaxKind } from "typescript";
import { describe, expect, it } from "vitest";

const __dirname = import.meta.dirname;

function getFile(asset: string): string {
    return readFileSync(join(__dirname, "__test__", asset), "utf-8");
}

describe("AstParser", function () {
    const file: string = getFile("file.js");

    expect(file).to.be.a("string");

    it("constructs", function () {
        new AstParser(file);
    });

    it("sets the text prop", function () {
        const parser = new AstParser(file);

        expect(parser.text).to.equal(file);
    });

    it("creates the sourceFile", function () {
        const parser = new AstParser(file);

        expect(parser.sourceFile.kind).to.equal(SyntaxKind.SourceFile);
    });

    it("collects all vars", function () {
        const parser = new AstParser(file);

        expect(parser.vars).to.have.lengthOf(5);
    });

    describe("line and column utils", function () {
        describe("offset to line + col", function () {
            it("correctly translates 0", function () {
                const parser = new AstParser(file);

                expect(parser.positionAt(0)
                    .isEqual(new Position(0, 0))).to.be.true;
            });

            it("correctly translates pos 1", function () {
                const parser = new AstParser(file);

                expect(parser.positionAt(68)
                    .isEqual(new Position(2, 11))).to.be.true;
            });

            it("correctly translates pos 2", function () {
                const parser = new AstParser(file);

                expect(parser.positionAt(88)
                    .isEqual(new Position(3, 13))).to.be.true;
            });

            it("correctly translates the start of a line", function () {
                const parser = new AstParser(file);

                expect(parser.positionAt(37)
                    .isEqual(new Position(1, 0))).to.be.true;
            });
        });

        describe("line + col to offset", function () {
            it("correctly translates 0", function () {
                const parser = new AstParser(file);

                expect(parser.offsetAt(new Position(0, 0))).to.equal(0);
            });

            it("correctly translates pos 1", function () {
                const parser = new AstParser(file);

                expect(parser.offsetAt(new Position(2, 11))).to.equal(68);
            });

            it("correctly translates pos 2", function () {
                const parser = new AstParser(file);

                expect(parser.offsetAt(new Position(3, 13))).to.equal(88);
            });

            it("correctly translates the start of a line", function () {
                const parser = new AstParser(file);

                expect(parser.offsetAt(new Position(1, 0))).to.equal(37);
            });
        });
    });
});

describe("AstParser - textDocument copied tests", function () {
    const assert = require("assert") as typeof import("assert");

    function newDocument(str: string) {
        return new AstParser(str);
    }

    const Positions = {
        create(line: number, column: number) {
            return new Position(line, column);
        },
    };

    it("Empty content", () => {
        const str = "";
        const document = newDocument(str);

        assert.equal(document.lineCount, 1);
        assert.equal(document.offsetAt(Positions.create(0, 0)), 0);
        assert.deepEqual(document.positionAt(0), Positions.create(0, 0));
    });

    it("Single line", () => {
        const str = "Hello World";
        const document = newDocument(str);

        assert.equal(document.lineCount, 1);

        for (let i = 0; i < str.length; i++) {
            assert.equal(document.offsetAt(Positions.create(0, i)), i);
            assert.deepEqual(document.positionAt(i), Positions.create(0, i));
        }
    });

    it("Multiple lines", () => {
        const str = "ABCDE\nFGHIJ\nKLMNO\n";
        const document = newDocument(str);

        assert.equal(document.lineCount, 4);

        for (let i = 0; i < str.length; i++) {
            const line = Math.floor(i / 6);
            const column = i % 6;

            assert.equal(document.offsetAt(Positions.create(line, column)), i);
            assert.deepEqual(document.positionAt(i), Positions.create(line, column));
        }

        assert.equal(document.offsetAt(Positions.create(3, 0)), 18);
        assert.equal(document.offsetAt(Positions.create(3, 1)), 18);
        assert.deepEqual(document.positionAt(18), Positions.create(3, 0));
        assert.deepEqual(document.positionAt(19), Positions.create(3, 0));
    });

    it("Starts with new-line", () => {
        const document = newDocument("\nABCDE");

        assert.equal(document.lineCount, 2);
        assert.deepEqual(document.positionAt(0), Positions.create(0, 0));
        assert.deepEqual(document.positionAt(1), Positions.create(1, 0));
        assert.deepEqual(document.positionAt(6), Positions.create(1, 5));
    });

    it("New line characters", () => {
        let document = newDocument("ABCDE\rFGHIJ");

        assert.equal(document.lineCount, 2);
        assert.equal(document.offsetAt(Positions.create(1, 0)), 6);

        document = newDocument("ABCDE\nFGHIJ");
        assert.equal(document.lineCount, 2);
        assert.equal(document.offsetAt(Positions.create(1, 0)), 6);

        document = newDocument("ABCDE\r\nFGHIJ");
        assert.equal(document.lineCount, 2);
        assert.equal(document.offsetAt(Positions.create(1, 0)), 7);

        document = newDocument("ABCDE\n\nFGHIJ");
        assert.equal(document.lineCount, 3);
        assert.equal(document.offsetAt(Positions.create(1, 0)), 6);
        assert.equal(document.offsetAt(Positions.create(2, 0)), 7);

        document = newDocument("ABCDE\r\rFGHIJ");
        assert.equal(document.lineCount, 3);
        assert.equal(document.offsetAt(Positions.create(1, 0)), 6);
        assert.equal(document.offsetAt(Positions.create(2, 0)), 7);

        document = newDocument("ABCDE\n\rFGHIJ");
        assert.equal(document.lineCount, 3);
        assert.equal(document.offsetAt(Positions.create(1, 0)), 6);
        assert.equal(document.offsetAt(Positions.create(2, 0)), 7);
    });

    it("Invalid inputs at beginning of file", () => {
        const document = newDocument("ABCDE");

        assert.deepEqual(document.positionAt(-1), Positions.create(0, 0));
    });

    it("Invalid inputs at end of file", () => {
        let str = "ABCDE\n";
        let document = newDocument(str);

        assert.equal(document.offsetAt(Positions.create(1, 1)), str.length);
        assert.equal(document.offsetAt(Positions.create(2, 0)), str.length);
        assert.deepEqual(document.positionAt(str.length), Positions.create(1, 0));
        assert.deepEqual(document.positionAt(str.length + 3), Positions.create(1, 0));

        str = "ABCDE";
        document = newDocument(str);
        assert.equal(document.offsetAt(Positions.create(0, 10)), str.length);
        assert.equal(document.offsetAt(Positions.create(1, 1)), str.length);
        assert.deepEqual(document.positionAt(str.length), Positions.create(0, 5));
        assert.deepEqual(document.positionAt(str.length + 3), Positions.create(0, 5));
    });

    it("Invalid inputs at end of line", () => {
        const document = newDocument("A\nB\rC\r\nD");

        assert.equal(document.offsetAt(Positions.create(0, 10)), 1);
        assert.equal(document.offsetAt(Positions.create(1, 10)), 3);
        assert.equal(document.offsetAt(Positions.create(2, 2)), 5); // between \r and \n
        assert.equal(document.offsetAt(Positions.create(2, 3)), 5);
        assert.equal(document.offsetAt(Positions.create(2, 10)), 5);
        assert.equal(document.offsetAt(Positions.create(3, 10)), 8);

        assert.deepEqual(document.positionAt(6), Positions.create(2, 1)); // between \r and \n
    });
});
