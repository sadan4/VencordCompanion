// import { AstParser } from "@ast/AstParser";

import { expect } from "chai";
import file from "test://ast/file.js";
import { SyntaxKind } from "typescript";

describe("AstParser", function () {
    before("test import of extension", async function () {
        const my_Chai = expect;
        const my_require = require;
        console.log(await import("@ast/AstParser"));
    });

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

    describe("line and collumn utils", function () {
        describe("offset to line + col", function () {
            it("correctly translates 0", function () {
                const parser = new AstParser(file);
                expect(parser.makeLocation(0).isEqual(new Position(0, 0))).to.be.true;
            });

            it("correctly translates pos 1", function () {
                const parser = new AstParser(file);
                expect(parser.makeLocation(68).isEqual(new Position(2, 11))).to.be.true;
            });

            it("correctly translates pos 2", function () {
                const parser = new AstParser(file);
                expect(parser.makeLocation(88).isEqual(new Position(3, 13))).to.be.true;
            });

            it("correctly translates the start of a line", function () {
                const parser = new AstParser(file);
                expect(parser.makeLocation(37).isEqual(new Position(1, 0))).to.be.true;
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
