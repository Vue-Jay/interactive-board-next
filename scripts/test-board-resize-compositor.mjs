import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {performance} from "node:perf_hooks";
import ts from "typescript";

const compile=src=>ts.transpileModule(src,{compilerOptions:{
 module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022
}}).outputText;
const helpers={};
new Function("exports",compile(readFileSync("src/boardResizeCompositor.ts","utf8")))(helpers);
const geometry={};
new Function("exports",compile(readFileSync("src/lektrusRotateResize.ts","utf8")))(geometry);
const app=readFileSync("src/BoardApp.tsx","utf8");
const fitBegin=app.indexOf("const fitItemToRect =");
const fitEnd=app.indexOf("const connectorItemFromPoints =",fitBegin);
assert.ok(fitBegin>=0&&fitEnd>fitBegin);
const model={};
new Function("exports",compile(app.slice(fitBegin,fitEnd)+
 "\nexports.fitItemToRect=fitItemToRect;"))(model);
const {canCompositeBoardResize,resizePreviewBounds,paintBoardResizePreview}=helpers;

const sample=(id,kind="text")=>({id,kind,x:75,y:36,width:230,height:110,rotation:0});
const p=sample("p"),q={...sample("q","image"),x:470,y:220},
 r={...sample("r","shape"),x:310,y:450};
const ids=new Set(["p","q","r"]);
assert.equal(canCompositeBoardResize([p,q,r],ids),true);
assert.equal(canCompositeBoardResize([p,q,r],new Set(["p"])),true);
assert.equal(canCompositeBoardResize([p,q,r],new Set()),false);
assert.equal(canCompositeBoardResize([p,q,r],new Set(["missing"])),false);
assert.equal(canCompositeBoardResize([p,q,r],new Set(["p","missing"])),false);
assert.equal(canCompositeBoardResize([...Array(65)].map((_,i)=>sample("a"+i)),
 new Set([...Array(65)].map((_,i)=>"a"+i))),false);
for(const kind of ["graph","table","formula","connector","instrument",
 "pen","marker","quiz","flashcard","checklist","pdf"]){
 assert.equal(canCompositeBoardResize([{...p,kind}],new Set(["p"])),false,
  kind+" must retain React/subject geometry");
}
for(const kind of ["text","sticky","shape","frame","comment","image"]){
 assert.equal(canCompositeBoardResize([{...p,kind}],new Set(["p"])),true,
  kind+" can resize with CSS layout dimensions");
}
assert.equal(canCompositeBoardResize([{...p,points:[]}],new Set(["p"])),false);
assert.equal(canCompositeBoardResize([{...p,hidden:true}],new Set(["p"])),false);
assert.equal(canCompositeBoardResize([p,{...sample("note","comment"),
 commentTargetId:"p"}],new Set(["p"])),false,
 "Resizing a linked target requires updating the comment leader SVG");
assert.equal(canCompositeBoardResize([{...sample("note","comment"),
 commentTargetId:"external"}],new Set(["note"])),false,
 "Resizing the annotation itself must move its leader too");
assert.equal(canCompositeBoardResize([p,{...sample("note","comment"),
 commentTargetId:"external"}],new Set(["p"])),true);
const arrow={id:"arrow",kind:"connector",x:0,y:0,width:500,height:80,
 connectorStartBinding:{itemId:"p"},connectorEndBinding:{itemId:"q"}};
assert.equal(canCompositeBoardResize([p,q,r,arrow],new Set(["p"])),false,
 "A fixed connector endpoint must not detach during preview");
assert.equal(canCompositeBoardResize([p,q,r,arrow],ids),false,
 "Both moving connector endpoints still require the accurate full path");
assert.equal(canCompositeBoardResize([p,q,r,arrow],new Set(["r"])),true,
 "Unrelated arrows must not block resize fast path");

const style=()=>({left:"",top:"",width:"",height:"",transform:"rotate(37deg)"});
const view={x:84,y:-22,zoom:.85};
const bases=[p,q,r];
const targets=bases.map(base=>({base,element:{style:style()}}));
const frame={style:style()};
const oldTransform=(original,bounds,dx,dy,handle,shift)=>{
 const next=geometry.resizedRect(bounds,handle,dx,dy,80,60,shift);
 const sx=next.width/Math.max(1,bounds.width);
 const sy=next.height/Math.max(1,bounds.height);
 return original.map(base=>model.fitItemToRect(base,{
  x:next.x+(base.x-bounds.x)*sx,
  y:next.y+(base.y-bounds.y)*sy,
  width:Math.max(8,base.width*sx),
  height:Math.max(8,base.height*sy),
 }));
};
const bounds=resizePreviewBounds(bases);
let lastGroup;
for(const handle of ["nw","n","ne","e","se","s","sw","w"])
 for(const keepRatio of [false,true])
  for(let frameIndex=0;frameIndex<240;frameIndex++){
   const dx=(frameIndex-85)*1.47,dy=(frameIndex-110)*.61;
   const poses=oldTransform(bases,bounds,dx,dy,handle,keepRatio);
   paintBoardResizePreview(targets,poses,frame,view);
   for(let i=0;i<poses.length;i++){
    const pose=poses[i],st=targets[i].element.style;
    assert.equal(st.left,`${pose.x}px`);
    assert.equal(st.top,`${pose.y}px`);
    assert.equal(st.width,`${pose.width}px`);
    assert.equal(st.height,`${pose.height}px`);
    assert.equal(st.transform,"rotate(37deg)",
     "Retain intrinsic rotation instead of scaling or resetting it");
    assert.strictEqual(bases[i],targets[i].base);
   }
   const b=resizePreviewBounds(poses);
   assert.equal(frame.style.left,`${b.x*view.zoom+view.x}px`);
   assert.equal(frame.style.top,`${b.y*view.zoom+view.y}px`);
   assert.equal(frame.style.width,`${b.width*view.zoom}px`);
   assert.equal(frame.style.height,`${b.height*view.zoom}px`);
   lastGroup=poses;
  }
