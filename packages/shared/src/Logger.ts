export interface Logger {
    trace(message: string, ...args: any[]): void;
    debug(message: string, ...args: any[]): void;
    info(message: string, ...args: any[]): void;
    warn(message: string, ...args: any[]): void;
    error(message: string | Error, ...args: any[]): void;
}

export const NoopLogger: Logger = Object.freeze({
    trace: () => { },
    debug: () => { },
    info: () => { },
    warn: () => { },
    error: () => { },
});
