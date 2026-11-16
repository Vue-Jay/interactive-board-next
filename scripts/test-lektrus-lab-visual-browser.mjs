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
 chrome=spawn(chromium,['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--no-first-run','--no-default-browser-check',`--remote-debugging-port=${debugPort}`,'--remote-allow-origins=*',`--user-data-dir=${profile}`,'--window-size=1440,1000','about:blank'],{stdio:['ignore','ignore','pipe']});
 chrome.stderr.on('data',b=>{if(log.length<8)log.push(String(b).slice(0,300));});
 let page;
 for(let i=0;i<450&&!page;i++){try{page=(await fetch(`http://127.0.0.1:${debugPort}/json/list`).then(r=>r.json())).find(t=>t.type==='page');}catch{}if(!page)await delay(100);}
 assert.ok(page,'Standalone laboratory did not load: '+log.join(' '));socket=new WebSocket(page.webSocketDebuggerUrl);
 await new Promise((r,j)=>{socket.addEventListener('open',r,{once:true});socket.addEventListener('error',j,{once:true});});
 let id=0;const pending=new Map();socket.addEventListener('message',e=>{const m=JSON.parse(e.data),p=pending.get(m.id);if(!p)return;pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result);});
 const call=(method,params={})=>new Promise((resolve,reject)=>{pending.set(++id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
 const evalPage=async expression=>{const r=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.text);return r.result.value;};
 await call('Page.enable');await call('Page.navigate',{url});
 const wait=async(expression,msg)=>{for(let i=0;i<300;i++){let r;try{r=await evalPage(expression);}catch{}if(r)return r;await delay(100);}throw Error(msg);};
 const click=async selector=>{assert.ok(await evalPage(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e||e.disabled)return false;e.click();return true})()`),selector);await delay(150);};
 const fluid=()=>evalPage(`document.querySelector('.lektrus-lab-vessel.selected .lektrus-lab-fluid')?.getAttribute('fill')`);
 const add=async formula=>{assert.ok(await evalPage(`(()=>{const e=[...document.querySelectorAll('.lektrus-lab-quick-bottle')].find(x=>x.querySelector('strong')?.textContent===${JSON.stringify(formula)});if(!e||e.disabled)return false;e.click();return true})()`),formula);await delay(150);};
 const play=()=>click('button[aria-label^="Пуск"]');
 const pause=()=>click('button[aria-label^="Пауза"]');
 const place=async(x,y)=>{await evalPage(`(()=>{const e=document.querySelector('.lektrus-lab-bench');const r=e.getBoundingClientRect();e.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,isPrimary:true,button:0,clientX:r.left+r.width*${x},clientY:r.top+r.height*${y}}));})()`);await delay(200);};
 await wait('!!document.querySelector(".lektrus-lab-quick-bottle")','Lab controls did not render');
 await click('summary[aria-label="Настройки опытов"]');
 const evaporationSwitch='[role="switch"][aria-label="Испарение"]';
 const evaporationState=()=>evalPage(`document.querySelector(${JSON.stringify(evaporationSwitch)})?.getAttribute('aria-checked')`);
 assert.equal(await evaporationState(),'false','A new experiment must default to evaporation off');
 await click(evaporationSwitch);assert.equal(await evaporationState(),'true','Evaporation can still be enabled');
 await click(evaporationSwitch);assert.equal(await evaporationState(),'false','Evaporation can be disabled again');
 await click('button[aria-label="Закрыть настройки опыта"]');
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
 // Real measuring controls must transfer liquid without visually moving the
 // collected precipitate, then empty the pipette when the sample is returned.
 await click('button[aria-label="Взять из шкафа Пипетка"]');
 await place(.68,.72);
 await wait('!!document.querySelector(".lektrus-lab-vessel.is-pipette.selected")','Pipette placement must select it');
 await click('button[aria-label="Открыть шкаф посуды"]');
 const measure=async label=>{assert.ok(await evalPage(`(()=>{const e=[...document.querySelectorAll('.lektrus-lab-measuring-cabinet button')].find(x=>x.textContent===${JSON.stringify(label)});if(!e||e.disabled)return false;e.click();return true})()`),label);await delay(150);};
 await measure('Набрать');
 await wait('!!document.querySelector(".lektrus-lab-vessel.is-pipette .lektrus-lab-fluid")','Sample must be visible inside pipette');
 assert.equal(await evalPage('!!document.querySelector(".lektrus-lab-vessel.is-pipette .lektrus-lab-added-solid")'),false,'Pipette must not draw settled precipitate');
 assert.equal(await evalPage('!!document.querySelector(".lektrus-lab-vessel:not(.is-pipette) .lektrus-lab-added-solid")'),true,'Precipitate must remain visible in the donor');
 await measure('Выдать');
 await wait('!document.querySelector(".lektrus-lab-vessel.is-pipette .lektrus-lab-fluid")','Returned sample must visibly empty the pipette');
 await click('.lektrus-lab-furniture-dialog button[aria-label="Закрыть шкаф"]');
 // Actual UI controls: clear, choose new glassware, and check the visual
 // difference between prepared reagents and measured evolving gas.
 await click('button[aria-label="Очистить стол"]');await click('button[aria-label="Подтвердить очистку стола"]');
 await click('button[aria-label="Взять из шкафа Стакан"]');
 await place(.35,.72);
 await wait('!!document.querySelector(".lektrus-lab-vessel.selected")','Glassware placement did not select its new vessel');
 await add('Na2CO3');await add('HCl');
 assert.equal(await evalPage('!!document.querySelector(".lektrus-lab-gas-bubbles")'),false,'Paused preparation must not show gas bubbles');
 await click('.lektrus-lab-gas-stage .lektrus-lab-gas-connect');
 await wait('!!document.querySelector(".lektrus-lab-gas-collector-valve")&&!!document.querySelector(".lektrus-lab-gas-tube")','One click must create the valved receiver and tube');
 await wait(`(()=>{const svg=document.querySelector('.lektrus-lab-gas-tube'),port=document.querySelector('.lektrus-lab-gas-collector-valve [data-lab-gas-port]'),p=svg?.querySelector('path');if(!p||!port)return false;const pt=p.getPointAtLength(p.getTotalLength()).matrixTransform(p.getScreenCTM()),r=port.getBoundingClientRect();return Math.hypot(pt.x-r.left-r.width/2,pt.y-r.top-r.height/2)<3})()`,'Tube must touch the actual valve rather than float above it');
 await play();
 await wait('!!document.querySelector(".lektrus-lab-gas-bubbles circle")&&!!document.querySelector(".lektrus-lab-gas-tube-flow")','Evolving aqueous gas must produce bubbles and visible flow in the tube');
 await wait('parseFloat(document.querySelector(".lektrus-lab-gas-collector-valve text:nth-of-type(2)")?.textContent)>0','Receiver volume must rise during collection');
 if(process.env.LAB_QA_GAS_SCREENSHOT){await call('Page.enable');const data=await call('Page.captureScreenshot',{format:'png'});await writeFile(process.env.LAB_QA_GAS_SCREENSHOT,Buffer.from(data.data,'base64'));}
 await pause();
 await click('.lektrus-lab-gas-capacity .lektrus-lab-gas-connect');
 await wait('!!document.querySelector(".lektrus-lab-vessel.selected .lektrus-lab-gas-collector-valve")','Receiver must be selectable from the producer panel');
 await wait('!!document.querySelector(".lektrus-lab-gas-transfer input")','Measured gas transfer controls must be visible');
 // No historical gram dose is present in a precipitate formed from two
 // measured solutions. Draining every millilitre must not draw fake fluid.
 await click('button[aria-label="Очистить стол"]');await click('button[aria-label="Подтвердить очистку стола"]');
 await click('button[aria-label="Взять из шкафа Стакан"]');await place(.35,.72);
 await add('HCl');await add('AgNO3');await play();
 await wait('document.querySelector(".lektrus-lab-equation-history")?.textContent.includes("AgCl")','Silver chloride precipitation must finish');
 await pause();
 await click('button[aria-label="Взять из шкафа Пипетка"]');await place(.68,.72);
 await click('button[aria-label="Открыть шкаф посуды"]');
 await evalPage(`(()=>{const e=document.querySelector('.lektrus-lab-measuring-cabinet input');const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(e,'20');e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
 await measure('Набрать');
 await wait('!!document.querySelector(".lektrus-lab-vessel.is-pipette .lektrus-lab-fluid")','The full liquid sample must be transferred');
 assert.equal(await evalPage('!!document.querySelector(".lektrus-lab-vessel.is-beaker .lektrus-lab-fluid")'),false,'Dry reaction residue must not draw imaginary fluid');
 assert.equal(await evalPage('!!document.querySelector(".lektrus-lab-vessel.is-beaker .lektrus-lab-added-solid")'),true,'Dry reaction residue must remain visible');
 await click('.lektrus-lab-furniture-dialog button[aria-label="Закрыть шкаф"]');
 await click('.lektrus-lab-vessel.is-beaker');
 const residueTag=await evalPage(`(()=>{const e=document.querySelector('.lektrus-lab-vessel.is-beaker .lektrus-lab-content-tag');return e&&{text:e.textContent,title:e.title};})()`);
 assert.ok(residueTag?.text.includes('AgCl')&&residueTag?.text.includes(' г'),'Dry residue tag must give the product and actual mass');
 assert.ok(residueTag?.title.includes('ммоль'),'Product amount must be derived from the measured ledger');
 // The filter is a reusable physical device, not a one-way material sink.
 await click('button[aria-label="Очистить стол"]');await click('button[aria-label="Подтвердить очистку стола"]');
 await click('button[aria-label="Взять из шкафа Стакан"]');await place(.35,.72);
 await add('H2O');await add('CaCO3');
 await click('button[aria-label="Взять прибор: Мембранный фильтр"]');
 await wait('!!document.querySelector(".lektrus-lab-placed-device.is-filter")','Filter must be placed on the table');
 const points=await evalPage(`(()=>{const h=document.querySelector('.lektrus-lab-bench').getBoundingClientRect(),s=document.querySelector('.lektrus-lab-vessel.is-beaker').getBoundingClientRect(),f=document.querySelector('.lektrus-lab-placed-device.is-filter');return {from:{x:s.left+s.width/2,y:s.top+s.height/2},to:{x:h.left+h.width*parseFloat(f.style.left)/100,y:h.top+h.height*parseFloat(f.style.top)/100}}})()`);
 await call('Input.dispatchMouseEvent',{type:'mousePressed',...points.from,button:'left',buttons:1,clickCount:1});
 for(let i=1;i<=8;i++){const t=i/8;await call('Input.dispatchMouseEvent',{type:'mouseMoved',x:points.from.x+(points.to.x-points.from.x)*t,y:points.from.y+(points.to.y-points.from.y)*t,button:'left',buttons:1});await delay(35);}
 await call('Input.dispatchMouseEvent',{type:'mouseReleased',...points.to,button:'left',buttons:0,clickCount:1});
 await wait('!!document.querySelector(".lektrus-lab-filter-recover")','Filter must retain the calcium carbonate');
 assert.ok((await evalPage('document.querySelector(".lektrus-lab-filter-residue").textContent')).includes('CaCO3'));
 await click('.lektrus-lab-filter-recover');
 await wait('!document.querySelector(".lektrus-lab-filter-recover")','Recovery must empty the cartridge');
 await wait('!!document.querySelector(".lektrus-lab-vessel.selected .lektrus-lab-added-solid")','Recovered solid must be visible in selected vessel');
 console.log(JSON.stringify({clear,blue,diluted,solid}));
}finally{socket?.close();chrome?.kill();await server.close();await delay(200);await rm(profile,{recursive:true,force:true});}
