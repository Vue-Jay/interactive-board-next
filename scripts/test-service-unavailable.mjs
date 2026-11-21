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
const recoveryScript=document.match(/<script>([\s\S]*?)<\/script>/)[1];
assert.ok(index.includes(recoveryScript),"The entry-module failure page must use the same independent recovery script");

const handlers={};
const entries=new Map([["/service-unavailable.html",new Response(document)],["/",new Response("cached demo shell")]]);
let mode="offline",cachedPaths=[],navigationOptions;
const cache={addAll:async paths=>{cachedPaths=paths},match:async path=>entries.get(path)?.clone(),put:async(path,response)=>entries.set(path,response)};
vm.runInNewContext(read("public/sw.js"),{
  self:{location:{origin:"https://lektrus.test"},addEventListener:(name,handler)=>handlers[name]=handler},
  URL,Response,caches:{open:async()=>cache,match:async path=>entries.get(path)?.clone()},
  fetch:async(_request,options)=>{navigationOptions=options;if(mode==="offline")throw new TypeError("Network unavailable");return new Response(mode==="bad"?"upstream error":"online",{status:mode==="bad"?503:200})}
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
assert.equal(navigationOptions.cache,"no-store","Navigation must never replay stale HTML from the HTTP cache");
for(const pathname of ["/","/assets/index.js"]){
  let intercepted=false;
  handlers.fetch({request:{method:"GET",mode:"cors",cache:"no-store",url:"https://lektrus.test"+pathname},respondWith(){intercepted=true}});
  assert.equal(intercepted,false,"Explicit recovery probes must bypass the service worker shell cache");
}
assert.equal(entries.size,2,"Private navigation URLs must not be cached");

// Execute the actual dependency-free fallback script as if the entry module
// had never loaded. Simulate VPN changes without an online event and verify
// that a healthy tiny API response alone cannot trigger an auto-reload loop.
function recoveryFixture({initialOnline=true,initialMode="good",storage=new Map(),path="/app?section=boards#recent"}={}){
  const win=new EventTarget();const doc=new EventTarget();const nav={onLine:initialOnline};
  const elements=new Map();for(const id of ["retry","status","title","description","button","note"]){
    const element=new EventTarget();element.dataset={};element.textContent=id;element.disabled=false;elements.set(`[data-u-${id}]`,element);
  }
  const main={querySelector:sel=>elements.get(sel)};doc.visibilityState="visible";
  doc.querySelector=sel=>sel==="main.lektrus-unavailable"?main:null;
  const location=new URL("https://lektrus.test"+path);let reloads=0,seq=0,mode=initialMode;
  location.reload=()=>reloads++;location.replace=to=>{reloads++;location.href=new URL(to,location).href};
  const timers=new Map();const requests=[];
  class HtmlParser {parseFromString(html){return {getElementById:id=>id==="root"&&html.includes('id="root"')?{}:null,
    querySelector:()=>html.includes('src="/assets/index.js"')?{getAttribute:()=>"/assets/index.js"}:null}}}
  vm.runInNewContext(recoveryScript,{window:win,document:doc,navigator:nav,location,URL,DOMParser:HtmlParser,AbortController,Date,
    sessionStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},
    setTimeout(fn,ms){const id=++seq;timers.set(id,{fn,ms});return id},clearTimeout:id=>timers.delete(id),
    fetch:async (url,options)=>{requests.push({url,cache:options.cache});
      if(mode==="broken")throw Error("network");
      if(url.includes("/assets/"))return new Response("entry",{status:mode==="no-bundle"?503:200,headers:{"content-type":"text/javascript"}});
      return new Response('<div id="root"></div><script type="module" src="/assets/index.js"></script>',{status:mode==="bad"?503:200,headers:{"content-type":"text/html"}});
    }
  });
  return {win,doc,nav,requests,storage,elements,location,get reloads(){return reloads},setMode:value=>{mode=value},tick(ms){const next=[...timers].find(([,t])=>t.ms===ms);assert.ok(next,`Missing recovery timer ${ms}`);timers.delete(next[0]);next[1].fn()}};
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));
const offline=recoveryFixture({initialOnline:false,initialMode:"broken"});await settle();
assert.equal(offline.requests.length,1);assert.equal(offline.elements.get("[data-u-status]").textContent,"Нет соединения");
offline.setMode("bad");offline.tick(15000);await settle();
assert.equal(offline.reloads,0,"A 503 must not trigger a blind reload");
offline.setMode("no-bundle");offline.tick(15000);await settle();
assert.equal(offline.reloads,0,"An available HTML document is insufficient when JS is unavailable");
offline.setMode("good");offline.tick(15000);await settle();
assert.equal(offline.reloads,1,"Recover after VPN changes even with a stale offline flag and without an online event");
assert.equal(offline.location.href,"https://lektrus.test/app?section=boards#recent","Preserve the exact route and query");
assert.ok(offline.requests.every(r=>r.cache==="no-store"));
const loop=recoveryFixture({storage:offline.storage});await settle();
assert.equal(loop.reloads,0,"The next fallback document must not spin on repeated reloads");
loop.elements.get("[data-u-retry]").dispatchEvent(new Event("click"));await settle();
assert.equal(loop.reloads,1,"Manual recovery remains available while the automatic loop guard is active");
const direct=recoveryFixture({path:"/service-unavailable.html"});await settle();
assert.equal(direct.location.pathname,"/","The standalone recovery address must return to the app");
console.log("Recovery template, offline/503 navigation, demo cache, fresh HTML/JS recovery, VPN restoration and reload-loop guard passed.");
