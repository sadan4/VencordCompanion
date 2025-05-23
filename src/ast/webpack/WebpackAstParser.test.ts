import { TypeAssert } from "@ast/util";
import { WebpackAstParser } from "@ast/webpack";
import { RangeExportMap } from "@type/ast";

import { expect } from "chai";
import { resolve } from "node:path";
import { Location, Position, Range, Uri } from "vscode";

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
        // TODO: add length check for wreq.d args
        describe("wreq.d", function () {
            it("parses a simple module", function () {
                const parser = new WebpackAstParser(normalModule);
                const map: RangeExportMap = parser.getExportMap();

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
            it("parses a module with a string literal export", function () {
                const parser = new WebpackAstParser(require("test://ast/webpack/wreq.d/simpleString.js"));
                const map = parser.getExportMap();

                expect(map).to.have.keys("STRING_EXPORT");

                expect(map.STRING_EXPORT).to.deep.equal([new Range(5, 8, 5, 21), new Range(7, 12, 7, 31)]);
            });
            it("parses a module with an object literal export", function () {
                const parser = new WebpackAstParser(require("test://ast/webpack/wreq.d/objectExport.js"));
                const map = parser.getExportMap();

                expect(map).to.deep.equal({
                    EO: [
                        new Range(5, 8, 5, 10),
                        new Range(124, 13, 124, 14),
                    ],
                    ZP: {
                        getName: [
                            new Range(156, 8, 156, 15),
                            new Range(53, 13, 53, 14),
                        ],
                        useName: [
                            new Range(157, 8, 157, 15),
                            new Range(62, 13, 62, 14),
                        ],
                        isNameConcealed: [
                            new Range(158, 8, 158, 23),
                            new Range(158, 25, 158, 29),
                        ],
                        getUserTag: [
                            new Range(159, 8, 159, 18),
                            new Range(142, 13, 142, 14),
                        ],
                        useUserTag: [
                            new Range(160, 8, 160, 18),
                            new Range(160, 20, 160, 34),
                        ],
                        getFormattedName: [
                            new Range(164, 8, 164, 24),
                            new Range(81, 13, 81, 14),
                        ],
                        getGlobalName: [
                            new Range(165, 8, 165, 21),
                            new Range(72, 13, 72, 14),
                        ],
                        humanizeStatus: [
                            new Range(166, 8, 166, 22),
                            new Range(90, 13, 90, 14),
                        ],
                        useDirectMessageRecipient: [
                            new Range(167, 8, 167, 33),
                            new Range(147, 13, 147, 14),
                        ],
                        [WebpackAstParser.SYM_CJS_DEFAULT]: [new Range(155, 12, 155, 13)],
                    },
                });
            });
            it("parses a module with an exported object with a computed property", function () {
                const parser = new WebpackAstParser(require("test://ast/webpack/wreq.d/computedPropInObj.js"));
                const map = parser.getExportMap();

                expect(map).to.deep.equal({
                    Z: {
                        "[n(231338).Et.GET_PLATFORM_BEHAVIORS]": {
                            handler: [
                                new Range(8, 12, 8, 19),
                                new Range(8, 21, 8, 26),
                            ],
                            [WebpackAstParser.SYM_CJS_DEFAULT]: [new Range(7, 47, 7, 48)],
                        },
                        [WebpackAstParser.SYM_CJS_DEFAULT]: [new Range(6, 12, 6, 13)],
                    },
                });
            });
        });
        describe("module.exports", function () {
            it("parses a module with an object literal export (class names)", function () {
                const parser = new WebpackAstParser(require("test://ast/webpack/e.exports/objLiteral.js"));
                const map = parser.getExportMap();

                expect(map).to.deep.equal({
                    productListingsHeader: [
                        new Range(5, 8, 5, 29),
                        new Range(5, 31, 5, 61),
                    ],
                    productListings: [
                        new Range(6, 8, 6, 23),
                        new Range(6, 25, 6, 49),
                    ],
                    addButton: [
                        new Range(7, 8, 7, 17),
                        new Range(7, 19, 7, 37),
                    ],
                    addButtonInner: [
                        new Range(8, 8, 8, 22),
                        new Range(8, 24, 8, 47),
                    ],
                    [WebpackAstParser.SYM_CJS_DEFAULT]: [new Range(4, 16, 4, 17)],
                });
            });
            it("parses a single string export", function () {
                const parser = new WebpackAstParser(require("test://ast/webpack/e.exports/string.js"));
                const map = parser.getExportMap();

                expect(map).to.deep.equal({
                    [WebpackAstParser.SYM_CJS_DEFAULT]: [new Range(4, 16, 4, 46)],
                });
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

                expect(map).to.deep.equal({
                    headerContainer: [
                        new Range(5, 8, 5, 23),
                        new Range(5, 25, 5, 49),
                    ],
                    closeContainer: [
                        new Range(6, 8, 6, 22),
                        new Range(6, 24, 6, 47),
                    ],
                    closeIcon: [
                        new Range(7, 8, 7, 17),
                        new Range(7, 19, 7, 37),
                    ],
                    headerImage: [
                        new Range(8, 8, 8, 19),
                        new Range(8, 21, 8, 41),
                    ],
                    headerImageContainer: [
                        new Range(9, 8, 9, 28),
                        new Range(9, 30, 9, 59),
                    ],
                    confirmationContainer: [
                        new Range(10, 8, 10, 29),
                        new Range(10, 31, 10, 61),
                    ],
                    purchaseConfirmation: [
                        new Range(11, 8, 11, 28),
                        new Range(11, 30, 11, 88),
                    ],
                    confirmationTitle: [
                        new Range(12, 8, 12, 25),
                        new Range(12, 27, 12, 53),
                    ],
                    confirmationSubtitle: [
                        new Range(13, 8, 13, 28),
                        new Range(13, 30, 13, 59),
                    ],
                    [WebpackAstParser.SYM_CJS_DEFAULT]: [new Range(4, 12, 4, 13)],
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
        describe("stores", function () {
            it("generates the proper export map for a store exported with wreq.d", function () {
                const parser = new WebpackAstParser(require("test://ast/webpack/stores/store1.js"));
                const map = parser.getExportMap();

                expect(map).to.have.keys("Z");

                expect(map.Z).to.have.keys(["initialize", "isVisible", WebpackAstParser.SYM_CJS_DEFAULT]);
                TypeAssert<RangeExportMap>(map.Z);
                expect(map.Z[WebpackAstParser.SYM_CJS_DEFAULT]).to.deep.equal([
                    new Range(4, 8, 4, 9),
                    new Range(32, 16, 32, 17),
                    new Range(10, 10, 10, 11),
                ]);
                expect(map.Z.initialize).to.deep.equal([new Range(11, 8, 11, 18)]);
                expect(map.Z.isVisible).to.deep.equal([new Range(18, 8, 18, 17)]);
            });
            it("generates the proper export map for a store constructed with no arguments", function () {
                const parser = new WebpackAstParser(require("test://ast/webpack/stores/store2.js"));
                const map = parser.getExportMap();

                expect(map).to.have.keys("default", "mergeUser", "ASSISTANT_WUMPUS_VOICE_USER");

                expect(map.default).to.deep.equal({
                    initialize: [new Range(212, 8, 212, 18)],
                    takeSnapshot: [new Range(215, 8, 215, 20)],
                    handleLoadCache: [new Range(224, 8, 224, 23)],
                    getUserStoreVersion: [new Range(38, 12, 38, 13)],
                    getUser: [new Range(241, 8, 241, 15)],
                    getUsers: [new Range(245, 8, 245, 16)],
                    forEach: [new Range(248, 8, 248, 15)],
                    findByTag: [new Range(253, 8, 253, 17)],
                    filter: [new Range(260, 8, 260, 14)],
                    getCurrentUser: [new Range(270, 8, 270, 22)],
                    [WebpackAstParser.SYM_CJS_DEFAULT]: [
                        new Range(7, 8, 7, 15),
                        new Range(286, 17, 286, 19),
                        new Range(211, 10, 211, 12),
                        new Range(273, 8, 282, 9),
                    ],
                });
                expect(map.ASSISTANT_WUMPUS_VOICE_USER).to.deep.equal([
                    new Range(6, 8, 6, 35),
                    new Range(39, 12, 39, 31),
                ]);
                expect(map.mergeUser).to.deep.equal([
                    new Range(8, 8, 8, 17),
                    new Range(118, 13, 118, 14),
                ]);
            });
            it("generates the proper export map for a store with no initialize method", function () {
                const parser = new WebpackAstParser(require("test://ast/webpack/stores/store3.js"));
                const map = parser.getExportMap();

                expect(map).to.have.keys("Z");
                expect(map.Z).to.deep.equal({
                    getGuild: [new Range(199, 8, 199, 16)],
                    getGuilds: [new Range(203, 8, 203, 17)],
                    getGuildIds: [new Range(206, 8, 206, 19)],
                    // getGuildCount: [new Range(209, 8, 209, 21)],
                    getGuildCount: [new Range(4, 8, 4, 9)],
                    // isLoaded: [new Range(212, 8, 212, 16)],
                    isLoaded: [new Range(52, 12, 52, 14)],
                    getGeoRestrictedGuilds: [new Range(53, 12, 53, 14)],
                    getAllGuildsRoles: [new Range(218, 8, 218, 25)],
                    getRoles: [new Range(221, 8, 221, 16)],
                    getRole: [new Range(225, 8, 225, 15)],
                    [WebpackAstParser.SYM_CJS_DEFAULT]: [
                        new Range(6, 8, 6, 9),
                        new Range(231, 16, 231, 17),
                        new Range(198, 10, 198, 11),
                    ],
                });
            });
            it("generates the proper export map for a store with getters", function () {
                const parser = new WebpackAstParser(require("test://ast/webpack/stores/getter.js"));
                const map = parser.getExportMap();

                // Change when parsing is fixed to only return to constants
                expect(map).to.deep.equal({
                    Z: {
                        [WebpackAstParser.SYM_CJS_DEFAULT]: [
                            new Range(4, 8, 4, 9),
                            new Range(24, 16, 24, 17),
                            new Range(9, 10, 9, 11),
                        ],
                        keepOpen: [new Range(8, 12, 8, 14)],
                        enabled: [new Range(7, 12, 7, 14)],
                    },
                });
            });
            it.skip("generates the proper export map for a store exported with wreq.t", function () {
                // I've never seen a store exported with wreq.t
            });
            it.skip("generates the proper export map for a store exported with wreq.e", function () {
                // I've never seen a store exported with wreq.e
            });
        });
    });
    describe("import parsing", function () {
        it("parses an only re-exported export properly", function () {
            const parser = new WebpackAstParser(require("test://ast/webpack/imports/reExport.js"));
            const test = parser.getUsesOfImport("999001", "foo");

            expect(test).to.deep.equal([new Range(5, 21, 5, 24)]);
        });
        it("parses a re-export with other uses", function () {
            const parser = new WebpackAstParser(require("test://ast/webpack/imports/reExport.js"));
            const test = parser.getUsesOfImport("999001", "bar");

            expect(test).to.have.deep.members([new Range(6, 22, 6, 25), new Range(10, 18, 10, 21)]);
        });
        it("returns [] when there are no uses of that export for that module", function () {
            const parser = new WebpackAstParser(require("test://ast/webpack/imports/reExport.js"));
            const test = parser.getUsesOfImport("999001", "baz");

            expect(test).to.deep.equal([]);
        });
        it("returns [] when the module ID is not imported", function () {
            const parser = new WebpackAstParser(require("test://ast/webpack/imports/reExport.js"));
            const text = parser.getUsesOfImport("999003", "foo");

            expect(text).to.deep.equal([]);
        });
        it("returns [] when there are no uses of that export for that module 2", function () {
            const parser = new WebpackAstParser(require("test://ast/webpack/imports/indirectCall.js"));
            const test = parser.getUsesOfImport("999002", "bar");

            expect(test).to.deep.equal([]);
        });
        it("returns [] when the module ID is not imported 2", function () {
            const parser = new WebpackAstParser(require("test://ast/webpack/imports/indirectCall.js"));
            const text = parser.getUsesOfImport("999004", "foo");

            expect(text).to.deep.equal([]);
        });
        it("parses an indirect call properly", function () {
            const parser = new WebpackAstParser(require("test://ast/webpack/imports/indirectCall.js"));
            const test = parser.getUsesOfImport("999002", "foo");

            expect(test).to.deep.equal([new Range(9, 22, 9, 25)]);
        });
        it("throws when wreq is not used", function () {
            const parser = new WebpackAstParser(require("test://ast/webpack/imports/noWreq.js"));

            // args should not matter as it should throw before
            expect(parser.getUsesOfImport.bind(parser)).to.throw("Wreq is not used in this file");
        });
        it("parses node default exports correctly", function () {
            const parser = new WebpackAstParser(require("test://ast/webpack/imports/nodeModule.js"));
            const test = parser.getUsesOfImport("999005", WebpackAstParser.SYM_CJS_DEFAULT);

            expect(test).to.have.deep.members([new Range(20, 15, 20, 19), new Range(15, 8, 15, 12)]);
        });
        it("parsed named node exports correctly", function () {
            const parser = new WebpackAstParser(require("test://ast/webpack/imports/nodeModule.js"));
            const test = parser.getUsesOfImport("999005", "qux");

            expect(test).to.have.deep.members([new Range(19, 13, 19, 16), new Range(16, 20, 16, 23)]);
        });
    });
    // INFO: this assumes that the cache is working properly
    // TODO: add septate testing for the cache
    describe("cache parsing", function () {
        function makeModulePath(file: string): Uri {
            return Uri.file(resolve(
                __dirname,
                "..",
                "..",
                "..",
                "assets",
                "test",
                "ast",
                ".modules",
                file,
            ));
        }

        function makeLineRange(file: string | number, y1, x1: number, len = 1) {
            if (typeof file === "number") {
                file = `${file * 111111}.js`;
            }
            return new Location(
                makeModulePath(file),
                new Range(y1, x1, y1, x1 + len),
            );
        }
        describe("re-export handling", function () {
            it("handles re-exports across wreq.d", async function () {
                const parser = new WebpackAstParser(require("test://ast/.modules/333333.js"));
                const locs = await parser.generateReferences(new Position(5, 8));

                expect(locs).to.have.deep.members([
                    makeLineRange(2, 18, 29),
                    makeLineRange(1, 23, 34),
                    makeLineRange(4, 5, 20),
                    makeLineRange(5, 12, 30),
                    makeLineRange(5, 17, 30),
                ]);
            });
            it.skip("handles re-exports across wreq.t", async function () {
            });
            it.skip("handles re-exports across wreq.e", async function () {
            });
        });
        it("finds a simple use in only one file", async function () {
            const parser = new WebpackAstParser(require("test://ast/.modules/222222.js"));
            const locs = await parser.generateReferences(new Position(6, 8));

            expect(locs).to.deep.equal([makeLineRange(1, 15, 26)]);
        });
        it("finds a simple export in more than one file", async function () {
            const parser = new WebpackAstParser(require("test://ast/.modules/222222.js"));
            const locs = await parser.generateReferences(new Position(5, 8));

            expect(locs).to.have.deep.members([
                makeLineRange(1, 15, 18),
                makeLineRange(1, 15, 40),
                makeLineRange(9, 13, 41),
            ]);
        });
        it.skip("finds all uses of a default e.exports", function () {

        });
        /**
         * ```js
         * function foo() {
         * }
         * function bar() {
         * }
         * foo.bar = bar;
         * e.exports = foo;
         * ```
         */
        it.skip("finds all uses of a default e.exports where the exports are assigned to the default export first", function () {

        });
        describe("stores", function () {
            it("finds all uses of a store from the class name", async function () {
                const parser = new WebpackAstParser(require("test://ast/.modules/999999.js"));
                const locs = await parser.generateReferences(new Position(8, 11));

                console.log(locs);
            });
        });
    });
});
