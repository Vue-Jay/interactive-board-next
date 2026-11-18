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
const keyboardOnly=process.argv.includes("--keyboard-only");
const landscapeOnly=process.argv.includes("--landscape-only");
const interfaceOnly=process.argv.includes("--interface-only");
if(homeOnly||keyboardOnly||landscapeOnly)process.env.VITE_LEKTRUS_LOCAL_TEST="true";
if(interfaceOnly){
 process.env.VITE_LEKTRUS_BACKEND="selfhost";
 delete process.env.VITE_LEKTRUS_API_ORIGIN;
}
const studioBoard="/board/00000000-0000-4000-8000-00000000a11a?layout-editor=1";
const studioUser={id:"00000000-0000-4000-8000-000000000001",email:"admin@example.test",user_metadata:{display_name:"Admin"},account_role:"teacher",teacher_status:"approved",is_admin:true};
let publishedLayout=null;
const server=await createServer({configFile:"./vite.config.ts",
 plugins:interfaceOnly?[{name:"interface-studio-fixture",configureServer(server){
  server.middlewares.use(async(req,res,next)=>{
   if(!req.url?.startsWith("/api/v1/"))return next();
   res.setHeader("Content-Type","application/json");
   if(req.url==="/api/v1/admin/interface-layout"&&req.method==="PUT"){
    let raw="";for await(const chunk of req)raw+=chunk;
    publishedLayout=JSON.parse(raw).layout;res.end('{"ok":true}');return;
   }
   if(req.url==="/api/v1/interface-layout"){res.end(JSON.stringify({layout:publishedLayout}));return;}
   if(req.url==="/api/v1/auth/me"){res.end(JSON.stringify(studioUser));return;}
   res.end("[]");
  });
 }}]:[],
 server:{host:"127.0.0.1",port:0,strictPort:false}});
