import { PropsWithChildren, ReactNode, useState } from "react";
import { EvaledPatch, ReporterData } from "./types";

interface CodeblockProps {
    label: ReactNode;
}

function Codeblock({ children, label }: PropsWithChildren<CodeblockProps>) {
    return (
        <div className="CodeblockContainer">
            <h4>{label}</h4>
            <div className="Codeblock">
                <h4>{children}</h4>
            </div>
        </div>
    )
}

interface ArrowProps {
    right: boolean;
}

function Arrow({ right }: ArrowProps) {
    return (
        right ? (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 512">
                <path fill="currentColor" d="M278.6 233.4c12.5 12.5 12.5 32.8 0 45.3l-160 160c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3L210.7 256L73.4 118.6c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0l160 160z" />
            </svg>
        ) : (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512">
                <path fill="currentColor" d="M201.4 374.6c12.5 12.5 32.8 12.5 45.3 0l160-160c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L224 306.7L86.6 169.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l160 160z" />
            </svg>
        )
    );
}

interface ExpandableHeaderProps {
    header: ReactNode
}

function ExpandableHeader({ header, children }: PropsWithChildren<ExpandableHeaderProps>) {
    const [expanded, setExpanded] = useState(false);

    return (
        <div>
            <div className="PluginName" onClick={() => setExpanded((e) => !e)}>
                <div>
                    <Arrow right={!expanded} />
                </div>
                <h3>{header}</h3>
            </div>
            <div style={{ marginLeft: "2rem" }}>
                {expanded && (children ?? null)}
            </div>
        </div>
    )
}
interface ButtonProps {
    label: ReactNode;
    disabled?: boolean;
    onClick: () => void;
}

function Button({ label, onClick, disabled }: ButtonProps) {
    return (
        <div className="Button" onClick={disabled ? undefined : onClick} style={disabled ? { filter: "brightness(0.7)", cursor: "not-allowed" } : {}}>
            <h3>{label}</h3>
        </div>
    )
}

interface PluginReportProps {
    data: EvaledPatch[];
    name: string;
    onHide: () => void;
}

function PluginReport({ data, name, onHide }: PluginReportProps) {
    console.log(name)
    return (
        <ExpandableHeader header={`${name} (${data.length})`}>
            <div style={{ display: "flex", flexDirection: "row", gap: "0.5rem" }}>
                <Button label={"Disable Plugin"} onClick={() => void 0} />
            </div>
            <div className="PatchList">
                {data.map((e, index) => {
                    if (data.length === 1) return (
                        <div className="EvaledPatch">
                            <div style={{ display: "flex", flexDirection: "row", gap: "0.5rem" }}>
                                <Button label={"Hide"} onClick={onHide} />
                                <Button label={"Jump"} onClick={() => void 0} />
                                <Button label={"Diff"} onClick={() => void 0} />
                                <Button label={"Extract"} onClick={() => void 0} />
                            </div>
                            <Codeblock label="Find:">{e.find}</Codeblock>
                            <Codeblock label="Module Number:">{e.id || "------"}</Codeblock>
                            <Codeblock label="Match:">{String(e.replacement[0].match)}</Codeblock>
                            <Codeblock label="Replace:">{String(e.replacement[0].replace)}</Codeblock>
                        </div>
                    )
                    return (
                        <div className="EvaledPatch" key={index}>
                            <ExpandableHeader header={<Codeblock label="">{e.find}</Codeblock>}>
                                <div style={{ display: "flex", flexDirection: "row", gap: "0.5rem" }}>
                                    <Button label={"Hide"} onClick={onHide} />
                                    <Button label={"Jump"} onClick={() => void 0} />
                                    <Button label={"Diff"} onClick={() => void 0} />
                                    <Button label={"Extract"} onClick={() => void 0} />
                                </div>
                                <Codeblock label="Find:">{e.find}</Codeblock>
                                <Codeblock label="Module Number:">{e.id || "------"}</Codeblock>
                                {e.replacement.map(i =>
                                    <>
                                        <Codeblock label="Match:">{String(i.match)}</Codeblock>
                                        <Codeblock label="Replace:">{i.replace}</Codeblock>
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

interface ReportListProps {
    brokenPatches: EvaledPatch[];
    name: string
}

function ReportList({ brokenPatches, name }: ReportListProps) {
    let [hidden, setHidden] = useState<string[]>([]);

    let list = brokenPatches.reduce((acc, obj) => {
        const plugin = obj.plugin;
        if (!acc[plugin]) {
            acc[plugin] = [];
        }
        acc[plugin].push(obj);
        return acc;
    }, {} as Record<string, EvaledPatch[]>);

    return (
        <div className="ReportList">
            <h2 style={{ marginLeft: "0.5rem" }}>{name}</h2>
            {Object.entries(list).map(([key, value]) => {
                if (hidden.some((e: any) => e === key)) return null;
                return (
                    <PluginReport data={value} name={key} onHide={() => setHidden((e) => [...e, key])} />
                )
            })}
        </div>
    )
}

interface ReporterSectionsProps {
    data: ReporterData;
}

export function ReporterSections({ data }: ReporterSectionsProps) {
    console.log(data);
    const { failedPatches, failedWebpack } = data;

    console.log(failedPatches);

    return (
        <div id="reporter">
            <h1>Vencord Reporter Report</h1>
            {failedPatches && Object.entries(failedPatches).map(([key, value]) => {
                if (!value.length) return null;
                return (
                    <ReportList brokenPatches={value} name={key} />
                );
            })}
        </div>
    );
}
