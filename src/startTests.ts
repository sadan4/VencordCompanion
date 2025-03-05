import { runTests } from "@vscode/test-electron";
import { resolve } from "path";

(async function () {
    try {
        const extensionDevelopmentPath = resolve(__dirname, "..");

        const extensionTestsPath = resolve(__dirname, "runTests");

        await runTests({
            version: "1.89.1",
            extensionDevelopmentPath,
            extensionTestsPath
        });
    } catch (e) {
        console.error("Failed to run tests");
        console.error(e);
        process.exit(1);
    }
})();
