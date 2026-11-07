import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";

// Execute production Realtime transport with two deterministic simulated peers.
const code=ts.transpileModule(readFileSync(new URL("../src/boardWorkSync.ts",import.meta.url),"utf8"),{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText;
const sockets=[],timers=new Map(),listeners=new Map();
let nextTimer=0;
const clock=(fn,ms)=>{const id=++nextTimer;timers.set(id,{fn,ms});return id};
class Socket{
 static OPEN=1;
 constructor(){this.readyState=0;this.sent=[];sockets.push(this)}
 send(data){this.sent.push(JSON.parse(data))}
 close(){this.readyState=3}
 open(){this.readyState=1;this.onopen?.()}
 message(event,payload,ref,topic="realtime:board-work:board"){
  this.onmessage?.({data:JSON.stringify({topic,event,payload,ref})});
 }
}
const backend={
 isRemoteBackendEnabled:()=>true,
 getRealtimeSocketUrl:()=>"wss://test.invalid/realtime",
 getRemoteSession:async()=>({access_token:"jwt"})
};
const exports={};
new Function("exports","require","WebSocket","setTimeout","clearTimeout",
 "setInterval","clearInterval","window",code)(
 exports,()=>backend,Socket,
 clock,id=>timers.delete(id),
 clock,id=>timers.delete(id),
 {addEventListener:(type,fn)=>listeners.set(type,fn),
  removeEventListener:(type)=>listeners.delete(type)}
);
const received=[];
const sender=exports.connectBoardWorkChannel(
 "board",{userId:"owner",name:"Teacher",role:"owner"},
 ()=>{},()=>{},true,()=>{},()=>{});
await Promise.resolve();await Promise.resolve();
const ws=sockets[0];assert.ok(ws);ws.open();
const join=ws.sent.find(x=>x.event==="phx_join");
ws.message("phx_reply",{status:"ok"},join.ref);
const initial={x:10,y:15,width:120,height:90,rotation:0};
const original="10,15,120,90,0";
const pose=(x)=>[{id:"object",x,y:15,width:120,height:90,rotation:0,origin:original}];
sender.publishTransform(pose(10));
const packets=()=>ws.sent.filter(x=>x.payload?.event==="object_transform")
 .map(x=>x.payload.payload);
assert.equal(packets().length,1,"first transform is immediately visible");
sender.publishTransform(pose(20));
sender.publishTransform(pose(30));
assert.equal(packets().length,1,"rapid frames do not spam Realtime");
sender.publishTransform(pose(40),true);
assert.equal(packets().length,2,"release bypasses the transport throttle");
assert.equal(packets()[1].items[0].x,40,"release does not replay stale queued frames");
assert.equal(packets()[1].finished,true);
assert.ok(packets()[1].seq>packets()[0].seq);
assert.equal([...timers.values()].filter(t=>t.ms<=65).length,0,
 "a pending move is cancelled when the final frame is sent");

const receiver=exports.connectBoardWorkChannel(
 "board",{userId:"viewer",name:"Student",role:"editor"},
 ()=>{},()=>{},false,undefined,message=>received.push(message));
await Promise.resolve();await Promise.resolve();
const peer=sockets[1];peer.open();const peerJoin=peer.sent.find(x=>x.event==="phx_join");
peer.message("phx_reply",{status:"ok"},peerJoin.ref);
const feed=(packet)=>peer.message("broadcast",{event:"object_transform",payload:packet});
feed(packets()[1]);assert.equal(received.length,1);
assert.equal(received[0].items[0].x,40);
feed(packets()[0]);assert.equal(received.length,1,"late packets cannot jump backwards");
feed(packets()[1]);assert.equal(received.length,1,"duplicate packets are ignored");
feed({...packets()[1],clientId:"attacker",seq:1,
 items:[{...pose(5)[0],x:Infinity}]});
feed({...packets()[1],clientId:"attacker",seq:2,
 items:Array.from({length:65},(_,i)=>({...pose(i)[0],id:String(i)}))});
assert.equal(received.length,1,"untrusted invalid/oversized geometry is ignored");
receiver.close();sender.close();
assert.equal(timers.size,0,"close releases timers");
assert.equal(listeners.size,0,"close removes network listeners");

const app=readFileSync(new URL("../src/BoardApp.tsx",import.meta.url),"utf8");
assert.match(app,/workChannel\.current\?\.publishTransform\(poses\)/);
assert.match(app,/workChannel\.current\?\.publishTransform\(poses,true\)/);
assert.match(app,/remoteObjectPoses\[entry\.item\.id\]/);
assert.match(app,/transition:pose\?/);
assert.match(app,/const item=pose\?/);
assert.match(app,/pose\.origin===objectPoseOrigin\(stored\)/,
 "A late broadcast cannot supersede already-saved object geometry");
assert.match(app,/objectPoseMatches\(pose,byId\.get\(id\)!\)/,
 "Once durable data reaches the final pose, release the visual hint after tween");
const helper=readFileSync(new URL("../src/boardObjectMotion.ts",import.meta.url),"utf8");
const helperJs=ts.transpileModule(helper,{compilerOptions:{
 module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const geometry={};new Function("exports",helperJs)(geometry);
assert.equal(geometry.objectPoseOrigin(initial),original);
assert.equal(geometry.objectPoseMatches(initial,{...initial,x:10.0005}),true);
assert.equal(geometry.objectPoseMatches(initial,{...initial,x:40}),false);
assert.match(app,/onTransform|\(mutation\)=>\{\s*\/\/ No broadcast may mutate/);
console.log("Live object transforms: 3 rapid samples + release -> 2 packets, final 40; stale/malformed ignored, cleanup OK.");
