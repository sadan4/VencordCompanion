import { AstParser } from "@ast/AstParser";

import { expect } from "chai";
import file from "test://ast/file.js";
import { SyntaxKind } from "typescript";

describe("AstParser", function () {
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
});
