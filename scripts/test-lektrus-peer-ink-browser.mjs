/** Real Chromium/React SVG regression; no production board or network traffic. */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {createServer} from 'vite';

const chromePath=process.env.CHROME_PATH||['/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser'].find(existsSync);
assert.ok(chromePath,'Chromium is required for this browser regression');
const server=await createServer({server:{host:'127.0.0.1',port:0}});
const profile=await mkdtemp(path.join(tmpdir(),'lektrus-peer-ink-'));
let chrome,ws;
try{
  await server.listen();
  const url=`http://127.0.0.1:${server.httpServer.address().port}/tests/fixtures/lektrus-peer-ink.html`;
  chrome=spawn(chromePath,['--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-gpu','--no-first-run',
    '--remote-debugging-port=0','--remote-allow-origins=*',`--user-data-dir=${profile}`,url],{stdio:['ignore','ignore','pipe']});
  const debuggerUrl=await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(Error('Chromium did not start')),15000);
    chrome.stderr.on('data',chunk=>{
      const match=String(chunk).match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if(match){clearTimeout(timer);resolve(match[1])}
    });
    chrome.once('error',error=>{clearTimeout(timer);reject(error)});
    chrome.once('exit',(code,signal)=>{clearTimeout(timer);reject(Error(`Chromium exited before startup (${code??signal})`))});
  });
  const origin=new URL(debuggerUrl).host;
  let target;
  for(let i=0;i<100&&!target;i++){
    const pages=await fetch(`http://${origin}/json/list`,{signal:AbortSignal.timeout(2000)}).then(r=>r.json());
    target=pages.find(page=>page.type==='page'&&page.url===url);
    if(!target)await delay(100);
  }
  assert.ok(target,'Browser fixture not found');
  ws=new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true})});
  let id=0;
  const evaluate=()=>new Promise((resolve,reject)=>{
    const requestId=++id;
    const timeout=setTimeout(()=>{ws.removeEventListener('message',receive);reject(Error('CDP evaluation timed out'))},5000);
    function receive(event){
      const data=JSON.parse(event.data);
      if(data.id!==requestId)return;
      clearTimeout(timeout);ws.removeEventListener('message',receive);
      if(data.error||data.result?.exceptionDetails)reject(Error(JSON.stringify(data.error||data.result.exceptionDetails)));
      else resolve(data.result?.result?.value);
    }
    ws.addEventListener('message',receive);
    ws.send(JSON.stringify({id:requestId,method:'Runtime.evaluate',params:{expression:'window.result',returnByValue:true}}));
  });
  let result;
  for(let i=0;i<150&&!result;i++){result=await evaluate();if(!result)await delay(100)}
  assert.ok(result,'Browser regression did not finish');
  assert.ok(!result.error,result.error);
  assert.equal(result.packets,2400);
  assert.equal(result.publicationsBeforeChecks,20);
  assert.equal(result.parentRendersDuringInk,0);
  console.log('Peer ink Chromium:',JSON.stringify(result));
}finally{
  ws?.close();
  if(chrome&&chrome.exitCode===null&&chrome.signalCode===null){
    const exiting=new Promise(resolve=>chrome.once('exit',resolve));
    chrome.kill();await exiting;
  }
  await server.close();
  await rm(profile,{recursive:true,force:true});
}
