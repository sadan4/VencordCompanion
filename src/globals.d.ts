declare module "test://*" {
    var _: string;

    export default _;
}

declare global {
    /**
     * These vars exist only at build time.
     * 
     * Code branching on this will get removed at runtime if minification is enabled.
     */
    export var IS_TEST: boolean;
}

export { };
