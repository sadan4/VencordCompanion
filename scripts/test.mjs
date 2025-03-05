import { build } from "esbuild";
import { testOpts } from "./common.mjs";
import { resolveTsPaths } from "resolve-tspaths";
import { rm } from "fs/promises";

await rm(testOpts.outdir, { recursive: true, force: true });
await build(testOpts);
await resolveTsPaths();
