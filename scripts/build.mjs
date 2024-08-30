import esbuild from "esbuild";
import { commonOpts, webviewOpts } from "./common.mjs";

//@ts-check

await Promise.all([
    esbuild.build(commonOpts),
    esbuild.build(webviewOpts)
])