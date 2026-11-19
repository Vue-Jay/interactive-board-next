import assert from "node:assert/strict";
import vm from "node:vm";
import {readFileSync} from "node:fs";

const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const document=read("dist/service-unavailable.html");
const index=read("dist/index.html");
assert.match(document,/<main class="lektrus-unavailable"/);
assert.match(document,/data-u-retry/);
assert.match(document,/href="https:\/\/t\.me\/lektrus"/);
assert.match(document,/href="mailto:lektrus\.system@inbox\.ru\?/);
assert.match(document,/data:image\/png;base64,/);
assert.doesNotMatch(document,/<script[^>]+src=/);
assert.ok(index.includes('<template id="lektrus-unavailable-template">'),"Every native/web shell must embed recovery markup");
assert.ok(index.includes(document.match(/<main\b[\s\S]*?<\/main>/)[0]),"Standalone and embedded recovery screen must be identical");

const handlers={};
const entries=new Map([["/service-unavailable.html",new Response(document)],["/",new Response("cached demo shell")]]);
let mode="offline",cachedPaths=[];
const cache={addAll:async paths=>{cachedPaths=paths},match:async path=>entries.get(path)?.clone(),put:async(path,response)=>entries.set(path,response)};
vm.runInNewContext(read("public/sw.js"),{
  self:{location:{origin:"https://lektrus.test"},addEventListener:(name,handler)=>handlers[name]=handler},
  URL,Response,caches:{open:async()=>cache,match:async path=>entries.get(path)?.clone()},
  fetch:async()=>{if(mode==="offline")throw new TypeError("Network unavailable");return new Response(mode==="bad"?"upstream error":"online",{status:mode==="bad"?503:200})}
});
let install;
handlers.install({waitUntil:p=>{install=p}});
await install;
assert.ok(cachedPaths.includes("/service-unavailable.html"));
const navigate=path=>{
  let result;
  handlers.fetch({request:{method:"GET",mode:"navigate",url:"https://lektrus.test"+path},respondWith:p=>{result=p}});
  return result;
};
for(const route of ["/","/app?section=boards","/board/00000000-0000-4000-8000-000000000004","/join/"+"a".repeat(64)]){
  const response=await navigate(route);
  assert.equal(response.status,503);
  assert.match(await response.text(),/lektrus-unavailable/);
}
assert.equal(await (await navigate("/demo/board")).text(),"cached demo shell");
assert.equal(navigate("/api/v1/health"),undefined);
mode="bad";
for(const route of ["/","/#home","/app","/board/00000000-0000-4000-8000-000000000004"]){
  const response=await navigate(route);
  const body=await response.text();
  assert.equal(response.status,503);
  assert.match(body,/lektrus-unavailable/);
  assert.match(body,/mailto:lektrus\.system@inbox\.ru/);
}
mode="good";
assert.equal(await (await navigate("/app")).text(),"online");
assert.equal(entries.size,2,"Private navigation URLs must not be cached");
console.log("Recovery template, offline/503 navigation, demo cache and network-only API passed.");
