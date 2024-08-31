import esbuild from "esbuild";
import { commonOpts } from "./common.mjs";

//@ts-check
/**
 * @type {esbuild.BuildOptions}
 */
const opts = {
    ...commonOpts
}

opts.minify = false;
opts.sourcemap = "linked"

const ctx = await esbuild.context(opts);

await ctx.watch()

await ctx.serve({
    servedir: "./dist",
    host: "localhost",
    port: 3000
})

console.log("http://localhost:3000")