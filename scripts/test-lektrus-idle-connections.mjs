import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const read=p=>fs.readFileSync(new URL("../"+p,import.meta.url),"utf8");
const source=read("src/useBoardIdleConnection.ts");
const code=ts.transpileModule(source,{compilerOptions:{
 module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022
}}).outputText;
const exp={};
let clock=1000,nextTimer=0;
let doc,win,timers,states,effects,canSleep;
const fakeSetTimeout=(callback,delay)=>{const id=++nextTimer;timers.set(id,{at:clock+delay,callback});return id};
const fakeClearTimeout=id=>timers.delete(id);
const fakeDate={now:()=>clock};
const listeners=()=>({
 callbacks:new Map(),
 addEventListener(name,callback){if(!this.callbacks.has(name))this.callbacks.set(name,new Set());this.callbacks.get(name).add(callback)},
 removeEventListener(name,callback){this.callbacks.get(name)?.delete(callback)},
 dispatch(name,values={}){const event={type:name,cancelable:true,buttons:0,prevented:false,stopped:false,
   preventDefault(){this.prevented=true},stopPropagation(){this.stopped=true},...values};
   for(const cb of this.callbacks.get(name)??[])cb(event);
   return event;}
});
const mockReact={
 useRef(value){return {current:value}},
 useState(value){states.push(value);return [value,next=>{states.push(next)}]},
 useEffect(effect){effects.push(effect)}
};
new Function("exports","require","setTimeout","clearTimeout","Date","document","window",code)(
 exp,name=>name==="react"?mockReact:{},fakeSetTimeout,fakeClearTimeout,fakeDate,
 new Proxy({}, {get(_t,key){return doc?.[key]},set(_t,key,value){if(doc)doc[key]=value;return true}}),
 new Proxy({}, {get(_t,key){const v=win?.[key];return typeof v==="function"?v.bind(win):v}})
);
const advance=ms=>{
 const end=clock+ms;
 for(let guard=0;guard<1000;guard++){
  let earliest=null;
  for(const [id,entry] of timers){
   if(entry.at<=end&&(!earliest||entry.at<earliest.entry.at))earliest={id,entry};
  }
  if(!earliest)break;
  clock=earliest.entry.at;timers.delete(earliest.id);earliest.entry.callback();
 }
 clock=end;
};
const setup=(sleepable=true,hidden=false)=>{
 clock=1000;nextTimer=0;timers=new Map();states=[];effects=[];canSleep=sleepable;
 doc=listeners();doc.hidden=hidden;win=listeners();
 assert.equal(exp.useBoardIdleConnection(true,()=>canSleep),true);
 assert.equal(effects.length,1);
 const cleanup=effects[0]();
 return {cleanup,doc,win};
};
assert.equal(exp.BOARD_IDLE_MS,300000);
assert.equal(exp.BOARD_HIDDEN_IDLE_MS,60000);
assert.equal(exp.boardNextIdleDelay(5,0,null),299995);
assert.equal(exp.boardNextIdleDelay(61000,0,1000),0);
assert.equal(exp.boardNextIdleDelay(300000,0,null),0);
{
 const h=setup();
 advance(299999);
 assert.notEqual(states.at(-1),false,"Must not sleep early");
 advance(1);
 assert.equal(states.at(-1),false,"Sleep at 5min with no user action");
 assert.equal(timers.size,0,"No network heartbeat timer while sleeping");
 h.win.dispatch("online");
 assert.equal(states.at(-1),false,"Online event must not wake a sleeping board");
 h.win.dispatch("pointermove",{buttons:0});
 assert.equal(states.at(-1),false,"Mouse hover must not wake a sleeping board");
 const wake=h.win.dispatch("pointerdown");
 assert.equal(states.at(-1),true,"Real pointer action should wake instantly");
 assert.equal(wake.prevented,true,"Wake-up gesture must not edit a stale document");
 assert.equal(wake.stopped,true);
 advance(299999);assert.equal(states.at(-1),true);
 h.win.dispatch("keydown");advance(299999);assert.equal(states.at(-1),true,
  "Keyboard activity should reset idle clock");
 h.cleanup();
 assert.equal(timers.size,0,"Unmount removes all timers");
 assert.equal([...h.win.callbacks.values()].every(set=>set.size===0),true,
  "Unmount removes all user-activity listeners");
}
{
 const h=setup(true,false);
 advance(10000);
 h.doc.hidden=true;h.doc.dispatch("visibilitychange");
 advance(59999);assert.notEqual(states.at(-1),false);
 advance(1);assert.equal(states.at(-1),false,"Hidden board sleeps after 1 minute");
 h.doc.hidden=false;h.doc.dispatch("visibilitychange");
 assert.equal(states.at(-1),false,"Showing tab alone must not wake realtime");
 h.win.dispatch("wheel");
 assert.equal(states.at(-1),true,"User wheel action should wake");
 h.cleanup();
}
{
 const h=setup(false);
 advance(300000);
 assert.equal(states.at(-1),true,"Do not close while save/gesture is pending");
 assert.equal(timers.size,1,"Retry the sleep check while busy");
 canSleep=true;
 advance(exp.BOARD_IDLE_BUSY_RECHECK_MS);
 assert.equal(states.at(-1),false,"Sleep once data is safely saved");
 h.cleanup();
}
const board=read("src/BoardApp.tsx");
for(const marker of [
 "selfhostWatchDocument(","subscribeBoardDocument(","subscribeBoardPresence(",
 "connectBoardCursorChannel(","connectBoardViewControl(",
 "connectBoardWorkChannel(","connectAttachmentApprovalChannel("
]){
 const at=board.indexOf(marker);
 assert.ok(at>=0,marker+" missing");
 const guard=board.slice(Math.max(0,at-300),at);
 assert.match(guard,/boardConnectionAwake/,marker+" needs an idle gate");
}
assert.match(board,/layoutEditing\|\|!boardConnectionAwake\|\|!documentSyncEnabled/);
assert.match(board,/layoutEditing\|\|!discussionEnabled\|\|!boardConnectionAwake/);
assert.match(board,/!remoteSaveInFlight\.current&&!saveTimer\.current&&!remoteRetryTimer\.current/);
assert.match(board,/!queuedRemoteSnapshot\.current&&!pendingRemote\.current/);
assert.match(board,/pendingAttachmentTimers\.current\.size===0/);
assert.match(board,/!boardConnectionAwake&&<div className="lektrus-board-idle-indicator"/);
const styles=read("src/lektrusMobileWorkspacePolish.css");
assert.match(styles,/\.workspace \.lektrus-board-idle-indicator/);
assert.match(styles,/pointer-events:none/);
console.log("Idle board: 5min, background 1min, save-safe delayed sleep, no hover wake, click/key/wheel resume, all sockets/polling/visit gates PASS");
