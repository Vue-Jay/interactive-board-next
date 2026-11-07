import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {Buffer} from "node:buffer";
import vm from "node:vm";
import ts from "typescript";

const read=(path)=>readFileSync(new URL("../src/"+path,import.meta.url),"utf8");
const app=read("App.tsx"),preview=read("boardPreview.ts"),sync=read("boardSync.ts");
const receivedStart=app.indexOf("  receiveRemote.current = row => {");
const receivedEnd=app.indexOf("  useEffect(() => layoutEditing?",receivedStart);
assert.ok(receivedStart>=0 && receivedEnd>receivedStart);
const receiver=app.slice(receivedStart,receivedEnd);
assert.ok(receiver.indexOf('if (preliminary === "ignore") return;')>=0);
assert.ok(receiver.indexOf('if (preliminary === "defer")')>=0);
assert.ok(receiver.indexOf('if (preliminary === "ignore")')<
          receiver.indexOf("sharedBoardFingerprint(currentDocument())"),
 "Stale Realtime echoes must be discarded before hashing the local board");
assert.match(receiver,/applyServerDocument\(row,\s*data\)/,
 "Pass the already parsed remote document to the apply path");
assert.match(app,/const applyServerDocument = \(row: RemoteBoardDocument, prepared\?: DocumentData\) => \{/);
assert.match(app,/const data = prepared \?\? parseDocument\(JSON\.stringify\(row\.document\)\)/);

const applyStart=app.indexOf("  const applyServerDocument = ");
const applyEnd=app.indexOf("  receiveRemote.current = row => {",applyStart);
assert.ok(applyStart>=0&&applyEnd>applyStart);
const apply=app.slice(applyStart,applyEnd);
assert.match(apply,/const incomingFingerprint=documentFingerprint\(data\);/);
assert.match(apply,/acknowledgedDocument\.current = incomingFingerprint;/);
assert.match(apply,/acknowledgedSharedContent\.current = incomingFingerprint;/);
assert.doesNotMatch(apply,/acknowledgedSharedContent\.current = sharedBoardFingerprint\(data\)/,
 "Remote version must not hash the same validated document twice");
assert.match(receiver,/acknowledgedSharedContent\.current = remoteFingerprint;/,
 "Merging a remote conflict should reuse the validated document hash");


// Exercise the REAL decision helper, while recording the heavy call count
// implied by the old/new receiver order. No arbitrary elapsed-time CI gate.
const compiledSync=ts.transpileModule(sync,{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText;
const syncAPI={};
vm.runInNewContext(compiledSync,{exports:syncAPI,require:()=>({})});
let oldHashes=0,newHashes=0;
const fakeHash=()=>{oldHashes++;return "same"};
const fakeHashNew=()=>{newHashes++;return "same"};
const count=1000,acceptedVersion=51;
for(let n=0;n<count;n++){
 // Previous receiver computed dirty (full hash), THEN checked the version.
 const dirty=fakeHash()!=="same";
 assert.equal(syncAPI.remoteUpdateDecision(acceptedVersion,51,false,dirty),"ignore");
 // Current receiver checks version before evaluating the local hash.
 const preliminary=syncAPI.remoteUpdateDecision(acceptedVersion,51,false,false);
 if(preliminary!=="ignore"&&preliminary!=="defer")fakeHashNew();
}
assert.equal(oldHashes,count);assert.equal(newHashes,0);
assert.equal(syncAPI.remoteUpdateDecision(50,51,true,false),"defer");
assert.equal(syncAPI.remoteUpdateDecision(50,51,false,true),"conflict");
assert.equal(syncAPI.remoteUpdateDecision(50,51,false,false),"apply");

// Run just the actual preview scheduler with deterministic mocked media/Storage.
const schedulerStart=preview.indexOf("type PreviewIdleWindow=");
assert.ok(schedulerStart>0);
const schedulerSource=preview.slice(schedulerStart);
function runScenario(source,sameImage){
 const mock={id:0,timers:new Map(),calls:[],cache:"data:image/webp;base64,AAAA"};
 const newImage=sameImage?mock.cache:"data:image/webp;base64,BBBB";
 const exports={};
 const compiled=ts.transpileModule(source,{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
 }).outputText;
 const timeout=(fn,delay)=>{const id=++mock.id;mock.timers.set(id,{fn,delay});return id};
 vm.runInNewContext(compiled,{
  exports,window:{},setTimeout:timeout,clearTimeout:id=>mock.timers.delete(id),
  renderBoardPreview:async()=>newImage,
  cachedBoardPreview:()=>mock.cache,
  cacheBoardPreview:(_id,v)=>{mock.cache=v},
  isRemoteBackendEnabled:()=>true,
  remoteRequest:async(path,options)=>{mock.calls.push({
   path,method:options.method,bytes:Buffer.byteLength(options.body),body:options.body
  });},
  encodeURIComponent,JSON,Map,Number,Date,Promise,
 });
 return {mock,schedule:exports.scheduleBackgroundBoardPreview};
}
assert.match(schedulerSource,/if\(image===cachedBoardPreview\(boardId\)\)return;/);
const oldSource=schedulerSource.replace(
 '      if(image===cachedBoardPreview(boardId))return;\n','');
assert.notEqual(oldSource,schedulerSource);
const doc={version:1,title:"Test",view:{x:0,y:0,zoom:1},items:[
 {id:"obj-1",kind:"text",text:"school work ".repeat(20_000),x:0,y:0,width:100,height:50}
]};
async function tick(h){
 h.schedule("board-one",doc,77);
 for(const entry of [...h.mock.timers.values()])entry.fn();
 for(let n=0;n<16;n++)await Promise.resolve();
 return h.mock.calls;
}
const old=runScenario(oldSource,true);
const newer=runScenario(schedulerSource,true);
await tick(old);await tick(newer);
assert.equal(old.mock.calls.length,1,"Old code always PATCHed an unchanged preview");
assert.equal(newer.mock.calls.length,0,"Unchanged preview must not rewrite full board JSONB");
const changed=runScenario(schedulerSource,false);
await tick(changed);
assert.equal(changed.mock.calls.length,1,"A changed preview must still publish");
assert.match(changed.mock.calls[0].path,/version=eq\.77/,
 "Thumbnail patch still checks expected board version");
assert.equal(changed.mock.calls[0].method,"PATCH");
assert.ok(changed.mock.calls[0].bytes>200_000);
console.log(JSON.stringify({
 test:"board runtime hot paths, deterministic offline harness",
 ignoredRealtimeNotifications:count,
 fullLocalFingerprintCalls:{before:oldHashes,after:newHashes},
 unchangedThumbnail:{beforeFullDocPatches:old.mock.calls.length,
  beforeInboundBytes:old.mock.calls[0].bytes,afterFullDocPatches:newer.mock.calls.length,
  afterInboundBytes:0},
 changedThumbnail:{patches:changed.mock.calls.length,
  inboundBytes:changed.mock.calls[0].bytes},
 note:"Saved network bytes and computation counts are measured in mock transport; no live FPS or remote billing."
}));
