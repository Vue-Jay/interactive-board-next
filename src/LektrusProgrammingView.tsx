import {useEffect,useRef,useState,type CSSProperties,type SyntheticEvent} from "react";
import type {ProgrammingDiagram} from "./lektrusProgrammingModel";
import {programmingLanguageLabels} from "./lektrusProgrammingModel";
import {PROGRAM_SANDBOX_HTML} from "./lektrusProgrammingSandbox";

type OutputLine={level:"log"|"warning"|"error";text:string};
type RunStatus="idle"|"compiling"|"running"|"success"|"error"|"timeout"|"stopped";
const CHANNEL="lektrus-program-runner";
const actionStyle:CSSProperties={border:"1px solid #9cbad6",borderRadius:9,
 padding:"7px 14px",background:"#eef5ff",color:"#285277",cursor:"pointer",fontWeight:700};
const statusNames:Record<RunStatus,string>={
 idle:"Не запускалась",compiling:"Компиляция TypeScript…",running:"Выполняется…",
 success:"Завершено",error:"Ошибка",timeout:"Превышено время",stopped:"Остановлено"
};
export default function LektrusProgrammingView({diagram:d}:{diagram:ProgrammingDiagram}){
 const iframe=useRef<HTMLIFrameElement>(null);
 const token=useRef(crypto.randomUUID());
 const sequence=useRef(0);
 const [ready,setReady]=useState(false);
 const [status,setStatus]=useState<RunStatus>("idle");
 const [output,setOutput]=useState<OutputLine[]>([]);
 const running=status==="running"||status==="compiling";
 useEffect(()=>{
  const handler=(event:MessageEvent)=>{
   if(event.source!==iframe.current?.contentWindow)return;
   const msg=event.data as {channel?:string;type?:string;token?:string;
    runId?:number;level?:OutputLine["level"];text?:string;status?:string};
   if(!msg||msg.channel!==CHANNEL)return;
   if(msg.type==="ready"){setReady(true);return}
   if(msg.token!==token.current||msg.runId!==sequence.current)return;
   if(msg.type==="line"&&typeof msg.text==="string"){
    const level=msg.level==="warning"||msg.level==="error"?msg.level:"log";
    setOutput(lines=>lines.length>=155?lines:[...lines,{level,text:msg.text!.slice(0,2500)}]);
   }
   if(msg.type==="done"){
    setStatus(["success","error","timeout","stopped"].includes(msg.status||"")?
     msg.status as RunStatus:"error");
   }
  };
  window.addEventListener("message",handler);
  return()=>window.removeEventListener("message",handler);
 },[]);
 const appendError=(text:string)=>{
  setOutput(lines=>[...lines,{level:"error",text}]);setStatus("error");
 };
 const run=async()=>{
  if(!ready||running)return;
  const id=++sequence.current;
  setOutput([]);
  setStatus(d.language==="typescript"?"compiling":"running");
  let code=d.code;
  if(d.language==="typescript"){
   try{
    // Lazy-loaded only for TypeScript lessons. Transpilation does not perform full type checking.
    const ts=await import("typescript");
    const compiled=ts.transpileModule(code,{fileName:"lesson.ts",reportDiagnostics:true,
     compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None,
      strict:true,isolatedModules:true}});
    if(sequence.current!==id)return;
    const problems=compiled.diagnostics?.filter(
     issue=>issue.category===ts.DiagnosticCategory.Error)??[];
    if(problems.length){
     setOutput(problems.map(issue=>({level:"error" as const,
      text:ts.flattenDiagnosticMessageText(issue.messageText,"\n")})));
     setStatus("error");return;
    }
    code=compiled.outputText;
   }catch(error){
    if(sequence.current===id)appendError("Ошибка компилятора TypeScript: "+String(error));
    return;
   }
  }
  if(sequence.current!==id)return;
  if(!iframe.current?.contentWindow){
   appendError("Изолированная среда не готова. Откройте доску повторно.");return;
  }
  setStatus("running");
  iframe.current.contentWindow.postMessage({
   channel:CHANNEL,type:"execute",token:token.current,runId:id,
   code,stdin:d.stdin
  },"*");
 };
 const stop=()=>{
  const id=sequence.current;
  iframe.current?.contentWindow?.postMessage({
   channel:CHANNEL,type:"stop",token:token.current,runId:id
  },"*");
  sequence.current++;
  setStatus("stopped");
 };
 const stopPropagation=(e:SyntheticEvent)=>e.stopPropagation();
 return <div className="lektrus-programming-board" role="group" aria-label={d.title}
  onPointerDown={stopPropagation} onPointerUp={stopPropagation} onClick={stopPropagation}
  style={{boxSizing:"border-box",display:"flex",flexDirection:"column",gap:8,
   height:"100%",minHeight:0,background:"#fcfdff",padding:"12px 15px",
   border:"1px solid #bfd2e6",borderRadius:12,color:"#284866",overflow:"auto"}}>
  <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",justifyContent:"space-between"}}>
   <div><strong style={{fontSize:18}}>{d.title}</strong>
    <div style={{fontSize:12,color:"#637f9b"}}>{programmingLanguageLabels[d.language]}
     {d.language==="typescript"?" · компиляция в JavaScript":""}</div></div>
   <div style={{display:"flex",alignItems:"center",gap:7,flexWrap:"wrap"}}>
    <button type="button" disabled={!ready||running}
     style={{...actionStyle,opacity:!ready||running?.5:1}}
     onClick={()=>void run()}>▶ Запустить</button>
    <button type="button" disabled={!running} onClick={stop}
     style={{...actionStyle,opacity:running?1:.45}}>■ Стоп</button>
   </div>
  </div>
  {d.showCode&&<pre aria-label="Код программы"
   style={{margin:0,whiteSpace:"pre",overflow:"auto",flex:"1 1 150px",
    minHeight:95,maxHeight:320,background:"#172438",color:"#e4f0fc",
    borderRadius:9,padding:"13px",lineHeight:1.55,fontSize:13,
    fontFamily:"ui-monospace, SFMono-Regular, Consolas, monospace",
    tabSize:2}}>{d.code||"// Пустая программа"}</pre>}
  <div style={{fontSize:12,color:"#5f7893"}}>Ввод: {d.stdin?
   d.stdin.length>140?d.stdin.slice(0,140)+"…":d.stdin:"(пусто)"}</div>
  <div style={{fontSize:13,fontWeight:700,display:"flex",gap:10,alignItems:"center"}}>
   Консоль <span role="status" style={{fontWeight:500,color:status==="error"?"#b04e4e":"#6082a1"}}>
    {statusNames[status]}</span>
  </div>
  <div role="log" aria-live="polite" aria-label="Результат выполнения"
   style={{flex:"1 1 85px",minHeight:75,maxHeight:220,
    overflow:"auto",background:"#f0f5fb",border:"1px solid #d6e3ef",
    padding:"10px",borderRadius:9,
    font:"13px/1.5 ui-monospace, SFMono-Regular, Consolas, monospace",
    whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>
   {output.length?output.map((line,i)=>
    <div key={i} style={{color:line.level==="error"?"#ae3544":
     line.level==="warning"?"#916c1e":"#294b69"}}>{line.text}</div>):
    <span style={{color:"#7890a6"}}>Нажмите «Запустить», чтобы увидеть результат.</span>}
  </div>
  <iframe ref={iframe} title="Изолированный исполнитель кода"
   aria-hidden="true" sandbox="allow-scripts" referrerPolicy="no-referrer"
   srcDoc={PROGRAM_SANDBOX_HTML} onLoad={()=>setReady(true)}
   style={{position:"absolute",height:0,width:0,border:0,opacity:0,pointerEvents:"none"}}/>
 </div>;
}
