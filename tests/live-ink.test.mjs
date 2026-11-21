import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {randomUUID} from 'node:crypto';

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
    exports,require:name=>{
      if(name==="./selfhostApi")return {isSelfhostBackendEnabled:()=>false};
      assert.equal(name,"./backend");
      return backend;
    },WebSocket:Socket,
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
  assert.strictEqual(api.mergeRemoteLiveInk(finished,packet(120,620,true)),finished,
    'duplicate final packets must not invalidate the snapshot');
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
  assert.match(app,/remoteInkStore\.push\(ink\)/);
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
  const overlay=readFileSync(new URL('../src/RemoteInkOverlay.tsx',import.meta.url),'utf8');
  assert.match(overlay,/remoteInkRuns\(ink\)\.map\(run/);
  assert.match(overlay,/key=\{ink\.id\+":"\+run\.offset\}/,
    'recovered fragments must keep independent SVG element identity');
});

function inkStoreHarness(){
  const source=readFileSync(new URL('../src/boardLiveInk.ts',import.meta.url),'utf8');
  const api={};
  vm.runInNewContext(ts.transpileModule(source,{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
  }).outputText,{exports:api});
  let now=0,sequence=0;
  const frames=new Map(),timers=new Map();
  const scheduler={now:()=>now,requestFrame:fn=>{frames.set(++sequence,fn);return sequence},
    cancelFrame:id=>frames.delete(id),setTimer:(fn,delay)=>{timers.set(++sequence,{fn,at:now+delay});return sequence},
    clearTimer:id=>timers.delete(id)};
  const frame=()=>{for(const [id,fn] of [...frames]){if(frames.delete(id))fn()}};
  const advance=ms=>{
    const end=now+ms;
    for(;;){
      const next=[...timers].filter(([,timer])=>timer.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];
      if(!next)break;
      now=next[1].at;timers.delete(next[0]);next[1].fn();
    }
    now=end;
  };
  const packet=(id,start,end,finished=false)=>({id,clientId:id,userId:id,kind:'pen',color:'#000',
    weight:3,offset:start,points:Array.from({length:end-start},(_,i)=>({x:start+i,y:start+i})),finished});
  return {api,store:api.createRemoteInkStore(scheduler),scheduler,frame,advance,frames,timers,packet};
}

test('30 simultaneous peers publish one snapshot per frame without dropping points or completions',()=>{
  const h=inkStoreHarness(),expected=new Map();
  let updates=0,packets=0;
  const unsubscribe=h.store.subscribe(()=>updates++);
  const old=h.store.getSnapshot();
  const send=ink=>{packets++;expected.set(ink.id,h.api.mergeRemoteLiveInk(expected.get(ink.id),ink));h.store.push(ink)};
  for(let f=0;f<20;f++){
    for(let peer=0;peer<30;peer++){
      const id=`peer-${peer}`,start=f*20;
      send(h.packet(id,start,start+5));
      send(h.packet(id,start+10,start+15)); // gap
      send(h.packet(id,start+5,start+10)); // late repair
      send(h.packet(id,start+15,start+20,f===19));
    }
    assert.equal(updates,f,'no React notification before frame');
    assert.equal(h.frames.size,1);
    assert.equal(h.timers.size,2,'one expiry and one fallback for all strokes');
    h.frame();
    assert.equal(updates,f+1);
    assert.equal(h.timers.size,1);
  }
  assert.equal(old.size,0,'previous snapshots stay immutable');
  assert.equal(JSON.stringify([...h.store.getSnapshot()]),JSON.stringify([...expected]));
  const snapshot=h.store.getSnapshot();
  h.store.push(h.packet('peer-0',395,400,true));h.frame();
  assert.strictEqual(h.store.getSnapshot(),snapshot);
  assert.equal(updates,20,'duplicate final does not repaint');
  unsubscribe();h.store.reset();
  assert.equal(h.timers.size,0);assert.equal(h.frames.size,0);
  console.log(`Peer ink: ${packets} packets, ${updates} overlay publications (${packets/updates}x fewer), no lost points`);
});

