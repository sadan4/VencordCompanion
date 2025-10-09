import { testOptions } from "./common.mts";

import { build } from "esbuild";
import { rm } from "node:fs/promises";
import { resolveTsPaths } from "resolve-tspaths";

await rm(testOptions[0].outdir, {
    recursive: true,
    force: true,
});
await Promise.all(testOptions.map((x) => build(x)));
await resolveTsPaths();
