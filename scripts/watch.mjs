import esbuild from "esbuild";
import { commonOpts } from "./common.mjs";
//@ts-check

const extCtx = await esbuild.context({...commonOpts, minify: false});

await Promise.all([
    extCtx.watch(),
])
