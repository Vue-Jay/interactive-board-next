import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const source=fs.readFileSync(new URL("../src/boardDragSnapIndex.ts",import.meta.url),"utf8");
const compiled=ts.transpileModule(source,{compilerOptions:{
 module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022
}}).outputText;
const mod={};
new Function("exports",compiled)(mod);
const {buildBoardDragSnapIndex,snapBoardDrag}=mod;

// Reference algorithm from App.tsx before the optimization. Equality includes
// exact float deltas, guides and deterministic ties (first object wins).
function brute(moving,others,rawDx,rawDy,threshold){
 let dx=rawDx,dy=rawDy,bestX=threshold+1,bestY=threshold+1;
 let guideX,guideY;
 const xs=[moving.x,moving.x+moving.width/2,moving.x+moving.width];
 const ys=[moving.y,moving.y+moving.height/2,moving.y+moving.height];
 for(const other of others){
  const otherX=[other.x,other.x+other.width/2,other.x+other.width];
  const otherY=[other.y,other.y+other.height/2,other.y+other.height];
  for(const source of xs)for(const target of otherX){
   const diff=target-(source+rawDx),distance=Math.abs(diff);
   if(distance<=threshold&&distance<bestX){bestX=distance;dx=rawDx+diff;guideX=target}
  }
  for(const source of ys)for(const target of otherY){
   const diff=target-(source+rawDy),distance=Math.abs(diff);
   if(distance<=threshold&&distance<bestY){bestY=distance;dy=rawDy+diff;guideY=target}
  }
 }
 return {dx,dy,guides:{x:guideX,y:guideY}};
}
const cases=[
 [[],{x:0,y:0,width:120,height:55},33,-12,7],
 [[{x:100,y:150,width:80,height:30}],{x:0,y:0,width:100,height:70},0,0,7],
 [[{x:-100,y:0,width:100,height:100},{x:100,y:0,width:100,height:100}],{x:0,y:0,width:100,height:50},0,0,7],
 [[{x:1,y:1,width:0,height:0},{x:1,y:1,width:0,height:0}],{x:0,y:0,width:1,height:1},0,0,7],
 [[{x:-4,y:2,width:20,height:20},{x:4,y:5,width:20,height:20}],{x:0,y:0,width:2,height:2},0,0,7],
 [[{x:-1000,y:-1000,width:0,height:0}],{x:1,y:1,width:10,height:10},0,0,7],
];
for(const [others,moving,dx,dy,threshold] of cases){
 assert.deepEqual(snapBoardDrag(moving,buildBoardDragSnapIndex(others),dx,dy,threshold),
  brute(moving,others,dx,dy,threshold));
}
let seed=1456849;
const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
const ran=(min,max)=>min+(max-min)*random();
for(let size of [0,1,2,3,12,100,250,1500]){
 const objects=Array.from({length:size},(_,i)=>({
  x:Math.round(ran(-10000,10000)),y:Math.round(ran(-10000,10000)),
  width:Math.round(ran(0,500)),height:Math.round(ran(0,400)),
  id:i
 }));
 // One index per drag, across many samples, not one index per pointer event.
 const index=buildBoardDragSnapIndex(objects);
 assert.ok(index.x.positions.length<=size*3&&index.y.positions.length<=size*3,
  "Store just three anchors per axis instead of scanning all objects per frame");
 assert.equal(index.x.positions.length,index.x.orders.length);
 assert.equal(index.y.positions.length,index.y.orders.length);
 assert.ok(index.x.positions.every((v,i)=>i===0||v>index.x.positions[i-1]));
 const moving={x:ran(-400,400),y:ran(-400,400),
  width:ran(8,370),height:ran(8,340)};
 for(let frame=0;frame<500;frame++){
  const dx=ran(-4000,4000),dy=ran(-4000,4000);
  const threshold=(frame%2===0?7:13)/(frame%3+1);
  const actual=snapBoardDrag(moving,index,dx,dy,threshold);
  const expected=brute(moving,objects,dx,dy,threshold);
  assert.deepEqual(actual,expected,
   "Indexed snapping must preserve exact guide and delta at "+size+" objects, frame "+frame);
 }
}
// Typical collaboration payload contains lots of strokes. Their bounds are
// still indexed, so snapping to an ink edge works, including negative coords.
const stroke={x:-36,y:84,width:8,height:0};
const index=buildBoardDragSnapIndex([stroke]);
assert.equal(snapBoardDrag({x:0,y:80,width:4,height:4},index,-40,0,7).guides.x,-36);

const app=fs.readFileSync(new URL("../src/BoardApp.tsx",import.meta.url),"utf8");
assert.match(app,/buildBoardDragSnapIndex/);
assert.match(app,/snapBoardDrag\(cache\.moving,cache\.snapIndex/);
assert.match(app,/dragSnapCache = useRef\(new WeakMap<Gesture/);
assert.match(app,/selected:.*Set<string>/);
assert.doesNotMatch(app,/const snapDraggedBounds = \(/,
 "The O(objects × pointermoves) alignment scan must not survive inside App");
console.log("Board snap index: brute-force-equivalent across 19,000+ pointer frames, 1,500 objects, signed coords, ties, and stroke bounds.");
