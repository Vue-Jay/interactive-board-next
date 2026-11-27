/** Actual authenticated app, two isolated Chrome profiles, disposable local API. */
import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {existsSync} from "node:fs";
import {mkdtemp,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import net from "node:net";
import {setTimeout as delay} from "node:timers/promises";
import {createServer} from "vite";

const boardId=process.env.LEKTRUS_QA_BOARD;
const owner=JSON.parse(process.env.LEKTRUS_QA_OWNER||"null");
const student=JSON.parse(process.env.LEKTRUS_QA_STUDENT||"null");
assert.ok(boardId&&owner?.user?.id&&student?.user?.id&&owner.user.id!==student.user.id);
const chromePath=process.env.CHROME_PATH||["/usr/bin/google-chrome","/usr/bin/chromium","/usr/bin/chromium-browser"].find(existsSync);
assert.ok(chromePath,"Chromium required");
process.env.VITE_LEKTRUS_BACKEND="selfhost";
process.env.VITE_LEKTRUS_API_ORIGIN="http://127.0.0.1:18764";
const origin="http://127.0.0.1:18764",api="http://127.0.0.1:18762";
const server=await createServer({server:{host:"127.0.0.1",port:18764,strictPort:true,proxy:{"/api":{target:api,ws:true,changeOrigin:false}}}});
const peers=[];
async function wait(fn,label,timeout=25000){
 const deadline=Date.now()+timeout;
 let last;
 while(Date.now()<deadline){
  try{last=await fn();if(last)return last}catch(error){last=String(error)}
  await delay(150);
 }
 throw Error(label+"; last="+JSON.stringify(last));
}
async function port(){
 const s=net.createServer();
 await new Promise((resolve,reject)=>s.once("error",reject).listen(0,"127.0.0.1",resolve));
 const p=s.address().port;await new Promise(resolve=>s.close(resolve));return p;
}
async function browser(session){
 const profile=await mkdtemp(path.join(tmpdir(),"lektrus-sync-"));
 const p=await port();
 const chrome=spawn(chromePath,["--headless=new","--no-sandbox","--disable-dev-shm-usage","--disable-gpu","--no-first-run","--disable-extensions","--remote-allow-origins=*","--window-size=1440,900","--remote-debugging-port="+p,"--user-data-dir="+profile,"about:blank"],{stdio:["ignore","ignore","pipe"]});
 let log="";chrome.stderr.on("data",v=>{if(log.length<5000)log+=v});
 const peer={profile,chrome,ws:null};peers.push(peer);
 const target=await wait(async()=>{if(chrome.exitCode!==null)throw Error(log);
  return (await fetch("http://127.0.0.1:"+p+"/json/list",{signal:AbortSignal.timeout(2000)}).then(r=>r.json())).find(x=>x.type==="page");
 },"Chrome debugger");
 const ws=new WebSocket(target.webSocketDebuggerUrl);peer.ws=ws;
 await new Promise((resolve,reject)=>{ws.addEventListener("open",resolve,{once:true});ws.addEventListener("error",reject,{once:true})});
 let sequence=0;
 function call(method,params={}){
  return new Promise((resolve,reject)=>{
   const id=++sequence;
   const timeout=setTimeout(()=>{ws.removeEventListener("message",receive);reject(Error("CDP timeout "+method))},12000);
   function receive(event){const data=JSON.parse(event.data);if(data.id!==id)return;
    clearTimeout(timeout);ws.removeEventListener("message",receive);
    if(data.error||data.result?.exceptionDetails)reject(Error(JSON.stringify(data.error||data.result.exceptionDetails)));
    else resolve(data.result);
   }
   ws.addEventListener("message",receive);ws.send(JSON.stringify({id,method,params}));
  });
 }
 const evaluate=async expression=>(await call("Runtime.evaluate",{expression,returnByValue:true,awaitPromise:true})).result?.value;
 await call("Page.enable");await call("Network.enable");
 await call("Page.addScriptToEvaluateOnNewDocument",{source:
  "if(location.origin==="+JSON.stringify(origin)+"){if(!localStorage.getItem('lektrus.selfhost.session.v1'))localStorage.setItem('lektrus.selfhost.session.v1',"+JSON.stringify(JSON.stringify(session))+");window.__qaSockets=[];const Native=window.WebSocket;window.WebSocket=class extends Native{constructor(...args){super(...args);if(String(args[0]).includes('/events'))window.__qaSockets.push(this)}};}"});
 const page=origin+"/board/"+boardId;
 await call("Page.navigate",{url:page});
 await wait(()=>evaluate("!!document.querySelector('section.board')&&!!document.querySelector('[data-object=\"qa-sticky\"]')"),"Board not rendered for "+session.user.account_role,45000);
 await wait(()=>evaluate("window.__qaSockets?.some(s=>s.readyState===1)"),"Socket not connected");
 return Object.assign(peer,{call,evaluate,session,page});
}
async function stored(peer){
 return peer.evaluate("(()=>{const k=Object.keys(localStorage).find(k=>k.endsWith("+JSON.stringify(".board."+boardId)+")&&k.includes('document'));return k?JSON.parse(localStorage.getItem(k)):null})()");
}
async function head(){
 const response=await fetch(api+"/api/v1/boards/"+boardId+"/document",{headers:{Authorization:"Bearer "+owner.access_token}});
 assert.equal(response.status,200);return response.json();
}
async function converge(predicate,label,timeout=25000){
 return wait(async()=>{
  const [row,a,b]=await Promise.all([head(),stored(peers[0]),stored(peers[1])]);
  return row.document&&a&&b&&[row.document,a,b].every(predicate)&&row;
 },label,timeout);
}
async function click(peer,selector){
 const point=await peer.evaluate("(()=>{const e=[...document.querySelectorAll("+JSON.stringify(selector)+")].find(x=>x.getBoundingClientRect().width>0&&!x.disabled);if(!e)return null;const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()");
 assert.ok(point,"Control missing "+selector);
 await peer.call("Input.dispatchMouseEvent",{type:"mousePressed",...point,button:"left",buttons:1,clickCount:1});
 await peer.call("Input.dispatchMouseEvent",{type:"mouseReleased",...point,button:"left",buttons:0,clickCount:1});
}
async function stroke(peer,kind,yFraction){
 await click(peer,'.toolbar-pinned button[aria-label^="'+(kind==="pen"?"Карандаш":"Маркер")+'"]');
 await wait(()=>peer.evaluate("document.querySelector('section.board')?.classList.contains('board-tool-"+kind+"')"),"Ink tool not selected");
 const p=await peer.evaluate("(()=>{const r=document.querySelector('section.board').getBoundingClientRect();return {x:Math.round(r.left+r.width*.52),y:Math.round(r.top+r.height*"+yFraction+")}})()");
 const send=(type,x,y,pressed)=>peer.call("Input.dispatchMouseEvent",{type,x,y,button:pressed||type==="mouseReleased"?"left":"none",buttons:pressed?1:0,clickCount:1});
 await send("mousePressed",p.x,p.y,true);
 for(let dx=12;dx<=96;dx+=12){await send("mouseMoved",p.x+dx,p.y+Math.sin(dx/30)*6,true);await delay(20)}
 await send("mouseReleased",p.x+96,p.y,false);
}
const owns=(d,kind,user)=>d.items.some(i=>i.kind===kind&&i.createdBy===user&&i.points?.length>1);
try{
 await server.listen();
 const a=await browser(owner),b=await browser(student);
 await stroke(a,"pen",.65);
 await converge(d=>owns(d,"pen",owner.user.id),"Teacher pen did not converge");
 await stroke(b,"marker",.8);
 await converge(d=>owns(d,"pen",owner.user.id)&&owns(d,"marker",student.user.id),"Pupil marker did not converge");
 await click(a,'button[aria-label="Отменить"]');
 await converge(d=>!owns(d,"pen",owner.user.id)&&owns(d,"marker",student.user.id),"Teacher undo destroyed peer work or was lost");
 await click(a,'button[aria-label="Повторить"]');
 await converge(d=>owns(d,"pen",owner.user.id)&&owns(d,"marker",student.user.id),"Teacher redo failed");
 await b.call("Network.emulateNetworkConditions",{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});
 await b.evaluate("window.__qaSockets.forEach(s=>s.close(4000,'QA network loss'));true");
 await stroke(a,"marker",.5);
 await wait(async()=>owns((await head()).document,"marker",owner.user.id),"Teacher edit during disconnect not committed");
 await b.call("Network.emulateNetworkConditions",{offline:false,latency:150,downloadThroughput:100000,uploadThroughput:50000});
 await converge(d=>owns(d,"marker",owner.user.id)&&owns(d,"marker",student.user.id)&&owns(d,"pen",owner.user.id),"Reconnect lost durable work",35000);
 await b.call("Network.emulateNetworkConditions",{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});
 await b.call("Page.reload");
 await wait(()=>b.evaluate("!!document.querySelector('[data-object=\"qa-sticky\"]')"),"Reload board missing",45000);
 await converge(d=>owns(d,"marker",owner.user.id)&&owns(d,"marker",student.user.id)&&owns(d,"pen",owner.user.id),"Reload lost peer work",35000);
 console.log("Two actual Chromium sessions: teacher pen, student marker, cross-user undo/redo, offline catch-up and reload converged.");
}finally{
 for(const peer of peers){peer.ws?.close();if(peer.chrome.exitCode===null&&peer.chrome.signalCode===null){
  const exited=new Promise(resolve=>peer.chrome.once("exit",resolve));peer.chrome.kill();await exited;
 }await rm(peer.profile,{recursive:true,force:true,maxRetries:10,retryDelay:150})}
 await server.close();
}
