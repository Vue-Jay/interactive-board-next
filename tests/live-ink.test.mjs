import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function harness(){
  const sockets=[], timers=new Map(), listeners=new Map(), received=[];
  let nextTimer=0;
  class Socket {
    static OPEN=1;
    readyState=0;
    sent=[];
    constructor(){sockets.push(this)}
    send(payload){this.sent.push(JSON.parse(payload))}
    close(){this.readyState=3}
    open(){this.readyState=1;this.onopen?.()}
    message(event,payload={},topic='realtime:board-cursors:board-1',ref=null){
      this.onmessage?.({data:JSON.stringify({event,payload,topic,ref})});
    }
    join(){
      const request=this.sent.find(entry=>entry.event==='phx_join');
      assert.ok(request,'channel join must be sent');
      this.message('phx_reply',{status:'ok'},request.topic,request.ref);
    }
  }
  const backend={
    isRemoteBackendEnabled:()=>true,
    getRealtimeSocketUrl:()=> 'wss://example.invalid',
    getRemoteSession:async()=>({access_token:'token'})
  };
  const source=readFileSync(new URL('../src/boardBroadcast.ts',import.meta.url),'utf8');
  const exports={};
  const schedule=(callback,ms)=>{const id=++nextTimer;timers.set(id,{callback,ms});return id};
  vm.runInNewContext(ts.transpileModule(source,{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
  }).outputText,{
    exports,require:()=>backend,WebSocket:Socket,
    setTimeout:schedule,clearTimeout:id=>timers.delete(id),
    setInterval:schedule,clearInterval:id=>timers.delete(id),
    window:{addEventListener:(name,cb)=>listeners.set(name,cb),
      removeEventListener:name=>listeners.delete(name)},
    crypto:{randomUUID:()=> 'sender-client'},
    navigator:{onLine:true},
  });
  const channel=exports.connectBoardCursorChannel('board-1',
    {userId:'teacher',name:'Teacher',role:'owner'},()=>{},true,
    ink=>received.push(ink));
  const tick=async()=>{for(let i=0;i<10;i++)await Promise.resolve()};
  const packets=ws=>ws.sent.filter(entry=>entry.event==='broadcast'&&
    entry.payload?.event==='live_ink').map(entry=>entry.payload.payload);
  const fire=ms=>{const entry=[...timers].find(([,t])=>t.ms===ms);
    assert.ok(entry,'expected timer '+ms);timers.delete(entry[0]);entry[1].callback()};
  return {sockets,received,channel,tick,packets,fire,timers};
}
const ink=(id,finished=false)=>({id,kind:'pen',color:'#000',weight:3,
  points:[{x:1,y:1},{x:2,y:2}],finished});

test('two completed handwritten strokes survive channel join delay',async()=>{
  const h=harness();
  h.channel.sendInk(ink('a'));
  h.channel.sendInk(ink('a',true));
  h.channel.sendInk(ink('b'));
  h.channel.sendInk(ink('b',true));
  await h.tick();
  const ws=h.sockets[0];ws.open();ws.join();
  const finals=h.packets(ws).filter(p=>p.finished).map(p=>p.id);
  assert.deepEqual(finals,['a','b'],'every completed stroke needs its own packet');
  h.channel.close();
});

test('after reconnect completed strokes are not replaced by newer previews',async()=>{
  const h=harness();await h.tick();
  let ws=h.sockets[0];ws.open();ws.join();
  h.channel.sendInk(ink('existing',true));
  // This final packet was ACKed before the connection dropped. UnACKed
  // packets have a separate test and MUST be replayed after reconnect.
  const confirmed=ws.sent.filter(item=>item.payload?.event==='live_ink').at(-1);
  ws.message('phx_reply',{status:'ok'},confirmed.topic,confirmed.ref);
  ws.onclose();
  h.channel.sendInk(ink('offline-a',true));
  h.channel.sendInk(ink('offline-b',true));
  h.fire(1000);await h.tick();
  ws=h.sockets[1];ws.open();ws.join();
  assert.deepEqual(h.packets(ws).filter(p=>p.finished).map(p=>p.id),
    ['offline-a','offline-b']);
  h.channel.close();
});

test('receiving the latest live ink packet keeps stroke identity',async()=>{
  const h=harness();await h.tick();
  const ws=h.sockets[0];ws.open();ws.join();
  ws.message('broadcast',{event:'live_ink',payload:{
    ...ink('handwriting',true),userId:'other',clientId:'remote-client'}});
  assert.equal(h.received[0]?.id,'handwriting');
  assert.equal(h.received[0]?.finished,true);
  h.channel.close();
});


