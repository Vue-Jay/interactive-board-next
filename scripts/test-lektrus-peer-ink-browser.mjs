/** Real Chromium/React SVG regression; no production board or network traffic. */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
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
  const response=await fetch(url,{signal:AbortSignal.timeout(10000)});
  assert.equal(response.status,200,'Vite fixture must be reachable before launching Chrome');
  // Chrome allocates its own debugging port; avoid racing another process
  // for a port released between net.listen() and Chrome startup.
  let debugPort;
  let startupLog='';
  chrome=spawn(chromePath,['--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-gpu',
    '--no-first-run','--disable-extensions','--remote-allow-origins=*',
    '--remote-debugging-port=0','--no-proxy-server',`--user-data-dir=${profile}`,'about:blank'],{stdio:['ignore','ignore','pipe']});
  chrome.stderr.on('data',chunk=>{if(startupLog.length<6000)startupLog+=String(chunk)});
  let target;
  const targetDeadline=Date.now()+60000;
  while(!target&&Date.now()<targetDeadline){
    if(chrome.exitCode!==null||chrome.signalCode!==null)throw Error(`Chromium exited before startup: ${startupLog}`);
    try{
      if(!debugPort){
        const portFile=await readFile(path.join(profile,'DevToolsActivePort'),'utf8');
        debugPort=Number(portFile.split('\n')[0]);
        if(!Number.isInteger(debugPort)||debugPort<=0)throw Error('Invalid debugging port');
      }
      const pages=await fetch(`http://127.0.0.1:${debugPort}/json/list`,{signal:AbortSignal.timeout(2500)}).then(r=>r.json());
      target=pages.find(page=>page.type==='page'&&page.url==='about:blank');
    }catch(error){
      if(error.code!=='ENOENT'&&error.name!=='TimeoutError'&&!(error instanceof TypeError))throw error;
    }
    if(!target)await delay(150);
  }
  assert.ok(target,`Browser fixture not found: ${startupLog}`);
  ws=new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true})});
  let id=0;
  const call=(method,params={})=>new Promise((resolve,reject)=>{
    const requestId=++id;
    const timeout=setTimeout(()=>{ws.removeEventListener('message',receive);reject(Error('CDP evaluation timed out'))},5000);
    function receive(event){
      const data=JSON.parse(event.data);
      if(data.id!==requestId)return;
      clearTimeout(timeout);ws.removeEventListener('message',receive);
      if(data.error||data.result?.exceptionDetails)reject(Error(JSON.stringify(data.error||data.result.exceptionDetails)));
      else resolve(data.result);
    }
    ws.addEventListener('message',receive);
    ws.send(JSON.stringify({id:requestId,method,params}));
  });
  const navigation=await call('Page.navigate',{url});
  assert.ok(!navigation.errorText,navigation.errorText);
  let result;
  const renderDeadline=Date.now()+60000;
  while(!result&&Date.now()<renderDeadline){
    try{
      const evaluated=await call('Runtime.evaluate',{expression:'window.result',returnByValue:true});
      result=evaluated?.result?.value;
    }catch(error){
      if(!/context|navigat/i.test(String(error)))throw error;
    }
    if(!result)await delay(150);
  }
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
