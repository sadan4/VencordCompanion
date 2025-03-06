import { build } from "esbuild";
import { testOptions } from "./common.mjs";
import { resolveTsPaths } from "resolve-tspaths";
import { rm } from "fs/promises";

await rm(testOptions[0].outdir, { recursive: true, force: true });
await Promise.all(testOptions.map(x => build(x)))
await resolveTsPaths();
