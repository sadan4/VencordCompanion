import { areVersionsIncompatible, compareVersions, debounce, SemVerVersion } from "./util";

import { describe, expect, it, vi } from "vitest";

describe("debounce()", function () {
    it("resets the timeout correctly", function () {
        vi.useFakeTimers();

        let i = 0;
        const debouncedFunc = debounce(() => i++, 100);

        debouncedFunc();
        debouncedFunc();
        debouncedFunc();
        vi.advanceTimersByTime(50);
        debouncedFunc();
        vi.advanceTimersByTime(125);
        expect(i).to.equal(1);
        vi.restoreAllMocks();
    });
});

describe.todo("debounceAsync()", function () {
});

describe("compareVersions()", function () {
    // Test cases for equal versions
    it("should return 0 for equal versions", function () {
        const tests: [SemVerVersion, SemVerVersion][] = [
            [[1, 0, 0], [1, 0, 0]],
            [[2, 3, 4], [2, 3, 4]],
            [[0, 0, 0], [0, 0, 0]],
        ];

        for (const [a, b] of tests) {
            expect(compareVersions(a, b)).to.equal(0, `Expected ${a} to be equal to ${b}`);
        }
    });

    // Test cases for version a < version b
    it("should return -1 when first version is less than second", function () {
        const tests: [SemVerVersion, SemVerVersion][] = [
            // Different major versions
            [[1, 0, 0], [2, 0, 0]],
            [[0, 9, 9], [1, 0, 0]],

            // Same major, different minor
            [[1, 0, 0], [1, 1, 0]],
            [[2, 3, 0], [2, 4, 0]],

            // Same major and minor, different patch
            [[1, 1, 0], [1, 1, 1]],
            [[3, 2, 4], [3, 2, 5]],
        ];

        for (const [a, b] of tests) {
            expect(compareVersions(a, b)).to.equal(-1, `Expected ${a} to be less than ${b}`);
        }
    });

    // Test cases for version a > version b
    it("should return 1 when first version is greater than second", function () {
        const tests: [SemVerVersion, SemVerVersion][] = [
            // Different major versions
            [[2, 0, 0], [1, 0, 0]],
            [[1, 0, 0], [0, 9, 9]],

            // Same major, different minor
            [[1, 1, 0], [1, 0, 0]],
            [[2, 4, 0], [2, 3, 0]],

            // Same major and minor, different patch
            [[1, 1, 1], [1, 1, 0]],
            [[3, 2, 5], [3, 2, 4]],
        ];

        for (const [a, b] of tests) {
            expect(compareVersions(a, b)).to.equal(1, `Expected ${a} to be greater than ${b}`);
        }
    });

    // Edge cases
    it("should handle edge cases correctly", function () {
        // Very large version numbers
        expect(compareVersions([9999, 9999, 9999], [9999, 9999, 9998])).to.equal(1);
        expect(compareVersions([9999, 9998, 9999], [9999, 9999, 9999])).to.equal(-1);

        // Zero versions
        expect(compareVersions([0, 0, 1], [0, 0, 0])).to.equal(1);
        expect(compareVersions([0, 1, 0], [0, 0, 9])).to.equal(1);
    });
});

describe("areVersionsIncompatible()", function () {
    // Test cases where versions are compatible
    it("should return false for compatible versions", function () {
        const tests: [SemVerVersion, SemVerVersion][] = [
            // Exact same version
            [[1, 0, 0], [1, 0, 0]],

            // Same major, higher minor in actual
            [[1, 0, 0], [1, 1, 0]],
            [[1, 0, 0], [1, 2, 3]],

            // Same major, same minor, higher patch in actual
            [[1, 1, 0], [1, 1, 1]],
        ];

        for (const [minVersion, actualVersion] of tests) {
            expect(areVersionsIncompatible(minVersion, actualVersion)).to.be.false;
            // Additional message in case of failure
            if (areVersionsIncompatible(minVersion, actualVersion)) {
                throw new Error(`Expected min=${minVersion} and actual=${actualVersion} to be compatible`);
            }
        }
    });

    // Test cases where versions are incompatible
    it("should return true for incompatible versions", function () {
        const tests: [SemVerVersion, SemVerVersion][] = [
            // Actual version is less than min version
            [[1, 1, 0], [1, 0, 0]],
            [[2, 0, 0], [1, 9, 9]],
            [[1, 0, 1], [1, 0, 0]],

            // Actual version has higher major than min version
            [[1, 0, 0], [2, 0, 0]],
            [[2, 3, 4], [3, 0, 0]],
        ];

        for (const [minVersion, actualVersion] of tests) {
            expect(areVersionsIncompatible(minVersion, actualVersion)).to.be.true;
            // Additional message in case of failure
            if (!areVersionsIncompatible(minVersion, actualVersion)) {
                throw new Error(`Expected min=${minVersion} and actual=${actualVersion} to be incompatible`);
            }
        }
    });

    // Edge cases
    it("should handle edge cases correctly", function () {
        // Zero versions
        expect(areVersionsIncompatible([0, 0, 0], [0, 0, 0])).to.be.false;
        expect(areVersionsIncompatible([0, 0, 1], [0, 0, 0])).to.be.true;

        // Large version numbers
        expect(areVersionsIncompatible([9, 0, 0], [10, 0, 0])).to.be.true;
        expect(areVersionsIncompatible([9, 9, 9], [9, 9, 10])).to.be.false;
    });
});
