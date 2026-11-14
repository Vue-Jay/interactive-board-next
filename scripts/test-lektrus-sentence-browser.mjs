/** Real pointer and touch interactions in Chrome on the isolated Vite fixture. */
import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {existsSync} from "node:fs";
import {mkdtemp,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import net from "node:net";
import {setTimeout as delay} from "node:timers/promises";
import {createServer} from "vite";

const chromePath=process.env.CHROME_PATH||[
 "/usr/bin/google-chrome","/usr/bin/chromium","/usr/bin/chromium-browser"
].find(existsSync);
assert.ok(chromePath,"Chrome binary required for browser drag regression");
const server=await createServer({configFile:"./vite.config.ts",
 server:{host:"127.0.0.1",port:0,strictPort:false}});
let chrome;
let ws;
let profile;
try{
 await server.listen();
 const address=server.httpServer.address();
 const baseUrl=`http://127.0.0.1:${address.port}/tests/fixtures/lektrus-sentence-drag.html`;
 const portServer=net.createServer();
 await new Promise((resolve,reject)=>portServer.once("error",reject).listen(0,"127.0.0.1",resolve));
 const debugPort=portServer.address().port;
 await new Promise(resolve=>portServer.close(resolve));
 profile=await mkdtemp(path.join(tmpdir(),"lektrus-sentence-drag-"));
 chrome=spawn(chromePath,[
  "--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage",
  "--no-first-run","--disable-extensions","--remote-allow-origins=*",
  `--remote-debugging-port=${debugPort}`,`--user-data-dir=${profile}`,
  "--window-size=1100,800",baseUrl
 ],{stdio:"ignore"});

 let target;
 const started=Date.now();
 while(!target&&Date.now()-started<30000){
  try{
   const pages=await fetch(`http://127.0.0.1:${debugPort}/json/list`).then(r=>r.json());
   target=pages.find(p=>p.type==="page"&&p.url.startsWith(baseUrl));
  }catch{}
  if(!target)await delay(120);
 }
 assert.ok(target,"Chrome did not open Vite sentence fixture");
 ws=new WebSocket(target.webSocketDebuggerUrl);
 await new Promise((resolve,reject)=>{
  ws.addEventListener("open",resolve,{once:true});
  ws.addEventListener("error",reject,{once:true});
 });
 let lastId=0;
 const pending=new Map();
 ws.addEventListener("message",event=>{
  const data=JSON.parse(event.data);
  if(!data.id)return;
  const item=pending.get(data.id);
  if(!item)return;
  pending.delete(data.id);
  data.error?item.reject(new Error(data.error.message)):item.resolve(data.result);
 });
 const call=(method,params={})=>new Promise((resolve,reject)=>{
  const id=++lastId;
  pending.set(id,{resolve,reject});
  ws.send(JSON.stringify({id,method,params}));
 });
 const evaluate=async expression=>{
  const result=await call("Runtime.evaluate",{expression,returnByValue:true,awaitPromise:true});
  if(result.exceptionDetails)throw new Error(result.exceptionDetails.text??"Browser evaluation error");
  return result.result?.value;
 };
 const waitFor=async(expression,message,timeout=10000)=>{
  const started=Date.now();
  while(Date.now()-started<timeout){
   if(await evaluate(expression))return;
   await delay(70);
  }
  throw new Error(message);
 };
 const order=()=>evaluate("[...document.querySelectorAll('.lektrus-sentence-parts [data-sentence-word]')].map(b=>b.dataset.sentenceWord)");
 const bounds=index=>evaluate(`(() => {
  const words=[...document.querySelectorAll('.lektrus-sentence-parts [data-sentence-word]')];
  const box=words[${index}].getBoundingClientRect();
  return {left:box.left,right:box.right,top:box.top,bottom:box.bottom,
   cx:box.left+box.width/2,cy:box.top+box.height/2};
 })()`);
 await call("Runtime.enable");
 await waitFor("document.querySelectorAll('.lektrus-sentence-parts button').length===6",
  "Foreign-language sentence view did not render six words");
 const initial=await order();
 // A click or single tap no longer swaps two words.
 const first=await bounds(0);
 await call("Input.dispatchMouseEvent",{type:"mouseMoved",x:first.cx,y:first.cy});
 await call("Input.dispatchMouseEvent",{type:"mousePressed",button:"left",x:first.cx,y:first.cy,clickCount:1});
 await call("Input.dispatchMouseEvent",{type:"mouseReleased",button:"left",x:first.cx,y:first.cy,clickCount:1});
 assert.deepEqual(await order(),initial,"Click alone must not change word order");

 // Desktop mouse: move first chip to the end through real PointerEvents.
 const last=await bounds(5);
 const endX=Math.min(1020,last.right+14);
 await call("Input.dispatchMouseEvent",{type:"mousePressed",button:"left",x:first.cx,y:first.cy,clickCount:1});
 await call("Input.dispatchMouseEvent",{type:"mouseMoved",button:"left",buttons:1,x:first.cx+14,y:first.cy});
 await call("Input.dispatchMouseEvent",{type:"mouseMoved",button:"left",buttons:1,x:endX,y:last.cy});
 await waitFor("!!document.querySelector('.lektrus-sentence-drag-preview')","Drag preview missing");
 await call("Input.dispatchMouseEvent",{type:"mouseReleased",button:"left",x:endX,y:last.cy,clickCount:1});
 await waitFor("!document.querySelector('.lektrus-sentence-drag-preview')","Drag preview should disappear");
 assert.equal((await order()).at(-1),initial[0],"Mouse should move a word to the end");

 // Keyboard: a focused chip moves left one position without the old click-pair UX.
 await evaluate(`document.querySelectorAll('.lektrus-sentence-parts button')[5].focus()`);
 await call("Input.dispatchKeyEvent",{type:"keyDown",key:"ArrowLeft",code:"ArrowLeft",windowsVirtualKeyCode:37,nativeVirtualKeyCode:37});
 await call("Input.dispatchKeyEvent",{type:"keyUp",key:"ArrowLeft",code:"ArrowLeft",windowsVirtualKeyCode:37,nativeVirtualKeyCode:37});
 assert.equal((await order())[4],initial[0],"ArrowLeft must move focused word");

 // Touch events synthesize a touch pointer; the chip prevents page scrolling.
 await call("Emulation.setTouchEmulationEnabled",{enabled:true,maxTouchPoints:1});
 const from=await bounds(4),to=await bounds(0);
 await call("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{x:from.cx,y:from.cy}]});
 await call("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[{x:from.cx-16,y:from.cy}]});
 await call("Input.dispatchTouchEvent",{type:"touchMove",touchPoints:[{x:to.left+2,y:to.cy}]});
 await call("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});
 assert.equal((await order())[0],initial[0],"Touch should move a word to the front");
 assert.equal((await order()).length,6,"No words should be lost during drag");
 await evaluate(`[...document.querySelectorAll('.lektrus-sentence-actions button')].find(b=>b.textContent==='Заново').click()`);
 assert.deepEqual(await order(),initial,"Reset must restore initial sentence scramble");
 console.log("Browser sentence drag: click does not swap, mouse and touch reorder, keyboard moves and reset restores words.");
}finally{
 if(ws&&ws.readyState===WebSocket.OPEN)ws.close();
 if(chrome){
  chrome.kill();
  await delay(100);
 }
 if(profile)await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});
 await server.close();
}
