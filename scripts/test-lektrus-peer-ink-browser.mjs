/** Real Chromium/React SVG regression; no production board or network traffic. */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import net from 'node:net';
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
  const portServer=net.createServer();
  await new Promise((resolve,reject)=>portServer.once('error',reject).listen(0,'127.0.0.1',resolve));
  const debugPort=portServer.address().port;
  await new Promise(resolve=>portServer.close(resolve));
  let startupLog='';
  chrome=spawn(chromePath,['--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-gpu',
    '--no-first-run','--disable-extensions','--remote-allow-origins=*',
    `--remote-debugging-port=${debugPort}`,`--user-data-dir=${profile}`,url],{stdio:['ignore','ignore','pipe']});
  chrome.stderr.on('data',chunk=>{if(startupLog.length<6000)startupLog+=String(chunk)});
  let target;
  const targetDeadline=Date.now()+30000;
  while(!target&&Date.now()<targetDeadline){
    if(chrome.exitCode!==null||chrome.signalCode!==null)throw Error(`Chromium exited before startup: ${startupLog}`);
    try{
      const pages=await fetch(`http://127.0.0.1:${debugPort}/json/list`,{signal:AbortSignal.timeout(2500)}).then(r=>r.json());
      target=pages.find(page=>page.type==='page'&&page.url===url);
    }catch(error){
      if(error.name!=='TimeoutError'&&!(error instanceof TypeError))throw error;
    }
    if(!target)await delay(150);
  }
  assert.ok(target,`Browser fixture not found: ${startupLog}`);
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
  assert.equal(result.cursorPackets,2400);
  assert.equal(result.cursorFramePublications,20);
  assert.equal(result.parentRendersDuringCursors,0);
  console.log('Peer ink Chromium:',JSON.stringify(result));
}finally{
  ws?.close();
  if(chrome&&chrome.exitCode===null&&chrome.signalCode===null){
    const exiting=new Promise(resolve=>chrome.once('exit',resolve));
    chrome.kill();await exiting;
  }
  await server.close();
  // Chrome's renderer subprocesses may still finish writing profile files
  // immediately after the browser process exits. Retry the isolated cleanup.
  await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:150});
}
