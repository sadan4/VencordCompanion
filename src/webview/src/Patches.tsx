import PatchSection from "./PatchSection"
import { FailedPatchType } from "./types"

export default function Patches() {
    const failed = reporterData.failedPatches
    const failedSections = Object.keys(failed)
    .map(k => <PatchSection data={failed[k as keyof FailedPatchType]} name={k}/>)
    return (<>
            {failedSections}
    </>)
}