test('hidden-tab fallback, expiry refresh, board cleanup and resubscription remain safe',()=>{
  const h=inkStoreHarness();let updates=0;
  h.store.subscribe(()=>updates++);
  h.store.push(h.packet('early',0,10,true));h.store.push(h.packet('late',0,10));
  h.advance(49);assert.equal(updates,0);
  h.advance(1);assert.equal(updates,1);assert.equal(h.frames.size,0);
  h.advance(100_000);h.store.push(h.packet('late',0,10));
  h.advance(19_950);h.frame();
  assert.equal(h.store.getSnapshot().has('early'),false);
  assert.equal(h.store.getSnapshot().has('late'),true,'duplicates refresh TTL without rendering');
  h.advance(100_050);h.frame();assert.equal(h.store.getSnapshot().size,0);
  h.store.push(h.packet('old-board',0,2));h.store.reset();
  assert.equal(h.frames.size,0);assert.equal(h.timers.size,0);
  h.store.push(h.packet('new-board',0,3,true));h.frame();
  assert.deepEqual([...h.store.getSnapshot().keys()],['new-board']);
  h.store.reset();assert.equal(h.store.getSnapshot().size,0);
});

function loadMotionModule(path,dependencies={}){
  const source=readFileSync(new URL(`../src/${path}`,import.meta.url),'utf8'),api={};
  vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:api,require:name=>dependencies[name],crypto:{randomUUID}});
  return api;
}
test('authoritative ink never reappears after erase, and cancel removes live erase immediately',()=>{
  const h=inkStoreHarness();
  h.store.push(h.packet('saved',0,10,true));h.frame();
  h.store.acknowledge(['saved']);
  assert.equal(h.store.getSnapshot().size,0);
  h.store.push(h.packet('saved',5,10,true));h.frame();
  assert.equal(h.store.getSnapshot().size,0);
  const erase={...h.packet('erase',0,10),kind:'eraser'};
  h.store.push(erase);h.frame();assert.ok(h.store.getSnapshot().has('erase'));
  h.store.push({...erase,finished:true,cancelled:true});
  assert.equal(h.store.getSnapshot().size,0);
  h.store.push(erase);h.frame();assert.equal(h.store.getSnapshot().size,0);
  const complete={...erase,id:'finished',finished:true};
  h.store.push(complete);h.frame();h.advance(1000);
  h.store.push({...complete,finished:false});h.advance(8000);h.frame();
  assert.equal(h.store.getSnapshot().size,0,'late unfinished packet must not resurrect the long TTL');
});
test('live erase cuts only target ink without mutating the persistent board; vocabulary cards fit both faces',()=>{
  const h=inkStoreHarness();
  const {previewRemoteErasures}=loadMotionModule('remoteEraserPreview.ts',{
    './boardModel':{isInkItem:item=>['pen','marker'].includes(item.kind)},
    './boardLiveInk':h.api,'./inkEraser':loadMotionModule('inkEraser.ts')});
  const item={id:'ink',kind:'marker',x:0,y:0,width:100,height:4,weight:4,points:[{x:0,y:0},{x:100,y:0}]};
  const untouched={...item,id:'different'};
  const before=[item,untouched],original=JSON.stringify(before);
  const preview={...h.packet('erase',0,1),kind:'eraser',weight:12,points:[{x:50,y:0}]};
  const previews=new Map([['erase',preview]]),targets=new Map([['erase',new Set(['ink'])]]);
  const cut=previewRemoteErasures(before,previews,targets);
  assert.equal(cut.length,3);assert.strictEqual(cut[2],untouched);
  assert.equal(JSON.stringify(before),original);assert.ok(cut.slice(0,2).every(x=>x.id.startsWith('ink:remote-erase:')));
  const final=cut.slice(0,2).map((x,i)=>({...x,id:'saved'+i}));
  assert.ok(previewRemoteErasures(final,previews,targets).every((x,i)=>x===final[i]));
  const completed=h.api.mergeRemoteLiveInk(preview,{...preview,finished:true,cutIds:['ink']});
  assert.equal(completed.cutIds[0],'ink','Duplicate final geometry still carries the affected IDs');
  const delayed=h.api.mergeRemoteLiveInk(completed,{...preview,finished:false,cutIds:[]});
  assert.equal(delayed.cutIds[0],'ink','Late packet cannot clear final affected IDs');
  const missedPath={...completed,points:[{x:1000,y:1000}]};
  const withoutGap=previewRemoteErasures(before,new Map([['erase',missedPath]]),targets);
  assert.equal(withoutGap.length,1);
  assert.strictEqual(withoutGap[0],untouched,'Missed path must not leave the known erased original visible');
  const {fitLanguageFlashcardItem}=loadMotionModule('languageFlashcardSize.ts');
  const deck={id:'card',kind:'graph',graphFigureId:'language-flashcards',x:0,y:0,width:810,height:450,schoolDiagram:{kind:'flashcards',cards:[{term:'cat',translation:'кот',transcription:''}],showTranslation:true,showTranscription:true,direction:'foreign-first'}};
  const short=fitLanguageFlashcardItem(deck);
  assert.ok(short.width<450&&short.height<350);assert.equal(short.x+short.width/2,405);
  assert.strictEqual(fitLanguageFlashcardItem(short,short),short,'unchanged deck retains manual size');
  const long=fitLanguageFlashcardItem({...deck,schoolDiagram:{...deck.schoolDiagram,cards:[{term:'a very long phrase',translation:'длинное предложение со многими словами',transcription:''}]}},deck);
  assert.ok(long.width>short.width&&long.height>short.height);
  const app=readFileSync(new URL('../src/BoardApp.tsx',import.meta.url),'utf8');
  const paint=app.slice(app.indexOf('const beginInkPreview='),app.indexOf('const scheduleInkPreviewPaint='));
  assert.match(paint,/canvas\.style\.opacity=ink\.kind==="marker"\?"0\.32":"1"/);
  assert.equal([...paint.matchAll(/ctx\.globalAlpha=1/g)].length,2,'Both preview batches paint opaque before compositing');
});
test('cursor bursts retain the latest position per peer and never notify the board per packet',()=>{
  const h=inkStoreHarness(),store=loadMotionModule('boardRemoteCursors.ts').createRemoteCursorStore(h.scheduler);
  let updates=0;store.subscribe(()=>updates++);
  const cursor=(peer,x)=>({userId:`peer-${peer}`,name:`Peer ${peer}`,role:'editor',x,y:x*2,updatedAt:999999999});
  const empty=store.getSnapshot();
  for(let f=0;f<20;f++){
    for(let peer=0;peer<30;peer++)for(let n=0;n<4;n++)store.push(cursor(peer,f*4+n));
    assert.equal(updates,f);
    assert.equal(h.frames.size,1);assert.equal(h.timers.size,2);
    h.frame();assert.equal(updates,f+1);assert.equal(store.getCount(),30);
  }
  assert.equal(empty.size,0);
  for(const value of store.getSnapshot().values()){assert.equal(value.x,79);assert.equal(value.y,158)}
  const old=store.getSnapshot();
  store.push(cursor(0,79));h.frame();assert.strictEqual(store.getSnapshot(),old);
  h.advance(10000);store.push(cursor(0,79)); // TTL refresh without repaint
  store.push(cursor(31,1));store.retainOnline(new Set(['peer-0','peer-1']));
  h.frame();assert.equal(store.getCount(),2);assert.equal(store.getSnapshot().has('peer-31'),false);
  h.advance(2000);assert.equal(store.getCount(),1,'idle cursor expires even with skewed client clocks');
  h.advance(10000);assert.equal(store.getCount(),0);assert.equal(h.timers.size,0,'no idle polling timer');
  store.push(cursor(2,11));h.advance(50);assert.equal(store.getCount(),1,'hidden-tab fallback');
  store.push(cursor(3,12));store.reset();assert.equal(h.timers.size,0);assert.equal(h.frames.size,0);
  assert.equal(store.getCount(),0);
  console.log('Cursor bursts: 2400 packets / 20 frame publications; duplicate moves, presence, TTL and cleanup passed');
});

