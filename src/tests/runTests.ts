import { resolve } from "path";

import { glob } from "glob";
import Mocha from "mocha";

export function run(): Promise<void> {
    return new Promise((res, rej) => {
        const mocha = new Mocha({
            ui: "bdd",
            color: true
        });

        const testsRoot = resolve(__dirname, "..");

        glob("**/*.test.js", {
            cwd: testsRoot
        }).then(matches => {
            for (const file of matches) {
                mocha.addFile(resolve(testsRoot, file));
            }

            try {
                mocha.run(failures => {
                    if (failures > 0) {
                        rej(new Error(`${failures} tests failed.`));
                    } else
                        res();
                });
            } catch (e) {
                console.error(e);
                rej(e);
            }
        });
    });
}