test('final stroke awaiting server acknowledgement is resent after network change',async()=>{
  const h=harness();await h.tick();
  let ws=h.sockets[0];ws.open();ws.join();
  h.channel.sendInk(ink('unconfirmed',true));
  assert.deepEqual(h.packets(ws).filter(p=>p.finished).map(p=>p.id),
    ['unconfirmed']);
  // No phx_reply arrived before cellular network changed.
  ws.onclose();
  h.fire(1000);await h.tick();
  ws=h.sockets[1];ws.open();ws.join();
  assert.deepEqual(h.packets(ws).filter(p=>p.finished).map(p=>p.id),
    ['unconfirmed'],'unacknowledged final stroke must survive reconnect');
  h.channel.close();
});

test('acknowledged final stroke is not replayed on reconnect',async()=>{
  const h=harness();await h.tick();
  let ws=h.sockets[0];ws.open();ws.join();
  h.channel.sendInk(ink('confirmed',true));
  const message=ws.sent.filter(item=>item.payload?.event==='live_ink').at(-1);
  assert.ok(message);
  ws.message('phx_reply',{status:'ok'},message.topic,message.ref);
  ws.onclose();
  h.fire(1000);await h.tick();
  ws=h.sockets[1];ws.open();ws.join();
  assert.deepEqual(h.packets(ws).map(p=>p.id),[],
    'ACKed ink is durable in the realtime channel and needs no replay');
  h.channel.close();
});


test('long stroke sends only new points, then a complete final recovery window',async()=>{
  const h=harness();await h.tick();
  const ws=h.sockets[0];ws.open();ws.join();
  const points=count=>Array.from({length:count},(_,i)=>({x:i,y:i*.5}));
  const sample=(count,finished=false)=>({
    id:'very-long',kind:'pen',color:'#234',weight:3,
    points:points(count),offset:0,finished
  });
  h.channel.sendInk(sample(20));
  assert.equal(h.packets(ws).length,1);
  assert.equal(h.packets(ws)[0].points.length,20);
  h.channel.sendInk(sample(30));
  assert.equal(h.packets(ws).length,1,'intermediate state must be throttled');
  const shortTimer=[...h.timers.values()].find(t=>t.ms<1000);
  assert.ok(shortTimer,'a coalesced incremental packet is scheduled');
  h.fire(shortTimer.ms);
  assert.equal(h.packets(ws).length,2);
  assert.equal(h.packets(ws)[1].offset,20);
  assert.equal(h.packets(ws)[1].points.length,10,
    'previously transmitted points must not be sent twice');
  h.channel.sendInk(sample(40,true));
  assert.equal(h.packets(ws).length,3,'a completed line is sent immediately');
  assert.equal(h.packets(ws)[2].offset,0);
  assert.equal(h.packets(ws)[2].points.length,40,
    'the last window recovers a dropped incremental packet');
  assert.equal(h.packets(ws)[2].finished,true);
  h.channel.close();
  assert.equal(h.timers.size,0);
});

test('incremental previews stitch into long strokes, reject stale packets and bound memory',()=>{
  const source=readFileSync(new URL('../src/boardLiveInk.ts',import.meta.url),'utf8');
  const api={};
  vm.runInNewContext(ts.transpileModule(source,{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
  }).outputText,{exports:api});
  const points=(from,to)=>Array.from({length:to-from},(_,i)=>({x:from+i,y:from+i}));
  const packet=(start,end,finished=false)=>({
    id:'stroke',clientId:'peer',userId:'other',kind:'pen',color:'#000',
    weight:3,offset:start,points:points(start,end),finished
  });
  let preview=api.mergeRemoteLiveInk(undefined,packet(0,500));
  preview=api.mergeRemoteLiveInk(preview,packet(500,510));
  assert.equal(preview.points.length,510,'the first 500 points remain visible');
  assert.equal(preview.points[0].x,0);
  assert.equal(preview.points.at(-1).x,509);
  preview=api.mergeRemoteLiveInk(preview,packet(510,620));
  const earlier=api.mergeRemoteLiveInk(preview,packet(500,510));
  assert.strictEqual(earlier,preview,'a delayed old packet cannot rewind handwriting');
  const finished=api.mergeRemoteLiveInk(preview,packet(120,620,true));
  assert.equal(finished.finished,true);
  assert.equal(finished.points.length,620,
    'the final overlapping window must retain the early part of the stroke');
  assert.strictEqual(api.mergeRemoteLiveInk(finished,packet(400,510)),finished);
  const gap=api.mergeRemoteLiveInk(packet(0,50),packet(100,130));
  assert.equal(gap.offset,100,'a dropped packet cannot create a false diagonal stroke');
  assert.equal(gap.points[0].x,100);
  let long=packet(0,500);
  for(let i=500;i<6000;i+=100){
    long=api.mergeRemoteLiveInk(long,packet(i,i+100));
  }
  assert.equal(long.points.length,api.MAX_REMOTE_LIVE_INK_POINTS);
  assert.equal(long.offset,2000);
  const old={...packet(0,3)};delete old.offset;
  assert.equal(api.mergeRemoteLiveInk(long,old),old,'legacy peers remain compatible');
  const app=readFileSync(new URL('../src/BoardApp.tsx',import.meta.url),'utf8');
  assert.match(app,/mergeRemoteLiveInk\(current\[ink\.id\],ink\)/);
  assert.match(app,/offset:Math\.max\(0,g\.path\.length-500\)/);
});


