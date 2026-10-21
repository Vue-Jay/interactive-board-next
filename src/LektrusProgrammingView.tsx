import {useEffect,useRef,useState,type CSSProperties,type SyntheticEvent} from "react";
import type {ProgrammingDiagram,ProgrammingTest} from "./lektrusProgrammingModel";
import {normalizeProgramOutput,programmingLanguageLabels} from "./lektrusProgrammingModel";
import {PROGRAM_SANDBOX_HTML} from "./lektrusProgrammingSandbox";

type OutputLine={level:"log"|"warning"|"error";text:string};
type RunStatus="idle"|"compiling"|"running"|"success"|"error"|"timeout"|"stopped";
type Outcome={id:string;name:string;ok:boolean;actual:string;status:string};
type Batch={cases:ProgrammingTest[];index:number;code:string;lines:string[];hasError:boolean;passed:number};
const CHANNEL="lektrus-program-runner";
const actionStyle:CSSProperties={border:"1px solid #9cbad6",borderRadius:9,
 padding:"7px 12px",background:"#eef5ff",color:"#285277",cursor:"pointer",fontWeight:700};
const statusNames:Record<RunStatus,string>={
 idle:"Не запускалась",compiling:"Подготовка программы…",running:"Выполняется…",
 success:"Завершено",error:"Ошибка",timeout:"Превышено время",stopped:"Остановлено"
};
export default function LektrusProgrammingView({diagram:d}:{diagram:ProgrammingDiagram}){
 const iframe=useRef<HTMLIFrameElement>(null);
 const token=useRef(crypto.randomUUID());
 const sequence=useRef(0);
 const batch=useRef<Batch|null>(null);
 const [ready,setReady]=useState(false);
 const [status,setStatus]=useState<RunStatus>("idle");
 const [source,setSource]=useState(d.code);
 const [stdin,setStdin]=useState(d.stdin);
 const [output,setOutput]=useState<OutputLine[]>([]);
 const [outcomes,setOutcomes]=useState<Outcome[]>([]);
 const running=status==="running"||status==="compiling";
 const tests=d.tests??[];

 useEffect(()=>{
  sequence.current++;
  batch.current=null;
  setSource(d.code);
  setStdin(d.stdin);
  setOutput([]);
  setOutcomes([]);
  setStatus("idle");
 },[d.code,d.stdin,d.language,d.tests]);

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
    const active=batch.current;
    if(active){
     if(level==="log")active.lines.push(msg.text.slice(0,2500));
     if(level==="error")active.hasError=true;
    }else{
     setOutput(lines=>lines.length>=155?lines:[...lines,{level,text:msg.text!.slice(0,2500)}]);
    }
   }
   if(msg.type!=="done")return;
   const resultStatus:RunStatus=["success","error","timeout","stopped"].includes(msg.status||"")?
    msg.status as RunStatus:"error";
   const active=batch.current;
   if(!active){setStatus(resultStatus);return}
   const test=active.cases[active.index];
   const actual=normalizeProgramOutput(active.lines.join("\n"));
   const ok=resultStatus==="success"&&!active.hasError&&actual===normalizeProgramOutput(test.expected);
   active.passed+=Number(ok);
   setOutcomes(previous=>[...previous,{id:test.id,name:test.name,ok,actual,status:resultStatus}]);
   if(active.index+1===active.cases.length){
    batch.current=null;
    setStatus(active.passed===active.cases.length?"success":"error");
    return;
   }
   active.index++;
   active.lines=[];
   active.hasError=false;
   const next=active.cases[active.index];
   const nextId=++sequence.current;
   iframe.current?.contentWindow?.postMessage({
    channel:CHANNEL,type:"execute",token:token.current,runId:nextId,
    code:active.code,language:d.language,stdin:next.stdin
   },"*");
  };
  window.addEventListener("message",handler);
  return()=>window.removeEventListener("message",handler);
 },[d.language]);

 const appendError=(message:string)=>{
  setOutput(lines=>[...lines,{level:"error",text:message}]);
  setStatus("error");
 };
 const compile=async():Promise<string|null>=>{
  if(d.language!=="typescript")return source;
  try{
   const ts=await import("typescript");
   const compiled=ts.transpileModule(source,{fileName:"lesson.ts",reportDiagnostics:true,
    compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None,
     strict:true,isolatedModules:true}});
   const errors=compiled.diagnostics?.filter(issue=>issue.category===ts.DiagnosticCategory.Error)??[];
   if(errors.length){
    setOutput(errors.map(issue=>({level:"error" as const,text:
     (issue.file&&issue.start!==undefined?"Строка "+(issue.file.getLineAndCharacterOfPosition(issue.start).line+1)+": ":"")+
     ts.flattenDiagnosticMessageText(issue.messageText,"\n")})));
    setStatus("error");return null;
   }
   return compiled.outputText;
  }catch(error){
   appendError("Ошибка преобразования TypeScript: "+String(error));
   return null;
  }
 };
 const start=async(checkAll:boolean)=>{
  if(!ready||running||(checkAll&&tests.length===0))return;
  const startId=++sequence.current;
  batch.current=null;
  setOutput([]);
  setOutcomes([]);
  setStatus(d.language==="typescript"?"compiling":"running");
  const compiled=await compile();
  if(sequence.current!==startId||compiled===null)return;
  const cases=checkAll?tests:[];
  if(checkAll)batch.current={cases,index:0,code:compiled,lines:[],hasError:false,passed:0};
  const input=checkAll?cases[0].stdin:stdin;
  setStatus("running");
  iframe.current?.contentWindow?.postMessage({
   channel:CHANNEL,type:"execute",token:token.current,runId:startId,
   code:compiled,language:d.language,stdin:input
  },"*");
 };
 const stop=()=>{
  const id=sequence.current;
  iframe.current?.contentWindow?.postMessage({
   channel:CHANNEL,type:"stop",token:token.current,runId:id
  },"*");
  sequence.current++;
  batch.current=null;
  setStatus("stopped");
 };
 const reset=()=>{
  if(running)stop();
  setSource(d.code);
  setStdin(d.stdin);
  setOutput([]);
  setOutcomes([]);
  setStatus("idle");
 };
 const stopPropagation=(e:SyntheticEvent)=>e.stopPropagation();
 return <div className="lektrus-programming-board" role="group" aria-label={d.title}
  onPointerDown={stopPropagation} onPointerUp={stopPropagation}
  onClick={stopPropagation} onKeyDown={stopPropagation}
  style={{boxSizing:"border-box",display:"flex",flexDirection:"column",gap:8,
   height:"100%",minHeight:0,background:"#fcfdff",padding:"12px 15px",
   border:"1px solid #bfd2e6",borderRadius:12,color:"#284866",overflow:"auto"}}>
  <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",justifyContent:"space-between"}}>
   <div><strong style={{fontSize:18}}>{d.title}</strong>
    <div style={{fontSize:12,color:"#637f9b"}}>{programmingLanguageLabels[d.language]}
     {d.language==="typescript"?" · преобразование в JavaScript":d.language==="python"?" · Python (Pyodide)":""}</div></div>
   <div style={{display:"flex",alignItems:"center",gap:7,flexWrap:"wrap"}}>
    <button type="button" disabled={!ready||running} style={{...actionStyle,opacity:!ready||running?.5:1}}
     onClick={()=>void start(false)}>▶ Запустить</button>
    <button type="button" disabled={!ready||running||!tests.length}
     style={{...actionStyle,opacity:!ready||running||!tests.length?.45:1}}
     onClick={()=>void start(true)}>Проверить тесты ({tests.length})</button>
    <button type="button" disabled={!running} onClick={stop}
     style={{...actionStyle,opacity:running?1:.45}}>■ Стоп</button>
    <button type="button" onClick={reset} style={actionStyle}>Сбросить</button>
   </div>
  </div>
  {d.showCode?<label style={{display:"flex",flexDirection:"column",gap:4,flex:"1 0 120px",minHeight:140}}>
   <span style={{fontSize:12,color:"#607e97"}}>Исходный код (черновик на этой доске, до 20 000 символов)</span>
   <textarea value={source} onChange={e=>setSource(e.target.value)} maxLength={20000}
    aria-label="Редактировать код программы" spellCheck={false}
    style={{display:"block",width:"100%",boxSizing:"border-box",flex:"1 1 125px",
     minHeight:115,background:"#172438",color:"#e4f0fc",border:"1px solid #5b7394",
     borderRadius:9,padding:"12px",lineHeight:1.5,fontSize:13,
     fontFamily:"ui-monospace, SFMono-Regular, Consolas, monospace",
     tabSize:2,resize:"vertical",whiteSpace:"pre",overflow:"auto"}}/>
  </label>:<p style={{fontSize:12,color:"#607e97"}}>
   Код скрыт преподавателем. Программу можно запускать с собственными входными данными.
  </p>}
  <label style={{display:"flex",flexDirection:"column",gap:4,fontSize:12,color:"#607e97"}}>
   Стандартный ввод (только на этом устройстве)
   <textarea rows={2} value={stdin} maxLength={2000}
    onChange={e=>setStdin(e.target.value)} aria-label="Ввод для запуска программы"
    spellCheck={false} style={{boxSizing:"border-box",width:"100%",padding:7,
     borderRadius:7,border:"1px solid #bbcede",
     fontFamily:"ui-monospace, Consolas, monospace",resize:"vertical"}}/>
  </label>
  <div style={{fontSize:13,fontWeight:700,display:"flex",gap:10,alignItems:"center"}}>
   Консоль <span role="status" style={{fontWeight:500,color:status==="error"?"#b04e4e":"#6082a1"}}>
    {statusNames[status]}</span>
  </div>
  <div role="log" aria-live="polite" aria-label="Результат выполнения"
   style={{flex:"1 1 70px",minHeight:70,maxHeight:200,
    overflow:"auto",background:"#f0f5fb",border:"1px solid #d6e3ef",
    padding:"10px",borderRadius:9,
    font:"13px/1.5 ui-monospace, SFMono-Regular, Consolas, monospace",
    whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>
   {output.length?output.map((line,i)=>
    <div key={i} style={{color:line.level==="error"?"#ae3544":
     line.level==="warning"?"#916c1e":"#294b69"}}>{line.text}</div>):
    <span style={{color:"#7890a6"}}>Нажмите «Запустить» или «Проверить тесты».</span>}
  </div>
  {outcomes.length>0&&<div aria-label="Результаты тестов" style={{display:"grid",gap:6}}>
   <strong style={{fontSize:13}}>Пройдено: {outcomes.filter(x=>x.ok).length} из {tests.length}</strong>
   {outcomes.map(outcome=><div key={outcome.id}
    style={{borderRadius:7,padding:"7px 10px",background:outcome.ok?"#e5f5eb":"#fbeaea",
     fontSize:12,color:"#324f6c"}}>
    <strong>{outcome.ok?"✓":"×"} {outcome.name}</strong>
    {!outcome.ok&&<div style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>
     {outcome.status==="success"?"Ответ не совпадает с ожидаемым.":"Выполнение: "+outcome.status}
     {d.showExpected&&<div>Ожидается: {tests.find(t=>t.id===outcome.id)?.expected||"(пустой вывод)"}</div>}
     <div>Получено: {outcome.actual||"(пустой вывод)"}</div>
    </div>}
   </div>)}
  </div>}
  <iframe ref={iframe} title="Изолированный исполнитель кода"
   aria-hidden="true" sandbox="allow-scripts" referrerPolicy="no-referrer"
   srcDoc={PROGRAM_SANDBOX_HTML}
   style={{position:"absolute",height:0,width:0,border:0,opacity:0,pointerEvents:"none"}}/>
 </div>;
}