let profile,chrome,socket;
const log=[];
try{
 await server.listen();
 const port=server.httpServer.address().port;
 const route=homeOnly||interfaceOnly||keyboardOnly||landscapeOnly?"/app":"/demo/board?scene=math&capture=1";
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
  if(result.exceptionDetails)throw new Error("Browser evaluation: "+(result.exceptionDetails.exception?.description||result.exceptionDetails.text));
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

 if(landscapeOnly){
  const viewport=async(width,height)=>{
   await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:2,mobile:true,screenOrientation:{type:height>width?'portraitPrimary':'landscapePrimary',angle:height>width?0:90}});
   await call('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});await delay(300);
  };
  await viewport(390,844);
  await wait('!!document.querySelector(".lektrus-calendar-grid")','Workspace did not render',30000);
  // Emulate a browser denying orientation lock to exercise the fallback.
  await evaluate(`Object.defineProperty(document,'fullscreenEnabled',{configurable:true,value:false});Object.defineProperty(screen.orientation,'lock',{configurable:true,value:async()=>{throw new Error('Orientation lock denied')}});true`);
  await click('.lectris-mobile-bottom button[aria-label="Доски"]');
  await wait('!!document.querySelector(".lectris-library-new")','Board library did not render');
  await click('.lectris-library-new');
  await wait('!!document.querySelector(".lektrus-create-dialog")','Create board dialog did not render');
  const titleInput=await rect('.lektrus-create-dialog input');
  await call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:titleInput.x,y:titleInput.y,id:1}]});
  await call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await call('Input.insertText',{text:'Landscape browser QA'});
  assert.equal(await evaluate('document.activeElement.value'),'Landscape browser QA','Title input must remain focused before submit');
  await evaluate(`(()=>{window.__loaderFrames=[];window.__sampleLoader=true;window.__createSubmitEvents=0;document.querySelector('.lektrus-create-dialog').addEventListener('submit',()=>window.__createSubmitEvents++);const sample=()=>{if(!window.__sampleLoader)return;const e=document.querySelector('.lektrus-browser-board-logical > .lektrus-board-loading');if(e)window.__loaderFrames.push([e.offsetWidth,e.offsetHeight]);requestAnimationFrame(sample)};requestAnimationFrame(sample)})()`);
  const submitButton=await rect('.lektrus-create-dialog button[type="submit"]');
  await call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:submitButton.x,y:submitButton.y,id:1}]});
  await call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  const boardReady='!!document.querySelector(".lektrus-browser-board-frame")?.contentDocument?.querySelector("section.board")';
  await wait(boardReady,'Landscape frame did not render the actual created board',45000);
  assert.equal(await evaluate('window.__createSubmitEvents'),1,'One touch must submit exactly once');
  const state=()=>evaluate(`(()=>{const f=document.querySelector('.lektrus-browser-board-frame'),w=f.contentWindow,d=f.contentDocument,r=f.getBoundingClientRect();return {width:w.innerWidth,height:w.innerHeight,rotated:f.parentElement.dataset.rotated==='true',bounds:[r.left,r.top,r.right,r.bottom],title:d.querySelector('.board-title')?.value,tool:d.querySelector('section.board')?.className}})()`);
  const first=await state();
  assert.equal(first.title,'Landscape browser QA');
  assert.equal(first.rotated,true);assert.ok(first.width>first.height,JSON.stringify(first));
  const loader=await evaluate('window.__sampleLoader=false;window.__loaderFrames');
  assert.ok(loader.length&&loader.every(([w,h])=>w>h),'First loader must be landscape: '+JSON.stringify(loader.slice(0,5)));
  await evaluate('window.__originalFrame=document.querySelector(".lektrus-browser-board-frame").contentWindow;window.__originalBoard=window.__originalFrame.document.querySelector("section.board");window.__boardPath=location.pathname');
  const point=async(selector)=>evaluate(`(()=>{const f=document.querySelector('.lektrus-browser-board-frame'),d=f.contentDocument,e=[...d.querySelectorAll(${JSON.stringify(selector)})].find(b=>b.getBoundingClientRect().width>0&&b.getBoundingClientRect().height>0&&d.elementFromPoint(b.getBoundingClientRect().x+b.getBoundingClientRect().width/2,b.getBoundingClientRect().y+b.getBoundingClientRect().height/2)?.closest(${JSON.stringify(selector)}));if(!e)return null;const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  const physical=async(points)=>evaluate(`(()=>{const f=document.querySelector('.lektrus-browser-board-frame'),r=f.getBoundingClientRect(),rotated=f.parentElement.dataset.rotated==='true';return ${JSON.stringify(points)}.map(p=>rotated?{x:r.right-p.y,y:r.top+p.x}:{x:r.left+p.x,y:r.top+p.y})})()`);
  const touch=async(points)=>{const mapped=await physical(points);await call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...mapped[0],id:1}]});for(const p of mapped.slice(1)){await call('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...p,id:1}]});await delay(30)}await call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await delay(250)};
  const pen=await point('nav.mobile-board-tools button[data-interface-control="pen"],.toolbar-pinned button[data-interface-control="pen"]');
  assert.ok(pen,'No visible pencil on the landscape board');await touch([pen]);
  await wait('document.querySelector(".lektrus-browser-board-frame").contentDocument.querySelector("section.board").classList.contains("board-tool-pen")','Rotated touch did not activate pencil');
  const path=await evaluate(`(()=>{const d=document.querySelector('.lektrus-browser-board-frame').contentDocument,b=d.querySelector('section.board').getBoundingClientRect();for(const fy of [.48,.6,.73,.35])for(const fx of [.35,.45,.55]){const p=Array.from({length:9},(_,i)=>({x:Math.round(b.left+b.width*fx)+10*i,y:Math.round(b.top+b.height*fy)}));if(p.every(q=>{const hit=d.elementFromPoint(q.x,q.y);return hit?.closest('section.board')&&!hit.closest('.board-object,button,input,textarea,.toolbar,.board-controls,.mobile-board-tools,.selection-toolbar-screen')}))return p}return null})()`);
  assert.ok(path,'Cannot find a clear drawing path');await touch(path);
  const storedPen=`(()=>{const key=Object.keys(localStorage).find(k=>k.endsWith(window.__boardPath.split('/').pop())&&k.includes('document'));try{return JSON.parse(localStorage.getItem(key))?.items?.find(i=>i.kind==='pen')}catch{return null}})()`;
  const ink=await wait(storedPen,'Real rotated touch stroke was not saved',15000);
  assert.ok(ink.points.length>1,'Incomplete stroke');
  const dx=ink.points.at(-1).x-ink.points[0].x,dy=ink.points.at(-1).y-ink.points[0].y;
  assert.ok(dx>40&&Math.abs(dy)<4,'A logical horizontal stroke was transposed: '+JSON.stringify({dx,dy}));
  console.log('✓ First loader horizontal; real rotated touch pencil drew logical horizontal ink');
  const select=await point('nav.mobile-board-tools button[data-interface-control="select"],.toolbar-pinned button[data-interface-control="select"]');
  assert.ok(select,'No visible select tool');await touch([select]);
  const zoom=()=>evaluate(`document.querySelector('.lektrus-browser-board-frame').contentDocument.querySelector('.zoom-value').textContent`);
  const beforeZoom=await zoom(),center=path[4];
  let pinch=await physical([{x:center.x-16,y:center.y},{x:center.x+16,y:center.y}]);
  await call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:pinch.map((p,id)=>({...p,id}))});
  for(let i=1;i<=9;i++){
   pinch=await physical([{x:center.x-16-i*4,y:center.y},{x:center.x+16+i*4,y:center.y}]);
   await call('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:pinch.map((p,id)=>({...p,id}))});await delay(35);
  }
  await call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await wait(`document.querySelector('.lektrus-browser-board-frame').contentDocument.querySelector('.zoom-value').textContent!==${JSON.stringify(beforeZoom)}`,'Two-finger pinch did not zoom the rotated board');
  const title=await point('.board-title');assert.ok(title,'Board title inaccessible while rotated');await touch([title]);
  const titleFocused=`(()=>{const d=document.querySelector('.lektrus-browser-board-frame').contentDocument;return d.activeElement===d.querySelector('.board-title')})()`;
  await wait(titleFocused,'Rotated touch did not focus the title field');
  await call('Input.insertText',{text:'!'});
  const edited=await evaluate(`document.querySelector('.lektrus-browser-board-frame').contentDocument.querySelector('.board-title').value`);
  assert.ok(edited.includes('!'),'Real browser typing was not received inside landscape board');
  await touch([center]);await wait('!'+titleFocused,'Outside touch did not blur the title editor');
  assert.equal(await evaluate(`document.querySelector('.lektrus-browser-board-frame').contentDocument.querySelector('.board-title').value`),edited);
  console.log('✓ Real two-finger zoom, keyboard input and outside-tap dismissal in rotated board');
  // Emulate an unusually short IME viewport in the landscape frame. The
  // controls themselves are exercised using real rotated touch coordinates.
  for(const [kind,tool,field] of [
   ['checklist','button[aria-label^="Чек-лист / задание"]','.checklist-title-input input'],
   ['flashcard','button[aria-label^="Карточка вопрос–ответ"]','.flashcard-editor-compose textarea'],
   ['quiz','button[aria-label^="Вопрос / мини-тест"]','.quiz-question-editor textarea'],
   // Table is created immediately and can occupy the full zoomed-in board;
   // the other three create no object when Cancel is pressed.
   ['table','.lektrus-elements-data-action','.table-editor-grid textarea'],
  ]){
   const more=await point('.mobile-tools-more');assert.ok(more,'Tool catalogue unavailable');await touch([more]);
   await wait('!!window.__originalFrame.document.querySelector(".mobile-tools-sheet")','Tool catalogue did not open');
   await evaluate(`window.__originalFrame.document.querySelector('.mobile-tools-sheet '+${JSON.stringify(tool)}).scrollIntoView({block:'center'})`);
   const item=await point('.mobile-tools-sheet '+tool);assert.ok(item,kind+' catalogue tool inaccessible');await touch([item]);
   const empty=await evaluate(`(()=>{const d=window.__originalFrame.document,b=d.querySelector('section.board').getBoundingClientRect();for(const fy of [.48,.6,.73,.35])for(const fx of [.35,.45,.55,.7]){const p={x:b.left+b.width*fx,y:b.top+b.height*fy};const e=d.elementFromPoint(p.x,p.y);if(e?.closest('section.board')&&!e.closest('.board-object,button,input,textarea,.toolbar,.board-controls,.mobile-board-tools,.selection-toolbar-screen'))return p}return null})()`);
   assert.ok(empty,'No unobstructed editor placement');await touch([empty]);
   await wait(`!!window.__originalFrame.document.querySelector('.lektrus-touch-editor-portal .${kind}-editor-modal')`,kind+' touch editor did not open');
   await evaluate(`window.__originalFrame.document.querySelector(${JSON.stringify(field)}).scrollIntoView({block:'center'})`);
   const fieldPoint=await point(field);assert.ok(fieldPoint,kind+' input inaccessible');await touch([fieldPoint]);
   await call('Input.insertText',{text:'QA'});
   await evaluate(`(()=>{const w=window.__originalFrame,v=new w.EventTarget();Object.assign(v,{width:w.innerWidth,height:165,offsetLeft:0,offsetTop:0});Object.defineProperty(w,'visualViewport',{configurable:true,value:v});w.dispatchEvent(new w.Event('resize'))})()`);
   await wait(`window.__originalFrame.document.querySelector('.lektrus-touch-editor-portal').dataset.compactHeight==='true'`,kind+' editor ignored short viewport');
   const geometry=await evaluate(`(()=>{const d=window.__originalFrame.document,m=d.querySelector('.${kind}-editor-modal'),h=m.querySelector('.${kind}-editor-header').getBoundingClientRect(),f=m.querySelector('.${kind}-editor-footer').getBoundingClientRect();return {top:h.top,headerBottom:h.bottom,footerTop:f.top,bottom:f.bottom}})()`);
   assert.ok(geometry.top>=0&&geometry.bottom<=166&&geometry.footerTop-geometry.headerBottom>=42,kind+' keyboard viewport clipping: '+JSON.stringify(geometry));
   const header=await point('.'+kind+'-editor-header strong');assert.ok(header,kind+' clipped header');await touch([header]);
   await wait(`window.__originalFrame.document.activeElement!==window.__originalFrame.document.querySelector(${JSON.stringify(field)})`,kind+' outside touch did not blur input');
   await evaluate(`delete window.__originalFrame.visualViewport;window.__originalFrame.dispatchEvent(new window.__originalFrame.Event('resize'))`);
   if(kind==='checklist'){
    const rows=()=>evaluate(`window.__originalFrame.document.querySelectorAll('.checklist-editor-row').length`);
    assert.equal(await rows(),1,'Outside tap accidentally added a checklist row');
    await evaluate(`window.__originalFrame.document.querySelector('.checklist-add-row').scrollIntoView({block:'center'})`);
    const add=await point('.checklist-add-row');assert.ok(add,'Checklist add row inaccessible');await touch([add]);
    assert.equal(await rows(),2,'One touch must add exactly one checklist row');
   }
   const cancel=await point('.'+kind+'-editor-footer button.secondary'+(kind==='checklist'?':nth-child(3)':''));assert.ok(cancel,kind+' cancel inaccessible');await touch([cancel]);
   await wait(`!window.__originalFrame.document.querySelector('.${kind}-editor-modal')`,kind+' editor did not close');
   console.log('✓ '+kind+' editor: input, header and footer accessible with short landscape keyboard');
  }
  for(const [w,h,rotated] of [[844,390,false],[768,1024,true],[1024,768,false],[390,844,true]]){
   await viewport(w,h);
   await wait(`document.querySelector('.lektrus-browser-board-frame').parentElement.dataset.rotated===String(${rotated})`,'Incorrect orientation after physical rotation');
   const s=await state();assert.ok(s.width>s.height&&s.bounds[0]>=-1&&s.bounds[1]>=-1&&s.bounds[2]<=w+1&&s.bounds[3]<=h+1,JSON.stringify(s));
   assert.ok(await evaluate(`document.querySelector('.lektrus-browser-board-frame').contentWindow===window.__originalFrame&&window.__originalFrame.document.querySelector('section.board')===window.__originalBoard`),'Board remounted during rotation');
   assert.equal((await evaluate(storedPen)).id,ink.id);
   console.log(`✓ ${w}×${h}: landscape viewport, same board instance and retained ink`);
  }
  const back=await point('.board-home-button');assert.ok(back,'Back button unavailable');await touch([back]);
  // BoardApp may present a return confirmation; answer through the real UI.
  await wait('!document.querySelector(".lektrus-browser-board-frame")','Back action did not return to portrait workspace',15000);
  assert.ok(await evaluate('!document.documentElement.classList.contains("lektrus-browser-board-active")&&innerHeight>innerWidth'));
  const directPath=await evaluate('window.__boardPath');
  await call('Page.navigate',{url:new URL(directPath,url).href});
  await wait(boardReady,'Direct link did not reopen landscape board',45000);
  await evaluate(`window.__boardPath=${JSON.stringify(directPath)}`);
  assert.equal((await evaluate(storedPen)).id,ink.id);
  console.log('✓ Return to portrait workspace and direct-link reopen preserve saved ink');
  // Reproduce the old native WebView where CSS viewport units fail to
  // constrain the menu. Inline geometry must win over the legacy rule.
  await evaluate(`(()=>{const d=document.querySelector('.lektrus-browser-board-frame').contentDocument,s=d.createElement('style');s.id='legacy-menu-viewport';s.textContent='html body .topbar .topbar-right .topbar-more-menu[open]>.topbar-more-popover{max-height:none!important;overflow:visible!important}';d.head.append(s)})()`);
  const menu=await point('.topbar-more-menu>summary');assert.ok(menu,'Board actions menu unavailable');await touch([menu]);
  const menuGeometry=`(()=>{const f=document.querySelector('.lektrus-browser-board-frame'),element=f?.contentDocument?.querySelector('.topbar-more-menu[open] .topbar-more-popover');if(!element)return null;const r=element.getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,height:f.contentWindow.innerHeight,scrollable:element.scrollHeight>element.clientHeight,overflow:f.contentWindow.getComputedStyle(element).overflowY,inline:element.style.maxHeight,scrollTop:element.scrollTop}})()`;
  const menuBounds=await evaluate(menuGeometry);
  assert.ok(menuBounds&&menuBounds.top>=0&&menuBounds.bottom<=menuBounds.height+1&&menuBounds.scrollable&&menuBounds.overflow==='auto'&&menuBounds.inline.endsWith('px'),JSON.stringify(menuBounds));
  const scrollX=(menuBounds.left+menuBounds.right)/2;
  // Start in the middle, not at the physical browser/OS back-gesture edge.
  const scrollStart=menuBounds.top+(menuBounds.bottom-menuBounds.top)*.66,scrollEnd=menuBounds.top+28;
  assert.ok(await evaluate(`!!document.querySelector('.lektrus-browser-board-frame').contentDocument.elementFromPoint(${scrollX},${scrollStart})?.closest('.topbar-more-popover')`),'Menu is visually bounded but does not receive touches');
  await evaluate(`(()=>{window.__menuTouchTrace=[];sessionStorage.removeItem('qa-menu-touch');const d=document.querySelector('.lektrus-browser-board-frame').contentDocument;for(const type of ['pointerdown','pointermove','pointerup','pointercancel','click'])d.addEventListener(type,e=>{if(window.__menuTouchTrace.length<40){window.__menuTouchTrace.push({type,x:e.clientX,y:e.clientY,kind:e.pointerType,target:e.target.tagName,button:e.target.closest('button')?.textContent,menu:!!e.target.closest('.topbar-more-popover')});sessionStorage.setItem('qa-menu-touch',JSON.stringify(window.__menuTouchTrace))}},true)})()`);
  await touch(Array.from({length:9},(_,i)=>({x:scrollX,y:scrollStart+(scrollEnd-scrollStart)*i/8})));
  try{await wait(`(${menuGeometry})?.scrollTop>0`,'Rotated touch did not scroll the action menu',4000)}catch(e){console.log('Menu touch diagnostic',JSON.stringify({before:menuBounds,after:await evaluate(menuGeometry),path:await evaluate('location.pathname'),events:await evaluate('JSON.parse(sessionStorage.getItem("qa-menu-touch")||"[]")')}));throw e}
  await evaluate(`(()=>{const w=document.querySelector('.lektrus-browser-board-frame').contentWindow,v=new w.EventTarget();Object.assign(v,{width:w.innerWidth,height:185,offsetLeft:0,offsetTop:0});Object.defineProperty(w,'visualViewport',{configurable:true,value:v});w.dispatchEvent(new w.Event('resize'))})()`);
  await wait(`(${menuGeometry})?.bottom<=185`,'Menu did not adapt to a reduced visual viewport');
  await evaluate(`(()=>{const w=document.querySelector('.lektrus-browser-board-frame').contentWindow;delete w.visualViewport;w.document.querySelector('#legacy-menu-viewport').remove();w.dispatchEvent(new w.Event('resize'))})()`);
  console.log('✓ Rotated board menu fits even with legacy CSS viewport failure, scrolls by touch, and adapts to a reduced viewport');
  await call('Page.navigate',{url:new URL('/demo/board?scene=math',url).href});
  await wait(boardReady,'Public demo did not open in landscape',45000);
  const demoState=await state();assert.equal(demoState.rotated,true);assert.ok(demoState.width>demoState.height);
  console.log('✓ Public demo board uses the same landscape viewport');
 }else
 if(keyboardOnly){
  await wait('!!document.querySelector(".lektrus-calendar-grid")',"Application did not render",30000);
  // A fixture inside the actual app documents the shared startup behavior even
  // for canvas/gesture targets that suppress the browser's default focus change.
  await evaluate(`(()=>{const f=document.createElement('div');f.id='keyboard-fixture';f.style.cssText='position:fixed;inset:12px;z-index:2147483647;background:white;padding:12px;touch-action:none;display:flex;flex-direction:column;align-items:flex-start;gap:12px';f.innerHTML='<label for="qa-one">First</label><input id="qa-one" value="Retained" style="position:static;width:200px;height:40px"><textarea id="qa-two" style="position:static;width:200px;height:60px"></textarea><div id="qa-outside" style="width:200px;height:160px;touch-action:none">Outside</div>';document.body.append(f);f.querySelector('#qa-outside').addEventListener('pointerdown',e=>e.preventDefault());})()`);
  const tap=async(selector,dy=0)=>{const p=await rect(selector);assert.ok(await evaluate(`!!document.elementFromPoint(${p.x},${p.y})?.closest(${JSON.stringify(selector)})`),`Touch target obscured: ${selector}`);await call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:p.x,y:p.y,id:1}]});if(dy)await call('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:p.x,y:p.y+dy,id:1}]});await call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await delay(400);};
  const focused=()=>evaluate('document.activeElement.id');
  for(const [width,height] of [[390,844],[768,1024],[1024,768]]){
   await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:2,mobile:true});
   await call('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
   await delay(200);
   await tap('#qa-one');assert.equal(await focused(),'qa-one');
   await tap('#qa-two');assert.equal(await focused(),'qa-two','A different input must retain focus');
   await tap('label[for="qa-one"]');assert.equal(await focused(),'qa-one','A field label must retain focus');
   await tap('#qa-outside',40);assert.equal(await focused(),'qa-one','A drag must not dismiss the keyboard');
   await tap('#qa-outside');assert.notEqual(await focused(),'qa-one','An outside tap must dismiss the keyboard');
   assert.equal(await evaluate('document.querySelector("#qa-one").value'),'Retained');
   console.log(`✓ ${width}×${height}: outside tap, drag, field switch, label and preserved text`);
  }
  await evaluate(`document.querySelector('#keyboard-fixture').remove()`);
  // Reproduce the WebKit keyboard case: the layout viewport stays full size,
  // while the visual viewport shrinks. This is not a native keyboard test;
  // the Appium run independently taps the real button with the IME open.
  for(const [width,height,visibleHeight] of [[390,844,480],[768,1024,600],[1024,768,400]]){
   await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:2,mobile:true});
   await delay(200);
   await evaluate(`(()=>{const v=Object.assign(new EventTarget(),{width:${width},height:${height},offsetTop:0,offsetLeft:0,scale:1});Object.defineProperty(window,'visualViewport',{configurable:true,value:v});})()`);
   await evaluate(`document.querySelector('.lectris-mobile-bottom button[aria-label="Доски"],.lectris-nav-link[aria-label="Доски"]').click()`);
   await wait('!!document.querySelector(".lectris-library-new")','Board library did not open');
   await evaluate('document.querySelector(".lectris-library-new").click()');
   await wait('!!document.querySelector(".lektrus-create-dialog")','Create board dialog did not render');
   await evaluate(`visualViewport.height=${visibleHeight};visualViewport.dispatchEvent(new Event('resize'))`);
   await delay(200);
   const submit=await rect('.lektrus-create-dialog button[type="submit"]');
   assert.ok(submit.top>=0&&submit.bottom<=visibleHeight,`Create button obscured by keyboard: ${JSON.stringify(submit)}`);
   await tap('.lektrus-create-dialog>footer button[type="button"]');
   await wait('!document.querySelector(".lektrus-create-dialog")','Cancel action inaccessible');
   await evaluate('delete window.visualViewport');
   console.log(`✓ ${width}×${height}: create board footer stays above reduced visual viewport (${visibleHeight}px)`);
  }
  await evaluate(`(async()=>{const {mountPdfFixture}=await import('/scripts/qa-pdf-browser-fixture.tsx');window.__disposePdfFixture=mountPdfFixture();return true})()`);
  const pdfReady=()=>wait('document.querySelector(".lektrus-pdf-canvas-stage")?.dataset.pdfStatus==="ready"',"Embedded PDF page did not render",30000);
  const pdfPixel=()=>evaluate(`(()=>{const c=document.querySelector('.lektrus-pdf-canvas'); return Array.from(c.getContext('2d').getImageData(Math.floor(c.width/2),Math.floor(c.height/2),1,1).data)})()`);
  await pdfReady();assert.deepEqual(await pdfPixel(),[255,0,0,255],"Actual PDF first page pixels");
  for(const [width,height] of [[390,844],[768,1024],[1024,768]]){
   await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:2,mobile:true});
   await delay(200);
   const bounds=await rect('.lektrus-pdf-canvas');assert.ok(bounds.left>=0&&bounds.top>=0&&bounds.right<=width+1&&bounds.bottom<=height+1,JSON.stringify(bounds));
   await tap('.lektrus-pdf-page-controls button[aria-label="Следующая страница PDF"]');await pdfReady();assert.deepEqual(await pdfPixel(),[0,255,0,255],"Actual PDF second page pixels");
   await tap('.lektrus-pdf-page-controls button[aria-label="Предыдущая страница PDF"]');await pdfReady();assert.deepEqual(await pdfPixel(),[255,0,0,255],"Actual PDF first page after return");
   console.log(`✓ ${width}×${height}: PDF canvas rendered actual page pixels, touch pagination stays in viewport`);
  }
  const exportPixel=await evaluate(`(async()=>{const {renderPdfPageCanvas}=await import('/src/pdfPagination.ts');const blob=await fetch(document.querySelector('#pdf-fixture').dataset.source).then(r=>r.blob());const c=await renderPdfPageCanvas(blob,3);return Array.from(c.getContext('2d').getImageData(c.width>>1,c.height>>1,1,1).data)})()`);
  assert.deepEqual(exportPixel,[0,0,255,255],"PNG export rasterizer must render actual third-page pixels");
  console.log('✓ PDF rasterizer: actual third-page pixels for board PNG export');
  await evaluate('window.__disposePdfFixture()');
 }else
 if(interfaceOnly){
  const session={access_token:"test-admin-token",refresh_token:"test-refresh-token",expires_at:Math.floor(Date.now()/1000)+3600,user:studioUser};
  await call("Page.addScriptToEvaluateOnNewDocument",{source:`localStorage.setItem('lektrus.selfhost.session.v1',${JSON.stringify(JSON.stringify(session))})`});
  await call("Page.navigate",{url:new URL(studioBoard,url).href});
  await wait('!!document.querySelector(".lektrus-live-layout-actions")',"Admin interface studio did not open",30000);
  const select=async label=>evaluate(`[...document.querySelectorAll('.lektrus-live-layout-device-switch button')].find(b=>b.textContent===${JSON.stringify(label)}).click()`);
  const check=async(profile,width,height,touch)=>{
   await wait(`(()=>{const f=document.querySelector('.lektrus-layout-device-frame');return f?.contentDocument?.documentElement?.dataset.interfaceLayoutDevice===${JSON.stringify(profile)}&&getComputedStyle(f).visibility==='visible'&&!!f.contentDocument.querySelector('.workspace .board')})()`,"Real profile did not load: "+profile,30000);
   const state=await evaluate(`(()=>{const f=document.querySelector('.lektrus-layout-device-frame'),w=f.contentWindow,r=f.getBoundingClientRect(),dock=document.querySelector('.lektrus-live-layout-actions').getBoundingClientRect();return {width:w.innerWidth,height:w.innerHeight,coarse:w.matchMedia('(pointer:coarse)').matches,hover:w.matchMedia('(hover:hover)').matches,recursive:!!f.contentDocument.querySelector('.lektrus-live-layout-editor'),fits:r.bottom<=dock.top&&r.width<=w.innerWidth+1}})()`);
   assert.deepEqual(state,{width,height,coarse:touch,hover:!touch,recursive:false,fits:true},profile);
   const bounds=await evaluate(`(()=>{const d=document.querySelector('.lektrus-layout-device-frame').contentDocument;const b=d.querySelector('.board-home-button').getBoundingClientRect(),l=d.querySelector('.topbar-left').getBoundingClientRect(),h=d.querySelector('.topbar').getBoundingClientRect(),rail=d.querySelector('nav.mobile-board-tools')?.getBoundingClientRect();return {button:b.width>0&&b.left>=Math.max(l.left,h.left)-0.5&&b.right<=Math.min(l.right,h.right)+0.5&&b.top>=h.top&&b.bottom<=h.bottom,rail:rail?.left??null}})()`);
   assert.ok(bounds.button,profile+": board back button is clipped");
   if(touch&&width>height) assert.ok(bounds.rail>=10&&bounds.rail<=18,profile+": rail must be near the left safe edge: "+bounds.rail);
  };
  await select("ПК");await check("desktop",1920,1080,false);
  const target=await evaluate(`(()=>{const f=document.querySelector('.lektrus-layout-device-frame');const b=f.contentDocument.querySelector('.toolbar-pinned [data-interface-control="marker"]').getBoundingClientRect(),r=f.getBoundingClientRect(),k=r.width/f.clientWidth;return {x:r.left+(b.x+b.width/2)*k,y:r.top+(b.y+b.height/2)*k}})()`);
  await mouse("mousePressed",target.x,target.y,{pressed:true});
  await mouse("mouseMoved",target.x+36,target.y,{pressed:true});
  await mouse("mouseReleased",target.x+36,target.y);
  await select("Ноутбук");await check("laptop",1366,768,false);
  await select("Планшет");await check("tablet",1024,768,true);
  await evaluate(`[...document.querySelectorAll('.lektrus-live-layout-actions button')].find(b=>b.textContent.includes('Повернуть')).click()`);
  await check("tabletPortrait",768,1024,true);
  await select("Телефон");await check("phonePortrait",390,844,true);
  await evaluate(`[...document.querySelectorAll('.lektrus-live-layout-actions button')].find(b=>b.textContent.includes('Повернуть')).click()`);
  await check("phone",844,390,true);
  // Reproduce both physical landscape orientations, including a side system
  // navigation bar, and verify native insets are applied to actual controls.
  for(const [left,right,systemLeft,systemRight] of [[38,0,0,26],[0,38,26,0]]){
   const safe=await evaluate(`(()=>{const f=document.querySelector('.lektrus-layout-device-frame'),d=f.contentDocument,r=d.documentElement;r.classList.add('lektrus-native-app','lektrus-android-app');for(const [key,value] of Object.entries(${JSON.stringify({"cutout-left":left,"cutout-right":right,"system-left":systemLeft,"system-right":systemRight,"system-top":24})}))r.style.setProperty('--lektrus-'+key,value+'px');const b=d.querySelector('.board-home-button').getBoundingClientRect(),rail=d.querySelector('nav.mobile-board-tools').getBoundingClientRect(),z=d.querySelector('.board-controls').getBoundingClientRect();return {button:b.left,buttonTop:b.top,rail:rail.left,railTop:rail.top,railBottom:rail.bottom,zoomRight:z.right}})()`);
   assert.ok(safe.button>=Math.max(left,systemLeft)+7&&safe.buttonTop>=24,"Native back button crosses the safe area: "+JSON.stringify(safe));
   assert.ok(safe.rail>=Math.max(left,systemLeft)+10&&safe.railTop>=96&&safe.railBottom<=390,"Native rail crosses the safe area: "+JSON.stringify(safe));
   assert.ok(safe.zoomRight<=844-Math.max(right,systemRight)-11,"Native zoom crosses the safe area: "+JSON.stringify(safe));
  }
  await evaluate(`(()=>{const r=document.querySelector('.lektrus-layout-device-frame').contentDocument.documentElement;r.classList.remove('lektrus-native-app','lektrus-android-app');for(const key of ['cutout-left','cutout-right','system-left','system-right','system-top'])r.style.removeProperty('--lektrus-'+key)})()`);
  await select("ПК");await check("desktop",1920,1080,false);
  await click(".lektrus-live-layout-actions .primary");
  await wait('!document.querySelector(".lektrus-live-layout-editor")',"Published layout did not close editor",15000);
  assert.ok(publishedLayout?.controls?.desktop?.marker?.x>0,"Desktop marker move was not published");
  assert.equal(publishedLayout.controls.phone.marker.x,0,"Phone was changed by desktop edit");
  assert.equal(publishedLayout.controls.phonePortrait.marker.x,0,"Portrait was changed by desktop edit");
  console.log("✓ Actual device preview: six viewports, touch CSS media, independent profile placements, published API payload");
  process.exitCode=0;
 }else

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
  await click('.lectris-collapse-button');
  await call('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
  const sections=[
   ["Доски","boards",".lectris-library-intro"],
   ["Предметы","subjects",".lektrus-category-panel"],
   ["Группы и классы","groups",".lektrus-group-layout"],
   ["Ученики","students",".students-shell"],
   ["Задания","assignments",".assignments-shell"],
   ["Расписание","schedule",".schedule-shell"],
   ["Прогресс","progress",".progress-shell"],
   ["Материалы","materials",".materials-shell"],
   ["Шаблоны","templates",".templates-shell"],
   ["Уведомления","notifications",".notifications-shell"],
   ["Отзывы и предложения","feedback",".lektrus-feedback-screen"],
   ["Профиль","profile",".profile-only-shell"],
   ["Настройки","settings",".settings-shell"],
  ];
  const checkSection=async(id,selector)=>{
   await wait(`location.pathname==="/app"&&new URLSearchParams(location.search).get("section")===${JSON.stringify(id)}&&!!document.querySelector(${JSON.stringify(selector)})`,
    "Wrong workspace section: "+id);
  };
  for(const [label,id,selector] of sections){
   await click('.lectris-workspace-sidebar button[aria-label="'+label+'"]');
   await checkSection(id,selector);
   console.log('✓ Sidebar: '+label);
  }
  await click('.settings-plan-row button');
  await checkSection("billing",".billing-page");
  await click('.billing-head button');
  await checkSection("settings",".settings-shell");
  assert.ok(!await evaluate('document.querySelector(".settings-shell").textContent.includes("AI-студия")'),"AI assistant must be available only on the board");
  await evaluate('history.pushState({},"","/app?section=ai");dispatchEvent(new PopStateEvent("popstate"))');
  await checkSection("settings",".settings-shell");
  await click('.lectris-workspace-sidebar button[aria-label="Группы и классы"]');
  await checkSection("groups",".lektrus-group-layout");
  await click('.lektrus-category-create');
  await evaluate(`(()=>{const input=document.querySelector('.lektrus-category-form input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'QA draft');input.dispatchEvent(new Event('input',{bubbles:true}))})()`);
  await wait('!document.querySelector(".lektrus-category-form button[type=submit]").disabled',"Group name did not enable Add");
  await click('.lektrus-category-form button[type=button]');
  await click('.lectris-workspace-sidebar button[aria-label="Предметы"]');
  await checkSection("subjects",".lektrus-category-panel");
  await click('.lektrus-category-create');
  await wait('document.querySelector(".lektrus-category-form input").value===""&&document.querySelector(".lektrus-category-form button[type=submit]").disabled',"Cancelled group draft leaked into subject form");
  await click('.lektrus-category-form button[type=button]');
  await click('.lectris-brand');
  await wait('!!document.querySelector(".lektrus-calendar-grid")',"Home brand did not navigate");
  for(const [label,id,selector] of sections.filter(x=>["groups","students","subjects","assignments"].includes(x[1]))){
   await evaluate(`[...document.querySelectorAll(".lectris-hub-tile")].find(x=>x.textContent.includes(${JSON.stringify(label)})).click()`);
   await checkSection(id,selector);
   await click('.lectris-brand');
   await wait('!!document.querySelector(".lektrus-calendar-grid")',"Home did not reopen");
  }
  await click('.lectris-hub-section-head:not(.lektrus-calendar-head) button');
  await checkSection("boards",".lectris-library-intro");
  for(let i=1;i<=3;i++){
   await click('.lectris-library-filters button:nth-child('+i+')');
   await wait(`document.querySelector(".lectris-library-filters button:nth-child(${i})").getAttribute("aria-pressed")==="true"`,"Board filter did not select");
  }
  await click('.lectris-library-new');
  await wait('!!document.querySelector(".lektrus-create-dialog")',"Create board dialog did not open");
  await evaluate('[...document.querySelectorAll(".lektrus-create-dialog button")].find(b=>b.textContent.includes("Отмена")).click()');
  await wait('!document.querySelector(".lektrus-create-dialog")',"Create board dialog did not close");
  await click('.lectris-brand');
  await wait('!!document.querySelector(".lektrus-calendar-grid")',"Home did not reopen");
  await click('.lektrus-calendar-head button');
  await checkSection("schedule",".schedule-shell");
  const week=await evaluate('document.querySelector(".schedule-toolbar strong").textContent');
  await click('.schedule-toolbar button:last-child');
  await wait(`document.querySelector(".schedule-toolbar strong").textContent!==${JSON.stringify(week)}`,"Schedule next week did not change");
  await click('.schedule-toolbar button:nth-child(2)');
  await wait(`document.querySelector(".schedule-toolbar strong").textContent===${JSON.stringify(week)}`,"Today did not restore week");
  await click('.schedule-view-toggle button:nth-child(2)');
  await wait('document.querySelector(".schedule-view-toggle button:nth-child(2)").getAttribute("aria-pressed")==="true"',"Completed lessons filter did not activate");
  await click('.schedule-view-toggle button:first-child');
  await wait('document.querySelector(".schedule-view-toggle button:first-child").getAttribute("aria-pressed")==="true"',"Current lessons filter did not activate");
  await click('.schedule-shell .boards-create');
  await wait('!!document.querySelector(".schedule-modal")',"New lesson did not open");
  await click('.schedule-modal .access-head button');
  await wait('!document.querySelector(".schedule-modal")',"Lesson dialog did not close");
  await click('.lectris-workspace-sidebar button[aria-label="Прогресс"]');
  await wait('!!document.querySelector(".progress-tabs button")',"Progress tabs did not load");
  for(let i=1;i<=3;i++){
   await click('.progress-tabs button:nth-child('+i+')');
   await wait(`document.querySelector(".progress-tabs button:nth-child(${i})").getAttribute("aria-selected")==="true"`,"Progress tab did not select");
  }
  await click('.lectris-workspace-sidebar button[aria-label="Уведомления"]');
  await checkSection("notifications",".notifications-shell");
  await click('.notifications-shell .students-header>button');
  await wait('!!document.querySelector(".notification-settings")',"Notification settings did not open");
  await click('.notification-settings .access-head button');
  await wait('!document.querySelector(".notification-settings")',"Notification settings did not close");
  await click('.lectris-header-search');
  await wait('!!document.querySelector(".lectris-command-dialog")',"Command search did not open");
  await evaluate('[...document.querySelectorAll(".lectris-command-results button")].find(b=>b.textContent.includes("Шаблоны")).click()');
  await checkSection("templates",".templates-shell");
  await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false});
  await click('.lectris-mobile-bottom button[aria-label="Ещё разделы"]');
  await wait('!!document.querySelector(".lektrus-more-page")',"Mobile More did not open");
  await evaluate('[...document.querySelectorAll(".lektrus-more-page-item")].find(b=>b.textContent.includes("Настройки")).click()');
  await checkSection("settings",".settings-shell");
  console.log('✓ Desktop tiles, schedule controls, progress tabs, board-only AI routing, billing, notifications dialog, command search and mobile More');
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
 // The parser must inspect the document's real page tree, not merely allow
 // navigation up to an arbitrary maximum. Exercise the bundled worker.
 const pdfCounts=await evaluate(`(async()=>{
   const {getPdfPageCount}=await import('/src/pdfPagination.ts');
   const makePdf=count=>{
     const objects=['<< /Type /Catalog /Pages 2 0 R >>',
       '<< /Type /Pages /Kids ['+Array.from({length:count},(_,i)=>(i+3)+' 0 R').join(' ')+'] /Count '+count+' >>',
       ...Array.from({length:count},()=> '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] >>')];
     let pdf='%PDF-1.4\\n';const offsets=[0];
     objects.forEach((body,i)=>{offsets.push(pdf.length);pdf+=(i+1)+' 0 obj\\n'+body+'\\nendobj\\n'});
     const xref=pdf.length;
     pdf+='xref\\n0 '+offsets.length+'\\n0000000000 65535 f \\n'+offsets.slice(1).map(v=>String(v).padStart(10,'0')+' 00000 n \\n').join('')+'trailer\\n<< /Size '+offsets.length+' /Root 1 0 R >>\\nstartxref\\n'+xref+'\\n%%EOF\\n';
     return new Blob([pdf],{type:'application/pdf'});
   };
   return [await getPdfPageCount(makePdf(1)),await getPdfPageCount(makePdf(3))];
 })()`);
 assert.deepEqual(pdfCounts,[1,3],"Real PDF page count must be read by the worker");
 console.log("✓ PDF: actual one- and three-page documents parsed");

 // Clicking the top bar while the Layers dock is open must hit the actual menu.
 await click('.topbar-more-trigger');
 await evaluate(`[...document.querySelectorAll('.topbar-more-menu button')].find(b=>b.textContent.includes('Слои и объекты'))?.click()`);
 await wait('!!document.querySelector(".layers-panel")',"Layers panel did not open");
 await click('.topbar-more-trigger');
 assert.ok(await evaluate(`(() => {
 const menu=document.querySelector('.topbar-more-popover'),layers=document.querySelector('.layers-panel');
 const m=menu.getBoundingClientRect(),l=layers.getBoundingClientRect();
 const left=Math.max(m.left,l.left),right=Math.min(m.right,l.right),top=Math.max(m.top,l.top),bottom=Math.min(m.bottom,l.bottom);
 return left<right&&top<bottom&&!!document.elementFromPoint((left+right)/2,(top+bottom)/2)?.closest('.topbar-more-popover');
 })()`),"Open menu is occluded by the layer panel");
 await click('.topbar-more-trigger');
 await click('button[aria-label="Закрыть слои"]');
 console.log("✓ Board menu appears above layer panel");


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

 // Reproduce the reported triangle-label overlap in a real SVG, using actual
 // rendered glyph bounds (not just the geometry model's estimated text size).
 await call("Page.navigate",{url:url.replace("scene=math","scene=geometry")});
 await wait('!!document.querySelector(\'[data-object="geo-triangle"] .graph-polygon\')',"Geometry demo did not render");
 const labelLayout=await evaluate(`(() => {
  const item=document.querySelector('[data-object="geo-triangle"]');
  const polygon=item.querySelector('.graph-polygon');
  const labels=[...item.querySelectorAll('.graph-point text')];
  return {count:labels.length,overlaps:labels.filter(t=>{
   const b=t.getBBox();
   return [[b.x,b.y],[b.x+b.width,b.y],[b.x,b.y+b.height],[b.x+b.width,b.y+b.height],[b.x+b.width/2,b.y+b.height/2]]
    .some(([x,y])=>polygon.isPointInFill(new DOMPoint(x,y)));
  }).map(t=>t.textContent)};
 })()`);
 assert.deepEqual(labelLayout,{count:3,overlaps:[]},"Triangle vertex text overlaps the shape");
 console.log("✓ Geometry: actual triangle vertex glyphs outside the figure");

 await click('button[aria-label="Таблицы и диаграммы"]');
 await wait('!![...document.querySelectorAll("button")].find(b=>b.textContent.includes("Диаграмма")&&b.textContent.includes("Столбцы"))',"Chart tool unavailable");
 await evaluate('[...document.querySelectorAll("button")].find(b=>b.textContent.includes("Диаграмма")&&b.textContent.includes("Столбцы")).click()');
 await wait('!!document.querySelector(".lektrus-data-chart-dialog")',"Chart editor unavailable");
 await evaluate(`(() => {
  const d=document.querySelector('.lektrus-data-chart-dialog');
  const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
  const set=(selector,value)=>{const input=d.querySelector(selector);setter.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));};
  set('input[placeholder="Название диаграммы"]','Температура');
  set('input[aria-label="Категория 1"]','Январь');
  set('input[aria-label="Значение 1"]','-10');
  set('input[aria-label="Категория 2"]','Июнь');
  set('input[aria-label="Значение 2"]','20');
 })()`);
 await wait('document.querySelector(\'.lektrus-data-chart-dialog input[aria-label="Значение 1"]\')?.value==="-10"',"Negative data was clamped");
 await evaluate('[...document.querySelectorAll(".lektrus-data-chart-types button")].find(b=>b.textContent==="Круговая").click()');
 await click('.lektrus-data-chart-dialog footer .primary');
 await wait('!!document.querySelector(".lektrus-data-chart-error")',"Invalid negative pie chart accepted");
 await evaluate('[...document.querySelectorAll(".lektrus-data-chart-types button")].find(b=>b.textContent==="Линия").click()');
 await click('.lektrus-data-chart-dialog footer .primary');
 await wait('!!document.querySelector(\'.board-object .lektrus-data-chart[aria-label*="-10"]\')',"Negative chart data lost on save");
 console.log("✓ Chart: negative values preserved, pie validation and actual line chart save");
 console.log("Lektrus release smoke passed: actual browser interactions and curated subjects.");
 }
 }
}finally{
 if(socket&&socket.readyState===WebSocket.OPEN)socket.close();
 if(chrome){chrome.kill();await delay(120)}
 if(profile)await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});
 await server.close();
}
