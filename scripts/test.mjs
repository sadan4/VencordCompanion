import { testOptions } from "./common.mjs";

import { rm } from "fs/promises";

import { build } from "esbuild";
import { resolveTsPaths } from "resolve-tspaths";

await rm(testOptions[0].outdir, {
    recursive: true,
    force: true,
});
await Promise.all(testOptions.map((x) => build(x)));
await resolveTsPaths();
