import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";

const read=(file)=>readFileSync(new URL("../src/"+file,import.meta.url),"utf8");
const target={module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022};
const backendSource=read("backend.ts");
const start=backendSource.indexOf("export const remoteAssetExists =");
const end=backendSource.indexOf("export type RemoteBoardDocument",start);
assert.ok(start>0&&end>start,"HEAD implementation is present");
const compiledHead=ts.transpileModule(backendSource.slice(start,end),{compilerOptions:target}).outputText;
const buildHead=(status,metadata={})=>{
 const calls=[];
 const exports={};
 new Function("exports","getRemoteSession","fetchWithTimeout","remoteAssetRequest","url","anonKey",compiledHead)(
  exports,async()=>({access_token:"jwt"}),
  async(url,init)=>{calls.push({url,method:init.method,headers:init.headers});return {ok:status>=200&&status<300,status};},
  async()=>{calls.push({method:"fallback-get"});return new Blob(["legacy"])},
  "https://example.invalid","anon-public"
 );
 return {fn:exports.remoteAssetExists,calls,...metadata};
};
for(const status of [200,204,404,400,403,405,501]){
 const {fn,calls}=buildHead(status);
 if(status===200||status===204)assert.equal(await fn("board/file"),true);
 if(status===404||status===400)assert.equal(await fn("board/file"),false);
 if(status===403)await assert.rejects(fn("board/file"),/HTTP 403/);
 if(status===405||status===501)assert.equal(await fn("board/file"),true);
 assert.equal(calls[0].method,"HEAD","Existence check must avoid downloading file bodies");
 assert.equal(calls[0].headers.Authorization,"Bearer jwt");
 assert.equal(calls.filter(call=>call.method==="fallback-get").length,
  [405,501].includes(status)?1:0,"Full GET only for unsupported HEAD");
}
const source=read("assetStore.ts");
assert.match(source,/const exists = selfhost\s*\? await selfhostAssetExists\(boardId,id\)\s*:\s*await remoteAssetExists\(path\)/,
 "Existing assets must be checked with HEAD instead of GET");
const local=new Map(),server=new Map(),calls=[];
const adapter={
 isRemoteBackendEnabled:()=>true,
 remoteAssetExists:async path=>{
  calls.push(["head",path]);
  return server.has(path);
 },
 remoteAssetRequest:async(path,blob)=>{
  calls.push([blob?"upload":"download",path]);
  if(blob){server.set(path,blob);return null}
  if(!server.has(path))throw new Error("Missing media");
  return server.get(path);
 }
};
const selfhostAdapter={
 selfhostAssetExists:async(board,id)=>adapter.remoteAssetExists(`${board}/${id}`),
 selfhostDownloadAsset:async(board,id)=>adapter.remoteAssetRequest(`${board}/${id}`),
 selfhostUploadAsset:async(board,id,blob)=>adapter.remoteAssetRequest(`${board}/${id}`,blob),
};
const inject=source.replace(/let databasePromise[\s\S]*?const synchronized/,
 `const getLocalAsset=async (id:string)=>local.get(id)??null;
 const putLocalAsset=async (id:string,blob:Blob)=>{local.set(id,blob);};
 const synchronized`);
assert.notEqual(inject,source,"Test must isolate local IDB access");
const api={};
new Function("exports","require","Blob","local",ts.transpileModule(inject,{compilerOptions:target}).outputText)(
 api,path=>path==="./selfhostApi"?selfhostAdapter:adapter,Blob,local
);
const pdf=new Blob(["A".repeat(1024)],{type:"application/pdf"});
// Exercise actual demo paths with both remote backends enabled. This must
// neither use the local database nor issue a network request, even for misses.
const demoId="lektrus-demo-first",otherDemoId="lektrus-demo-second";
const beforeDemoLocal=[...local.entries()],beforeDemoCalls=calls.length;
api.setSelfhostBoardMode(demoId,true);
await api.putAsset("pdf",pdf,demoId,false);
await api.putAsset("pdf",pdf,otherDemoId,true);
assert.equal(await api.getAsset("pdf",demoId),pdf);
assert.equal(await api.getDisplayAsset("pdf",demoId),pdf);
assert.equal(await api.getAsset("missing",demoId),null);
await api.ensureBoardAssets(demoId,{items:[{kind:"pdf",assetId:"pdf"},{kind:"pdf",assetId:"missing"}]});
api.clearDemoBoardAssets(demoId);
assert.equal(await api.getAsset("pdf",demoId),null,"Demo assets must disappear on exit");
assert.equal(await api.getAsset("pdf",otherDemoId),pdf,"Separate demos must be isolated");
api.clearDemoBoardAssets(otherDemoId);
assert.deepEqual([...local.entries()],beforeDemoLocal,"Demo must not write local attachment storage");
assert.equal(calls.length,beforeDemoCalls,"Demo asset paths must never touch either backend");
server.set("board/large-pdf",pdf);
await api.ensureBoardAssets("board",{items:[{kind:"pdf",assetId:"large-pdf"}]});
assert.deepEqual(calls,[["head","board/large-pdf"]],
 "Cold autosave must not transfer or re-store any pre-existing binary");
