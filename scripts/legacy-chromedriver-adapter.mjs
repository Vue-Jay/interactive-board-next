#!/usr/bin/env node
// QA transport only. ChromeDriver 2.x returns the original JSON Wire status
// object (status=0, build.version=alpha). Appium 3 expects W3C's 'ready'.
// Translate that successful readiness response; relay every test command and
// response unchanged. Never report readiness if the real driver is unavailable.
import {spawn,spawnSync} from 'node:child_process';
import {createServer,request} from 'node:http';
import {createServer as createSocket} from 'node:net';

const binary=process.env.LEKTRUS_QA_REAL_CHROMEDRIVER;
if(!binary)throw new Error('Missing real ChromeDriver executable');
const args=process.argv.slice(2);
if(args.includes('--version')){
 const result=spawnSync(binary,args,{stdio:'inherit'});
 process.exit(result.status??1);
}
const portIndex=args.findIndex(a=>a.startsWith('--port='));
if(portIndex<0)throw new Error('Expected ChromeDriver --port argument');
const port=Number(args[portIndex].split('=')[1]);
const reservation=createSocket();
await new Promise((resolve,reject)=>reservation.listen(0,'127.0.0.1',resolve).once('error',reject));
const internal=reservation.address().port;
await new Promise(resolve=>reservation.close(resolve));
args[portIndex]=`--port=${internal}`;
const driver=spawn(binary,args,{stdio:'inherit'});
let translated=false;
const proxy=createServer((req,res)=>{
 const upstream=request({host:'127.0.0.1',port:internal,path:req.url,method:req.method,headers:req.headers},reply=>{
  if(req.method!=='GET'||req.url!=='/status'||reply.statusCode!==200){
   res.writeHead(reply.statusCode,reply.headers);reply.pipe(res);return;
  }
  const chunks=[];reply.on('data',c=>chunks.push(c));reply.on('end',()=>{
   let body=Buffer.concat(chunks);
   try{
    const json=JSON.parse(body.toString());
    if(json.status===0&&json.value?.build?.version==='alpha'&&json.value.ready===undefined){
     json.value.ready=true;json.value.message='Legacy ChromeDriver ready';
     body=Buffer.from(JSON.stringify(json));
     if(!translated){translated=true;console.error('Translated successful legacy ChromeDriver readiness status');}
    }
   }catch{/* preserve the real malformed response for Appium to reject */}
   const headers={...reply.headers,'content-length':String(body.length)};
   delete headers['transfer-encoding'];
   res.writeHead(reply.statusCode,headers);res.end(body);
  });
 });
 upstream.on('error',error=>{if(!res.headersSent)res.writeHead(503,{'content-type':'application/json'});res.end(JSON.stringify({value:{ready:false,message:error.message}}));});
 req.pipe(upstream);
});
proxy.listen(port,'127.0.0.1');
proxy.on('error',error=>{console.error(error);driver.kill();process.exitCode=1;});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{driver.kill(signal);proxy.close();});
driver.on('error',error=>{console.error(error);proxy.close();process.exitCode=1;});
driver.on('exit',code=>{proxy.close();process.exitCode=code??1;});
