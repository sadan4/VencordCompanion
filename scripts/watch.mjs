import esbuild from "esbuild";
import { commonOpts, webviewOpts } from "./common.mjs";
//@ts-check

const extCtx = await esbuild.context(commonOpts);

const webviewCtx = await esbuild.context(webviewOpts);

await Promise.all([
    extCtx.watch(),
    webviewCtx.watch()
])
