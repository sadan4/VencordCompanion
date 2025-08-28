import { debounce } from "./util";

import { describe, expect, it } from "vitest";

describe("debounce()", function () {
    it("resets the timeout correctly", async function () {
        let i = 0;
        const debouncedFunc = debounce(() => i++, 100);

        debouncedFunc();
        debouncedFunc();
        debouncedFunc();
        await new Promise((resolve) => setTimeout(resolve, 50));
        debouncedFunc();
        await new Promise((resolve) => setTimeout(resolve, 125));
        expect(i).to.equal(1);
    });
});

describe.todo("debounceAsync()", function () {
});
