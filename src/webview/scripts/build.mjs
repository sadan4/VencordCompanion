import esbuild from "esbuild";
import { commonOpts } from "./common.mjs";
//@ts-check

const opts = {
    ...commonOpts
}

export const finalOpts = opts

await esbuild.build({
    ...opts
})

