import { WebpackAstParser } from "@ast/webpack";
import { ExportMap } from "@type/ast";

import { expect } from "chai";
import { Range } from "vscode";

describe("WebpackAstParser", function () {
    const normalModule: string = require("test://ast/webpack/module.js");

    it("constructs", function () {
        new WebpackAstParser(normalModule);
    });

    it("parses the module ID", function () {
        const parser = new WebpackAstParser(normalModule);

        expect(parser.moduleId).to.equal("317269");
    });

    describe("export parsing", function () {
        it("parses a module with only wreq.d", function () {
            const parser = new WebpackAstParser(normalModule);
            const map: ExportMap = parser.getExportMap();

            expect(map).to.have.keys("TB", "VY", "ZP");
            for (const expName in map) {
                expect(map[expName]).to.have.length(2);
                // both should be truthy
                expect(map[expName][0] || map[expName][1], "Both are not truthy").to.be.ok;
            }
            // the `ZP` of
            // ```js
            // n.d(t, {
            //     ZP: () => ident
            // })
            // ```
            expect(map.TB[0]).to.deep.equal(new Range(4, 8, 4, 10));
            expect(map.VY[0]).to.deep.equal(new Range(5, 8, 5, 10));
            expect(map.ZP[0]).to.deep.equal(new Range(6, 8, 6, 10));
            // the identifier where its used
            expect(map.TB[1]).to.deep.equal(new Range(162, 13, 162, 14));
            expect(map.VY[1]).to.deep.equal(new Range(183, 13, 183, 14));
            expect(map.ZP[1]).to.deep.equal(new Range(87, 13, 87, 14));
        });
        describe("module.exports", function () {
            it("parses a module with an object literal export (class names)", function () {
                const parser = new WebpackAstParser(require("test://ast/webpack/e.exports/objLiteral.js"));
                const map = parser.getExportMap();

                expect(map).to.have.keys("addButton", "addButtonInner", "productListingsHeader", "productListings");
                for (const k in map)
                    expect(map[k]).to.have.length(2);
                // props in th export
                expect(map.productListingsHeader[0]).to.deep.equal(new Range(5, 8, 5, 29));
                expect(map.productListings[0]).to.deep.equal(new Range(6, 8, 6, 23));
                expect(map.addButton[0]).to.deep.equal(new Range(7, 8, 7, 17));
                expect(map.addButtonInner[0]).to.deep.equal(new Range(8, 8, 8, 22));
                // values in the export (string literals)
                expect(map.productListingsHeader[1]).to.deep.equal(new Range(5, 31, 5, 61));
                expect(map.productListings[1]).to.deep.equal(new Range(6, 25, 6, 49));
                expect(map.addButton[1]).to.deep.equal(new Range(7, 19, 7, 37));
                expect(map.addButtonInner[1]).to.deep.equal(new Range(8, 24, 8, 47));
            });
            it("parses a single string export", function () {
                const parser = new WebpackAstParser(require("test://ast/webpack/e.exports/string.js"));
                const map = parser.getExportMap();

                expect(map).to.have.keys(WebpackAstParser.SYM_CJS_DEFAULT);
                expect(map[WebpackAstParser.SYM_CJS_DEFAULT]).to.have.length(1);
                expect(map[WebpackAstParser.SYM_CJS_DEFAULT][0]).to.deep.equal(new Range(4, 16, 4, 46));
            });
            it("parses a re-export", function () {
                const parser = new WebpackAstParser(require("test://ast/webpack/e.exports/identReExport.js"));
                const map = parser.getExportMap();

                expect(map).to.have.keys(WebpackAstParser.SYM_CJS_DEFAULT);
                expect(map[WebpackAstParser.SYM_CJS_DEFAULT]).to.have.length(1);
                expect(map[WebpackAstParser.SYM_CJS_DEFAULT][0]).to.deep.equal(new Range(4, 12, 4, 21));
            });
            it("parses exports in an intermediate variable", function () {
                const parser = new WebpackAstParser(require("test://ast/webpack/e.exports/ident.js"));
                const map = parser.getExportMap();

                const keys = [
                    "headerContainer",
                    "closeContainer",
                    "closeIcon",
                    "headerImage",
                    "headerImageContainer",
                    "confirmationContainer",
                    "purchaseConfirmation",
                    "confirmationTitle",
                    "confirmationSubtitle",
                ];

                expect(map).to.have.keys(keys);
                keys.forEach((key) => {
                    expect(map[key]).to.have.length(2);
                });
                keys.filter((x) => typeof x === "string")
                    .forEach((key, i) => {
                        expect(map[key][0]).to.deep.equal(new Range(i + 5, 8, i + 5, key.length + 8));
                    });

                const stringPoints = [49, 47, 37, 41, 59, 61, 88, 53, 59];

                keys.filter((x) => typeof x === "string")
                    .forEach((key, i) => {
                        const end = stringPoints[i];

                        expect(map[key][1]).to.deep.equal(new Range(i + 5, key.length + 8 + 2, i + 5, end));
                    });
            });
            it("parses a function expression", function () {
                const parser = new WebpackAstParser(require("test://ast/webpack/e.exports/function.js"));
                const map = parser.getExportMap();

                expect(map).to.have.keys(WebpackAstParser.SYM_CJS_DEFAULT);
                expect(map[WebpackAstParser.SYM_CJS_DEFAULT]).to.have.length(1);
                expect(map[WebpackAstParser.SYM_CJS_DEFAULT][0]).to.deep.equal(new Range(9, 16, 9, 27));
            });
            it("parses everything else", function () {
                const parser = new WebpackAstParser(require("test://ast/webpack/e.exports/everythingElse.js"));
                const map = parser.getExportMap();

                expect(map).to.have.keys(WebpackAstParser.SYM_CJS_DEFAULT);
                expect(map[WebpackAstParser.SYM_CJS_DEFAULT]).to.have.length(1);
                expect(map[WebpackAstParser.SYM_CJS_DEFAULT][0]).to.deep.equal(new Range(5, 16, 5, 44));
            });
        });
        describe("exports", function () {
            it("Parses exports properly", function () {
                const parser = new WebpackAstParser(require("test://ast/webpack/exports/module.js"));

                const keys = [
                    "Deflate",
                    "deflate",
                    "deflateRaw",
                    "gzip",
                ];

                const map = parser.getExportMap();

                expect(map).to.have.keys(keys);
                keys.forEach((key) => {
                    expect(map[key]).to.have.length(3);
                });
                keys.forEach((key, i) => {
                    expect(map[key][0]).to.deep.equal(new Range(101 + i, 6, 101 + i, 6 + key.length));
                    expect(map[key][1]).to.deep.equal(new Range(101 + i, 9 + key.length, 101 + i, 10 + key.length));
                });
                expect(map.Deflate[2]).to.deep.equal(new Range(18, 13, 18, 14));
                expect(map.deflate[2]).to.deep.equal(new Range(49, 13, 49, 14));
                expect(map.deflateRaw[2]).to.deep.equal(new Range(56, 13, 56, 14));
                expect(map.gzip[2]).to.deep.equal(new Range(60, 13, 60, 14));
            });
        });
    });
    describe("import parsing", function () {
        it("parses re-exports properly", function () {
            const module = require("test://ast/webpack/imports/reExport.js");
            const parser = 
        });

    });
});
