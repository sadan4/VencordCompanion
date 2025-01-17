
export * from "./recieve";
export * from "./send";

export type Discriminate<
    U extends { [P in D]: string },
    K extends U[D],
    D extends keyof U = "type" extends keyof U ? "type" : never
>
    = U extends { [P in D]: K; } ? U : never;
