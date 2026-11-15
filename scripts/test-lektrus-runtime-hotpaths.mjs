import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {Buffer} from "node:buffer";
import vm from "node:vm";
import ts from "typescript";

const read=(path)=>readFileSync(new URL("../src/"+path,import.meta.url),"utf8");
const app=read("BoardApp.tsx"),preview=read("boardPreview.ts"),sync=read("boardSync.ts");
const inkOverlay=read("RemoteInkOverlay.tsx");

assert.match(app,/const persistedItemIds=useMemo\(\(\)=>new Set\(items\.map\(item=>item\.id\)\),\[items\]\)/,
 "Build one persisted board ID index per items revision");
assert.match(app,/<RemoteInkOverlay store=\{remoteInkStore\}/);
assert.match(inkOverlay,/useSyncExternalStore\(store\.subscribe,store\.getSnapshot/);
assert.match(inkOverlay,/\!persistedItemIds\.has\(ink\.id\)/);
assert.doesNotMatch(app,/setRemoteInk\(/,
 "Do not rescan the entire board once per live stroke");
assert.match(app,/<RemoteCursorOverlay store=\{remoteCursorStore\}/);
assert.match(app,/<RemoteCursorCount store=\{remoteCursorStore\}/);
assert.doesNotMatch(app,/setRemoteCursors\(/,"Cursor activity must not rerender the board");
assert.match(app,/const storedById=getCurrentItemIndex\(itemsRef\.current\)/);
assert.match(app,/const byId=itemById;/,"Do not rebuild the durable index on each peer transform");
assert.match(inkOverlay,/<polyline key=\{ink\.id\+":"\+run\.offset\}/);
assert.match(inkOverlay,/<circle key=\{ink\.id\+":"\+run\.offset\}/,
 "Every peer stroke must keep a stable unique SVG key");
const sampleObjects=Array.from({length:10_000},(_,i)=>({id:"obj-"+i}));
const sampleRemoteInk=Array.from({length:150},(_,i)=>({id:i%10===0?"obj-"+i:"new-"+i}));
const persistedIds=new Set(sampleObjects.map(item=>item.id));
const slow=()=>sampleRemoteInk.filter(ink=>!sampleObjects.some(item=>item.id===ink.id));
const indexed=()=>sampleRemoteInk.filter(ink=>!persistedIds.has(ink.id));
assert.deepEqual(slow(),indexed(),"Fast overlay must include exactly the same uncommitted strokes");
let slowElapsed=0,fastElapsed=0;
for(let trial=0;trial<4;trial++){
 const t=Date.now();for(let n=0;n<8;n++)slow();slowElapsed+=Date.now()-t;
 const t2=Date.now();for(let n=0;n<8;n++)indexed();fastElapsed+=Date.now()-t2;
}

const receivedStart=app.indexOf("  receiveRemote.current = row => {");
const receivedEnd=app.indexOf("  useEffect(() => layoutEditing?",receivedStart);
assert.ok(receivedStart>=0 && receivedEnd>receivedStart);
const receiver=app.slice(receivedStart,receivedEnd);
assert.ok(receiver.indexOf('if (preliminary === "ignore") return;')>=0);
assert.ok(receiver.indexOf('if (preliminary === "defer")')>=0);
assert.ok(receiver.indexOf('if (preliminary === "ignore")')<
          receiver.indexOf("sharedBoardFingerprint(currentDocument())"),
 "Stale Realtime echoes must be discarded before hashing the local board");
assert.match(receiver,/applyServerDocument\(row,\s*data,\s*remoteFingerprint\)/,
 "Pass the already parsed and hashed remote document to the apply path");
assert.match(app,/const applyServerDocument = \(row: RemoteBoardDocument, data: DocumentData, remoteFingerprint: string\) => \{/);

const applyStart=app.indexOf("  const applyServerDocument = ");
const applyEnd=app.indexOf("  receiveRemote.current = row => {",applyStart);
assert.ok(applyStart>=0&&applyEnd>applyStart);
const apply=app.slice(applyStart,applyEnd);
assert.doesNotMatch(apply,/parseDocument\(/);
assert.match(apply,/const incomingFingerprint=data\.items===incomingItemsBeforeSync\?remoteFingerprint:documentFingerprint\(data\);/);
assert.match(apply,/JSON\.stringify\(localDoc\.background\)!==JSON\.stringify\(data\.background\) &&\s*sharedBoardFingerprint/,
 "Only hash the hypothetical background-only update when the background actually differs");
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
// Evaluate the actual apply path's fingerprint and background classification
// with deterministic inputs. Unchanged connectors keep the receiver's hash.
const classifySource=apply.slice(0,apply.indexOf("    remoteVersion.current = row.version;"))+
 "return {incomingFingerprint,onlyBackgroundChanged}; };";
const compiledClassify=ts.transpileModule(classifySource+"\nexports.classify=applyServerDocument;",{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText;
const classifyAPI={};
let classHashes=0,localDoc,changedConnectors=false;
const hash=value=>{classHashes++;return syncAPI.documentFingerprint(value)};
vm.runInNewContext(compiledClassify,{exports:classifyAPI,currentDocument:()=>localDoc,
 documentFingerprint:hash,sharedBoardFingerprint:hash,
 syncBoundConnectors:items=>changedConnectors?items.map(item=>({...item,x:item.x+1})):items});
localDoc={version:1,title:"Large board",background:{color:"white"},items:[{id:"a",x:0,text:"я".repeat(800_000)}]};
const updated={...localDoc,items:[{...localDoc.items[0],x:2}]};
const updatedHash=syncAPI.documentFingerprint(updated);
assert.equal(classifyAPI.classify({},updated,updatedHash).incomingFingerprint,updatedHash);
assert.equal(classHashes,0,"Unchanged connectors and background need zero extra full hashes");
const recolored={...localDoc,background:{color:"black"}};
assert.equal(classifyAPI.classify({},recolored,syncAPI.documentFingerprint(recolored)).onlyBackgroundChanged,true);
assert.equal(classHashes,1,"A background-only change must still be identified");
changedConnectors=true;
const adjusted={...updated};
assert.equal(classifyAPI.classify({},adjusted,updatedHash).incomingFingerprint,syncAPI.documentFingerprint(adjusted));
assert.equal(classHashes,2,"Changed connector geometry must refresh the hash");
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
 overlayFilter:{objects:sampleObjects.length,remoteStrokes:sampleRemoteInk.length,passes:32,oldElapsedMs:slowElapsed,newElapsedMs:fastElapsed},
 ignoredRealtimeNotifications:count,
 fullLocalFingerprintCalls:{before:oldHashes,after:newHashes},
 unchangedThumbnail:{beforeFullDocPatches:old.mock.calls.length,
  beforeInboundBytes:old.mock.calls[0].bytes,afterFullDocPatches:newer.mock.calls.length,
  afterInboundBytes:0},
 changedThumbnail:{patches:changed.mock.calls.length,
  inboundBytes:changed.mock.calls[0].bytes},
 note:"Saved network bytes and computation counts are measured in mock transport; no live FPS or remote billing."
}));
