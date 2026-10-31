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
