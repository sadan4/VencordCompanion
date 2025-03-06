import { build } from "esbuild";
import { testOptions, webviewOpts } from "./common.mjs";
import { resolveTsPaths } from "resolve-tspaths";
import { rm } from "fs/promises";

await rm(testOptions[0].outdir, { recursive: true, force: true });
await Promise.all([...testOptions, webviewOpts].map(x => build(x)))
await resolveTsPaths();
