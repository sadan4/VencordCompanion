import Patches from "./Patches"

export const ReporterSections = function() {
    return (<div id="reporter">
            <h1 style={{
                alignSelf: "flex-start",
                justifySelf: "center"
            }}>Vencord Reporter Report</h1>
            <Patches/>
    </div>)
}