import { format } from "prettier/standalone"
//@ts-ignore for some fucking reason, the d.ts file shows no exports when the mjs file clearly has them
import estree from "prettier/plugins/estree"
//@ts-ignore d.ts file strikes again, shows no default export. usage follows their own docs
import babel from "prettier/plugins/babel"

export default async function (text: string) {
    return await format(text, {
        parser: "babel",
        plugins: [babel, estree],
        tabWidth: 4
    })
}