assert.equal(await api.getAsset("large-pdf","board"),pdf);
assert.deepEqual(calls.slice(-1),[["download","board/large-pdf"]],
 "An actual viewer must still be allowed to fetch full content");
local.set("old",new Blob(["legacy image"],{type:"image/png"}));
await api.ensureBoardAssets("board",{items:[{kind:"image",assetId:"old"}]});
assert.equal(server.has("board/old"),true,"Legacy assets must still migrate");
// A temporary HEAD failure is not an absent object. The legacy local copy
// must never trigger a duplicate POST when Storage is unreachable or denies HEAD.
local.set("cached-legacy",new Blob(["legacy"],{type:"image/png"}));
for (const reason of ["Network timeout","HTTP 403"]) {
 const before=calls.length;
 adapter.remoteAssetExists=async path=>{calls.push(["head",path]);throw new Error(reason)};
 await assert.rejects(
  api.ensureBoardAssets("board",{items:[{kind:"image",assetId:"cached-legacy"}]}),
  new RegExp(reason));
 assert.deepEqual(calls.slice(before),[["head","board/cached-legacy"]],
  "Failed probe must not upload a cached legacy binary");
}
adapter.remoteAssetExists=async path=>{calls.push(["head",path]);return server.has(path)};
const count=calls.length;
await api.ensureBoardAssets("board",{items:[{kind:"image",assetId:"old"}]});
assert.equal(calls.length,count,"Already synchronized media must avoid repeated probes");
await assert.rejects(
 api.ensureBoardAssets("board",{items:[{kind:"image",assetId:"missing"}]}),
 /не найдено|Missing/,"A missing attachment must still block the save");
// A legacy board with many attachments must not create an unlimited burst.
const originalHead=adapter.remoteAssetExists;
let active=0,peak=0;
adapter.remoteAssetExists=async path=>{
 active++;peak=Math.max(peak,active);
 try {await new Promise(resolve=>setTimeout(resolve,0));return server.has(path)}
 finally {active--}
};
const many=Array.from({length:19},(_,i)=>({kind:"image",assetId:"bulk-"+i}));
for(const item of many)server.set("board/"+item.assetId,new Blob(["img"]));
await api.ensureBoardAssets("board",{items:many});
assert.ok(peak>1&&peak<=6,`Storage HEAD concurrency must be bounded, got ${peak}`);
assert.equal(calls.filter(([method,path])=>method==="download"&&path.startsWith("board/bulk-")).length,0);
adapter.remoteAssetExists=originalHead;

// Exercise the currently deployed backend as well: three views of the same
// large PDF must share one transfer and subsequent reads use the local cache.
api.setSelfhostBoardMode("native-board",true);
server.set("native-board/pdf",pdf);
const beforeNative=calls.length;
await api.ensureBoardAssets("native-board",{items:[{kind:"pdf",assetId:"pdf"}]});
assert.deepEqual(calls.slice(beforeNative),[["head","native-board/pdf"]]);
await Promise.all(Array.from({length:3},()=>api.getAsset("pdf","native-board")));
await api.getAsset("pdf","native-board");
assert.deepEqual(calls.slice(beforeNative),[["head","native-board/pdf"],["download","native-board/pdf"]]);
local.set("native-missing",pdf);
adapter.remoteAssetExists=async()=>{throw new Error("HTTP 403")};
await assert.rejects(api.ensureBoardAssets("native-board",{items:[{kind:"pdf",assetId:"native-missing"}]}),/HTTP 403/);
assert.equal(server.has("native-board/native-missing"),false);

console.log("Storage egress regression: HEAD, denied/missing/fallback and legacy migration passed.");
