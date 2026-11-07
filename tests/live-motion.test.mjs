import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import {test} from "node:test";

const src=(name)=>readFileSync(new URL("../src/"+name,import.meta.url),"utf8");
const compile=(name)=>ts.transpileModule(src(name),{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText;
const motion={};
vm.runInNewContext(compile("boardLiveMotion.ts"),{exports:motion});

test("1200-point stroke remains continuous while 500-point packets slide forward",()=>{
 const points=Array.from({length:1200},(_,i)=>({x:i,y:i/2}));
 let preview;
 for(const end of [1,400,510,690,900,1080,1200]){
  const start=Math.max(0,end-500);
  preview=motion.mergeLiveInkPreview(preview,{id:"stroke",clientId:"peer",
   points:points.slice(start,end),startIndex:start,finished:end===1200});
  assert.equal(preview.points.length,end);
 }
 assert.equal(preview.points[0].x,0);
 assert.equal(preview.points.at(-1).x,1199);
 assert.equal(preview.finished,true);
 const late=motion.mergeLiveInkPreview(preview,{id:"stroke",clientId:"peer",
   points:points.slice(400,900),startIndex:400,finished:false});
 assert.equal(late.points.length,1200,"stale window must not shorten the stroke");
});

test("invalid geometry never becomes a live preview; final geometry matches authoritative storage",()=>{
 const item={id:"shape",x:20,y:30,width:80,height:60,rotation:0};
 const geometry=motion.captureLiveGeometry([item],["shape"]);
 assert.equal(geometry.length,1);
 assert.equal(motion.sameLiveGeometry(item,geometry[0]),true);
 assert.equal(motion.sameLiveGeometry({...item,x:21},geometry[0]),false);
 assert.equal(motion.sameLiveGeometry({...item,rotation:360},geometry[0]),true);
 assert.equal(motion.validLiveGeometry({...geometry[0],x:Infinity}),false);
 assert.equal(motion.validLiveGeometry({...geometry[0],width:-4}),false);
 assert.equal(motion.captureLiveGeometry([item],["unknown"]).length,0);
 assert.equal(motion.captureLiveGeometry([item],Array(65).fill("shape")).length,0);
});

function harness(){
 const sockets=[],timers=new Map(),received=[],listeners=new Map();
 let timerId=0,now=1000;
 class Socket {
  static OPEN=1;
  readyState=0;
  sent=[];
  constructor(){sockets.push(this)}
  close(){this.readyState=3}
  send(json){
   const frame=JSON.parse(json);
   this.sent.push(frame);
   if(frame.event!=="broadcast")return;
   // Supabase topic broadcasts the same ephemeral event to the other viewer.
   for(const other of sockets)if(other!==this&&other.readyState===Socket.OPEN){
    other.onmessage?.({data:JSON.stringify(frame)});
   }
  }
  open(){
   this.readyState=Socket.OPEN;
   this.onopen?.();
   const joined=this.sent.find(frame=>frame.event==="phx_join");
   assert.ok(joined);
   this.onmessage?.({data:JSON.stringify({topic:joined.topic,event:"phx_reply",
    ref:joined.ref,payload:{status:"ok"}})});
  }
  message(frame){this.onmessage?.({data:JSON.stringify(frame)})}
 }
 const backend={
  getRealtimeSocketUrl:()=> "wss://test.invalid",
  getRemoteSession:async()=>({access_token:"test-jwt"}),
  isRemoteBackendEnabled:()=>true
 };
 const exports={};
 vm.runInNewContext(compile("boardWorkSync.ts"),{
  exports,
  require:name=>name==="./backend"?backend:name==="./boardLiveMotion"?motion:
   (()=>{throw new Error("Unexpected module "+name)})(),
  WebSocket:Socket,Date:class extends Date{static now(){return now}},
  setTimeout:(fn,ms)=>{const id=++timerId;timers.set(id,{fn,ms});return id},
  clearTimeout:id=>timers.delete(id),
  setInterval:(fn,ms)=>{const id=++timerId;timers.set(id,{fn,ms,interval:true});return id},
  clearInterval:id=>timers.delete(id),
  window:{addEventListener:(name,fn)=>listeners.set(fn,name),
   removeEventListener:(name,fn)=>listeners.delete(fn)}
 });
 const person=id=>({userId:id,name:id,role:"editor"});
 const channels=[
  exports.connectBoardWorkChannel("board-1",person("teacher"),()=>{},()=>{},true,()=>{},event=>received.push(event)),
  exports.connectBoardWorkChannel("board-1",person("student"),()=>{},()=>{},true,()=>{},event=>received.push(event))
 ];
 const tick=async()=>{for(let i=0;i<10;i++)await Promise.resolve()};
 const fire=ms=>{
  const entry=[...timers].find(([,t])=>t.ms===ms);
  assert.ok(entry,"expected "+ms+"ms timer");
  timers.delete(entry[0]);entry[1].fn();
 };
 const close=()=>{channels.forEach(c=>c.close());assert.equal(timers.size,0);assert.equal(listeners.size,0)};
 return {sockets,channels,received,timers,tick,fire,close,advance:ms=>now+=ms};
}
const rectangle=(x)=>({id:"one",x,y:0,width:120,height:80,rotation:0});

test("two peers see coalesced movement then final position without a stale move",async()=>{
 const h=harness();await h.tick();
 assert.equal(h.sockets.length,2);
 h.sockets.forEach(ws=>ws.open());
 h.channels[0].publishTransform([rectangle(10)],"move");
 assert.equal(h.received.length,1);
 h.channels[0].publishTransform([rectangle(20)],"move");
 h.channels[0].publishTransform([rectangle(30)],"move");
 assert.equal(h.received.length,1,"rapid moves must share one bounded timer");
 const lateMove=h.sockets[0].sent.at(-1);
 h.channels[0].publishTransform([rectangle(40)],"finish");
 assert.deepEqual(h.received.map(x=>x.items[0].x),[10,40]);
 assert.equal(h.received.at(-1).phase,"finish");
 assert.equal([...h.timers.values()].some(x=>x.ms<=45),false,"finish cancels pending intermediate move");
 h.sockets[1].message(lateMove);
 assert.equal(h.received.length,2,"old sequence must not rewind final position");
 h.channels[0].publishTransform([rectangle(50)],"move");
 assert.equal(h.received.length,2,"realtime must rate-limit subsequent movement");
 h.advance(45);h.fire(45);
 assert.deepEqual(h.received.map(x=>x.items[0].x),[10,40,50]);
 h.channels[0].publishTransform([rectangle(50)],"cancel");
 assert.equal(h.received.at(-1).phase,"cancel");
 h.close();
});

test("malformed peer packets are ignored and cannot mutate the saved board",async()=>{
 const h=harness();await h.tick();h.sockets.forEach(ws=>ws.open());
 const fake={topic:"realtime:board-work:board-1",event:"broadcast",
  payload:{event:"board_transform",payload:{clientId:"fake",userId:"attacker",
   sequence:1,phase:"move",items:[{...rectangle(1),x:NaN}]}}};
 h.sockets[1].message(fake);
 assert.equal(h.received.length,0);
 assert.match(src("App.tsx"),/sameLiveGeometry\(indexed\.get\(id\),p\)/,
  "final preview must remain until authenticated geometry matches");
 assert.match(src("App.tsx"),/publishGestureMotion\(g,"move"\)/);
 assert.match(src("App.tsx"),/publishGestureMotion\(g,cancel\?"cancel":"finish"\)/);
 h.close();
});
