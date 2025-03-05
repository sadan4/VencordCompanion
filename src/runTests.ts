import { glob } from "glob";
import Mocha from "mocha"
import { resolve } from "path";
export function run() {
    const mocha = new Mocha({
        ui: "bdd",
        color: true
    })

    const testsRoot = __dirname;

    return new Promise<void>((res, rej) => {
        glob("**/*.test.js", {
            cwd: testsRoot
        }).then((matches) => {
            for (const file of matches) {
                mocha.addFile(resolve(testsRoot, file))
            }

            try {
                mocha.run(failures => {
                    if (failures > 0) {
                        rej(new Error(`${failures} tests failed.`))
                    } else
                        res();
                });
            } catch (e) {
                console.error(e);
                rej(e);
            }
        }, (err) => rej(err))
    })
}