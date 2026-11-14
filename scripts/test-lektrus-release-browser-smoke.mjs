/**
 * Integrated release smoke on an actual demo board, using Chrome DevTools.
 * Real pointer moves test selection and dragging. No Supabase connection needed.
 */
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
assert.ok(chromePath,"Chrome required for integrated release browser smoke");
const server=await createServer({configFile:"./vite.config.ts",
 server:{host:"127.0.0.1",port:0,strictPort:false}});
let profile,chrome,socket;
const log=[];
try{
 await server.listen();
 const port=server.httpServer.address().port;
 const url=`http://127.0.0.1:${port}/demo/board?scene=math&capture=1`;
 const portServer=net.createServer();
 await new Promise((resolve,reject)=>portServer.once("error",reject).listen(0,"127.0.0.1",resolve));
 const debugPort=portServer.address().port;
 await new Promise(resolve=>portServer.close(resolve));
 profile=await mkdtemp(path.join(tmpdir(),"lektrus-release-qa-"));
 chrome=spawn(chromePath,[
  "--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage",
  "--no-first-run","--disable-extensions","--remote-allow-origins=*",
  `--remote-debugging-port=${debugPort}`,`--user-data-dir=${profile}`,
  "--window-size=1440,1000",url
 ],{stdio:["ignore","ignore","pipe"]});
 chrome.stderr.on("data",chunk=>{if(log.length<20)log.push(String(chunk).slice(0,1500))});
 let page;
 for(let i=0;i<280&&!page;i++){
  try{
   const targets=await fetch(`http://127.0.0.1:${debugPort}/json/list`).then(r=>r.json());
   page=targets.find(target=>target.type==="page"&&target.url.includes("/demo/board"));
  }catch{}
  if(!page)await delay(150);
 }
 assert.ok(page,"Chrome did not open demo board; "+log.slice(-4).join(""));
 socket=new WebSocket(page.webSocketDebuggerUrl);
 await new Promise((resolve,reject)=>{
  socket.addEventListener("open",resolve,{once:true});
  socket.addEventListener("error",reject,{once:true});
 });
 let id=0;
 const pending=new Map();
 socket.addEventListener("message",event=>{
  const data=JSON.parse(event.data);
  if(!data.id)return;
  const job=pending.get(data.id);
  if(!job)return;
  pending.delete(data.id);
  data.error?job.reject(new Error(data.error.message)):job.resolve(data.result);
 });
 const call=(method,params={})=>new Promise((resolve,reject)=>{
  const next=++id;
  pending.set(next,{resolve,reject});
  socket.send(JSON.stringify({id:next,method,params}));
 });
 const evaluate=async expression=>{
  const result=await call("Runtime.evaluate",{expression,awaitPromise:true,returnByValue:true,userGesture:true});
  if(result.exceptionDetails)throw new Error("Browser evaluation: "+result.exceptionDetails.text);
  return result.result?.value;
 };
 const wait=async (expression,message,timeout=12000)=>{
  const started=Date.now();
  while(Date.now()-started<timeout){
   const result=await evaluate(expression);
   if(result)return result;
   await delay(95);
  }
  throw new Error(message);
 };
 const click=async selector=>{
  const result=await evaluate(`(() => {
   const element=document.querySelector(${JSON.stringify(selector)});
   if(!element)return false;
   element.click();return true;
  })()`);
  assert.ok(result,"Missing button: "+selector);
 };
 const rect=async selector=>{
  const result=await evaluate(`(() => {
   const item=document.querySelector(${JSON.stringify(selector)});
   if(!item)return null;
   const r=item.getBoundingClientRect();
   return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,
    x:r.left+r.width/2,y:r.top+r.height/2};
  })()`);
  assert.ok(result,"Missing element geometry: "+selector);
  return result;
 };
 const mouse=async(type,x,y,{pressed=false}={})=>call("Input.dispatchMouseEvent",{
  type,x,y,
  button:pressed||type==="mouseReleased"?"left":"none",
  buttons:pressed?1:0,
  clickCount:type==="mousePressed"||type==="mouseReleased"?1:0
 });
 await call("Runtime.enable");
 await call("Page.enable");

 // Initial lesson must actually render the board with math, text and table objects.
 await wait('document.querySelectorAll(".board-object[data-object]").length>=8',
  "Mathematics demo did not render its objects");
 for(const type of ["text","sticky","formula","table","graph"])
  assert.ok(await evaluate(`!!document.querySelector(".board-object.object-${type}")`),
   "Board lost "+type+" objects");
 console.log("✓ Demo board: math lessons and five object types rendered");

 // Zoom controls have to change the actual state and be resettable.
 await click('button[aria-label="Увеличить"]');
 await wait('document.querySelector(".zoom-value")?.textContent?.includes("125%")',
  "Zoom + was not applied");
 await click(".zoom-value");
 await wait('document.querySelector(".zoom-value")?.textContent?.includes("100%")',
  "Zoom reset was not applied");
 await click('button[aria-label="Настройки фона доски"]');
 await wait('!!document.querySelector("#lektrus-background-settings")',
  "Background settings did not open");
 await evaluate(`[...document.querySelectorAll("#lektrus-background-settings button")].find(b=>b.textContent.includes("Клетки"))?.click()`);
 await wait('document.querySelector("section.board")?.classList.contains("board-bg-grid")',
  "Grid background did not appear");
 await click('button[aria-label="Закрыть настройки фона"]');
 console.log("✓ View controls: zoom and grid background");

 // Drag a real sticky-note object; undo/redo should restore its positions.
 await click(".toolbar-pinned button:first-child");
 const before=await rect('[data-object="math-note"]');
 await mouse("mouseMoved",before.x,before.y);
 await mouse("mousePressed",before.x,before.y,{pressed:true});
 await mouse("mouseMoved",before.x+12,before.y+8,{pressed:true});
 await mouse("mouseMoved",before.x+75,before.y+44,{pressed:true});
 await mouse("mouseReleased",before.x+75,before.y+44);
 await wait(`(() => {
  const r=document.querySelector('[data-object="math-note"]')?.getBoundingClientRect();
  return r&&r.left>${before.left+30};
 })()`,"Sticky object did not move in response to a pointer drag");
 const after=await rect('[data-object="math-note"]');
 assert.ok(after.left-before.left>30,"Dragged object position did not commit");
 await wait('!!document.querySelector(\'button[aria-label="Отменить"]:not([disabled])\')',
  "Undo was not available after dragging the object");
 await click('button[aria-label="Отменить"]');
 try{
  await wait(`(() => {
   const r=document.querySelector('[data-object="math-note"]')?.getBoundingClientRect();
   return r&&Math.abs(r.left-${before.left})<12;
  })()`,"Undo did not restore object position",4000);
 }catch(error){
  const current=await evaluate(`(() => {
   const item=document.querySelector('[data-object="math-note"]');
   const r=item?.getBoundingClientRect();
   return {left:r?.left,top:r?.top,style:item?.getAttribute('style'),
    undoDisabled:document.querySelector('button[aria-label="Отменить"]')?.disabled,
    redoDisabled:document.querySelector('button[aria-label="Повторить"]')?.disabled,
    selected:document.querySelectorAll('.board-object.selected').length};
  })()`);
  throw new Error(error.message+"; "+JSON.stringify({current,before,after}));
 }
 await click('button[aria-label="Повторить"]');
 await wait(`(() => {
  const r=document.querySelector('[data-object="math-note"]')?.getBoundingClientRect();
  return r&&r.left>${before.left+30};
 })()`,"Redo did not restore object movement");
 console.log("✓ Object interactions: mouse drag, undo, redo");

 // The release catalogue must show the real 'Задания на доске' option.
 // Existing subject diagrams are never deleted by this menu filter.
 await click(".lektrus-desktop-subject-trigger");
 await wait('!!document.querySelector("#lektrus-subject-tools-panel select")',
  "Subject tools did not open");
 const changeSubject=async subject=>{
  const changed=await evaluate(`(() => {
   const select=document.querySelector('#lektrus-subject-tools-panel select[aria-label="Предмет доски для набора инструментов"]');
   if(!select)return false;
   const setter=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,"value").set;
   setter.call(select,${JSON.stringify(subject)});
   select.dispatchEvent(new Event("change",{bubbles:true}));
   return true;
  })()`);
  assert.ok(changed,"Subject selector unavailable");
  await wait(`document.querySelector('#lektrus-subject-tools-panel select')?.value===${JSON.stringify(subject)}`,
   subject+" selection did not change");
 };
 const menu=()=>evaluate(`[...document.querySelectorAll("#lektrus-subject-tools-panel .lektrus-subject-tools-list button")].map(b=>b.getAttribute("aria-label"))`);
 for(const subject of ["Биология","Информатика","Обществознание","Литература"]){
  await changeSubject(subject);
  await wait('document.querySelectorAll("#lektrus-subject-tools-panel .lektrus-subject-tools-list button").length===1',
   subject+" must offer one subject assignment tool");
  assert.deepEqual(await menu(),["Задания на доске"],"Wrong "+subject+" release catalogue");
 }
 await changeSubject("История");
 await wait('document.querySelectorAll("#lektrus-subject-tools-panel .lektrus-subject-tools-list button").length===2',
  "History must offer two tool choices");
 assert.deepEqual((await menu()).sort(),["Задания на доске","Исторические карты"].sort());
 assert.equal(await evaluate('document.body.textContent.includes("+ Предметная доска")'),false,
  "Obsolete standalone board button resurfaced");
 console.log("✓ Release catalogue: four assignment-only subjects and historical atlas");

 // Check the actual task-editor entry point (not only text in the catalogue).
 await click('#lektrus-subject-tools-panel button[aria-label="Задания на доске"]');
 await wait('!!document.querySelector(".lektrus-subject-task-editor")',
  "Board assignments did not open the subject worksheet editor");
 console.log("✓ Subject tasks: editor opens through real catalogue action");

 // This checks local non-empty document persistence; real multi-account
 // Supabase synchronization must be tested separately with two users.
 const stored=await evaluate(`(() => {
  const keys=Object.keys(localStorage).filter(k=>k.startsWith("lesson-board.document.v1.board."));
  return keys.some(k=>{try{return JSON.parse(localStorage.getItem(k)).items?.length>=8}catch{return false}});
 })()`);
 assert.ok(stored,"Demo lesson did not persist its document in local storage");
 console.log("✓ Persistence: local board document exists with lesson objects");
 console.log("Lektrus release smoke passed: actual browser interactions and curated subjects.");
}finally{
 if(socket&&socket.readyState===WebSocket.OPEN)socket.close();
 if(chrome){chrome.kill();await delay(120)}
 if(profile)await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});
 await server.close();
}
