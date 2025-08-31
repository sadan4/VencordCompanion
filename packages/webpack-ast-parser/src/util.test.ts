import { getFile } from "./testingUtil";
import { isWebpackModule } from "./util";

import { describe, expect, it } from "vitest";

const randomData = getFile("random");

describe("isWebpackModule", function () {
    it("fails on random data", function () {
        expect(isWebpackModule(randomData)).to.be.false;
    });
    it("throws on an object", function () {
        // @ts-expect-error it should throw a type error
        expect(() => isWebpackModule({})).to.throw();
    });
    it("fails on an empty string", function () {
        expect(isWebpackModule("")).to.be.false;
    });
    it("works on a module", function () {
        const file: string = getFile("util/webpackHeader.js");

        expect(isWebpackModule(file)).to.be.true;
    });
    it("works on an extracted find", function () {
        const file: string = getFile("util/extractedFindHeader.js");

        expect(isWebpackModule(file)).to.be.true;
    });
});
