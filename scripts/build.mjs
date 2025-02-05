import esbuild from "esbuild";
import { commonOpts, webviewOpts } from "./common.mjs";

//@ts-check

await Promise.all([
    esbuild.build({
        ...commonOpts,
        sourcemap: "linked",
    }),
    esbuild.build(webviewOpts)
])