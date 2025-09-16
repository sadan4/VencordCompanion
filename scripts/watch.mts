import { commonOpts } from "./common.mts";

import esbuild from "esbuild";

const extCtx = await esbuild.context({
    ...commonOpts,
    minify: false,
});

await Promise.all([extCtx.watch()]);