test('remote transforms reuse the current item index across 600 packets on a 10000-object board',()=>{
  const api=loadMotionModule('boardObjectMotion.ts');
  const items=Array.from({length:10000},(_,i)=>({id:`obj-${i}`,x:i,y:0,width:10,height:10}));
  const ids=Array.from({length:600},(_,i)=>`obj-${i*13}`);
  let count=0;
  const tracked=items;
  Object.defineProperty(tracked,'map',{value(callback){count++;return Array.prototype.map.call(this,callback)}});
  const start=performance.now();
  const old=ids.map(id=>new Map(tracked.map(item=>[item.id,item])).get(id));
  const oldMs=performance.now()-start;
  assert.equal(count,600);
  count=0;const index=api.createCurrentItemIndex();const fasterStart=performance.now();
  const next=ids.map(id=>index(tracked).get(id));
  const newMs=performance.now()-fasterStart;
  assert.equal(count,1);assert.deepEqual(old,next);
  const stored=index(tracked).get('obj-0');const origin=api.objectPoseOrigin(stored);
  const latest=[{...stored,x:200},...items.slice(1)];
  assert.notEqual(api.objectPoseOrigin(index(latest).get('obj-0')),origin,'old origin invalidated on authoritative revision');
  assert.notEqual(index(latest),index(tracked),'local undo/gesture replacement must reindex too');
  const deleted=items.slice(1);assert.equal(index(deleted).get('obj-0'),undefined,'deleted object cannot accept stale preview');
  console.log(`Transform lookup (600 packets, 10000 objects): 600 index builds -> 1; ${oldMs.toFixed(2)} -> ${newMs.toFixed(2)} ms`);
});
