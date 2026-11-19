#!/usr/bin/env node
/**
 * New, independent mobile-browser stress runner.
 * Runs only when explicitly invoked; never on import/commit.
 * Uses Chrome DevTools mobile emulation and physical touch protocol events.
 * This is NOT an Android APK or iOS IPA test.
 */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import {mkdtemp,rm,mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {setTimeout as sleep} from 'node:timers/promises';
import {createServer} from 'vite';

const chromePath=process.env.CHROME_PATH||['/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser'].find(existsSync);
assert.ok(chromePath,'Chromium/Chrome required for real mobile-browser stress execution');
const output=process.env.LEKTRUS_STRESS_OUTPUT||'artifacts/mobile-stress-v2';
const iterations=Math.max(1,Math.min(1000,Number(process.env.LEKTRUS_STRESS_ITERATIONS||100)));
const profiles=[{name:'android-phone',width:393,height:851,scale:3},{name:'small-phone',width:320,height:640,scale:2},{name:'tablet',width:820,height:1180,scale:2}];
process.env.VITE_LEKTRUS_LOCAL_TEST='true';
const server=await createServer({configFile:'./vite.config.ts',server:{host:'127.0.0.1',port:0,strictPort:false}});
let chrome,ws,profileDir;const results=[];const pending=new Map();let seq=0;
const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result?.value;};
const touch=async(x,y)=>{await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});};
const touchSelector=async(selector)=>{const pos=await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)return null;const r=e.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2,visible:r.width>0&&r.height>0}})()`);assert.ok(pos?.visible,'Touch target missing: '+selector);await touch(pos.x,pos.y);};
const wait=async(expression,description,timeout=20000)=>{const start=Date.now();while(Date.now()-start<timeout){if(await evaluate(expression))return;await sleep(120);}throw Error(description);};
const check=async(name,fn)=>{const start=Date.now();try{const detail=await fn();results.push({name,status:'passed',durationMs:Date.now()-start,detail});console.log('PASS',name);}catch(e){results.push({name,status:'failed',durationMs:Date.now()-start,error:String(e)});console.error('FAIL',name,String(e));}};
try{
 await server.listen();const port=server.httpServer.address().port;
 const listener=net.createServer();await new Promise(resolve=>listener.listen(0,'127.0.0.1',resolve));const debugPort=listener.address().port;await new Promise(resolve=>listener.close(resolve));
 profileDir=await mkdtemp(path.join(tmpdir(),'lektrus-mobile-stress-'));
 const url='http://127.0.0.1:'+port+'/app';
 chrome=spawn(chromePath,['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--no-first-run','--disable-extensions','--remote-allow-origins=*',`--remote-debugging-port=${debugPort}`,`--user-data-dir=${profileDir}`,'--window-size=1200,1000',url],{stdio:'ignore'});
 let page;
 for(let i=0;i<200&&!page;i++){try{page=(await fetch(`http://127.0.0.1:${debugPort}/json/list`).then(r=>r.json())).find(t=>t.type==='page'&&t.url.startsWith(url));}catch{}if(!page)await sleep(150);}
 assert.ok(page,'Chrome failed to open mobile workspace');
 ws=new WebSocket(page.webSocketDebuggerUrl);
 await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
 ws.addEventListener('message',event=>{const data=JSON.parse(event.data);if(!data.id)return;const task=pending.get(data.id);if(!task)return;pending.delete(data.id);data.error?task.reject(Error(data.error.message)):task.resolve(data.result);});
 await send('Runtime.enable');await send('Page.enable');
 await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
 await send('Runtime.evaluate',{expression:`window.__stressErrors=[];addEventListener('error',e=>__stressErrors.push(e.message));addEventListener('unhandledrejection',e=>__stressErrors.push(String(e.reason)))`});
 for(const p of profiles){
  for(const rotated of [false,true]){
   const width=rotated?p.height:p.width,height=rotated?p.width:p.height,tag=p.name+(rotated?'-landscape':'-portrait');
   await check(tag+'-layout',async()=>{
    await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:p.scale,mobile:true,screenOrientation:{type:rotated?'landscapePrimary':'portraitPrimary',angle:rotated?90:0}});
    await wait('!!document.querySelector(".lektrus-calendar-grid")','Workspace missing');
    const geometry=await evaluate(`({width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,bodyWidth:document.body.scrollWidth,controls:[...document.querySelectorAll('button')].filter(x=>x.getClientRects().length).length})`);
    assert.equal(geometry.width,width);assert.equal(geometry.height,height);
    assert.ok(geometry.controls>0,'No visible interactive controls');
    assert.ok(geometry.scrollWidth<=width+3,'Unexpected horizontal document overflow: '+JSON.stringify(geometry));
    return geometry;
   });
   if(!rotated)await check(tag+'-create-board-physical-touch',async()=>{
    // Reset the route to make this test independent of previous navigation.
    await send('Page.navigate',{url});
    await wait('!!document.querySelector(".lektrus-calendar-grid")','Workspace did not reload');
    await touchSelector('.lectris-mobile-bottom button[aria-label="Доски"]');
    await wait('!!document.querySelector(".lectris-library-new")','Board list unavailable');
    await touchSelector('.lectris-library-new');
    await wait('!!document.querySelector(".lektrus-create-dialog input")','Board creation dialog missing');
    await touchSelector('.lektrus-create-dialog input');
    const boardTitle='Stress '+p.name+' '+Date.now();
    await send('Input.insertText',{text:boardTitle});
    assert.equal(await evaluate('document.querySelector(".lektrus-create-dialog input").value'),boardTitle);
    await touchSelector('.lektrus-create-dialog button[type="submit"]');
    await wait('!!document.querySelector(".lektrus-browser-board-frame")','Board did not open after touch submission',45000);
    const title=await evaluate('document.querySelector(".lektrus-browser-board-frame")?.contentDocument?.querySelector(".board-title")?.value');
    assert.equal(title,boardTitle,'Created board title did not persist in board UI');
    // Draw with a real CDP touch stroke inside the newly created board.
    const drawing=await evaluate(`(()=>{const f=document.querySelector('.lektrus-browser-board-frame'),d=f?.contentDocument,b=d?.querySelector('section.board');if(!f||!b)return null;const r=b.getBoundingClientRect();return {frame:[f.getBoundingClientRect().left,f.getBoundingClientRect().top],points:Array.from({length:10},(_,i)=>({x:Math.round(r.left+r.width*.35+i*7),y:Math.round(r.top+r.height*.55)})),tool:!!d.querySelector('nav.mobile-board-tools button[data-interface-control="pen"],.toolbar-pinned button[data-interface-control="pen"]')}})()`);
    assert.ok(drawing?.tool,'Pencil tool missing in created mobile board');
    const penPoint=await evaluate(`(()=>{const f=document.querySelector('.lektrus-browser-board-frame'),d=f.contentDocument,e=[...d.querySelectorAll('nav.mobile-board-tools button[data-interface-control="pen"],.toolbar-pinned button[data-interface-control="pen"]')].find(x=>x.getBoundingClientRect().width>0);if(!e)return null;const r=e.getBoundingClientRect(),fr=f.getBoundingClientRect();return {x:fr.left+r.left+r.width/2,y:fr.top+r.top+r.height/2}})()`);
    assert.ok(penPoint,'Visible pencil control not found');
    await touch(penPoint.x,penPoint.y);
    await wait('document.querySelector(".lektrus-browser-board-frame")?.contentDocument?.querySelector("section.board")?.classList.contains("board-tool-pen")','Pencil did not activate after touch');
    const frame=await evaluate('(()=>{const f=document.querySelector(".lektrus-browser-board-frame"),r=f.getBoundingClientRect();return {left:r.left,top:r.top}})()');
    const points=drawing.points.map(q=>({x:frame.left+q.x,y:frame.top+q.y}));
    await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...points[0],id:1}]});
    for(const point of points.slice(1)){await send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...point,id:1}]});await sleep(25);}
    await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    const savedInk=`(()=>{for(const key of Object.keys(localStorage)){if(!key.includes('document'))continue;try{const data=JSON.parse(localStorage.getItem(key));const ink=data?.items?.find(item=>item.kind==='pen'&&item.points?.length>1);if(ink)return {points:ink.points.length,key};}catch{}}return null})()`;
    await wait(savedInk,'Real touch pen stroke was not persisted in local board document',15000);
    return {boardTitle:title,createdBy:'physical touch',stroke:'physical CDP gesture'};
   });
   await check(tag+'-keyboard-outside-tap',async()=>{
    await send('Page.navigate',{url});
    await wait('!!document.querySelector(".lektrus-calendar-grid")','Workspace missing for keyboard check');
    await touchSelector('.lectris-mobile-bottom button[aria-label="Ещё разделы"]');
    await wait('!!document.querySelector(".lektrus-more-page-search input")','More-page search missing');
    await touchSelector('.lektrus-more-page-search input');
    assert.equal(await evaluate('document.activeElement===document.querySelector(".lektrus-more-page-search input")'),true,'Search input not focused');
    await send('Input.insertText',{text:'Настройки'});
    assert.equal(await evaluate('document.querySelector(".lektrus-more-page-search input").value'),'Настройки');
    await touchSelector('.lektrus-more-page-title h1');
    await wait('document.activeElement!==document.querySelector(".lektrus-more-page-search input")','Outside touch did not dismiss input focus');
    assert.equal(await evaluate('document.querySelector(".lektrus-more-page-search input").value'),'Настройки','Outside tap discarded search input');
    return {outsideTouchBlurred:true,searchValuePreserved:true};
   });
   await check(tag+'-touch-storm',async()=>{
    await send('Page.navigate',{url});
    await wait('!!document.querySelector(".lektrus-calendar-grid")','Workspace did not reload for touch storm');
    await evaluate(`window.__stressErrors=[];addEventListener('error',e=>__stressErrors.push(e.message));addEventListener('unhandledrejection',e=>__stressErrors.push(String(e.reason)))`);
    const targets=await evaluate(`[...document.querySelectorAll('button')].filter(e=>e.getClientRects().length&&e.getBoundingClientRect().width>=20&&e.getBoundingClientRect().height>=20).map(e=>{const r=e.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2,label:e.getAttribute('aria-label')||e.textContent?.trim().slice(0,60)}}).filter(p=>p.x>0&&p.x<innerWidth&&p.y>0&&p.y<innerHeight)`);
    assert.ok(targets.length>0,'No touch targets');
    // Touch the same safe, non-destructive navigation control repeatedly.
    const safe=targets.find(t=>/главная|home|доски|boards/i.test(t.label||''));
    assert.ok(safe,'No known safe navigation button; refusing random destructive touches');
    for(let i=0;i<iterations;i++){
      const current=await evaluate(`(()=>{const e=[...document.querySelectorAll('button')].find(b=>(b.getAttribute('aria-label')||b.textContent?.trim())===${JSON.stringify(safe.label)});if(!e)return null;const r=e.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2,visible:r.width>0&&r.height>0}})()`);
      assert.ok(current?.visible,'Navigation target disappeared during touch storm');
      await touch(current.x,current.y);
    }
    const errors=await evaluate('window.__stressErrors||[]');
    assert.deepEqual(errors,[],'Browser runtime errors after touch storm');
    return {touches:iterations,target:safe.label};
   });
  }
 }
}finally{
 await mkdir(output,{recursive:true});
 await writeFile(path.join(output,'mobile-browser-stress-results.json'),JSON.stringify({schema:1,platform:'mobile-browser-chromium-emulated',iterations,results},null,2)+'\n');
 if(ws){try{ws.close();}catch{}}
 if(chrome){chrome.kill('SIGTERM');}
 await server.close();if(profileDir)await rm(profileDir,{recursive:true,force:true});
}
if(results.some(r=>r.status!=='passed'))process.exitCode=1;
console.log(JSON.stringify({checks:results.length,passed:results.filter(r=>r.status==='passed').length,failed:results.filter(r=>r.status==='failed').length,output},null,2));
