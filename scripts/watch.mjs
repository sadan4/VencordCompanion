import { commonOpts } from "./common.mjs";

import esbuild from "esbuild";
// @ts-check

const extCtx = await esbuild.context({
    ...commonOpts,
    minify: false,
});

await Promise.all([extCtx.watch()]);
