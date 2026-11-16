import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {preview} from 'vite';
import net from 'node:net';

const chromium=process.env.CHROME_PATH||['/usr/bin/google-chrome','/usr/bin/chromium'].find(existsSync);
assert.ok(chromium,'Chrome required for atlas visual regression');
assert.ok(existsSync('dist/index.html'),'Build the production application before the browser regression');
// Fetch exactly the pinned production geodata from the CI runner. The preview
// endpoint avoids unrelated browser cross-origin/network variability; no map
// shapes, names, records or dates are mocked by this test.
const upstream=/^https:\/\/(?:raw\.githubusercontent\.com\/(?:nvkelso\/natural-earth-vector\/ca96624a56bd078437bca8184e78163e5039ad19|aourednik\/historical-basemaps\/da7a4b735ecef70aebdc9c73e409d8a2500d50f3)\/|cdn\.jsdelivr\.net\/gh\/(?:nvkelso\/natural-earth-vector@ca96624a56bd078437bca8184e78163e5039ad19|aourednik\/historical-basemaps@da7a4b735ecef70aebdc9c73e409d8a2500d50f3)\/)/;
const sourceCache=new Map();
const server=await preview({preview:{host:'127.0.0.1',port:0},plugins:[{name:'atlas-qa-source',configurePreviewServer(s){s.middlewares.use('/__atlas-qa-source',async(req,res)=>{
 const url=new URL(req.url,'http://localhost').searchParams.get('url')??'';
 if(!upstream.test(url)){res.writeHead(400).end('Not an atlas source');return}
 try{
  if(!sourceCache.has(url))sourceCache.set(url,fetch(url,{signal:AbortSignal.timeout(20000)}).then(async r=>{if(!r.ok)throw Error('HTTP '+r.status);return Buffer.from(await r.arrayBuffer())}).catch(e=>{sourceCache.delete(url);throw e}));
  const bytes=await sourceCache.get(url);res.writeHead(200,{'Content-Type':'application/json'}).end(bytes);
 }catch(e){console.error('Atlas source failed:',url,String(e));res.writeHead(502).end('Upstream unavailable')}
})}}]});
const profile=await mkdtemp(join(tmpdir(),'lektrus-atlas-qa-'));
let chrome,socket;
try{
 const origin=`http://127.0.0.1:${server.httpServer.address().port}`;
 const portServer=net.createServer();await new Promise((r,j)=>portServer.once('error',j).listen(0,'127.0.0.1',r));
 const debugPort=portServer.address().port;await new Promise(r=>portServer.close(r));
 const log=[];
 chrome=spawn(chromium,['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--no-first-run','--no-default-browser-check',`--remote-debugging-port=${debugPort}`,'--remote-allow-origins=*',`--user-data-dir=${profile}`,'--window-size=1440,1000','about:blank'],{stdio:['ignore','ignore','pipe']});
 chrome.stderr.on('data',b=>{if(log.length<8)log.push(String(b).slice(0,300))});
 let page;
 for(let i=0;i<450&&!page;i++){try{page=(await fetch(`http://127.0.0.1:${debugPort}/json/list`).then(r=>r.json())).find(t=>t.type==='page')}catch{}if(!page)await delay(100)}
 assert.ok(page,'Chrome could not start: '+log.join(' '));socket=new WebSocket(page.webSocketDebuggerUrl);
 await new Promise((r,j)=>{socket.addEventListener('open',r,{once:true});socket.addEventListener('error',j,{once:true})});
 let id=0;const pending=new Map();socket.addEventListener('message',e=>{const m=JSON.parse(e.data),p=pending.get(m.id);if(!p)return;pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result)});
 const call=(method,params={})=>new Promise((resolve,reject)=>{pending.set(++id,{resolve,reject});socket.send(JSON.stringify({id,method,params}))});
 const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.text);return r.result.value};
 const wait=async(expression,label)=>{for(let i=0;i<450;i++){try{const r=await evaluate(expression);if(r)return r}catch{}await delay(100)}throw Error(label+'; visible text: '+String(await evaluate('document.body.innerText')).slice(0,500))};
 const click=async(selector,text)=>{assert.ok(await evaluate(`(()=>{const el=[...document.querySelectorAll(${JSON.stringify(selector)})].find(e=>!e.disabled&&${text?`e.textContent.includes(${JSON.stringify(text)})`:'true'});if(!el)return false;el.click();return true})()`),selector+' '+(text??''));await delay(120)};
 const screenshot=async name=>{if(!process.env.ATLAS_QA_SCREENSHOTS)return;const p=await call('Page.captureScreenshot',{format:'png'});await writeFile(name,Buffer.from(p.data,'base64'))};
 const mapReady='document.querySelectorAll(".lektrus-atlas-country").length>10&&!document.querySelector(".lektrus-atlas-failure")';
 await call('Page.enable');
 await call('Page.addScriptToEvaluateOnNewDocument',{source:`(()=>{const original=window.fetch.bind(window);window.fetch=(input,options)=>{const url=typeof input==='string'?input:input instanceof URL?input.href:input.url;if(${upstream.toString()}.test(url))return original('/__atlas-qa-source?url='+encodeURIComponent(url),options);return original(input,options)}})()`});
 await call('Page.navigate',{url:origin+'/tools/atlas'});
 await wait(mapReady,'Geographic map failed to load real country polygons');
 if(await evaluate('document.querySelector(".lektrus-atlas-inspector-toggle")?.getAttribute("aria-expanded")==="false"'))await click('.lektrus-atlas-inspector-toggle');
 await wait('!!document.querySelector("input[placeholder=\"Страна, регион или город\"]")','Geography search field not displayed');
 await evaluate(`(()=>{const field=document.querySelector('input[placeholder="Страна, регион или город"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(field,'Бурунди');field.dispatchEvent(new Event('input',{bubbles:true}))})()`);
 await wait('[...document.querySelectorAll(".lektrus-atlas-search-results button")].some(b=>b.textContent.trim()==="Бурунди")','Burundi not searchable');
 await click('.lektrus-atlas-search-results button','Бурунди');
 await wait('[...document.querySelectorAll(".lektrus-atlas-country-capitals button")].some(b=>b.textContent.includes("Гитега"))','Corrected capital missing in country card');
 assert.ok(await evaluate('![...document.querySelectorAll(".lektrus-atlas-country-capitals button")].some(b=>b.textContent.includes("◆ Бужумбура"))'),'Former capital must not be listed as the political capital');
 await click('.lektrus-atlas-country-capitals button','Гитега');
 await wait('document.body.innerText.includes("Политическая столица Бурунди с 2019 года")','Capital explanation did not render');
 await wait('[...document.querySelectorAll("a")].some(a=>a.href.includes("primature.gov.bi/presentation-generale"))','Government source not exposed in the real card');
 await screenshot('atlas-geography-qa.png');

 await call('Page.navigate',{url:origin+'/demo/board?scene=history&capture=1'});
 await wait('[...document.querySelectorAll(".lektrus-atlas-header button")].some(b=>b.textContent.trim()==="Карта событий")','History atlas not displayed');
 await click('.lektrus-atlas-header button','Карта событий');
 if(await evaluate('document.querySelector(".lektrus-atlas-inspector-toggle")?.getAttribute("aria-expanded")==="false"'))await click('.lektrus-atlas-inspector-toggle');
 await wait('!!document.querySelector(".lektrus-history-period-select")','Timeline not available');
 await evaluate(`(()=>{const field=document.querySelector('.lektrus-history-period-select');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(field,'1945');field.dispatchEvent(new Event('change',{bubbles:true}))})()`);
 await wait('[...document.querySelectorAll(".lektrus-atlas-history-events button")].some(b=>b.textContent.includes("Окончание Второй мировой войны"))','1945 event list missing');
 await wait(mapReady,'Historical map failed to load real country polygons');
 await click('.lektrus-atlas-history-events button','Окончание Второй мировой войны');
 await wait('document.body.innerText.includes("2 сентября 1945 года")','Correct date and event description did not render');
 assert.ok(await evaluate('[...document.querySelectorAll("a")].some(a=>a.href.includes("archives.gov/milestone-documents/surrender-of-japan"))'),'Primary historical source is missing');
 assert.ok(await evaluate('[...document.querySelectorAll(".lektrus-atlas-user-pin title")].some(t=>t.textContent.includes("Капитуляция Германии"))'),'European surrender marker is missing');
 assert.ok(await evaluate('[...document.querySelectorAll(".lektrus-atlas-description")].some(e=>e.innerText.includes("2 сентября 1945 года")&&e.getBoundingClientRect().width>0&&e.getBoundingClientRect().height>0)'),'Event card is not visible');
 await screenshot('atlas-history-qa.png');
 console.log('Atlas browser visual regression: live geography polygons, Gitega capital, date and source card, 1945 timeline and separate Japanese and German surrender events passed.');
}catch(error){console.error('Atlas visual regression failed:',error);throw error}
finally{
 socket?.close();
 if(chrome&&chrome.exitCode===null){chrome.kill();await Promise.race([new Promise(r=>chrome.once('exit',r)),delay(3000)])}
 await server.close();
 await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200}).catch(e=>console.warn('QA profile cleanup:',e.message));
}
