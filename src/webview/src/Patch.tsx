import { PropsWithChildren, SetStateAction, useState } from "react";
import { EvaledPatch, Patch as IPatch, PatchReplacement } from "./types";
interface SVGProps {
    width?: string,
    height?: string
}
function DownArrow({width, height}: SVGProps){
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width={width} height={height} viewBox="0 0 1024 1024" version="1.1">
            <path d="M903.232 256l56.768 50.432L512 768 64 306.432 120.768 256 512 659.072z" fill="currentColor"/>
        </svg>
    )
}
function RightArrow({width, height}: SVGProps){
    return (
        <svg className="rotate90"
        xmlns="http://www.w3.org/2000/svg" width={width} height={height} viewBox="0 0 1024 1024" version="1.1">
            <path d="M903.232 256l56.768 50.432L512 768 64 306.432 120.768 256 512 659.072z" fill="currentColor"/>
        </svg>
    )
}

interface props {
    patch: EvaledPatch
}
function Patch(props: props) {
    const [show, setShow] = useState(false)
    return (
        <>
        <div style={{
            display: "flex",
            flexDirection: "column"
        }}>
        <PatchHeader show={show} setShow={setShow} plugin={props.patch.plugin}/>
        {show && <PatchBody patch={props.patch}/>}
        </div>
        </>
    )
}
export default Patch
interface PatchHeaderProps {
    setShow: { (value: SetStateAction<boolean>): void; (arg0: boolean): void; };
    show: boolean;
    plugin: string;
}

function PatchHeader({ setShow, show, plugin }: PatchHeaderProps) {
    return <div className="pluginName"
        onClick={() => setShow(!show)}
        style={{
            userSelect: "none",
            paddingTop: "1vh",
            paddingBottom: "1vh",
            display: "flex",
            justifyContent: "space-between"
        }}
    ><div>{plugin}</div>{show ? <DownArrow width="20px" height="20px" /> : <RightArrow width="20px" height="20px" />}</div>;
}

interface PatchBodyProps {
    patch: EvaledPatch
}

function PatchBody({patch}: PatchBodyProps) {
    const replacement = Array.isArray(patch.replacement) ? patch.replacement : [patch.replacement];
    return <div className="patchBody">
    <span>Find: <CodeBlock>
        {String(patch.find)}
        </CodeBlock>
        </span>
        <span>
        ModuleId: <CodeBlock>
            {patch.id ?? "-"}
        </CodeBlock>
        </span>
        {replacement.map(x => <Replacement data={x}/>)}
        <div className="buttons">
        <button>Disable Plugin</button>
        <button>Go To Patch</button>
        <button>Delete Entry</button>
        <button disabled={!!(patch.id)}>Extract Module</button>
        <button disabled={!!(patch.id)}>Diff Patch</button>
        </div>
    </div>    
}
function CodeBlock({children}: PropsWithChildren) {
    return <div className="codeblock">
        {children}
    </div>
}
interface ReplacementProps {
    data: PatchReplacement
}

function Replacement({ data }: ReplacementProps) {
    console.log(data.match)
    return <div>
    Replacement: <span className="indent">
    Match: 
    <CodeBlock>
        {String(data.match)}
    </CodeBlock>
    </span>
    <span className="indent">
        Replace: <CodeBlock>
            {data.replace}
        </CodeBlock>
    </span>
    </div>
}
