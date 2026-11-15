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
const homeOnly=process.argv.includes("--home-only");
if(homeOnly)process.env.VITE_LEKTRUS_LOCAL_TEST="true";
const server=await createServer({configFile:"./vite.config.ts",
 server:{host:"127.0.0.1",port:0,strictPort:false}});
let profile,chrome,socket;
const log=[];
try{
 await server.listen();
 const port=server.httpServer.address().port;
 const route=homeOnly?"/app":"/demo/board?scene=math&capture=1";
 const url=`http://127.0.0.1:${port}${route}`;
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
   page=targets.find(target=>target.type==="page"&&target.url.startsWith(url));
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

 if(homeOnly){
  await wait('!!document.querySelector(".lektrus-calendar-grid")',"Home did not render",30000);
  const snapshot=()=>evaluate(`(() => {
   const box=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom}};
   const one=s=>document.querySelector(s), all=s=>[...document.querySelectorAll(s)];
   const hub=one('.lectris-hub'),calendar=one('.lektrus-calendar-panel'),aside=one('.lectris-hub-aside');
   const intersect=(a,b)=>Math.max(0,Math.min(a.right,b.right)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y));
   const checks=['.lektrus-calendar-head h2','.lektrus-calendar-head>button','.lektrus-calendar-toolbar>strong','.lektrus-calendar-toolbar button','.lektrus-calendar-grid button','.lektrus-calendar-day-heading strong','.lektrus-calendar-day-heading span'];
   const elements=checks.flatMap(s=>all(s));
   const cb=box(calendar); const bounds=elements.map(box);
   return {hub:box(hub),calendar:cb,aside:box(aside),tiles:all('.lectris-hub-tile').map(box),
    outside:bounds.filter(b=>b.x<cb.x-1||b.right>cb.right+1||b.y<cb.y-1||b.bottom>cb.bottom+1),
    overlap:bounds.flatMap((a,i)=>bounds.slice(i+1).filter(b=>intersect(a,b)>1)),
    scrollWidth:document.documentElement.scrollWidth,viewport:innerWidth,
    columns: getComputedStyle(one('.lectris-hub-columns')).gridTemplateColumns};
  })()`);
  for(const [width,height] of [[1440,900],[1100,850],[960,900],[860,760],[740,850],[390,844],[320,640],[960,900]]){
   await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
   await delay(220);
   const s=await snapshot();
   assert.ok(s.calendar.w>=s.aside.w-2,`Calendar uses only part of aside at ${width}: ${JSON.stringify(s)}`);
   assert.ok(s.outside.length===0&&s.overlap.length===0,`Calendar controls collide at ${width}: ${JSON.stringify(s)}`);
   assert.ok(s.scrollWidth<=s.viewport+1,`Horizontal page overflow at ${width}`);
   if(s.hub.w<=740)assert.equal(s.columns.split(' ').length,1,`Narrow workspace must stack: ${width}`);
   console.log(`✓ Home ${width}×${height}, content ${Math.round(s.hub.w)}px, calendar ${Math.round(s.calendar.w)}px: no overflow/overlap`);
  }
  await click('.lectris-collapse-button');
  await delay(250);
  const collapsed=await snapshot();
  assert.ok(!collapsed.outside.length&&!collapsed.overlap.length,'Collapsed sidebar: calendar overlap');
  console.log('✓ Home sidebar collapse: no overlap');
 }else{

 // Initial lesson must actually render the board with math, text and table objects.
 await wait('document.querySelectorAll(".board-object[data-object]").length>=8',
  "Mathematics demo did not render its objects");
 for(const type of ["text","sticky","formula","table","graph"])
  assert.ok(await evaluate(`!!document.querySelector(".board-object.object-${type}")`),
   "Board lost "+type+" objects");
 console.log("✓ Demo board: math lessons and five object types rendered");

 // A fresh profile zooms with the wheel; the alternate mode and reset must
 // work immediately, and the selected mode is kept across reloads.
 const openControls=async()=>{
  await wait('!!document.querySelector(".lectris-layout-picker summary")',"Board settings menu not ready");
  await click('.lectris-layout-picker summary');
  await click('.lectris-interface-settings-entry');
  await wait('!!document.querySelector(".lektrus-control-settings")',"Control settings did not open");
 };
 const modes=()=>evaluate(`[...document.querySelectorAll('.lektrus-controls-modes button')].map(b=>({label:b.querySelector('b').textContent.slice(2),active:b.getAttribute('aria-pressed')==='true'}))`);
 const closeControls=()=>click('.lektrus-control-settings footer button.primary');
 const wheel=async(modifiers=0)=>{
  const b=await rect('section.board');
  await call('Input.dispatchMouseEvent',{type:'mouseWheel',x:b.x,y:b.y,deltaX:0,deltaY:-120,modifiers});
  await delay(250);
 };
 const zoomLabel=()=>evaluate("document.querySelector('.zoom-value').textContent.trim()");
 await openControls();
 assert.deepEqual(await modes(),[{label:'Масштаб',active:true},{label:'Прокрутка',active:false}]);
 await closeControls();
 await click('.zoom-value');
 await wheel();
 assert.notEqual(await zoomLabel(),'100%','Default wheel must zoom');
 await click('.zoom-value');
 await wheel(2);
 assert.equal(await zoomLabel(),'100%','Ctrl + wheel in zoom mode must pan');
 await openControls();
 await click('.lektrus-controls-modes button:nth-child(2)');
 await closeControls();
 // Page.reload can resolve before the previous document is replaced. Do not
 // accept its already-rendered objects as proof of a completed reload.
 const reloaded=new Promise((resolve,reject)=>{
  const listener=event=>{
   if(JSON.parse(event.data).method!=="Page.loadEventFired")return;
   clearTimeout(timer);socket.removeEventListener("message",listener);resolve();
  };
  const timer=setTimeout(()=>{socket.removeEventListener("message",listener);reject(new Error("Reload did not finish"))},30000);
  socket.addEventListener("message",listener);
 });
 await call('Page.reload');
 await reloaded;
 await wait('document.querySelectorAll(".board-object[data-object]").length>=8','Board did not reload');
 await openControls();
 assert.equal((await modes())[1].active,true,'Explicit scroll preference must survive reload');
 await closeControls();
 await click('.zoom-value');
 await wheel();
 assert.equal(await zoomLabel(),'100%','Scroll mode must preserve zoom');
 await wheel(2);
 assert.notEqual(await zoomLabel(),'100%','Ctrl + wheel must zoom in scroll mode');
 await openControls();
 await click('.lektrus-control-settings footer button:first-child');
 assert.equal((await modes())[0].active,true,'Reset must choose zoom mode');
 await closeControls();
 await click('.zoom-value');
 console.log('✓ Wheel modes: zoom first/default, Ctrl reverses action, persistence and reset');

 // The narrow split-screen viewport used to stretch a notice from top to bottom.
 // Repeated messages must restart their own three-second lifetime.
 await call("Emulation.setDeviceMetricsOverride",{width:960,height:850,deviceScaleFactor:1,mobile:false});
 const key=async(code,ctrlKey=false)=>evaluate(`window.dispatchEvent(new KeyboardEvent("keydown",{code:${JSON.stringify(code)},ctrlKey:${ctrlKey},bubbles:true,cancelable:true}))`);
 await key("KeyA",true);
 await wait('document.querySelectorAll(".board-object.selected").length>0',"Select all for notice regression");
 await key("KeyC",true);
 const noticeSelector=".board-system-notice";
 await wait(`document.querySelector('${noticeSelector}')?.textContent.includes('Скопировано объектов')`,"Copy notice did not appear");
 const compactNotice=await evaluate(`(() => {const el=document.querySelector('${noticeSelector}');const r=el.getBoundingClientRect();return {height:r.height,width:r.width,top:getComputedStyle(el).top,bottom:getComputedStyle(el).bottom}})()`);
 assert.ok(compactNotice.height<100&&compactNotice.width<=380,JSON.stringify(compactNotice));
 await evaluate(`(() => {window.firstNotice=document.querySelector('${noticeSelector}');return true})()`);
 await delay(1700);
 await key("KeyC",true);
 await wait(`document.querySelector('${noticeSelector}')!==window.firstNotice&&!!document.querySelector('${noticeSelector}')`,"Identical new notice did not restart its lifetime");
 await delay(1500);
 assert.ok(await evaluate(`!!document.querySelector('${noticeSelector}')`),"Previous timer removed the replacement notice");
 await wait(`(() => {const e=document.querySelector('${noticeSelector}');return e&&Number(getComputedStyle(e).opacity)<1&&Number(getComputedStyle(e).opacity)>0})()`,"Notice did not fade",2000);
 await wait(`!document.querySelector('${noticeSelector}')`,"Notice did not auto-dismiss",1000);
 await key("KeyC",true);
 await wait(`!!document.querySelector('${noticeSelector}')`,"Notice did not reappear");
 await click(`${noticeSelector} button`);
 await wait(`!document.querySelector('${noticeSelector}')`,"Manual close failed");
 await key("Escape");
 // Selection must stay in camera coordinates even after native focus tries
 // to scroll a deeply positioned object into view. The open layer dock must
 // remain above the canvas and be excluded from Fit Selection.
 await click('.topbar-more-trigger');
 await evaluate(`[...document.querySelectorAll('.topbar-more-menu button')].find(b=>b.textContent.includes('Слои и объекты'))?.click()`);
 await wait('!!document.querySelector(".layers-panel")',"Layers panel did not open");
 await click('.layer-main:has(.layer-kind-graph)');
 await click('button[aria-label="Приблизить выделение"]');
 await wait(`(() => {const e=document.querySelector('.screen-transform-overlay'),p=document.querySelector('.layers-panel'),b=document.querySelector('.board');if(!e||!p||!b)return false;const a=e.getBoundingClientRect(),d=p.getBoundingClientRect(),c=b.getBoundingClientRect();return a.right<d.left&&a.top>=c.top+57;})()`,"Selection overlaps the layers dock or upper toolbar");
 const cameraScroll=await evaluate(`(() => {const b=document.querySelector('.board');b.scrollTop=94;b.scrollLeft=90;return {x:b.scrollLeft,y:b.scrollTop,isolated:getComputedStyle(b).isolation};})()`);
 assert.deepEqual(cameraScroll,{x:0,y:0,isolated:'isolate'},"Native scroll must not shift board selection or cover application chrome");
 await click('button[aria-label="Закрыть слои"]');
 await key("Escape");
 await click('.zoom-value');
 console.log("✓ Board camera: selection fits visible dock area, native focus cannot scroll the canvas");
 await call("Emulation.clearDeviceMetricsOverride");
 console.log("✓ Board notice: compact at 960px, repeated timer restarts, fades after three seconds, manual close");

 if(!process.argv.includes("--notice-only")){

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

 // Verify durable content, not simply a loaded demo seed.
 await wait(`(() => {
  const records=Object.keys(localStorage).filter(k=>k.startsWith("lesson-board.document.v1.board."))
   .map(k=>{try{return JSON.parse(localStorage.getItem(k))}catch{return null}});
  return records.some(d=>d?.items?.find(item=>item.id==="math-note"&&item.x>130));
 })()`,"Dragged sticky did not persist in local storage",9000);
 // A reload without capture=1 must retain the student's changes.
 await call("Page.navigate",{url:url.replace("&capture=1","")});
 await wait('!!document.querySelector(\'[data-object="math-note"]\')',
  "Reloaded board did not restore its objects");
 await wait(`(() => {
  const r=document.querySelector('[data-object="math-note"]')?.getBoundingClientRect();
  return r&&r.left>${before.left+30};
 })()`,"Reload lost the sticky position");
 console.log("✓ Persistence: moved object restored after page reload");

 // Real pencil gesture. Its points must reach the persistent document.
 await click('.toolbar-pinned button[aria-label^="Карандаш"]');
 await wait('document.querySelector("section.board")?.classList.contains("board-tool-pen")',
  "Pencil did not become the active tool");
 const canvasPoint=await evaluate(`(() => {
  const b=document.querySelector("section.board")?.getBoundingClientRect();
  if(!b)return null;
  const blocks=".board-object,button,input,select,textarea,[data-board-interactive],.toolbar,.board-controls,.selection-toolbar-screen";
  for(const fy of [0.81,0.72,0.91,0.58,0.25,0.13]){
   for(const fx of [0.38,0.55,0.78,0.21,0.67,0.89]){
    const x=Math.round(b.left+b.width*fx),y=Math.round(b.top+b.height*fy);
    const hit=document.elementFromPoint(x,y);
    if(hit?.closest("section.board")&&!hit.closest(blocks))
     return {x,y,tag:hit.tagName};
   }
  }
  return {error:"No unobstructed board point",rect:{left:b.left,top:b.top,width:b.width,height:b.height}};
 })()`);
 assert.ok(canvasPoint&&!canvasPoint.error,
  "Cannot locate unobstructed board drawing surface: "+JSON.stringify(canvasPoint));
 await mouse("mouseMoved",canvasPoint.x,canvasPoint.y);
 await mouse("mousePressed",canvasPoint.x,canvasPoint.y,{pressed:true});
 for(let dx=12;dx<=100;dx+=12)
  await mouse("mouseMoved",canvasPoint.x+dx,canvasPoint.y+Math.sin(dx/30)*12,{pressed:true});
 await mouse("mouseReleased",canvasPoint.x+100,canvasPoint.y);
 try{
  await wait('!!document.querySelector(".viewer-ink-canvas")',
   "Pencil gesture did not render an ink canvas",5000);
 }catch(error){
  const state=await evaluate(`(() => {
   const stored=Object.keys(localStorage).filter(k=>k.startsWith("lesson-board.document.v1.board."))
    .map(k=>{try{return JSON.parse(localStorage.getItem(k))}catch{return null}});
   const hit=document.elementFromPoint(${canvasPoint.x},${canvasPoint.y});
   return {tool:document.querySelector("section.board")?.className,
    hit:hit?.className?.baseVal??hit?.className,
    target:hit?.tagName,penSaved:stored.some(d=>d?.items?.some(i=>i.kind==="pen")),
    allCanvas:document.querySelectorAll("canvas").length,
    objects:document.querySelectorAll(".board-object").length};
  })()`);
  throw new Error(error.message+"; "+JSON.stringify({state,canvasPoint}));
 }
 await wait(`(() => {
  const records=Object.keys(localStorage).filter(k=>k.startsWith("lesson-board.document.v1.board."))
   .map(k=>{try{return JSON.parse(localStorage.getItem(k))}catch{return null}});
  return records.some(d=>d?.items?.some(item=>item.kind==="pen"&&item.points?.length>1));
 })()`,"Pencil stroke did not persist in the local board document",9000);
 await click('.toolbar-pinned button[aria-label^="Ластик"]');
 await wait('document.querySelector("section.board")?.classList.contains("board-tool-eraser")',
  "Eraser could not be activated");
 console.log("✓ Ink: real pencil stroke rendered and saved; eraser activates");

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
 }
 }
}finally{
 if(socket&&socket.readyState===WebSocket.OPEN)socket.close();
 if(chrome){chrome.kill();await delay(120)}
 if(profile)await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});
 await server.close();
}