test('packet loss never erases already visible peer ink or invents a connecting line',()=>{
  const source=readFileSync(new URL('../src/boardLiveInk.ts',import.meta.url),'utf8');
  const api={};
  vm.runInNewContext(ts.transpileModule(source,{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
  }).outputText,{exports:api});
  const packet=(from,to,finished=false)=>({
    id:'peer-stroke',clientId:'peer',userId:'other',kind:'pen',
    color:'#000',weight:3,offset:from,
    points:Array.from({length:to-from},(_,i)=>({x:from+i,y:from+i})),
    finished
  });
  let preview=api.mergeRemoteLiveInk(undefined,packet(0,50));
  preview=api.mergeRemoteLiveInk(preview,packet(100,130));
  assert.equal(preview.offset,100);
  assert.equal(preview.priorRuns.length,1,
    'a missing packet must not erase the first 50 already visible points');
  assert.deepEqual(Array.from(api.remoteInkRuns(preview),run=>[run.offset,run.points.length]),
    [[0,50],[100,30]],'separate SVG runs must never bridge the 50-point gap');
  const missed=packet(50,100);
  preview=api.mergeRemoteLiveInk(preview,missed);
  assert.equal(preview.priorRuns,undefined,'late packet stitches the missing gap');
  assert.equal(preview.offset,0);
  assert.equal(preview.points.length,130);
  assert.equal(preview.points.at(-1).x,129);
  assert.strictEqual(api.mergeRemoteLiveInk(preview,missed),preview,
    'a repeated packet cannot redraw or rewind a continuous line');

  // Even if a final window does not fill a much older missing range, the
  // fragment already drawn by the peer remains on the canvas.
  let finalWithGap=api.mergeRemoteLiveInk(undefined,packet(0,50));
  finalWithGap=api.mergeRemoteLiveInk(finalWithGap,packet(100,130));
  finalWithGap=api.mergeRemoteLiveInk(finalWithGap,packet(80,150,true));
  assert.equal(finalWithGap.finished,true);
  assert.deepEqual(Array.from(api.remoteInkRuns(finalWithGap),run=>[run.offset,run.points.length]),
    [[0,50],[80,70]],'missing samples are not joined by false geometry');
  assert.equal(api.remoteInkRuns(finalWithGap)[0].points[0].x,0);
  const repaired=api.mergeRemoteLiveInk(finalWithGap,packet(50,80));
  assert.equal(repaired.finished,true,'late recovery must not reopen the finished stroke');
  assert.equal(repaired.priorRuns,undefined,
    'a delayed pre-final packet joins the already displayed fragments');
  assert.equal(repaired.offset,0);
  assert.equal(repaired.points.length,150);
  assert.strictEqual(api.mergeRemoteLiveInk(repaired,packet(151,160)),repaired,
    'no intermediate sample may extend a completed stroke beyond its final point');
});

test('disconnected peer-ink history remains bounded and renderable',()=>{
  const source=readFileSync(new URL('../src/boardLiveInk.ts',import.meta.url),'utf8');
  const api={};
  vm.runInNewContext(ts.transpileModule(source,{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
  }).outputText,{exports:api});
  let preview;
  for(let block=0;block<100;block++){
    const offset=block*100;
    preview=api.mergeRemoteLiveInk(preview,{
      id:'network-jitter',clientId:'peer',userId:'other',kind:'marker',
      color:'#123',weight:6,offset,finished:false,
      points:Array.from({length:50},(_,i)=>({x:offset+i,y:offset+i}))
    });
  }
  const runs=api.remoteInkRuns(preview);
  assert.ok(runs.length>1,'network loss remains visible as separate fragments');
  assert.equal(runs.reduce((sum,run)=>sum+run.points.length,0),
    api.MAX_REMOTE_LIVE_INK_POINTS,'RAM is bounded across ALL disconnected runs');
  const app=readFileSync(new URL('../src/BoardApp.tsx',import.meta.url),'utf8');
  assert.match(app,/uncommittedRemoteInk\.flatMap\(ink => remoteInkRuns\(ink\)\.map\(run/);
  assert.match(app,/key=\{ink\.id\+":"\+run\.offset\}/,
    'recovered fragments must keep independent SVG element identity');
});