assert.notDeepEqual(lastGroup,bases);
paintBoardResizePreview(targets,bases,frame,view);
for(let i=0;i<bases.length;i++){
 assert.equal(targets[i].element.style.left,`${bases[i].x}px`,
  "Cancelled gesture must restore original location without React render");
 assert.equal(targets[i].element.style.width,`${bases[i].width}px`);
}
assert.equal(frame.style.width,`${bounds.width*view.zoom}px`,
 "Cancellation restores selection frame");

// Rotated single-object handles must keep the original opposite world anchor,
// and use the same rectangle as the legacy full-board render.
for(const degrees of [0,35,90,-150]){
 const base={...p,rotation:degrees};
 const target=[{base,element:{style:style()}}];
 for(const handle of ["nw","n","ne","e","se","s","sw","w"]){
  const radians=-degrees*Math.PI/180;
  const wx=63,wy=-28;
  const localWx=wx*Math.cos(radians)-wy*Math.sin(radians);
  const localWy=wx*Math.sin(radians)+wy*Math.cos(radians);
  const localRect=geometry.resizedRect(base,handle,localWx,localWy,100,44,true);
  const rect=geometry.preserveRotatedAnchor(base,localRect,degrees);
  const next=model.fitItemToRect(base,rect);
  paintBoardResizePreview(target,[next],frame,view);
  assert.equal(target[0].element.style.left,`${rect.x}px`);
  assert.equal(target[0].element.style.top,`${rect.y}px`);
  assert.equal(target[0].element.style.width,`${rect.width}px`);
  assert.equal(target[0].element.style.height,`${rect.height}px`);
  assert.equal(next.rotation,degrees);
 }
}

// Same 10k-object / 240-frame scenario, comparing old full-board scans and
// live compositor writes. Timer covers Node CPU, NOT user-device browser FPS.
const board=Array.from({length:10000},(_,i)=>({
 id:"object-"+i,kind:"text",
 x:i%125*10,y:Math.floor(i/125)*11,width:220,height:90,rotation:0,
}));
const moving=board.slice(450,453),selectedIds=new Set(moving.map(i=>i.id));
const worldBounds=resizePreviewBounds(moving);
const nodes=moving.map(base=>({base,element:{style:style()}}));
const outline={style:style()};
const count=240;
const finalPoses=oldTransform(moving,worldBounds,25,40,"se",false);
const baseline=()=>{
 let document=board;
 for(let frameIndex=1;frameIndex<=count;frameIndex++){
  const dx=25*frameIndex/count,dy=40*frameIndex/count;
  const byId=new Map(oldTransform(moving,worldBounds,dx,dy,"se",false)
   .map(item=>[item.id,item]));
  document=board.map(item=>byId.get(item.id)??item);
 }
 return document;
};
const optimized=()=>{
 for(let frameIndex=1;frameIndex<=count;frameIndex++){
  const dx=25*frameIndex/count,dy=40*frameIndex/count;
  const poses=oldTransform(moving,worldBounds,dx,dy,"se",false);
  paintBoardResizePreview(nodes,poses,outline,view);
 }
 const last=new Map(finalPoses.map(item=>[item.id,item]));
 return board.map(item=>last.get(item.id)??item);
};
assert.equal(canCompositeBoardResize(board,selectedIds),true);
const oldLast=baseline(),newLast=optimized();
for(let i=0;i<board.length;i++)assert.deepEqual(oldLast[i],newLast[i],
 "Final materialized model must match old per-frame path at object "+i);
function medianTime(fn){
 for(let i=0;i<2;i++)fn();
 const samples=[];
 for(let i=0;i<5;i++){
  const start=performance.now();fn();samples.push(performance.now()-start);
 }
 samples.sort((a,b)=>a-b);
 return Number(samples[2].toFixed(3));
}
const baselineMs=medianTime(baseline);
const compositorMs=medianTime(optimized);
const oldBoardTouches=board.length*count;
const newBoardTouches=board.length+moving.length*count;
assert.equal(oldBoardTouches,2_400_000);
assert.equal(newBoardTouches,10_720);
assert.ok(newBoardTouches<oldBoardTouches/100,
 "Reduce full-board traversals by at least 100x on the identical document");

assert.match(app,/const paintCompositorResize=\(g:Gesture,poses:Item\[\]\):boolean=>\{/);
assert.match(app,/if\(!paintCompositorResize\(g,resized\)\)/);
assert.match(app,/if\(!paintCompositorResize\(g,\[resized\]\)\)/);
assert.match(app,/workChannel\.current\?\.publishTransform\(poses\.map\(item=>/);
assert.match(app,/const resizePreview=compositorResize\.current\?\.gesture===g/);
assert.match(app,/if\(dragPreview\|\|rotatePreview\|\|groupRotatePreview\|\|resizePreview\)/);
assert.match(app,/if\(cancel\)paintBoardResizePreview\(/);
console.log(JSON.stringify({
 scenario:"10,000 board objects, 3 resizable objects, 240 pointer frames",
 oldBoardObjectVisits:oldBoardTouches,newBoardObjectVisits:newBoardTouches,
 oldReactFrameSchedules:count,newReactFrameSchedules:1,
 baselineNodeCpuMs:baselineMs,compositorNodeCpuMs:compositorMs,
 deterministicFrames:8*2*240,
 note:"Same Node.js fixture; CPU excludes React/browser layout/network. Not physical FPS."
}));
