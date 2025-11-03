import { rm } from "node:fs/promises";

import { build } from "esbuild";
import { resolveTsPaths } from "resolve-tspaths";

import { testOptions } from "./common.mts";

await rm(testOptions[0].outdir, {
    recursive: true,
    force: true,
});
await Promise.all(testOptions.map((x) => build(x)));
await resolveTsPaths();
