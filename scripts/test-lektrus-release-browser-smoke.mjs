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
const pwaOnly=process.argv.includes("--pwa-only");
const keyboardOnly=process.argv.includes("--keyboard-only");
const tabletToolsOnly=process.argv.includes("--tablet-tools-only");
const landscapeOnly=process.argv.includes("--landscape-only")||tabletToolsOnly;
const interfaceOnly=process.argv.includes("--interface-only");
const educationOnly=process.argv.includes("--education-only");
if(homeOnly||keyboardOnly||landscapeOnly||pwaOnly)process.env.VITE_LEKTRUS_LOCAL_TEST="true";
if(interfaceOnly||educationOnly){
 process.env.VITE_LEKTRUS_BACKEND="selfhost";
 delete process.env.VITE_LEKTRUS_API_ORIGIN;
}
const studioBoard="/board/00000000-0000-4000-8000-00000000a11a?layout-editor=1";
const studioUser={id:"00000000-0000-4000-8000-000000000001",email:"admin@example.test",user_metadata:{display_name:"Admin"},account_role:"teacher",teacher_status:"approved",is_admin:true};
let publishedLayout=null;
const linkedTeacher="00000000-0000-4000-8000-000000000002";
const linkedBoard="00000000-0000-4000-8000-000000000003";
let assignmentFailure=false;
const educationRows=[
 {id:"outgoing",teacher_id:studioUser.id,student_id:linkedTeacher,teacher_name:"Admin",student_name:"Ученик Тест",title:"Выданное задание",description:"",board_id:null,max_score:10,created_at:"2026-11-21T10:00:00Z",submissions:null},
 {id:"incoming",teacher_id:linkedTeacher,student_id:studioUser.id,teacher_name:"Учитель Тест",student_name:"Admin",title:"Полученное задание",description:"",board_id:linkedBoard,max_score:10,created_at:"2026-11-21T10:00:00Z",submissions:null},
];
const server=await createServer({configFile:"./vite.config.ts",
 plugins:educationOnly?[{name:"education-api-fixture",configureServer(server){
  server.middlewares.use((req,res,next)=>{
   const path=req.url?.split('?')[0];if(!path?.startsWith("/api/v1/"))return next();
   res.setHeader("Content-Type","application/json");
   const send=(value,status=200)=>{res.statusCode=status;res.end(JSON.stringify(value))};
   if(path==="/api/v1/health")return send({ok:true,service:"lektrus-selfhost"});
   if(path==="/api/v1/maintenance")return send({state:"off",access_allowed:true});
   if(path==="/api/v1/auth/me")return send(studioUser);
   if(path==="/api/v1/boards"||path==="/api/v1/students")return send({detail:"Fixture unavailable"},503);
   if(path==="/api/v1/assignments")return assignmentFailure?send({detail:"Fixture unavailable"},503):send(educationRows);
   if(path==="/api/v1/teachers")return send([{user_id:linkedTeacher,name:"Учитель Тест",boards:[{id:linkedBoard,title:"Математика"}]}]);
   if(path==="/api/v1/account/profile")return send({display_name:"Admin",theme:"light",compact_ui:true,default_board_zoom:100});
   if(path==="/api/v1/organization")return send({categories:[],boards:[]});
   if(path==="/api/v1/interface-layout")return send({layout:null});
   return send([]);
  });
 }}]:interfaceOnly?[{name:"interface-studio-fixture",configureServer(server){
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
 }}]:[{name:"qa-release-board-fixture-only",transform(code,id){
  if(id.endsWith("/src/App.tsx"))return code.replace('import("./PublicDemoBoard")','import("../scripts/qa-release-board-fixture")');
 }}],
 server:{host:"127.0.0.1",port:0,strictPort:false}});
