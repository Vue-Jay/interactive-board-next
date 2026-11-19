// Run against the actual compiled APK web bundle, without production accounts.
// Chromium viewport emulation checks layout and resize, not an Android OS/IME.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import {mkdtemp,rm,mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {setTimeout as delay} from 'node:timers/promises';
import {preview} from 'vite';

const chromePath=process.env.CHROME_PATH||['/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser'].find(existsSync);
assert.ok(chromePath,'Chrome required for authentication layout acceptance');
const server=await preview({preview:{host:'127.0.0.1',port:0,strictPort:false}});
const url=`http://127.0.0.1:${server.httpServer.address().port}/app`;
const profile=await mkdtemp(path.join(tmpdir(),'lektrus-auth-layout-'));
const portServer=net.createServer();
await new Promise((resolve,reject)=>portServer.once('error',reject).listen(0,'127.0.0.1',resolve));
const debugPort=portServer.address().port;
await new Promise(resolve=>portServer.close(resolve));
let chrome,socket,seq=0;const pending=new Map(),logs=[];
const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true});assert.ok(!r.exceptionDetails,r.exceptionDetails?.exception?.description||r.exceptionDetails?.text);return r.result.value;};
const wait=async(expression,message)=>{for(let i=0;i<200;i++){const result=await evaluate(expression);if(result)return result;await delay(100);}throw new Error(message);};
const resize=async(width,height)=>{await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await delay(150);};
const geometry=()=>evaluate(`(()=>{const s=document.querySelector('.auth-shell-interactive'),c=s.querySelector('.auth-card'),stage=s.querySelector('.auth-stage'),r=c.getBoundingClientRect(),p=getComputedStyle(stage);return {width:innerWidth,height:innerHeight,left:r.left,right:r.right,top:r.top,bottom:r.bottom,cardWidth:r.width,expectedWidth:Math.min(580,s.clientWidth-parseFloat(p.paddingLeft)-parseFloat(p.paddingRight)),scrollHeight:s.scrollHeight,clientHeight:s.clientHeight,scrollWidth:s.scrollWidth,center:Math.abs((r.top+r.bottom)/2-s.clientHeight/2),mobile:s.hasAttribute('data-auth-mobile'),shellDisplay:getComputedStyle(s).display,stageWidth:stage.getBoundingClientRect().width,cardComputedWidth:getComputedStyle(c).width,fields:[...s.querySelectorAll('.auth-field input')].map(e=>({font:parseFloat(getComputedStyle(e).fontSize),height:e.getBoundingClientRect().height}))}})()`);
const check=async(label)=>{const g=await geometry();assert.ok(g.mobile,label+' mobile layout not enabled');assert.ok(Math.abs(g.cardWidth-g.expectedWidth)<3,JSON.stringify(g));assert.ok(g.left>=0&&g.right<=g.width+1&&g.scrollWidth<=g.width+1,JSON.stringify(g));assert.ok(g.fields.every(f=>f.font>=16&&f.height>=47),JSON.stringify(g));if(g.scrollHeight<=g.clientHeight+2)assert.ok(g.center<3,JSON.stringify(g));else{assert.ok(g.top>=0,JSON.stringify(g));const scrolled=await evaluate(`(()=>{const s=document.querySelector('.auth-shell');s.scrollTop=s.scrollHeight;const p=s.scrollTop;s.scrollTop=0;return p;})()`);assert.ok(scrolled>0,label+' tall form must scroll');}console.log('PASS',label,JSON.stringify(g));return g;};
const output=process.env.LEKTRUS_AUTH_SCREENSHOTS||'artifacts/auth-layout';
const screenshot=async name=>{await mkdir(output,{recursive:true});const r=await send('Page.captureScreenshot',{format:'png'});await writeFile(path.join(output,name+'.png'),Buffer.from(r.data,'base64'));};
try{
  chrome=spawn(chromePath,['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--no-first-run','--disable-extensions','--remote-allow-origins=*',`--remote-debugging-port=${debugPort}`,`--user-data-dir=${profile}`,'about:blank'],{stdio:['ignore','ignore','pipe']});
  chrome.stderr.on('data',chunk=>{if(logs.length<25)logs.push(String(chunk).slice(0,1400));});
  let target;
  for(let i=0;i<180&&!target&&!chrome.exitCode;i++){try{target=(await fetch(`http://127.0.0.1:${debugPort}/json/list`).then(r=>r.json())).find(t=>t.type==='page');}catch{}if(!target)await delay(100);}
  assert.ok(target,'Chrome unavailable: '+logs.slice(-3).join(''));
  socket=new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
  socket.addEventListener('message',event=>{const r=JSON.parse(event.data),p=pending.get(r.id);if(!p)return;pending.delete(r.id);r.error?p.reject(new Error(r.error.message)):p.resolve(r.result);});
  await send('Page.enable');
  // Capacitor's custom platform exercises the native layout path even when
  // Chromium reports a desktop mouse, exactly the BlueStacks edge case.
  const native=await send('Page.addScriptToEvaluateOnNewDocument',{source:`window.CapacitorCustomPlatform={name:'android'};`});
  for(const [width,height] of [[320,568],[390,844],[600,1040],[820,1180]]){
    await resize(width,height);await send('Page.navigate',{url});
    await wait('document.querySelector(".auth-form h1")?.textContent?.includes("С возвращением")','Login did not render');
    await wait('document.querySelector(".auth-shell-interactive")?.hasAttribute("data-auth-mobile")','Native mobile layout not installed');
    assert.ok(await evaluate('document.documentElement.classList.contains("lektrus-native-app")'),'Native CSS class missing');
    await screenshot(`login-${width}`);
    await check(`native-login-${width}x${height}`);
    await evaluate('document.querySelector(".auth-field input").focus()');
    const before=await evaluate('document.querySelector(".auth-card").offsetTop');
    await resize(width,Math.round(height*.56));
    assert.equal(await evaluate('document.activeElement===document.querySelector(".auth-field input")'),true,'Resize lost focus');
    assert.equal(await evaluate('document.querySelector(".auth-card").offsetTop'),before,'Keyboard resize moved form');
    await resize(width,height);
    await evaluate('document.activeElement.blur();document.querySelector(".auth-tabs button:nth-child(2)").click()');
    await wait('document.querySelector(".auth-form h1")?.textContent?.includes("Создать аккаунт")','Registration missing');
    await check(`native-register-${width}x${height}`);
    if(width===390)await screenshot('registration-390');
    await evaluate('document.querySelector(".auth-tabs button:first-child").click()');
    await wait('!!document.querySelector(".auth-forgot-password")','Recovery button missing');
    await evaluate('document.querySelector(".auth-forgot-password").click()');
    await wait('document.querySelector(".auth-form h1")?.textContent?.includes("Восстановление пароля")','Recovery missing');
    await screenshot(`recovery-${width}`);
    await check(`native-recovery-${width}x${height}`);
  }
  await send('Page.removeScriptToEvaluateOnNewDocument',{identifier:native.identifier});
  await resize(390,844);await send('Page.navigate',{url});
  await wait('document.querySelector(".auth-form h1")?.textContent?.includes("С возвращением")&&!document.documentElement.classList.contains("lektrus-native-app")','Browser login missing');
  await wait('document.querySelector(".auth-shell-interactive")?.hasAttribute("data-auth-mobile")','Browser mobile auth missing');
  await check('browser-phone-login');
  console.log('PASS authentication layout acceptance');
}finally{
  socket?.close();chrome?.kill();await new Promise(resolve=>server.httpServer.close(resolve));
  await delay(100);await rm(profile,{recursive:true,force:true,maxRetries:3});
}
