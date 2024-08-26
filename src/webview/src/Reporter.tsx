import { useState } from "react";

function Codeblock({children, label} : {children: any, label: string})
{
    return (
        <div className="CodeblockContainer">
            <h4>{label}</h4>
            <div className="Codeblock">
                <h4>{children}</h4>
            </div>
        </div>
    )
}

function Arrow({ right }: { right: boolean }) {
    return (
        right ? (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 512">
                <path fill="currentColor" d="M278.6 233.4c12.5 12.5 12.5 32.8 0 45.3l-160 160c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3L210.7 256L73.4 118.6c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0l160 160z"/>
            </svg>
        ) : (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512">
                <path fill="currentColor" d="M201.4 374.6c12.5 12.5 32.8 12.5 45.3 0l160-160c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L224 306.7L86.6 169.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l160 160z"/>
            </svg>
        )
    );
}

function ExpandableHeader({header, children}: { header: any, children: any})
{
    const [expanded, setExpanded] = useState(false);

    return (
        <div>
            <div className="PluginName">
                <div onClick={() => setExpanded((e) => !e)}>
                    <Arrow right={!expanded}/>
                </div>
                <h3>{header}</h3>
            </div>
            <div style={{marginLeft: "2rem"}}>
                {expanded && (children ?? null)}
            </div>
        </div>
    )
}

function Button({label, onClick, disabled}: {label: any, onClick: any, disabled?: any})
{
    return (
        <div className="Button" onClick={disabled ? null : onClick} style={disabled ? {filter: "brightness(0.8)", cursor: "not-allowed"} : {}}>
            <h3>{label}</h3>
        </div>
    )
}

function PluginReport({ data, name, onHide }: { data: any[], name: string, onHide: any }) {
    return (
        <ExpandableHeader header={`${name} (${data.length})`}>
            <div style={{display: "flex", flexDirection: "row", gap: "0.5rem"}}>
                <Button label={"Hide"} onClick={onHide}/>
                <Button label={"Jump"} onClick={onHide}/>
                <Button label={"Diff"} onClick={onHide} disabled={true}/>
                <Button label={"Extract"} onClick={onHide} disabled={true}/>
            </div>
            <div className="PatchList">
                {data.map((e, index) => {
                    if(e.replacement.length !> 1) return (
                        <>
                            <Codeblock label="Match:">{String(typeof e.replacement[0].match == "string" ? e.replacement[0].match : "No match")}</Codeblock>
                            <Codeblock label="Replace:">{String(e.replacement[0].replace)}</Codeblock>
                        </>
                    )
                    return (
                        <div key={index}>
                            <ExpandableHeader header={<Codeblock label="">{e.find}</Codeblock>}>
                                {e.replacement.map((i: any, iIndex: number) => 
                                    <>
                                        <Codeblock label="Match:">{String(typeof i.match == "string" ? i.match : "No match")}</Codeblock>
                                        <Codeblock label="Replace:">{String(i.replace)}</Codeblock>
                                    </>
                                )}
                            </ExpandableHeader>
                        </div>
                    )
                })}
            </div>
        </ExpandableHeader>
    );
}


function ReportList({list, name}: {list: any, name: string})
{
    let [hidden, setHidden] : [any, any] = useState([]);

    list = list.reduce((acc : any, obj : any) => {
        const plugin = obj.plugin;
        if (!acc[plugin]) {
            acc[plugin] = [];
        }
        acc[plugin].push(obj);
        return acc;
    }, {});

    return (
        <div className="ReportList">
            <h2 style={{marginLeft: "0.5rem"}}>{name}</h2>
            {Object.entries(list).map(([key, value]: [any, any]) => {
                if(hidden.some((e: any) => e === key)) return null;
                return (
                    <PluginReport data={value} name={key} onHide={() => setHidden((e : any) => [...e, key])}/>
                )
            })}
        </div>
    )
}

export function ReporterSections({data} : {data: any}) {
    console.log(data);
    const {failedPatches, failedWebpack} : {failedPatches : { [key: string]: any[] }, failedWebpack : any} = data;

    console.log(failedPatches);

    return (
        <div id="reporter">
            <h1>Vencord Reporter Report</h1>
            {failedPatches && Object.entries(failedPatches).map(([key, value]) => {
                if(!value.length) return null;
                return (
                    <ReportList list={value} name={key}/>
                );
            })}
        </div>
    );
}
