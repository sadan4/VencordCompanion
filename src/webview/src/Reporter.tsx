import Patches from "./Patches"

export const ReporterSections = function() {
    return (<div id="reporter">
            <div style={{
                paddingLeft: "1vw"
            }}>
            <h1 style={{
                alignSelf: "flex-start",
                justifySelf: "center"
            }}>Vencord Reporter Report</h1>
            <Patches/>
            </div>
    </div>)
}