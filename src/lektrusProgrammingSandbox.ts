/** Isolated executable: never evaluate student code in the Lectrus document. */
const WORKER_SOURCE=String.raw`
const maxLines=150;
let lines=0;
let totalChars=0;
function format(value){
 if(typeof value==="string")return value;
 if(value===undefined)return "undefined";
 try{return JSON.stringify(value)}catch{return String(value)}
}
function report(kind,message){
 if(lines>=maxLines||totalChars>=20000)return;
 const text=String(message).slice(0,2500);
 lines++;totalChars+=text.length;
 self.postMessage({kind:"line",level:kind,text});
 if(lines===maxLines||totalChars>=20000)
  self.postMessage({kind:"line",level:"warning",text:"Вывод ограничен 150 строками / 20 000 символами."});
}
self.onmessage=async function(event){
 const data=event.data;
 if(!data||data.kind!=="execute"||typeof data.code!=="string")return;
 try{
  const input=typeof data.stdin==="string"?data.stdin:"";
  if(data.language==="python"){
   report("log","Загрузка Python (Pyodide). При первом запуске необходим интернет…");
   importScripts("https://cdn.jsdelivr.net/pyodide/v314.0.7/full/pyodide.js");
   const py=await loadPyodide({
    indexURL:"https://cdn.jsdelivr.net/pyodide/v314.0.7/full/"
   });
   py.setStdout({batched:(message)=>report("log",message)});
   py.setStderr({batched:(message)=>report("error",message)});
   py.globals.set("__lektrus_stdin",input);
   py.runPython("import sys, io\nsys.stdin = io.StringIO(__lektrus_stdin)");
   await py.runPythonAsync(data.code);
   self.postMessage({kind:"done",status:"success"});
   return;
  }
  // Disallow common network and nested-worker APIs in addition to the frame CSP.
  for(const key of ["fetch","XMLHttpRequest","WebSocket","EventSource",
   "Worker","SharedWorker","importScripts","indexedDB","caches"]){
   try{self[key]=undefined}catch{}
  }
  const inputLines=input.split(/\r?\n/);
  let index=0;
  const readLine=()=>inputLines[index++]??"";
  const captured={
   log:(...args)=>report("log",args.map(format).join(" ")),
   info:(...args)=>report("log",args.map(format).join(" ")),
   warn:(...args)=>report("warning",args.map(format).join(" ")),
   error:(...args)=>report("error",args.map(format).join(" "))
  };
  self.console=captured;
  const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
  const task=new AsyncFunction("console","print","input","readLine","prompt",
   '"use strict";\n'+data.code);
  await task(captured,(...args)=>captured.log(...args),input,readLine,
   (message)=>{if(message)captured.log(message);return readLine()});
  self.postMessage({kind:"done",status:"success"});
 }catch(error){
  report("error",error&&error.stack?String(error.stack):String(error));
  self.postMessage({kind:"done",status:"error"});
 }
};
`;
export const PROGRAM_SANDBOX_HTML=`<!doctype html><html lang="ru"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' blob: https://cdn.jsdelivr.net; worker-src blob:; connect-src https://cdn.jsdelivr.net; img-src 'none'; style-src 'none'; object-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'"></head>
<body><script>
(function(){
 "use strict";
 const workerText=${JSON.stringify(WORKER_SOURCE)};
 const originChannel="lektrus-program-runner";
 let worker=null,timer=null,activeId=null,activeToken=null;
 function send(message){parent.postMessage(Object.assign({channel:originChannel},message),"*")}
 function clear(){
  if(timer){clearTimeout(timer);timer=null}
  if(worker){worker.terminate();worker=null}
  activeId=null;activeToken=null;
 }
 function finish(status){
  if(activeId===null)return;
  send({type:"done",runId:activeId,token:activeToken,status});
  clear();
 }
 window.addEventListener("message",function(event){
  if(event.source!==parent||!event.data||event.data.channel!==originChannel)return;
  const data=event.data;
  if(data.type==="stop"){
   if(activeId===data.runId&&activeToken===data.token)finish("stopped");
   return;
  }
  if(data.type!=="execute"||typeof data.code!=="string"||
     typeof data.token!=="string"||typeof data.runId!=="number"||
     data.code.length>50000)return;
  if(activeId!==null)finish("stopped");
  activeId=data.runId;activeToken=data.token;
  try{
   const blob=new Blob([workerText],{type:"text/javascript"});
   const uri=URL.createObjectURL(blob);
   worker=new Worker(uri);
   URL.revokeObjectURL(uri);
   worker.onmessage=function(e){
    if(!e.data||activeId!==data.runId)return;
    if(e.data.kind==="line")send({type:"line",runId:activeId,token:activeToken,
     level:e.data.level,text:String(e.data.text).slice(0,2500)});
    if(e.data.kind==="done")finish(e.data.status==="success"?"success":"error");
   };
   worker.onerror=function(e){
    send({type:"line",runId:activeId,token:activeToken,level:"error",
     text:String(e.message||"Ошибка выполнения")});
    finish("error");
   };
   timer=setTimeout(function(){
    send({type:"line",runId:activeId,token:activeToken,level:"error",
     text:"Превышено время выполнения."});
    finish("timeout");
   },data.language==="python"?30000:4000);
   worker.postMessage({kind:"execute",language:data.language,code:data.code,stdin:String(data.stdin||"").slice(0,2000)});
  }catch(error){
   send({type:"line",runId:activeId,token:activeToken,level:"error",text:String(error)});
   finish("error");
  }
 });
 send({type:"ready"});
})();
</script></body></html>`;
