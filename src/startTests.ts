import { runTests } from "@vscode/test-electron";

import { resolve } from "path";

(async function () {
    try {
        const extensionDevelopmentPath = resolve(__dirname, "..");

        const extensionTestsPath = resolve(__dirname, "runTests");

        await runTests({
            extensionDevelopmentPath,
            extensionTestsPath,
            ...(process.env.VSCODE_TEST_BIN_PATH ? {
                vscodeExecutablePath: process.env.VSCODE_TEST_BIN_PATH
            } : {
                version: "1.89.1"
            })
        });
    } catch (e) {
        console.error("Failed to run tests");
        console.error(e);
        process.exit(1);
    }
})();
