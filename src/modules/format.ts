import babel from "prettier/plugins/babel";
import estree from "prettier/plugins/estree";
import { format as fmt } from "prettier/standalone";

export async function format(text: string) {
    return await fmt(text, {
        parser: "babel",
        plugins: [babel, estree],
        tabWidth: 4
    });
}
