import { Position } from "./Position";
import { Range, zeroRange } from "./Range";

import { assert, describe, expect, it } from "vitest";

describe("zeroRange", function () {
    it("is empty", function () {
        expect(zeroRange.isEmpty).to.be.true;
    });
    it("is equal to a new zero range", function () {
        expect(zeroRange.isEqual(new Range(0, 0, 0, 0))).to.be.true;
    });
});

describe("Range", function () {
    it("empty range", function () {
        const s = new Range(1, 1, 1, 1);

        assert.strictEqual(s.start.line, 1);
        assert.strictEqual(s.start.character, 1);
        assert.strictEqual(s.end.line, 1);
        assert.strictEqual(s.end.character, 1);
        assert.strictEqual(s.isEmpty, true);
    });
    it("swap start and stop same line", () => {
        const s = new Range(1, 2, 1, 1);

        assert.strictEqual(s.start.line, 1);
        assert.strictEqual(s.start.character, 1);
        assert.strictEqual(s.end.line, 1);
        assert.strictEqual(s.end.character, 2);
        assert.strictEqual(s.isEmpty, false);
    });

    it("swap start and stop", () => {
        const s = new Range(2, 1, 1, 2);

        assert.strictEqual(s.start.line, 1);
        assert.strictEqual(s.start.character, 2);
        assert.strictEqual(s.end.line, 2);
        assert.strictEqual(s.end.character, 1);
        assert.strictEqual(s.isEmpty, false);
    });

    it("no swap same line", () => {
        const s = new Range(1, 1, 1, 2);

        assert.strictEqual(s.start.line, 1);
        assert.strictEqual(s.start.character, 1);
        assert.strictEqual(s.end.line, 1);
        assert.strictEqual(s.end.character, 2);
        assert.strictEqual(s.isEmpty, false);
    });

    it("no swap", () => {
        const s = new Range(1, 1, 2, 1);

        assert.strictEqual(s.start.line, 1);
        assert.strictEqual(s.start.character, 1);
        assert.strictEqual(s.end.line, 2);
        assert.strictEqual(s.end.character, 1);
        assert.strictEqual(s.isEmpty, false);
    });
    it("contains(Position)", () => {
        assert.strictEqual(new Range(2, 2, 5, 10)
            .contains(new Position(1, 3)), false);
        assert.strictEqual(new Range(2, 2, 5, 10)
            .contains(new Position(2, 1)), false);
        assert.strictEqual(new Range(2, 2, 5, 10)
            .contains(new Position(2, 2)), true);
        assert.strictEqual(new Range(2, 2, 5, 10)
            .contains(new Position(2, 3)), true);
        assert.strictEqual(new Range(2, 2, 5, 10)
            .contains(new Position(3, 1)), true);
        assert.strictEqual(new Range(2, 2, 5, 10)
            .contains(new Position(5, 9)), true);
        assert.strictEqual(new Range(2, 2, 5, 10)
            .contains(new Position(5, 10)), true);
        assert.strictEqual(new Range(2, 2, 5, 10)
            .contains(new Position(5, 11)), false);
        assert.strictEqual(new Range(2, 2, 5, 10)
            .contains(new Position(6, 1)), false);
    });
    it("containsRange", () => {
        assert.strictEqual(new Range(2, 2, 5, 10)
            .contains(new Range(1, 3, 2, 2)), false);
        assert.strictEqual(new Range(2, 2, 5, 10)
            .contains(new Range(2, 1, 2, 2)), false);
        assert.strictEqual(new Range(2, 2, 5, 10)
            .contains(new Range(2, 2, 5, 11)), false);
        assert.strictEqual(new Range(2, 2, 5, 10)
            .contains(new Range(2, 2, 6, 1)), false);
        assert.strictEqual(new Range(2, 2, 5, 10)
            .contains(new Range(5, 9, 6, 1)), false);
        assert.strictEqual(new Range(2, 2, 5, 10)
            .contains(new Range(5, 10, 6, 1)), false);
        assert.strictEqual(new Range(2, 2, 5, 10)
            .contains(new Range(2, 2, 5, 10)), true);
        assert.strictEqual(new Range(2, 2, 5, 10)
            .contains(new Range(2, 3, 5, 9)), true);
        assert.strictEqual(new Range(2, 2, 5, 10)
            .contains(new Range(3, 100, 4, 100)), true);
    });
});
