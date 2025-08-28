export interface Logger {
    log(message: string, ...args: any[]): void;
    trace(message: string, ...args: any[]): void;
    debug(message: string, ...args: any[]): void;
    info(message: string, ...args: any[]): void;
    warn(message: string, ...args: any[]): void;
    error(message: string | Error, ...args: any[]): void;
}

export const NoopLogger: Logger = Object.freeze({
    log: () => { },
    trace: () => { },
    debug: () => { },
    info: () => { },
    warn: () => { },
    error: () => { },
});
