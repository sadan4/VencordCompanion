// @ts-check

const { resolve, join } = require("path");
/**
 * for some reason, there needs to be () around the require to type it
 * @type {typeof import("../src/modules/cache")}
 */
const { ModuleDepManager, ModuleCache } = (require("../dist.test/modules/cache"));

module.exports.mochaGlobalSetup = async function () {
    await ModuleDepManager.initModDeps({
        fromDisk: true,
        baseFolder: resolve(__dirname, ".."),
        folder: join("assets", "test", "ast", ".modules")
    });
    ModuleCache.baseFolder = resolve(__dirname, "..");
    ModuleCache.folder = join("assets", "test", "ast", ".modules");
}
