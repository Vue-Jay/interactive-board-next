import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {createServer} from 'vite';
import net from 'node:net';
const chromium=process.env.CHROME_PATH||['/usr/bin/chromium','/usr/bin/google-chrome'].find(existsSync);
assert.ok(chromium,'Chromium required for standalone laboratory visual QA');
const server=await createServer({server:{host:'127.0.0.1',port:0}});
const profile=await mkdtemp(join(tmpdir(),'lektrus-lab-qa-'));
let chrome,socket;
try{
 await server.listen();const url=`http://127.0.0.1:${server.httpServer.address().port}/tools/laboratory`;
 const portServer=net.createServer();await new Promise((r,j)=>portServer.once('error',j).listen(0,'127.0.0.1',r));
 const debugPort=portServer.address().port;await new Promise(r=>portServer.close(r));
 const log=[];
 chrome=spawn(chromium,['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage',`--remote-debugging-port=${debugPort}`,'--remote-allow-origins=*',`--user-data-dir=${profile}`,'--window-size=1440,1000',url],{stdio:['ignore','ignore','pipe']});
 chrome.stderr.on('data',b=>{if(log.length<8)log.push(String(b).slice(0,300));});
 let page;
 for(let i=0;i<150&&!page;i++){try{page=(await fetch(`http://127.0.0.1:${debugPort}/json/list`).then(r=>r.json())).find(t=>t.type==='page'&&t.url.startsWith(url));}catch{}if(!page)await delay(100);}
 assert.ok(page,'Standalone laboratory did not load: '+log.join(' '));socket=new WebSocket(page.webSocketDebuggerUrl);
 await new Promise((r,j)=>{socket.addEventListener('open',r,{once:true});socket.addEventListener('error',j,{once:true});});
 let id=0;const pending=new Map();socket.addEventListener('message',e=>{const m=JSON.parse(e.data),p=pending.get(m.id);if(!p)return;pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result);});
 const call=(method,params={})=>new Promise((resolve,reject)=>{pending.set(++id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
 const evalPage=async expression=>{const r=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.text);return r.result.value;};
 const wait=async(expression,msg)=>{for(let i=0;i<180;i++){const r=await evalPage(expression);if(r)return r;await delay(100);}throw Error(msg);};
 const click=async selector=>{assert.ok(await evalPage(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e||e.disabled)return false;e.click();return true})()`),selector);await delay(150);};
 const fluid=()=>evalPage(`document.querySelector('.lektrus-lab-vessel.selected .lektrus-lab-fluid')?.getAttribute('fill')`);
 const add=async formula=>{assert.ok(await evalPage(`(()=>{const e=[...document.querySelectorAll('.lektrus-lab-quick-bottle')].find(x=>x.querySelector('strong')?.textContent===${JSON.stringify(formula)});if(!e||e.disabled)return false;e.click();return true})()`),formula);await delay(150);};
 const play=()=>click('button[aria-label^="Пуск"]');
 const pause=()=>click('button[aria-label^="Пауза"]');
 await wait('!!document.querySelector(".lektrus-lab-quick-bottle")','Lab controls did not render');
 await click('.lektrus-lab-vessel');await add('H2O');const clear=await fluid();assert.ok(clear,'Water must have a visible liquid');
 await add('CuSO4');const blue=await fluid();assert.notEqual(blue,clear,'Copper solution added after water must visibly tint the liquid');
 await add('H2O');const diluted=await fluid();assert.notEqual(diluted,blue,'Dilution must lighten a measured colored solution');
 const overlap=await evalPage(`(()=>{const hint=document.querySelector('.lektrus-lab-pour-hint'),sink=document.querySelector('.lektrus-lab-sink-caption');if(!hint||!sink)return null;const a=hint.getBoundingClientRect(),b=sink.getBoundingClientRect();return a.right>b.left&&a.left<b.right&&a.bottom>b.top&&a.top<b.bottom;})()`);
 assert.equal(overlap,false,'Reaction status must not overlap sink label');
 await add('NaOH');await play();
 await wait('!!document.querySelector(".lektrus-lab-vessel.selected .lektrus-lab-added-solid")','Copper hydroxide must become a visible solid');
 await wait('document.querySelector(".lektrus-lab-equation-history")?.textContent.includes("Cu(OH)2")','Completed precipitation must be recorded on the chalkboard');
 await pause();const solid=await evalPage(`document.querySelector('.lektrus-lab-vessel.selected .lektrus-lab-added-solid path')?.getAttribute('fill')`);
 assert.ok(solid&&solid!=='#e9e7df','Copper hydroxide must not use an uncolored generic powder');
 if(process.env.LAB_QA_SCREENSHOT){await call('Page.enable');const data=await call('Page.captureScreenshot',{format:'png'});await writeFile(process.env.LAB_QA_SCREENSHOT,Buffer.from(data.data,'base64'));}
 console.log(JSON.stringify({clear,blue,diluted,solid}));
}finally{socket?.close();chrome?.kill();await server.close();await delay(200);await rm(profile,{recursive:true,force:true});}
