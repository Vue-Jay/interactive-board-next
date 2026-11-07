import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {performance} from "node:perf_hooks";
import ts from "typescript";

/** CPU and wire-size probe of deterministic SYNTHETIC board snapshots.
 * Results depend on CI machine/Node; no browser FPS, GPU or network measured.
 */
const source=readFileSync(new URL("../src/boardSync.ts",import.meta.url),"utf8");
const compiled=ts.transpileModule(source,{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
}).outputText;
const api={};
new Function("exports",compiled)(api);
assert.equal(typeof api.documentFingerprint,"function");
function sample(minBytes){
 const items=[];
 let text="";
 for(let j=0;j<36;j++)text+="Формула·медиа·рисунок: ";
 while(true){
  const i=items.length;
  items.push({id:"object-"+i,kind:"text",x:i*7,y:i%300,width:240,height:140,
   text,color:"#314668",lineHeight:1.5,locked:false});
  const document={version:1,title:"CPU benchmark",background:{type:"grid"},
   view:{x:0,y:0,zoom:1},items,ink:[]};
  const serialized=JSON.stringify(document);
  if(Buffer.byteLength(serialized)>=minBytes)return {document,serialized};
 }
}
function profile(label,minBytes,iterations=12){
 const {document,serialized}=sample(minBytes);
 const size=Buffer.byteLength(serialized);
 const stringify=[],parse=[],hash=[];
 const before=process.memoryUsage().heapUsed;
 for(let i=0;i<iterations;i++){
  let t=performance.now();
  const json=JSON.stringify(document);
  stringify.push(performance.now()-t);
  t=performance.now();
  const decoded=JSON.parse(json);
  parse.push(performance.now()-t);
  t=performance.now();
  const fingerprint=api.documentFingerprint(decoded);
  hash.push(performance.now()-t);
  assert.equal(fingerprint,api.documentFingerprint(document));
 }
 const after=process.memoryUsage().heapUsed;
 const quantile=(values,q)=>[...values].sort((a,b)=>a-b)[Math.floor((values.length-1)*q)];
 const fmt=v=>Number(v.toFixed(2));
 const result={label,bytes:size,items:document.items.length,iterations,
  stringifyMsP50:fmt(quantile(stringify,.5)),stringifyMsP95:fmt(quantile(stringify,.95)),
  parseMsP50:fmt(quantile(parse,.5)),parseMsP95:fmt(quantile(parse,.95)),
  fingerprintMsP50:fmt(quantile(hash,.5)),fingerprintMsP95:fmt(quantile(hash,.95)),
  heapBeforeMiB:fmt(before/1048576),heapAfterMiB:fmt(after/1048576),
  // Worst-case before any compression: one full snapshot to N peers.
  sixPeerFullDocumentBytes:size*5};
 console.log(JSON.stringify(result));
}
console.log(JSON.stringify({probe:"synthetic-board-serialize",node:process.version,
 platform:process.platform,arch:process.arch,scope:"Node CPU only; not browser/gpu/wire compression"}));
profile("typical-231kB",231_000);
profile("large-1.16MB",1_160_000,8);
