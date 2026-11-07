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
assert.match(source,/const exists = await remoteAssetExists\(path\)/,
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
const inject=source.replace(/const DB_NAME[\s\S]*?const synchronized/,
 `const getLocalAsset=async (id:string)=>local.get(id)??null;
 const putLocalAsset=async (id:string,blob:Blob)=>{local.set(id,blob);};
 const synchronized`);
assert.notEqual(inject,source,"Test must isolate local IDB access");
const api={};
new Function("exports","require","Blob","local",ts.transpileModule(inject,{compilerOptions:target}).outputText)(
 api,()=>adapter,Blob,local
);
const pdf=new Blob(["A".repeat(1024)],{type:"application/pdf"});
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

console.log("Storage egress regression: HEAD, denied/missing/fallback and legacy migration passed.");