let profile,chrome,socket;
const log=[];
try{
 await server.listen();
 const port=server.httpServer.address().port;
 const route=homeOnly||interfaceOnly||educationOnly||keyboardOnly||landscapeOnly||pwaOnly?"/app":"/demo/board?qa-release-fixture=1&scene=math&capture=1";
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
 const mouse=async(type,x,y,{pressed=false,clickCount=1}={})=>call("Input.dispatchMouseEvent",{
  type,x,y,
  button:pressed||type==="mouseReleased"?"left":"none",
  buttons:pressed?1:0,
  clickCount:type==="mousePressed"||type==="mouseReleased"?clickCount:0
 });
 await call("Runtime.enable");
 await call("Page.enable");
 const inkDockGeometry=`(()=>{const w=window.__originalFrame||window,d=w.document,p=d.querySelector('.lectris-quick-properties.is-ink-properties');if(!p)return null;const r=p.getBoundingClientRect(),board=d.querySelector('section.board')?.getBoundingClientRect(),bounds=s=>{const b=d.querySelector(s)?.getBoundingClientRect();return b?.width&&b.height?b:null},overlaps=b=>b&&r.left<b.right&&r.right>b.left&&r.top<b.bottom&&r.bottom>b.top;return {width:r.width,height:r.height,gap:w.innerHeight-r.bottom,left:r.left,right:r.right,screen:w.innerWidth,upper:p.dataset.inkUpperRow,canvasClearance:board?r.top-board.bottom:null,docks:d.querySelectorAll('.lectris-quick-properties.is-ink-properties').length,topDocks:d.querySelectorAll('.ink-settings.lektrus-ink-settings-direct').length,overlap:Boolean(overlaps(bounds('.board-controls'))||overlaps(bounds('.minimap'))||overlaps(bounds('nav.mobile-board-tools'))),widths:[...p.querySelectorAll('.lektrus-ink-width-button')].map(b=>{const q=b.getBoundingClientRect();return q.width>=36&&q.height>=38&&b.contains(d.elementFromPoint(q.x+q.width/2,q.y+q.height/2))})}})()`;
 const assertInkDock=(dock,wide)=>{
  assert.ok(dock&&dock.docks===1&&dock.topDocks===0&&dock.width<=Math.min(530,dock.screen-10)&&dock.height<=112&&!dock.overlap&&dock.canvasClearance>=-2&&dock.left>=0&&dock.right<=dock.screen&&dock.widths.length===5&&dock.widths.every(Boolean),JSON.stringify(dock));
  if(wide)assert.ok(dock.gap<=90,'Ink dock too high: '+JSON.stringify(dock));
 };

 if(pwaOnly){
  await call("Emulation.setUserAgentOverride",{userAgent:"Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36",platform:"Linux armv8l"});
  await call("Emulation.setDeviceMetricsOverride",{width:390,height:844,deviceScaleFactor:2,mobile:true});
  await call("Emulation.setTouchEmulationEnabled",{enabled:true,maxTouchPoints:5});
  // Suppress real browser install events so the QA case controls their timing.
  await call("Page.addScriptToEvaluateOnNewDocument",{source:`window.addEventListener("beforeinstallprompt",event=>{if(event.isTrusted){event.preventDefault();event.stopImmediatePropagation()}},true);Object.defineProperty(navigator,"getInstalledRelatedApps",{configurable:true,value:async()=>sessionStorage.getItem("qa-pwa-existing")==="1"?[{platform:"webapp",url:"https://lektrus.ru/manifest.webmanifest"}]:[]})`});
  const waitPwa=async(expression,message,timeout=30000)=>{
   const deadline=Date.now()+timeout;
   while(Date.now()<deadline){try{if(await evaluate(expression))return}catch{} await delay(100)}
   throw new Error(message);
  };
  const homeAt=async(stage)=>{
   const pageUrl=`http://127.0.0.1:${port}/app?qa-pwa-stage=${stage}`;
   await call("Page.navigate",{url:pageUrl});
   await waitPwa(`location.href===${JSON.stringify(pageUrl)}&&!!document.querySelector(".lektrus-calendar-grid")`,"PWA workspace did not render");
  };
  const signal=(outcome)=>evaluate(`(()=>{window.dispatchEvent(Object.assign(new Event("beforeinstallprompt",{cancelable:true}),{prompt:async()=>{},userChoice:Promise.resolve({outcome:${JSON.stringify(outcome)}})}));return true})()`);
  const offer='!!document.querySelector(".lektrus-pwa-offer")';
  const feedback='!!document.querySelector(".lektrus-pwa-feedback")';
  await homeAt("fresh");
  assert.equal(await evaluate(offer),false,"no automatic offer without a browser install signal");
  await signal("accepted");
  await wait(offer,"Mobile installation offer did not appear");
  await click(".lektrus-pwa-offer .lektrus-pwa-install-action");
  await wait(feedback,"Success notification disappeared with the offer");
  assert.equal(await evaluate(offer),false,"offer disappears immediately after accepted installation");
  assert.match(await evaluate('document.querySelector(".lektrus-pwa-feedback")?.textContent'),/Приложение установлено/);
  const bounds=await rect(".lektrus-pwa-feedback");
  assert.ok(bounds.left>=0&&bounds.right<=390&&bounds.top>=0&&bounds.bottom<=844,"toast must fit mobile viewport");
  await wait("!"+feedback,"success notification did not expire",6000);
  await homeAt("returning");
  assert.equal(await evaluate(offer),false,"installed PWA must not be offered on repeat visit");
  assert.equal(await evaluate(feedback),false,"no fake success on reload");
  // Discover an earlier installation even without a local stored marker.
  await evaluate('localStorage.removeItem("lektrus.pwa-installed.v1");sessionStorage.setItem("qa-pwa-existing","1")');
  await homeAt("existing");
  await waitPwa('localStorage.getItem("lektrus.pwa-installed.v1")==="1"',"related app detection did not remember existing installation");
  assert.equal(await evaluate(offer),false,"related-app detection suppresses the prompt");
  assert.equal(await evaluate(feedback),false,"detection does not announce a new installation");
  console.log("✓ PWA workspace: accepted install, visible success notification, expiry, persisted install and existing app detection");
  // The website shares the same state but has its own independent entry root.
  await evaluate('localStorage.removeItem("lektrus.pwa-installed.v1");sessionStorage.removeItem("qa-pwa-existing")');
  await call("Page.navigate",{url:`http://127.0.0.1:${port}/`});
  await waitPwa('location.pathname==="/"&&!!document.querySelector(".marketing-actions .lektrus-pwa-button-wrap button")',"Public site install button did not render");
  await signal("accepted");
  await click(".marketing-actions .lektrus-pwa-button-wrap button");
  await wait(feedback,"Public site missing success notification");
  assert.equal(await evaluate('!!document.querySelector(".marketing-actions .lektrus-pwa-button-wrap button")'),false);
  console.log("✓ PWA public site: successful installation confirmation survives button removal");
 }else if(landscapeOnly){
  const viewport=async(width,height)=>{
   await call('Emulation.setDeviceMetricsOverride',{width,height,screenWidth:width,screenHeight:height,deviceScaleFactor:2,mobile:true,screenOrientation:{type:height>width?'portraitPrimary':'landscapePrimary',angle:height>width?0:90}});
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
  const touch=async(points)=>{const mapped=await physical(points);await call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...mapped[0],id:1}]});if(mapped.length>1)await delay(100);for(const p of mapped.slice(1)){await call('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...p,id:1}]});await delay(30)}await call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await delay(250)};
  if(tabletToolsOnly){
   const boardExpr=expression=>`(()=>{const f=document.querySelector('.lektrus-browser-board-frame'),d=f.contentDocument,w=f.contentWindow;return (${expression})})()`;
   const boardEval=expression=>evaluate(boardExpr(expression));
   const boardWait=(expression,message)=>wait(boardExpr(expression),message);
   const tap=async selector=>{const p=await point(selector);assert.ok(p,"Inaccessible tool: "+selector);await touch([p])};
   const plus='nav.mobile-board-tools .mobile-tools-more';
   const groups=".mobile-tools-groups";
   const close='.mobile-tools-sheet-head button[aria-label="Закрыть"]';
   const catalogue=()=>boardEval(`[...d.querySelectorAll('.mobile-tools-group')].map(g=>({label:g.querySelector('span').textContent,tools:[...g.querySelectorAll('button')].map(b=>b.getAttribute('aria-label')||b.textContent.trim())}))`);
   const swipe=async selector=>{
    const region=await boardEval(`(()=>{const s=d.querySelector(${JSON.stringify(selector)}),r=s.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height*.76,distance:r.height*.55,top:s.scrollTop,max:s.scrollHeight-s.clientHeight,hit:!!d.elementFromPoint(r.x+r.width/2,r.y+r.height*.76)?.closest(${JSON.stringify(selector)})}})()`);
    assert.ok(region.max>10&&region.hit,'No scrollable touch area: '+JSON.stringify(region));
    await touch(Array.from({length:9},(_,i)=>({x:region.x,y:region.y-region.distance*i/8})));
    await boardWait(`d.querySelector(${JSON.stringify(selector)}).scrollTop>${region.top}`,'Real swipe did not scroll '+selector);
   };
   await viewport(844,390);
   await tap(plus);
   await boardWait(`!!d.querySelector('${groups}')`,'Phone catalogue failed to open');
   const phone=await catalogue();
   assert.equal(phone.length,7,JSON.stringify(phone));
   await tap(close);
   const assertSubjectSize=async()=>{
    const geometry=await boardEval(`(()=>{const s=d.querySelector('nav.mobile-board-tools>.lektrus-mobile-subject-trigger'),p=d.querySelector('${plus}'),a=s.getBoundingClientRect(),b=p.getBoundingClientRect(),i=s.querySelector('svg').getBoundingClientRect();return {subject:[a.width,a.height],plus:[b.width,b.height],icon:[i.width,i.height]}})()`);
    assert.ok(geometry.subject.every((v,i)=>Math.abs(v-geometry.plus[i])<=1),'Subject button differs from other buttons: '+JSON.stringify(geometry));
    assert.ok(geometry.icon.every(v=>v>=18&&v<=22),'Oversized subject icon: '+JSON.stringify(geometry));
   };
   const flickCatalogue=async()=>{
    const before=await boardEval(`(()=>{const g=d.querySelector('${groups}'),r=g.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height*.7,room:g.scrollHeight-g.clientHeight-g.scrollTop}})()`);
    assert.ok(before.room>100,'Catalogue needs room for a flick');
    const mapped=await physical([{x:before.x,y:before.y},{x:before.x,y:before.y-15},{x:before.x,y:before.y-32},{x:before.x,y:before.y-50}]);
    await call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...mapped[0],id:1}]});
    for(const p of mapped.slice(1)){await call('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...p,id:1}]});await delay(18)}
    await call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    const released=await boardEval(`d.querySelector('${groups}').scrollTop`);
    await delay(160);
    assert.ok(await boardEval(`d.querySelector('${groups}').scrollTop>${released+5}`),'Catalogue must keep scrolling smoothly after a flick');
    assert.ok(await point(close),'Catalogue header must remain accessible during inertia');
   };
   await assertSubjectSize();
   const checkDock=async()=>{
    await boardWait("d.documentElement.hasAttribute('data-tablet-tool-dock')",'Tablet dock not selected');
    assert.ok(await point(plus),'Tablet plus inaccessible');
    await assertSubjectSize();
    assert.equal(await boardEval("w.getComputedStyle(d.querySelector('.toolbar.compact-toolbar')).display"),"none");
    await tap(plus);
    await boardWait(`!!d.querySelector('${groups}')`,'Tablet catalogue failed to open');
    assert.deepEqual(await catalogue(),phone,'Tablet must expose all phone tool groups and buttons');
    await flickCatalogue();
    await tap(close);
    await tap(plus);
    await boardWait(`!!d.querySelector('${groups}')`,'Catalogue did not reopen after flick');
    await swipe(groups);
    assert.ok(await point(close),'Catalogue header scrolled out of reach');
    await tap(close);
   };
   await viewport(768,1024);
   await checkDock();
   await viewport(1024,768);
   await checkDock();
   await tap(plus);
   await tap('.mobile-tools-sheet-head button[aria-label="Настроить основные инструменты"]');
   await boardWait("!!d.querySelector('.lectris-tools-customize')",'Toolbar customization did not open');
   await boardEval("(()=>{d.querySelectorAll('.lectris-tools-customize-section:nth-child(2) button:not(:disabled)').forEach(b=>b.click());return true})()");
   await boardWait("d.querySelectorAll('.lectris-tools-customize-section:nth-child(2) button:not(:disabled)').length===0",'Tools were not pinned');
   await boardEval("(()=>{d.querySelector('.lectris-toolbar-save').click();return true})()");
   await boardWait("!d.querySelector('.lectris-tools-customize')",'Toolbar customization did not close');
   await viewport(1280,800);
   await checkDock();
   const middle='nav.mobile-board-tools .mobile-tool-cluster-create';
   const beforeTool=await boardEval("d.querySelector('section.board').className");
   await swipe(middle);
   assert.equal(await boardEval("d.querySelector('section.board').className"),beforeTool,'Swiping the toolbar must not select a tool');
   assert.ok(await point(plus),'Plus disappeared after scrolling pinned tools');
   await tap(plus);
   assert.deepEqual(await catalogue(),phone);
   await tap(close);
   console.log('✓ Tablet tool catalogue matches phone; real touch scrolls catalogue and pinned tools in portrait and landscape up to 1280px');
  }else{
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
  // Drawing settings share the lowest row with zoom and navigator when they
  // fit. Verify real hit targets, including the fifth width, after rotation.
  for(const [w,h] of [[844,390],[932,430],[720,360],[667,375],[390,844]]){
   await viewport(w,h);
   await wait(`Math.abs((${inkDockGeometry})?.screen-${Math.max(w,h)})<=2`,'Ink dock did not rotate');
   await delay(150);
   const dock=await evaluate(inkDockGeometry);
   assertInkDock(dock,w>=844||h>=844);
   const widest=await point('.lectris-quick-properties.is-ink-properties .lektrus-ink-width-button:last-child');
   assert.ok(widest,'22 px pen inaccessible');await touch([widest]);
   await wait(`window.__originalFrame.document.querySelector('.lectris-quick-properties .lektrus-ink-width-button:last-child').getAttribute('aria-pressed')==='true'`,'22 px pen did not activate');
   console.log(`✓ ${w}×${h}: compact ink dock, bottom gap ${dock.gap}px, five reachable widths`);
  }
  const color=await point('.lectris-quick-properties.is-ink-properties .lektrus-color-current');assert.ok(color,'Color picker inaccessible');await touch([color]);
  await wait(`!!window.__originalFrame.document.querySelector('.lektrus-colors-popup')`,'Color popup did not open');
  const popup=await evaluate(`(()=>{const w=window.__originalFrame,r=w.document.querySelector('.lektrus-colors-popup').getBoundingClientRect();return r.top>=0&&r.bottom<=w.innerHeight&&r.left>=0&&r.right<=w.innerWidth})()`);
  assert.ok(popup,'Color popup outside landscape viewport');
  await touch([color]);
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
   if(kind==='checklist'){
    assert.equal(await evaluate(`window.__originalFrame.document.querySelectorAll('.checklist-editor-row').length`),1,'Placement tap accidentally added a checklist row');
    // Older WebViews can retarget the compatibility click after the board's
    // pointerdown mounted the editor. It has no preceding editor pointerdown.
    await evaluate(`(()=>{const w=window.__originalFrame;w.document.querySelector('.checklist-add-row').dispatchEvent(new w.MouseEvent('click',{bubbles:true,cancelable:true,detail:1}))})()`);
    assert.equal(await evaluate(`window.__originalFrame.document.querySelectorAll('.checklist-editor-row').length`),1,'Retargeted placement click added a checklist row');
   }
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
  // A full navigation can replace the renderer. Reapply touch emulation so
  // subsequent menu actions exercise touch rather than compatibility clicks.
  await call('Emulation.setTouchEmulationEnabled',{enabled:false});
  await viewport(390,844);
  await evaluate(`window.__boardPath=${JSON.stringify(directPath)}`);
  assert.equal((await evaluate(storedPen)).id,ink.id);
  console.log('✓ Return to portrait workspace and direct-link reopen preserve saved ink');
  // Reproduce the old native WebView where CSS viewport units fail to
  // constrain the menu. Inline geometry must win over the legacy rule.
  await evaluate(`(()=>{const d=document.querySelector('.lektrus-browser-board-frame').contentDocument,s=d.createElement('style');s.id='legacy-menu-viewport';s.textContent='html body .topbar .topbar-right .topbar-more-menu[open]>.topbar-more-popover{max-height:none!important;overflow:visible!important}';d.head.append(s)})()`);
  const menu=await point('.topbar-more-menu>summary');assert.ok(menu,'Board actions menu unavailable');await touch([menu]);
  await wait('!!document.querySelector(".lektrus-browser-board-frame").contentDocument.querySelector(".topbar-more-menu[open] .lektrus-board-menu-pager")','Rotated action menu pager not created');
  const settings=await point('.topbar-more-popover .lektrus-controls-menu-entry');assert.ok(settings,'First action menu button is not visible');
  await touch([settings]);
  await wait('!!document.querySelector(".lektrus-browser-board-frame")?.contentDocument?.querySelector(".lektrus-control-settings")','Rotated action menu tap did not open board controls');
  const closeSettings=await point('.lektrus-control-settings button[aria-label="Закрыть настройки"]');assert.ok(closeSettings,'Board control settings close is not accessible');await touch([closeSettings]);
  await wait('!document.querySelector(".lektrus-browser-board-frame")?.contentDocument?.querySelector(".lektrus-control-settings")','Board control settings did not close');
  await touch([menu]);
  await wait('!!document.querySelector(".lektrus-browser-board-frame").contentDocument.querySelector(".topbar-more-menu[open] .lektrus-board-menu-pager")','Rotated menu pager did not return');
  const menuGeometry=`(()=>{const f=document.querySelector('.lektrus-browser-board-frame'),element=f?.contentDocument?.querySelector('.topbar-more-menu[open] .topbar-more-popover');if(!element)return null;const r=element.getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,height:f.contentWindow.innerHeight,scrollable:element.scrollHeight>element.clientHeight,overflow:f.contentWindow.getComputedStyle(element).overflowY,inline:element.style.maxHeight,scrollTop:element.scrollTop}})()`;
  const menuBounds=await evaluate(menuGeometry);
  assert.ok(menuBounds&&menuBounds.top>=0&&menuBounds.bottom<=menuBounds.height+1&&menuBounds.scrollable&&menuBounds.overflow==='auto'&&menuBounds.inline.endsWith('px'),JSON.stringify(menuBounds));
  const scrollX=(menuBounds.left+menuBounds.right)/2;
  // Start in the middle, not at the physical browser/OS back-gesture edge.
  const scrollStart=menuBounds.top+(menuBounds.bottom-menuBounds.top)*.66,scrollEnd=menuBounds.top+28;
  assert.ok(await evaluate(`!!document.querySelector('.lektrus-browser-board-frame').contentDocument.elementFromPoint(${scrollX},${scrollStart})?.closest('.topbar-more-popover')`),'Menu is visually bounded but does not receive touches');
  await touch(Array.from({length:9},(_,i)=>({x:scrollX,y:scrollStart+(scrollEnd-scrollStart)*i/8})));
  const swipeScrolled=(await evaluate(menuGeometry)).scrollTop>0;
  console.log(`Rotated menu swipe: ${swipeScrolled?'delivered':'browser intercepted; explicit paging available'}`);
  // Verify actual touch reachability of every action, including the final one,
  // even in browsers that consume the physical swipe before dispatching it.
  const page=async direction=>{const p=await point(`.lektrus-board-menu-pager button[data-menu-page="${direction}"]`);assert.ok(p,'Menu paging control inaccessible');await touch([p]);};
  for(let i=0;i<12&&(await evaluate(menuGeometry)).scrollTop>0;i++)await page('previous');
  assert.equal((await evaluate(menuGeometry)).scrollTop,0,'Previous action paging failed');
  const reachable=`(()=>{const d=document.querySelector('.lektrus-browser-board-frame').contentDocument;return [...d.querySelectorAll('.topbar-more-popover button:not([data-menu-page])')].map((b,i)=>{const r=b.getBoundingClientRect();return {i,hit:b.contains(d.elementFromPoint(r.x+r.width/2,r.y+r.height/2))}})})()`;
  const seen=new Set();
  let actions=await evaluate(reachable);for(const a of actions)if(a.hit)seen.add(a.i);
  for(let i=0;i<16&&seen.size<actions.length;i++){const before=(await evaluate(menuGeometry)).scrollTop;await page('next');actions=await evaluate(reachable);for(const a of actions)if(a.hit)seen.add(a.i);assert.ok((await evaluate(menuGeometry)).scrollTop>before||seen.size===actions.length,'Next action paging did not advance');}
  assert.equal(seen.size,actions.length,'Some board actions remain unreachable');
  await evaluate(`(()=>{const w=document.querySelector('.lektrus-browser-board-frame').contentWindow,v=new w.EventTarget();Object.assign(v,{width:w.innerWidth,height:185,offsetLeft:0,offsetTop:0});Object.defineProperty(w,'visualViewport',{configurable:true,value:v});w.dispatchEvent(new w.Event('resize'))})()`);
  await wait(`(${menuGeometry})?.bottom<=185`,'Menu did not adapt to a reduced visual viewport');
  await evaluate(`(()=>{const w=document.querySelector('.lektrus-browser-board-frame').contentWindow;delete w.visualViewport;w.document.querySelector('#legacy-menu-viewport').remove();w.dispatchEvent(new w.Event('resize'))})()`);
  console.log('✓ Rotated board menu fits even with legacy CSS viewport failure, all actions reachable by real touch paging, and adapts to a reduced viewport');
  await call('Page.navigate',{url:new URL('/demo/board?scene=math',url).href});
  await wait(boardReady,'Public demo did not open in landscape',45000);
  const demoState=await state();assert.equal(demoState.rotated,true);assert.ok(demoState.width>demoState.height);
  console.log('✓ Public demo board uses the same landscape viewport');
  }
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
 if(educationOnly){
  const session={access_token:"test-education-token",refresh_token:"test-refresh-token",expires_at:Math.floor(Date.now()/1000)+3600,user:studioUser};
  await call("Page.addScriptToEvaluateOnNewDocument",{source:`localStorage.setItem('lektrus.selfhost.session.v1',${JSON.stringify(JSON.stringify(session))});localStorage.setItem('onlinerepetitor.profile-settings.v51','{"compactUi":true}')`});
  await call("Page.navigate",{url});
  await wait('!!document.querySelector(".lectris-hub-tiles")&&!!document.querySelector(".lectris-mode-option")',"Teaching home did not open",30000);
  const tiles=()=>evaluate('[...document.querySelectorAll(".lectris-hub-tile strong")].map(x=>x.textContent)');
  assert.deepEqual(await tiles(),["Ученики","Предметы","Группы и классы","Задания"]);
  const nav=label=>click(`.lectris-workspace-sidebar button[aria-label="${label}"]`);
  await nav("Задания");
  await wait('document.querySelector(".assignment-list")?.textContent.includes("Выданное задание")',"Teaching assignments were blocked by failed references",30000);
  assert.ok(!(await evaluate('document.querySelector(".assignment-list").textContent')).includes("Полученное задание"));
  await click('.lectris-brand');
  await wait('!!document.querySelector(".lectris-mode-option:nth-child(2)")',"Home did not reopen");
  await click('.lectris-mode-option:nth-child(2)');
  await wait('!!document.querySelector(".lectris-hub-tiles-learner")',"Learning mode did not open");
  assert.deepEqual(await tiles(),["Преподаватели","Предметы","Задания"]);
  assert.equal(await evaluate('!!document.querySelector(\'.lectris-workspace-sidebar button[aria-label="Ученики"]\')'),false);
  await nav("Преподаватели");
  await wait('document.querySelector(".lektrus-teacher-card")?.textContent.includes("Учитель Тест")',"Teacher directory did not load");
  assert.ok((await evaluate('document.querySelector(".lektrus-teacher-card").textContent')).includes("Математика"));
  assignmentFailure=true;
  await nav("Задания");
  await wait('document.querySelector(".assignments-content [role=alert]")?.textContent.includes("Задания не загрузились")',"No explicit assignment failure state");
  assert.ok(!(await evaluate('document.querySelector(".assignments-content").textContent')).includes("Заданий пока нет"));
  assignmentFailure=false;
  await click('.assignments-content [role=alert] button');
  await wait('document.querySelector(".assignment-list")?.textContent.includes("Полученное задание")',"Learning assignments failed to recover",30000);
  assert.ok(!(await evaluate('document.querySelector(".assignment-list").textContent')).includes("Выданное задание"));
  assert.equal(await evaluate('!!document.querySelector(".assignments-shell .boards-create")'),false);
  await click('.lectris-brand');
  await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await wait('!!document.querySelector(".lectris-hub-tiles-learner")',"Mobile home did not open");
  assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'),true,"Mobile learner home overflow");
  await click('.lectris-mobile-bottom button[aria-label="Ещё разделы"]');
  await wait('!!document.querySelector(".lektrus-more-page")',"Mobile More did not open");
  assert.ok((await evaluate('document.querySelector(".lektrus-more-page").textContent')).includes("Преподаватели"));
  await evaluate('[...document.querySelectorAll(".lektrus-more-page-item")].find(b=>b.textContent.includes("Настройки")).click()');
  await wait('!!document.querySelector(".settings-shell")',"Settings did not open");
  assert.ok(!(await evaluate('document.querySelector(".settings-shell").textContent')).includes("Компактный интерфейс"));
  assert.equal(await evaluate('document.documentElement.classList.contains("compact-ui")'),false);
  console.log("✓ Teaching and learning assignments with failed references, retry, private teacher directory, mobile navigation and obsolete setting");
 }else if(interfaceOnly){
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
  // Seed the isolated local-test store, never the live user account. Previously
  // this test covered an empty dashboard and missed the squeezed mobile cards.
  const ownerId="00000000-0000-4000-8000-00000000a11f";
  const longId="00000000-0000-4000-8000-00000000b101",shortId="00000000-0000-4000-8000-00000000b102";
  const longTitle="Математика: подробное объяснение решения задач по алгебре и геометрии для подготовительной группы";
  const subject="Иностранный язык и дополнительная подготовка к экзаменам";
  const group="Группа углублённого изучения иностранного языка";
  const fixture=[{id:longId,title:longTitle,ownerId,role:"owner",createdAt:"2026-11-20T09:00:00Z",updatedAt:"2026-11-22T09:00:00Z"},
   {id:shortId,title:"Алгебра",ownerId,role:"owner",createdAt:"2026-11-20T09:00:00Z",updatedAt:"2026-11-21T09:00:00Z"}];
  await evaluate(`localStorage.setItem('lesson-board.local-test.boards.v1',${JSON.stringify(JSON.stringify(fixture))});localStorage.setItem(${JSON.stringify('lectris.board-organization.v1.'+ownerId)},${JSON.stringify(JSON.stringify({[longId]:{subject,group}}))});true`);
  await call('Page.reload');
  await wait('document.querySelectorAll(".lektrus-recent-board").length===2',"Recent board fixtures did not render",30000);
  const boardGeometry=()=>evaluate(`(()=>{
   const all=[...document.querySelectorAll('.lektrus-recent-board')];
   const box=e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}};
   return all.map(card=>{
    const title=card.querySelector('.lektrus-recent-board-title'),text=title.firstElementChild,cover=card.querySelector('.lectris-hub-board-cover'),info=card.querySelector('.lectris-hub-board-info'),menu=card.querySelector('.lectris-hub-board-edit');
    const b=box(card),t=box(title),c=box(cover),i=box(info),m=box(menu);
    const rows=[...info.querySelectorAll('.lectris-hub-board-kind,.lektrus-recent-board-group,.lektrus-recent-board-role,time')];
    return {title:text.textContent,scrolling:text.classList.contains('is-scrolling'),travel:parseFloat(text.style.getPropertyValue('--title-travel')),expected:Math.max(0,text.scrollWidth-title.clientWidth),
     columns:getComputedStyle(card.querySelector('.lectris-hub-board-main')).flexDirection,ordered:t.bottom<=c.top+1&&c.bottom<=i.top+1,fullCover:c.width>=b.width-3,menuClear:t.right<=m.left+1,
     inside:[t,c,i,m,...rows.map(box)].every(x=>x.left>=b.left-1&&x.right<=b.right+1&&x.top>=b.top-1&&x.bottom<=b.bottom+1),
     readable:rows.every(e=>e.scrollWidth<=e.clientWidth+1&&e.scrollHeight<=e.clientHeight+1&&getComputedStyle(e).whiteSpace==='normal'),details:rows.map(e=>e.textContent)};
   });
  })()`);
  for(const [width,height] of [[320,640],[360,800],[390,844],[430,932],[768,1024],[1024,768],[1440,900]]){
   await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<=768});
   await delay(180);
   const cards=await boardGeometry();
   assert.equal(cards.length,2);
   for(const card of cards)assert.ok(card.columns==='column'&&card.ordered&&card.fullCover&&card.menuClear&&card.inside&&card.readable,`Recent board card squeezed at ${width}: ${JSON.stringify(card)}`);
   assert.ok(cards[0].scrolling&&Math.abs(-cards[0].travel-cards[0].expected)<=1,`Long title must scroll exactly its overflow at ${width}`);
   assert.equal(cards[1].scrolling,false,'Short title must stay still');
   assert.deepEqual(cards[0].details.slice(0,2),[subject,group]);
   console.log(`✓ Recent board cards ${width}×${height}: title above full-width preview, wrapped metadata and separate menu`);
  }
  const motion=await evaluate(`(()=>{const text=document.querySelector('.lektrus-recent-board-title .is-scrolling'),a=text.getAnimations()[0];if(!a)return null;a.pause();const d=a.effect.getTiming().duration;a.currentTime=0;const start=new DOMMatrixReadOnly(getComputedStyle(text).transform).m41;a.currentTime=d*.55;const end=new DOMMatrixReadOnly(getComputedStyle(text).transform).m41;a.currentTime=d*.99;const back=new DOMMatrixReadOnly(getComputedStyle(text).transform).m41;a.play();return {start,end,back,travel:parseFloat(text.style.getPropertyValue('--title-travel'))}})()`);
  assert.ok(motion&&Math.abs(motion.start)<1&&Math.abs(motion.end-motion.travel)<1&&Math.abs(motion.back)<2,'Title must travel to its end and back: '+JSON.stringify(motion));
  await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  await delay(120);
  assert.ok(await evaluate(`(()=>{const e=document.querySelector('.lektrus-recent-board-title'),t=e.firstElementChild;return t.getAnimations().length===0&&getComputedStyle(t).whiteSpace==='normal'&&t.scrollWidth<=e.clientWidth+1&&t.scrollHeight<=e.clientHeight+1})()`),'Reduced-motion title should wrap rather than clip');
  await call('Emulation.setEmulatedMedia',{features:[]});
  await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await click('.lektrus-recent-board .lectris-hub-board-edit');
  assert.ok(await evaluate(`(()=>{const m=document.querySelector('.lektrus-home-board-actions');if(!m)return false;m.scrollIntoView({block:'center'});const b=m.lastElementChild.getBoundingClientRect();return b.width>0&&m.contains(document.elementFromPoint(b.x+b.width/2,b.y+b.height/2))})()`),'Recent-board action menu must not be clipped by its card');
  await click('.lektrus-recent-board .lectris-hub-board-edit');
  console.log('✓ Long title pans in both directions, reduced motion wraps, owner actions remain accessible');
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
  // A real tablet has two independent scrolling regions, and its layout
  // follows the remaining workspace width in both orientations.
  await call('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
  for(const [width,height] of [[768,1024],[1024,768],[1280,800]]){
   await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:true});
   await click('.lectris-brand');
   await wait('!!document.querySelector(".lektrus-calendar-grid")',"Tablet home did not render");
   await wait('!!document.querySelector(".lectris-workspace-stage[data-tablet-width]")',"Tablet stage has no measured width");
   const geometry=()=>evaluate(`(()=>{
    const stage=document.querySelector('.lectris-workspace-stage'),sidebar=document.querySelector('.lectris-workspace-sidebar'),shell=document.querySelector('.lectris-workspace'),b=stage.getBoundingClientRect(),s=sidebar.getBoundingClientRect(),r=shell.getBoundingClientRect();
    const controls=[...stage.querySelectorAll('.lectris-library-sort select,.lectris-library-search,.lectris-palette-options>button,.assignment-stats>button,.students-header button,.lektrus-category-strip>button,.schedule-calendar .lektrus-schedule-day-select,.lektrus-feedback-screen-grid>section')].filter(e=>e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden');
    return {stageWidth:b.width,viewport:innerWidth,profile:stage.dataset.tabletWidth,sidebarWidth:s.width,fullWidth:r.width>=innerWidth-2&&b.right>=innerWidth-2,fullHeight:b.bottom<=innerHeight+2&&b.bottom>=innerHeight-2&&s.bottom<=innerHeight+2,sideBySide:s.right<=b.left+2,vertical:getComputedStyle(stage).overflowY,sidebarScroll:getComputedStyle(sidebar).overflowY,overflow:controls.filter(e=>{const c=e.getBoundingClientRect();return c.left<b.left-2||c.right>b.right+2}).map(e=>e.className||e.tagName),documentWidth:document.documentElement.scrollWidth,heroHeight:stage.querySelector('.lectris-hub-hero')?.getBoundingClientRect().height||0};
   })()`);
   const assertTablet=async name=>{
    const g=await geometry();
    assert.ok(g.fullWidth&&g.fullHeight&&g.sideBySide&&g.sidebarWidth>50&&g.vertical==='auto'&&g.sidebarScroll==='auto'&&g.documentWidth<=g.viewport+2&&!g.overflow.length,`${name} ${width}×${height}: ${JSON.stringify(g)}`);
    assert.equal(g.profile,g.stageWidth<630?'compact':g.stageWidth<880?'medium':'wide',`Wrong tablet width profile: ${JSON.stringify(g)}`);
    return g;
   };
   const home=await assertTablet('Home');
   assert.ok(home.heroHeight>0&&home.heroHeight<340,'Tablet hero has excessive empty space: '+JSON.stringify(home));
   // Actual touch gesture, not assigning scrollTop from JS.
   const scroll=await evaluate(`(()=>{const e=document.querySelector('.lectris-workspace-stage'),r=e.getBoundingClientRect();return {x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height*.8),travel:Math.round(r.height*.55),available:e.scrollHeight-e.clientHeight}})()`);
   if(scroll.available>60){
    await call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:scroll.x,y:scroll.y}]});
    for(let step=1;step<=7;step++){await call('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:scroll.x,y:scroll.y-Math.round(scroll.travel*step/7)}]});await delay(30);}
    await call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await wait('document.querySelector(".lectris-workspace-stage").scrollTop>40',"Tablet touch could not scroll the home page");
   }
   for(const [label,id,selector] of sections){
    // Native touch navigation needs to reach items below the visible sidebar.
    await evaluate(`document.querySelector(${JSON.stringify('.lectris-workspace-sidebar button[aria-label="'+label+'"]')}).scrollIntoView({block:"nearest"})`);
    await click('.lectris-workspace-sidebar button[aria-label="'+label+'"]');
    await checkSection(id,selector);
    await assertTablet(id);
    if(id==="feedback"){
     await evaluate(`document.querySelector('.lektrus-feedback-screen button[type=submit]').scrollIntoView({block:'center',behavior:'instant'})`);
     await delay(180);
     const feedback=await evaluate(`(()=>{const e=document.querySelector('.lektrus-feedback-screen button[type=submit]'),s=document.querySelector('.lectris-workspace-stage'),b=e.getBoundingClientRect(),r=s.getBoundingClientRect();return {top:b.top,bottom:b.bottom,stageTop:r.top,stageBottom:r.bottom,viewport:innerHeight,scroll:s.scrollTop,scrollHeight:s.scrollHeight,clientHeight:s.clientHeight,visible:b.bottom<=Math.min(r.bottom,innerHeight)+2&&b.top>=r.top-2}})()`);
     assert.ok(feedback.visible,"Tablet feedback submit is unreachable: "+JSON.stringify(feedback));
    }
   }
   console.log(`✓ Tablet ${width}×${height}: all 13 routes, full screen, independent scrolling and controls within the stage`);
  }
  await call('Emulation.setTouchEmulationEnabled',{enabled:false});
  await call('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
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
  await wait('!document.querySelector(".lectris-header-search")',"Unneeded desktop header search is visible");
  await click('.lectris-workspace-sidebar button[aria-label="Шаблоны"]');
  await checkSection("templates",".templates-shell");
  await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false});
  await wait('!document.querySelector(".lectris-header-search")',"Unneeded mobile header search is visible");
  await click('.lectris-mobile-bottom button[aria-label="Ещё разделы"]');
  await wait('!!document.querySelector(".lektrus-more-page")',"Mobile More did not open");
  await evaluate('[...document.querySelectorAll(".lektrus-more-page-item")].find(b=>b.textContent.includes("Настройки")).click()');
  await checkSection("settings",".settings-shell");
  console.log('✓ Desktop tiles, schedule controls, progress tabs, board-only AI routing, billing, notifications dialog, header without search and mobile More');
 }else{

 // Public demo: verify absence of seed content, no persisted board, no double outline.
 const demoUrl=new URL("/demo/board?scene=geometry&capture=1",url).href;
 const demoRequests=[];
 const observeDemo=event=>{const data=JSON.parse(event.data);if(data.method==="Network.requestWillBeSent"||data.method==="Network.webSocketCreated"){const requestUrl=data.params.request?.url??data.params.url??"";if(/(?:\/api\/v1\/|\/rest\/v1\/|\/auth\/v1\/|\/storage\/v1\/|\/realtime\/v1\/)/.test(requestUrl))demoRequests.push(requestUrl)}};
 socket.addEventListener("message",observeDemo);
 await call("Network.enable");
 await call("Page.navigate",{url:demoUrl});
 await wait('document.querySelector(".board-title")?.value==="Демо-версия доски"',"Fresh demo did not open",45000);
 assert.equal(await evaluate('document.querySelectorAll(".board-object[data-object]").length'),0);
 await evaluate('document.querySelector(".board-title").focus()');
 assert.deepEqual(await evaluate('(()=>{const s=getComputedStyle(document.querySelector(".board-title"));return [s.outlineStyle,s.boxShadow]})()'),["none","none"],"Duplicate focus ring");
 await click('.toolbar-pinned button[aria-label^="Карандаш"]');
 const demoCanvas=await rect("section.board");
 await mouse("mousePressed",demoCanvas.x,demoCanvas.y,{pressed:true});
 for(let dx=12;dx<=84;dx+=12)await mouse("mouseMoved",demoCanvas.x+dx,demoCanvas.y+20,{pressed:true});
 await mouse("mouseReleased",demoCanvas.x+84,demoCanvas.y+20);
 await wait('!!document.querySelector(".viewer-ink-canvas")',"Demo pencil did not render");
 // Sticker ink is part of the card, not an independent canvas object.
 await click('.lektrus-desktop-sections button[aria-label="Текст"]');
 await wait('!!document.querySelector(".lektrus-tool-overflow-group--create")',"Text tool catalogue did not open");
 assert.ok(await evaluate('(()=>{const b=[...document.querySelectorAll(".lektrus-tool-overflow-group--create button")].find(b=>b.textContent.trim()==="Стикер");b?.click();return !!b})()'),"Sticker tool missing");
 await wait('document.querySelector("section.board")?.classList.contains("board-tool-sticky")',"Sticker tool not selected");
 await mouse("mousePressed",demoCanvas.x-180,demoCanvas.y-120,{pressed:true});
 await mouse("mouseReleased",demoCanvas.x-180,demoCanvas.y-120);
 await wait('!!document.querySelector(".object-sticky.selected")',"Sticker was not created");
 assert.equal(await evaluate('!!document.querySelector(".object-sticky .text-editor,.object-sticky .text-placeholder,.selection-toolbar-screen .selection-edit-action")'),false,"Sticker must not expose a text editor");
 const cardBefore=await rect(".object-sticky");
 await click('.toolbar-pinned button[aria-label^="Карандаш"]');
 await mouse("mousePressed",cardBefore.x-30,cardBefore.y-10,{pressed:true});
 for(let dx=-20;dx<=30;dx+=10)await mouse("mouseMoved",cardBefore.x+dx,cardBefore.y+dx/3,{pressed:true});
 await mouse("mouseReleased",cardBefore.x+30,cardBefore.y+10);
 await wait('!!document.querySelector(".sticker-ink-layer polyline")',"Drawing did not attach to sticker");
 const attached=await evaluate('document.querySelector(".sticker-ink-layer polyline").getAttribute("points")');
 await click(".toolbar-pinned button:first-child");
 await mouse("mousePressed",cardBefore.x,cardBefore.y,{pressed:true});
 await mouse("mouseMoved",cardBefore.x+80,cardBefore.y+40,{pressed:true});
 await mouse("mouseReleased",cardBefore.x+80,cardBefore.y+40);
 await wait(`document.querySelector(".object-sticky").getBoundingClientRect().left>${cardBefore.left+40}`,"Sticker with drawing did not move");
 assert.equal(await evaluate('document.querySelector(".sticker-ink-layer polyline").getAttribute("points")'),attached,"Sticker moved independently of its ink");
 assert.equal(await evaluate('document.querySelector(".snap-toggle")?.getAttribute("aria-pressed")'),"false","Grid snapping must be disabled initially");
 await click('.snap-toggle');
 assert.equal(await evaluate('document.querySelector(".snap-toggle")?.getAttribute("aria-pressed")'),"true");
 await click('.snap-toggle');
 await click('.toolbar-pinned button[aria-label^="Петля"]');
 const lassoCard=await rect('.object-sticky');
 await mouse('mousePressed',lassoCard.x,lassoCard.y,{pressed:true});
 await mouse('mouseMoved',lassoCard.x-35,lassoCard.y+20,{pressed:true});
 await mouse('mouseReleased',lassoCard.x-35,lassoCard.y+20);
 await wait(`document.querySelector('.object-sticky').getBoundingClientRect().left<${lassoCard.left-15}`,"Lasso must move the already selected sticker");
 const resizeCard=await rect('.object-sticky');
 const resizeHandle=await rect('.screen-handle-se');
 await mouse('mousePressed',resizeHandle.x,resizeHandle.y,{pressed:true});
 await mouse('mouseMoved',resizeHandle.x+48,resizeHandle.y+36,{pressed:true});
 await mouse('mouseReleased',resizeHandle.x+48,resizeHandle.y+36);
 await wait(`document.querySelector('.object-sticky').getBoundingClientRect().width>${resizeCard.right-resizeCard.left+20}`,"Lasso must resize selected objects");
 const resizedInk=await evaluate('document.querySelector(".sticker-ink-layer polyline").getAttribute("points")');
 const coords=s=>s.match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi).map(Number);
 assert.ok(coords(attached).every((n,i)=>Math.abs(n-coords(resizedInk)[i])<.01),"Resizing the sticker must not scale its ink");
 await click('.toolbar-pinned button[aria-label^="Карандаш"]');
 const grownCard=await rect('.object-sticky');
 await mouse('mousePressed',grownCard.x,grownCard.y,{pressed:true});
 await mouse('mouseMoved',grownCard.right+36,grownCard.y,{pressed:true});
 await mouse('mouseReleased',grownCard.right+36,grownCard.y);
 await wait('document.querySelectorAll(".sticker-ink-layer polyline").length===2',"Cross-boundary ink must be stored as one sticker stroke");
 const overhang=await evaluate(`(()=>{const card=document.querySelector('.object-sticky'),svg=card.querySelector('.sticker-ink-layer'),line=svg.querySelectorAll('polyline')[1],p=line.points.getItem(line.points.numberOfItems-1),s=new DOMPoint(p.x,p.y).matrixTransform(svg.getScreenCTM());return {points:line.getAttribute('points'),outside:s.x>card.getBoundingClientRect().right+15,visible:getComputedStyle(svg).overflow==='visible'&&getComputedStyle(card).overflow==='visible',x:s.x,y:s.y}})()`);
 assert.ok(overhang.outside&&overhang.visible,"The entire tail must remain visible outside the paper");
 await click('.toolbar-pinned button:first-child');
 await mouse('mousePressed',grownCard.x,grownCard.y-25,{pressed:true});
 await mouse('mouseMoved',grownCard.x-40,grownCard.y-5,{pressed:true});
 await mouse('mouseReleased',grownCard.x-40,grownCard.y-5);
 await wait(`document.querySelector('.object-sticky').getBoundingClientRect().left<${grownCard.left-20}`,"Sticker with outside ink did not move");
 const movedTail=await evaluate(`(()=>{const svg=document.querySelector('.sticker-ink-layer'),line=svg.querySelectorAll('polyline')[1],p=line.points.getItem(line.points.numberOfItems-1),s=new DOMPoint(p.x,p.y).matrixTransform(svg.getScreenCTM());return {points:line.getAttribute('points'),x:s.x,y:s.y}})()`);
 assert.equal(movedTail.points,overhang.points,"Outside ink was detached or distorted by movement");
 assert.ok(Math.abs(movedTail.x-overhang.x+40)<2&&Math.abs(movedTail.y-overhang.y-20)<2,"Outside tail must follow the paper");
 console.log('✓ Grid toggle, lasso move and resize, fixed-size sticker ink and complete attached overhang');
 assert.equal(await evaluate('!!document.querySelector(".lektrus-direct-comment,.edit-selected")'),false,"Removed tool or overlapping edit chip still visible");
 const panelFits=`(()=>{const el=document.querySelector(".selection-toolbar-screen"),b=document.querySelector("section.board");
  if(!el||!b)return false;const p=el.getBoundingClientRect(),r=b.getBoundingClientRect();
  return p.left>=r.left-1&&p.right<=r.right+1&&p.top>=r.top-1&&p.bottom<=r.bottom+1&&
   [...el.children].every(child=>{const c=child.getBoundingClientRect();return !c.width||(c.left>=p.left-1&&c.right<=p.right+1&&c.top>=p.top-1&&c.bottom<=p.bottom+1)});
 })()`;
 const waitPanelFits=async message=>{
  try{await wait(panelFits,message)}catch(error){
   console.error("Selection geometry:",JSON.stringify(await evaluate(`(()=>{
    const el=document.querySelector(".selection-toolbar-screen"),board=document.querySelector("section.board");
    const bounds=node=>node?.getBoundingClientRect().toJSON();
    return {board:bounds(board),panel:bounds(el),editor:!!document.querySelector(".text-editor"),
     selected:[...document.querySelectorAll(".board-object.selected")].map(node=>node.dataset.object),
     children:el?[...el.children].map(node=>({className:node.className,title:node.title,bounds:bounds(node)})):[]};
   })()`)));throw error;
  }
 };
 await waitPanelFits("Sticker action panel extends outside its background or board");
 await click('.lektrus-desktop-sections button[aria-label="Текст"]');
 await wait('!!document.querySelector(".lektrus-tool-overflow-group--create")',"Text tool catalogue did not open");
 assert.ok(await evaluate('(()=>{const b=[...document.querySelectorAll(".lektrus-tool-overflow-group--create button")].find(b=>b.textContent.trim()==="Текст");b?.click();return !!b})()'),"Text tool missing");
 await wait('document.querySelector("section.board")?.classList.contains("board-tool-text")',"Text tool not selected");
 await mouse("mousePressed",demoCanvas.x+190,demoCanvas.y-100,{pressed:true});
 await mouse("mouseReleased",demoCanvas.x+190,demoCanvas.y-100);
 await wait('!!document.querySelector(".object-text textarea.text-editor")',"Text editor did not open");
 await wait('document.activeElement===document.querySelector(".object-text textarea.text-editor")',"New text editor did not receive keyboard focus");
 await call("Input.insertText",{text:"Проверка текста"});
 await wait('document.querySelector(".object-text textarea.text-editor")?.value==="Проверка текста"',"Text input was not received");
 assert.deepEqual(await evaluate('(()=>{const s=getComputedStyle(document.querySelector(".object-text textarea.text-editor"));return [s.outlineStyle,s.boxShadow]})()'),["none","none"],"Text editor has an unnecessary focus ring");
 await evaluate('document.querySelector(".object-text textarea.text-editor").blur()');
 await wait('!document.querySelector(".object-text textarea.text-editor")&&document.querySelector(".object-text .text-display")?.textContent==="Проверка текста"',"Text editor did not save and close after losing focus");
 await waitPanelFits("Text action panel extends outside its background or board");
 await click('.selection-toolbar-screen summary[aria-label="Ещё действия"]');
 await wait('!!document.querySelector(".selection-more[open] .selection-text-format-section")',"Text formatting was not moved into More");
 await click('.selection-toolbar-screen summary[aria-label="Ещё действия"]');
 await delay(550);
 assert.equal(await evaluate('Object.keys(localStorage).some(k=>k.includes("lektrus-demo-"))'),false,"Demo content persisted");
 await call("Page.navigate",{url:new URL("/demo/board?scene=math",url).href});
 await wait('document.querySelector(".board-title")?.value==="Демо-версия доски"',"Demo did not reopen",45000);
 assert.equal(await evaluate('document.querySelectorAll(".board-object[data-object]").length'),0);
 assert.equal(await evaluate('!!document.querySelector(".viewer-ink-canvas")'),false,"Demo ink survived reload");
 await click('button[aria-label="Фото / PDF"]');
 await wait('!!document.querySelector(".lektrus-tool-overflow-content")',"Demo media menu unavailable");
 assert.equal(await evaluate('!!document.querySelector(\'button[aria-label="Видео"]\')'),false,"Video shown in demo");
 await click('button[aria-label="Закрыть меню инструментов"]');
 await click(".lektrus-desktop-subject-trigger");
 await wait('!!document.querySelector("#lektrus-subject-tools-panel select")',"Demo subject tools unavailable");
 await evaluate(`(()=>{const s=document.querySelector("#lektrus-subject-tools-panel select");Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,"value").set.call(s,"История");s.dispatchEvent(new Event("change",{bubbles:true}))})()`);
 await wait('document.querySelectorAll("#lektrus-subject-tools-panel .lektrus-subject-tools-list button").length===1',"Demo should offer only the subject board");
 assert.equal(await evaluate('document.querySelector("#lektrus-subject-tools-panel .lektrus-subject-tools-list button")?.getAttribute("aria-label")'),"Задания на доске");
 assert.deepEqual(demoRequests,[],"Demo made backend requests");
 socket.removeEventListener("message",observeDemo);
 // A new coordinate plane and number line snap independently from the board.
 await call("Page.navigate",{url:new URL("/demo/board?qa-release-fixture=1&scene=coordinates&capture=1",url).href});
 await wait('!!document.querySelector(\'[data-object="qa-plane"] .graph-view > svg\')',"Coordinate fixture did not open");
 await click('.fit-all-button');
 await delay(350);
 const svgPoint=async(id,x,y)=>evaluate(`(()=>{const svg=document.querySelector('[data-object="${id}"] .graph-view > svg'),p=new DOMPoint(${x},${y}).matrixTransform(svg.getScreenCTM());return {x:p.x,y:p.y}})()`);
 const doubleClick=async p=>{for(const count of [1,2]){await mouse("mousePressed",p.x,p.y,{pressed:true,clickCount:count});await mouse("mouseReleased",p.x,p.y,{clickCount:count});}};
 const planeSize=await evaluate('(()=>{const v=document.querySelector(\'[data-object="qa-plane"] .graph-view > svg\').viewBox.baseVal;return {width:v.width,height:v.height}})()');
 const planeHeight=planeSize.height,planeCenter=planeSize.width/2;
 // The fixture has a 20 × 12 coordinate range. Determine its real SVG
 // unit step rather than assuming the old, fixed 600-unit viewBox.
 const planeStep=Math.min(planeSize.width/20,planeHeight/12);
 assert.equal(await evaluate('document.querySelector(\'[data-object="qa-plane"] .lektrus-grid-control[aria-label*="привязку"]\').getAttribute("aria-pressed")'),"true");
 await doubleClick(await svgPoint("qa-plane",planeCenter+1.7*planeStep,planeHeight/2+1.23*planeStep));
 await wait('document.querySelectorAll(\'[data-object="qa-plane"] .graph-point\').length===1',"Double-click did not add a point");
 const planeVertex=await evaluate('(()=>{const c=document.querySelector(\'[data-object="qa-plane"] .graph-point circle:not(.graph-point-hit)\');return {x:Number(c.getAttribute("cx")),y:Number(c.getAttribute("cy"))}})()');
 assert.ok(Math.abs(planeVertex.x-(planeCenter+2*planeStep))<.01&&Math.abs(planeVertex.y-(planeHeight/2+planeStep))<.01,"Point did not snap to the integer grid");
 await doubleClick(await svgPoint("qa-plane",planeVertex.x,planeVertex.y));
 await wait('document.querySelectorAll(\'[data-object="qa-plane"] .graph-point\').length===0',"Double-click did not delete the point");
 assert.equal(await evaluate('!!document.querySelector(".graph-editor-backdrop,.lektrus-graph-dialog")'),false,"Point gestures opened the settings editor");
 const linePoint=await svgPoint("qa-line",351,180);
 await doubleClick(linePoint);
 await wait('document.querySelectorAll(\'[data-object="qa-line"] .graph-point\').length===3',"Number line point was not added");
 const lineVertex=await evaluate('(()=>{const c=[...document.querySelectorAll(\'[data-object="qa-line"] .graph-point circle:not(.graph-point-hit)\')].at(-1);return {x:Number(c.getAttribute("cx")),y:Number(c.getAttribute("cy"))}})()');
 assert.equal(lineVertex.x,360);assert.equal(lineVertex.y,180);
 await doubleClick(await svgPoint("qa-line",lineVertex.x,lineVertex.y));
 await wait('document.querySelectorAll(\'[data-object="qa-line"] .graph-point\').length===2',"Number line point was not deleted");
 await call("Emulation.setTouchEmulationEnabled",{enabled:true,maxTouchPoints:5});
 const doubleTap=async p=>{for(let i=0;i<2;i++){
  await call("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[{x:p.x,y:p.y,id:1}]});
  await call("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});
  if(i===0)await delay(90);
 }};
 await doubleTap(await svgPoint("qa-plane",planeCenter-2.3*planeStep,planeHeight/2-1.23*planeStep));
 await wait('document.querySelectorAll(\'[data-object="qa-plane"] .graph-point\').length===1',"Double tap did not add a coordinate point");
 await delay(700); // separate gestures, including the browser's native double-click suppression
 await doubleTap(await svgPoint("qa-plane",planeCenter-2*planeStep,planeHeight/2-planeStep));
 await wait('document.querySelectorAll(\'[data-object="qa-plane"] .graph-point\').length===0',"Double tap did not delete the coordinate point");
 await delay(350);
 assert.equal(await evaluate('document.querySelectorAll(\'[data-object="qa-plane"] .graph-point\').length'),0,"Synthetic double click recreated the deleted point");
 await call("Emulation.setTouchEmulationEnabled",{enabled:false});
 // Measure a real glyph in screen pixels before and after dragging the
 // right and bottom resize handles. Board camera must stay unchanged.
 const planeLabelMetrics=()=>evaluate(`(()=>{const svg=document.querySelector('[data-object="qa-plane"] .graph-view > svg');
  const labels=[...svg.querySelectorAll('[data-plane-axis]')];
  const text=labels.find(el=>el.textContent==='1')||labels[0];
  const r=text.getBoundingClientRect(),m=svg.getScreenCTM();
  const style=getComputedStyle(text);
  return {value:text.textContent,width:r.width,height:r.height,font:parseFloat(style.fontSize),fill:style.fill,weight:parseFloat(style.fontWeight),scale:Math.hypot(m.a,m.b),viewWidth:svg.viewBox.baseVal.width,viewHeight:svg.viewBox.baseVal.height};})()`);
 const originalMetrics=await planeLabelMetrics();
 assert.equal(originalMetrics.font,14,"Coordinate numbers should use the larger default font");
 assert.equal(originalMetrics.fill,"rgb(24, 35, 52)","Coordinate numbers must have a dark high-contrast fill");
 assert.ok(originalMetrics.weight>=600,"Coordinate numbers should be semibold");
 const checkPlaneLabels=async()=>{
  const result=await evaluate(`(()=>{const svg=document.querySelector('[data-object="qa-plane"] .graph-view > svg');
   const labels=[...svg.querySelectorAll('[data-plane-axis]')].map(el=>({value:el.textContent,axis:el.dataset.planeAxis,r:el.getBoundingClientRect()}));
   const collisions=[];
   for(let i=0;i<labels.length;i++)for(let j=i+1;j<labels.length;j++){
    const a=labels[i],b=labels[j];
    if(Math.min(a.r.right,b.r.right)-Math.max(a.r.left,b.r.left)>1&&Math.min(a.r.bottom,b.r.bottom)-Math.max(a.r.top,b.r.top)>1)collisions.push([a.axis,a.value,b.axis,b.value]);
   }
   const xs=labels.filter(l=>l.axis==="x").map(l=>Number(l.value)).sort((a,b)=>a-b);
   const gaps=xs.slice(1).map((v,i)=>v-xs[i]).filter(v=>v>0);
   return {count:labels.length,collisions,xStep:gaps.length?Math.min(...gaps):null,xs};})()`);
  assert.ok(result.count>2,"Coordinate labels unexpectedly disappeared");
  assert.deepEqual(result.collisions,[],"Coordinate labels overlap");
  return result;
 };
 await checkPlaneLabels();
 const selectPlane=await svgPoint("qa-plane",planeCenter,planeHeight/2);
 await mouse("mousePressed",selectPlane.x,selectPlane.y,{pressed:true});
 await mouse("mouseReleased",selectPlane.x,selectPlane.y);
 await wait('document.querySelector(\'[data-object="qa-plane"]\')?.classList.contains("selected")',"Coordinate plane not selected");
 for(const [handle,dx,dy] of [["e",48,0],["s",0,36]]){
  const before=await planeLabelMetrics();
  const grip=await rect(".screen-handle-"+handle);
  await mouse("mousePressed",grip.x,grip.y,{pressed:true});
  await mouse("mouseMoved",grip.x+dx,grip.y+dy,{pressed:true});
  await mouse("mouseReleased",grip.x+dx,grip.y+dy);
  await wait(`(()=>{const v=document.querySelector('[data-object="qa-plane"] .graph-view > svg').viewBox.baseVal;return v.${handle==="e"?"width":"height"}>${handle==="e"?before.viewWidth:before.viewHeight}+5})()`,"Coordinate resize did not expand viewBox");
  const after=await planeLabelMetrics();
  assert.ok(Math.abs(after.font-originalMetrics.font)<.01&&Math.abs(after.height-originalMetrics.height)<.5&&
   (after.value!==originalMetrics.value||Math.abs(after.width-originalMetrics.width)<.5),
   "Numeric axis glyph changed size after "+handle+" resize: "+JSON.stringify({originalMetrics,after}));
  assert.ok(Math.abs(after.scale-originalMetrics.scale)<.001,"Local SVG scale changed during resize");
  await checkPlaneLabels();
 }
 // SVG <g> does not implement HTMLElement.click(). Exercise the actual
 // mouse interaction, including board selection and pointer propagation.
 const clickPlaneZoom=async label=>{
  const target=await rect('[data-object="qa-plane"] [aria-label="'+label+'"] > rect');
  await mouse("mousePressed",target.x,target.y,{pressed:true});
  await mouse("mouseReleased",target.x,target.y);
 };
 await clickPlaneZoom("Увеличить масштаб плоскости");
 await wait(`parseFloat(getComputedStyle(document.querySelector('[data-object="qa-plane"] .graph-axis-labels text')).fontSize)>${originalMetrics.font}`,"Plane zoom-in did not enlarge numeric labels");
 const zoomedMetrics=await planeLabelMetrics();
 assert.ok(zoomedMetrics.font>originalMetrics.font&&zoomedMetrics.font<=16,"Plane zoom must gently enlarge labels without huge digits");
 await checkPlaneLabels();
 assert.ok(Math.abs(zoomedMetrics.scale-originalMetrics.scale)<.001,"Plane zoom must not resize the SVG");
 await clickPlaneZoom("Уменьшить масштаб плоскости");
 await wait(`Math.abs(parseFloat(getComputedStyle(document.querySelector('[data-object="qa-plane"] .graph-axis-labels text')).fontSize)-${originalMetrics.font})<.01`,"Plane zoom-out did not restore numeric label size");
 const baselineLabels=await checkPlaneLabels();
 assert.ok(Number.isFinite(baselineLabels.xStep),"Expected multiple horizontal axis labels");
 let previousStep=baselineLabels.xStep;
 for(let i=0;i<8;i++){
  const before=await planeLabelMetrics();
  await clickPlaneZoom("Уменьшить масштаб плоскости");
  if(before.font>12.01)await wait(`parseFloat(getComputedStyle(document.querySelector('[data-object="qa-plane"] [data-plane-axis]')).fontSize)<${before.font}`,"Zoom out did not reduce label font");
  else await delay(100);
  const current=await checkPlaneLabels();
  assert.ok(Number.isFinite(current.xStep)&&current.xStep>=previousStep-1e-8,
   "Zoom out must not make labels denser: "+JSON.stringify({previousStep,current}));
  previousStep=current.xStep;
 }
 const distantLabels=await checkPlaneLabels();
 assert.ok(distantLabels.xStep>baselineLabels.xStep,"Zoom out must select a coarser numeric tick interval: "+JSON.stringify({baselineLabels,distantLabels}));
 assert.ok((await planeLabelMetrics()).font>=12,"Axis labels became too small");
 for(let i=0;i<8;i++){await clickPlaneZoom("Увеличить масштаб плоскости");await delay(100);}
 await wait(`Math.abs(parseFloat(getComputedStyle(document.querySelector('[data-object="qa-plane"] [data-plane-axis]')).fontSize)-${originalMetrics.font})<.01`,"Reversing repeated zoom did not restore numeric label size");
 await checkPlaneLabels();
 console.log("✓ Coordinate plane and number line snap and point gestures; adaptive 1–2–5 labels, bounded zoom font and no overlapping numeric glyphs");
 await call("Page.navigate",{url});
 console.log("✓ Empty public demo, ephemeral ink, subject tools and text input focus");

 // Test-only fixture: the initial lesson must actually render the board with math, text and table objects.
 await wait('document.querySelectorAll(".board-object[data-object]").length>=8',
  "Mathematics demo did not render its objects");
 for(const type of ["text","sticky","formula","table","graph"])
  assert.ok(await evaluate(`!!document.querySelector(".board-object.object-${type}")`),
   "Board lost "+type+" objects");
 console.log("✓ Demo board: math lessons and five object types rendered");
 // The toolbar is shared by all kinds. Exercise the long/short action
 // sets and real screen bounds at a fitted zoom, not a fixed mock width.
 await click('.fit-all-button');
 await delay(300);
 for(const id of ["math-title","math-note","math-equation","math-graph","math-values"]){
  const point=await evaluate(`(()=>{const el=document.querySelector('[data-object="${id}"]');if(!el)return null;
   const r=el.getBoundingClientRect();for(const fy of [.2,.5,.8])for(const fx of [.2,.5,.8]){
    const x=r.left+r.width*fx,y=r.top+r.height*fy,hit=document.elementFromPoint(x,y);
    if(hit?.closest('[data-object]')===el&&!hit.closest('button,input,textarea,[data-board-interactive]'))return {x,y};
   }return null;})()`);
  assert.ok(point,"No visible selection surface for "+id);
  await mouse("mousePressed",point.x,point.y,{pressed:true});await mouse("mouseReleased",point.x,point.y);
  await wait(`document.querySelector('[data-object="${id}"]')?.classList.contains("selected")`,"Could not select "+id);
  await waitPanelFits("Action toolbar overflow for "+id);
 }
 await call("Page.navigate",{url});
 await wait('document.querySelectorAll(".board-object[data-object]").length>=8',"Math fixture did not restore after selection layout checks");
 console.log("✓ Selection action geometry across text, sticker, formula, graph and table");

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
 const eraserModeButton=async (mode)=>{
  const found=await evaluate(`(()=>{const button=[...document.querySelectorAll('.lektrus-eraser-modes button')].find(b=>b.dataset.eraserMode===${JSON.stringify(mode)}&&b.getBoundingClientRect().width>0);if(!button)return false;button.click();return true})()`);
  assert.ok(found,"Both eraser modes must be available");
 };
 const savedInkIds=`(()=>{const doc=JSON.parse(localStorage.getItem('lesson-board.document.v1.board.00000000-0000-4000-8000-0000000000a0'));return doc.items.filter(i=>i.kind==='pen').map(i=>i.id)})()`;
 const originalInk=await evaluate(savedInkIds);
 const lineId=originalInk.at(-1);
 assert.ok(lineId,"Saved stroke ID missing");
 await eraserModeButton("partial");
 const hitX=canvasPoint.x+48,hitY=canvasPoint.y+Math.sin(48/30)*12;
 await mouse("mousePressed",hitX,hitY,{pressed:true});
 await mouse("mouseReleased",hitX,hitY);
 await wait(`${savedInkIds}.length===${originalInk.length+1}&&!${savedInkIds}.includes(${JSON.stringify(lineId)})`,"Partial eraser must split the real stroke into two fragments");
 await click('button[aria-label="Отменить"]');
 await wait(`${savedInkIds}.includes(${JSON.stringify(lineId)})`,"Undo must restore the entire original stroke");
 await eraserModeButton("stroke");
 await mouse("mousePressed",hitX,hitY,{pressed:true});
 await wait('document.querySelector("section.board").classList.contains("eraser-live")',"Whole stroke must disappear in the live preview before pointer release");
 await mouse("mouseReleased",hitX,hitY);
 await wait(`${savedInkIds}.length===${originalInk.length-1}&&!${savedInkIds}.includes(${JSON.stringify(lineId)})`,"Whole stroke eraser must remove the complete line without fragments");
 console.log("✓ Real pencil, partial eraser, whole stroke eraser and undo");

 // Drop actual decoded files of different dimensions and encodings. The
 // pointer resize must keep their source aspect and fill the visible frame.
 for(const [mime,w,h] of [["image/png",480,90],["image/jpeg",90,480],["image/webp",320,160]]){
  const name=`resize-${mime.split('/')[1]}`;
  await evaluate(`(async()=>{const b=document.querySelector('section.board'),r=b.getBoundingClientRect(),c=document.createElement('canvas');c.width=${w};c.height=${h};const ctx=c.getContext('2d');ctx.fillStyle='#2275ce';ctx.fillRect(0,0,c.width,c.height);const file=new File([await new Promise(resolve=>c.toBlob(resolve,${JSON.stringify(mime)}))],${JSON.stringify(name)},{type:${JSON.stringify(mime)}});const dataTransfer=new DataTransfer();dataTransfer.items.add(file);b.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer,clientX:Math.round(r.left+r.width*.55),clientY:Math.round(r.top+r.height*.42)}));return true})()`);
  const selector=`.object-image:has(img[alt="${name}"])`;
  await wait(`(()=>{const img=document.querySelector(${JSON.stringify(selector)}+' img');return img?.complete&&img.naturalWidth>0})()`,"Image did not load: "+mime,10000);
  const ratio=await evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});return el.offsetWidth/el.offsetHeight})()`);
  assert.ok(Math.abs(ratio-w/h)/(w/h)<.05,"Initial frame must preserve image proportions for "+mime);
  const beforeWidth=await evaluate(`document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect().width`);
  const grip=await rect('.screen-handle-e');
  await mouse('mousePressed',grip.x,grip.y,{pressed:true});
  await mouse('mouseMoved',grip.x+24,grip.y,{pressed:true});
  await mouse('mouseReleased',grip.x+24,grip.y);
  await wait(`document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect().width>${beforeWidth+10}`,"Side grip must actually resize the image: "+mime);
  const resized=await evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)}),img=el.querySelector('img');return {ratio:parseFloat(el.style.width)/parseFloat(el.style.height),fit:getComputedStyle(img).objectFit}})()`);
  assert.ok(Math.abs(resized.ratio-w/h)/(w/h)<.015&&resized.fit==='fill',"Side grip must preserve aspect and avoid padding for "+mime);
  await click('button[aria-label="Отменить"]'); // resize
  await click('button[aria-label="Отменить"]'); // insertion, free the same board area
  await wait(`!document.querySelector(${JSON.stringify(selector)})`,"Undo must remove the inserted image");
 }
 console.log("✓ PNG, JPEG and WebP: real image insertion and proportional side resize without padding");

 // Large white bars around scans must be excluded BEFORE first resize,
 // without manually opening the crop editor.
 const paddedName="qa-padded-worksheet";
 await evaluate(`(async()=>{
  const b=document.querySelector("section.board"),r=b.getBoundingClientRect();
  const c=document.createElement("canvas");c.width=600;c.height=800;
  const ctx=c.getContext("2d");ctx.fillStyle="#fff";ctx.fillRect(0,0,600,800);
  ctx.fillStyle="#2275ce";ctx.fillRect(215,20,170,760);
  const blob=await new Promise(resolve=>c.toBlob(resolve,"image/png"));
  const file=new File([blob],${JSON.stringify(paddedName)},{type:"image/png"});
  const transfer=new DataTransfer();transfer.items.add(file);
  b.dispatchEvent(new DragEvent("drop",{bubbles:true,cancelable:true,dataTransfer:transfer,
   clientX:r.left+r.width*.55,clientY:r.top+r.height*.42}));
  return true;
 })()`);
 const paddedSelector=`.object-image:has(img[alt="${paddedName}"])`;
 await wait(`document.querySelector(${JSON.stringify(paddedSelector)})?.querySelector("img")?.naturalWidth>0`,
   "Padded worksheet did not load");
 await wait(`(()=>{
   const saved=JSON.parse(localStorage.getItem("lesson-board.document.v1.board.00000000-0000-4000-8000-0000000000a0")||'{"items":[]}');
   return saved.items.some(i=>i.name===${JSON.stringify(paddedName)}&&i.imageCrop?.width<.4);
  })()`,"Automatically cropped image must also persist in the saved board",15000);
 const beforeCrop=await evaluate(`(()=>{
  const element=document.querySelector(${JSON.stringify(paddedSelector)});
  const saved=JSON.parse(localStorage.getItem("lesson-board.document.v1.board.00000000-0000-4000-8000-0000000000a0"));
  const item=saved.items.find(i=>i.name===${JSON.stringify(paddedName)});
  return {ratio:element.offsetWidth/element.offsetHeight,crop:item?.imageCrop};
 })()`);
 assert.ok(beforeCrop.crop?.width<.4&&beforeCrop.crop.x>.3&&beforeCrop.ratio<.4,
  "Blank source margins must not be scaled as content: "+JSON.stringify(beforeCrop));
 const oldWidth=await evaluate(`document.querySelector(${JSON.stringify(paddedSelector)}).getBoundingClientRect().width`);
 const gripPadded=await rect(".screen-handle-e");
 await mouse("mousePressed",gripPadded.x,gripPadded.y,{pressed:true});
 await mouse("mouseMoved",gripPadded.x+24,gripPadded.y,{pressed:true});
 await mouse("mouseReleased",gripPadded.x+24,gripPadded.y);
 await wait(`document.querySelector(${JSON.stringify(paddedSelector)}).getBoundingClientRect().width>${oldWidth+10}`,
  "The scanned content itself must enlarge on side grip");
 const afterRatio=await evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(paddedSelector)});return el.offsetWidth/el.offsetHeight})()`);
 assert.ok(Math.abs(afterRatio-beforeCrop.ratio)<.025,"Automatic image crop aspect drifted during resize");
 await click('button[aria-label="Отменить"]');
 await click('button[aria-label="Отменить"]');
 await wait(`!document.querySelector(${JSON.stringify(paddedSelector)})`,"Undo must remove the fitted image");
 console.log("✓ White-margin scan is fitted on insertion and truly enlarges on drag");


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
 // Run the compact dock regression in the ordinary PR browser smoke as well
 // as the dedicated rotated-frame/mobile acceptance suite.
 await call('Emulation.setDeviceMetricsOverride',{width:844,height:390,deviceScaleFactor:2,mobile:true});
 await call('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:2});
 await call('Page.navigate',{url});
 await wait('!!document.querySelector("section.board")&&!!document.querySelector(".minimap")','Mobile fixture not ready');
 await click('nav.mobile-board-tools button[data-interface-control="pen"]');
 await wait('!!document.querySelector(".lectris-quick-properties.is-ink-properties")','Ink settings did not appear');
 const touchInk=async selector=>{const p=await rect(selector);assert.ok(await evaluate(`!!document.elementFromPoint(${p.x},${p.y})?.closest(${JSON.stringify(selector)})`),'Ink target obscured: '+selector);await call('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:p.x,y:p.y,id:1}]});await call('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await delay(150);};
 for(const [width,height] of [[844,390],[932,430],[720,360],[667,375]]){
  await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:2,mobile:true});
  await delay(250);
  const dock=await evaluate(inkDockGeometry);assertInkDock(dock,width>=844);
  for(const n of [1,5]){
   const selector=`.lectris-quick-properties.is-ink-properties .lektrus-ink-width-button:nth-child(${n})`;
   await touchInk(selector);
   await wait(`document.querySelector(${JSON.stringify(selector)}).getAttribute('aria-pressed')==='true'`,'Ink width did not activate');
  }
  console.log(`✓ ${width}×${height}: ink dock ${Math.round(dock.width)}×${Math.round(dock.height)}, bottom gap ${dock.gap}px, all five hit targets`);
 }
 await touchInk('.lectris-quick-properties.is-ink-properties .lektrus-color-current');
 await wait('!!document.querySelector(".lektrus-colors-popup")','Mobile color popup did not open');
 assert.ok(await evaluate(`(()=>{const r=document.querySelector('.lektrus-colors-popup').getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight&&r.left>=0&&r.right<=innerWidth})()`),'Color popup outside mobile viewport');
 console.log("Lektrus release smoke passed: actual browser interactions and curated subjects.");
 }
 }
}finally{
 if(socket&&socket.readyState===WebSocket.OPEN)socket.close();
 if(chrome){chrome.kill();await delay(120)}
 if(profile)await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});
 await server.close();
}
