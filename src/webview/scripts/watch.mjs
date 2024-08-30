import esbuild from "esbuild";
import { commonOpts } from "./common.mjs";

//@ts-check
const opts = {
    ...commonOpts
}

opts.minify = false;

const ctx = await esbuild.context(opts);

await ctx.watch()

await ctx.serve({
    servedir: "./dist",
    host: "localhost",
    port: 3000
})

console.log("http://localhost:3000")