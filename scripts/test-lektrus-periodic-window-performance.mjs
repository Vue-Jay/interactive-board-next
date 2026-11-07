import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

// Execute the actual positioning effect with a deterministic DOM/RAF scheduler.
// Before the optimization, every open card measured its stage once per idle
// animation frame forever. Event-triggered measurements should stop at rest.
const source=readFileSync(new URL("../src/LektrusPeriodicFloatingInfo.tsx",import.meta.url),"utf8");
const begin=source.indexOf(" useLayoutEffect(()=>{\n  const stage=stageRef.current;");
const marker=" },[stageRef]);";
const finish=source.indexOf(marker,begin);
assert.ok(begin>=0&&finish>begin,"positioning effect must remain executable");
const compiled=ts.transpileModule(source.slice(begin,finish+marker.length),{
 compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}
}).outputText;
const makeTarget=()=>{
 const listeners=new Map();
 return {
  addEventListener(name,fn){if(!listeners.has(name))listeners.set(name,new Set());listeners.get(name).add(fn)},
  removeEventListener(name,fn){listeners.get(name)?.delete(fn)},
  emit(name,event={}){for(const fn of listeners.get(name)??[])fn(event)},
  count(name){return listeners.get(name)?.size??0}
 };
};
const win=makeTarget(),doc=makeTarget();
win.visualViewport=makeTarget();
let reads=0,geometry=null,cleanup=null,resizeObserver=null,mutationObserver=null;
const parent={parentElement:null,contains(node){return node===stage}};
const stage={
 parentElement:parent,clientWidth:840,clientHeight:484,
 contains(node){return node===stage},
 getBoundingClientRect(){reads++;return {left:0,top:0,width:840,height:484}}
};
const pending=new Map();
let nextFrame=0;
const raf=fn=>{const id=++nextFrame;pending.set(id,fn);return id};
const cancel=id=>pending.delete(id);
const tick=()=>{
 const callbacks=[...pending.values()];
 pending.clear();
 for(const fn of callbacks)fn();
};
class ResizeObserverMock {
 constructor(callback){this.callback=callback;resizeObserver=this;this.active=true}
 observe(node){assert.equal(node,stage)}
 disconnect(){this.active=false}
 fire(){if(this.active)this.callback([])}
}
class MutationObserverMock {
 constructor(callback){this.callback=callback;mutationObserver=this;this.nodes=[];this.active=true}
 observe(node,options){this.nodes.push(node);assert.deepEqual(options.attributeFilter,["style","class"]);assert.equal(options.subtree,undefined)}
 disconnect(){this.active=false}
 fire(){if(this.active)this.callback([])}
}
const load=new Function("useLayoutEffect","stageRef","setGeometry","geometryMatches",
 "BASE_STAGE_WIDTH","BASE_STAGE_HEIGHT","requestAnimationFrame","cancelAnimationFrame",
 "ResizeObserver","MutationObserver","window","document",compiled);
load(callback=>{cleanup=callback()}, {current:stage},
 update=>{geometry=update(geometry)},
 (a,b)=>a!==null&&JSON.stringify(a)===JSON.stringify(b),
 840,484,raf,cancel,ResizeObserverMock,MutationObserverMock,win,doc);
assert.equal(reads,1,"initial layout is measured");
assert.equal(pending.size,0,"idle cards must not keep an RAF loop alive");
for(let frame=0;frame<60;frame++)tick();
assert.equal(reads,1,"60 idle frames must cause zero redundant geometry reads");
assert.deepEqual(mutationObserver.nodes,[stage,parent],"only stage ancestors are observed");

win.emit("resize");
win.emit("scroll");
resizeObserver.fire();
assert.equal(pending.size,1,"resize, scroll and observer changes batch into one frame");
tick();
assert.equal(reads,2,"batched resize has only one layout read");
assert.equal(pending.size,0);

mutationObserver.fire();
assert.equal(pending.size,1,"ancestor transform requests a visual update");
for(let frame=0;frame<37;frame++)tick();
assert.equal(pending.size,0,"transform follow-up has a finite duration");
assert.equal(reads,39,"transform can follow 37 frames without staying active forever");

doc.emit("transitionrun",{target:{contains:()=>false}});
assert.equal(pending.size,0,"unrelated CSS transitions do not wake board cards");
doc.emit("transitionrun",{target:parent});
assert.equal(pending.size,1,"stage ancestor transitions are followed");
tick();
assert.ok(pending.size>0);
cleanup();
assert.equal(pending.size,0,"unmount cancels the remaining frame");
assert.equal(resizeObserver.active,false);
assert.equal(mutationObserver.active,false);
assert.equal(win.count("resize"),0);
assert.equal(win.visualViewport.count("scroll"),0);
assert.equal(doc.count("transitionrun"),0);
console.log("Periodic window idle regression: 60 idle frames -> 0 extra reads vs old 60/card; transform and cleanup passed.");
