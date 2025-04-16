import esbuild from "esbuild";
import { commonOpts, webviewOpts } from "./common.mjs";

//@ts-check
const IS_DEV = process.argv.includes("--dev");
await Promise.all([
    esbuild.build({
        ...commonOpts,
        sourcemap: "linked",
        minify: !IS_DEV
    }),
    esbuild.build(webviewOpts)
])
