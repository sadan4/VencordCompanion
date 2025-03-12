import { strictEqual } from "node:assert";
import { window } from "vscode";

after(() => {
    window.showInformationMessage("All tests done!");
});

describe("Sanity check, always passes", function () {
    it("should pass", function () {
        strictEqual(1, 1);
        strictEqual(-1, [2, 3].indexOf(5));
        strictEqual(2, [3, 5, 1, 6].indexOf(1));
    });
});
