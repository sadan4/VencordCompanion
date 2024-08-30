import { ReporterData } from "./types"

declare global {
    let reporterData: ReporterData
    const IS_DEV: boolean;
}
export {}