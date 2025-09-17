import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        // https://github.com/vitest-dev/vitest/issues/7759#issuecomment-2812533570
        root: import.meta.dirname,
        projects: ["packages/*"],
        coverage: {
            exclude: ["__test__", "node_modules", "dist", "scripts"].map((p) => `**/${p}/**`)
                .concat(["./eslint.config.mts", "./vitest.config.mts", "./src"]),
        },
    },
});
