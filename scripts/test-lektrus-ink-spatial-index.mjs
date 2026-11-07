import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {performance} from "node:perf_hooks";
import ts from "typescript";

const source=readFileSync(new URL("../src/inkSpatialIndex.ts",import.meta.url),"utf8");
const output={};
new Function("exports",ts.transpileModule(source,{compilerOptions:{
 module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,
}}).outputText)(output);
const {indexInkStrokes,queryInkStrokes}=output;
const visibleBrute=(strokes,left,top,right,bottom)=>{
 if(right<=left||bottom<=top)return [];
 return strokes.filter(item=>{
  if(item.hidden||!item.points?.length)return false;
  const pad=(item.weight??3)/2;
  return !(item.x+item.width+pad<left||item.x-pad>right||
   item.y+item.height+pad<top||item.y-pad>bottom);
 });
};
const ink=[];
for(let i=0;i<15000;i++){
 const x=i%150*32,y=Math.floor(i/150)*32;
 ink.push({id:"stroke-"+i,kind:"pen",x,y,width:12,height:14,
  weight:i%5+1,points:[{x:0,y:0},{x:12,y:14}]});
}
ink.push({id:"crosses-many",kind:"marker",x:-1000,y:-20,width:6200,height:3600,
 weight:8,points:[{x:0,y:0},{x:6200,y:3600}]});
ink.push({id:"hidden",kind:"pen",hidden:true,x:700,y:700,width:80,height:80,
 weight:4,points:[{x:0,y:0},{x:80,y:80}]});
ink.push({id:"empty-points",kind:"pen",x:700,y:700,width:30,height:30,points:[]});
const indexed=indexInkStrokes(ink);
assert.equal(indexed.spans.length+indexed.longSpans.length,ink.length-2);
assert.equal(indexed.longSpans.length,1,
 "A single very long stroke must not disable pruning of all normal ink");
assert.ok(indexed.maxRightPrefix.every((max,i)=>i===0||max>=indexed.maxRightPrefix[i-1]));
const viewports=[];
for(let i=0;i<80;i++)viewports.push({
 left:-250+i*65,top:-120+(i%24)*110,
 right:-250+i*65+900,bottom:-120+(i%24)*110+620,
});
viewports.push({left:-1000,top:-20,right:-980,bottom:0});
viewports.push({left:200000,top:200000,right:200900,bottom:200900});
for(const {left,top,right,bottom} of viewports){
 const expected=visibleBrute(ink,left,top,right,bottom);
 const actual=queryInkStrokes(indexed,left,top,right,bottom);
 assert.deepEqual(actual.map(x=>x.id),expected.map(x=>x.id),
  "Spatial culling must preserve the existing exact visibility and paint z-order");
 assert.ok(actual.every(item=>ink.includes(item)),"The index must not clone stroke objects");
}
assert.deepEqual(queryInkStrokes(indexed,0,0,0,1),[]);
const runs=8;
let before=0,after=0,count=0;
for(let n=0;n<runs;n++){
 let start=performance.now();
 for(const rect of viewports)count+=visibleBrute(ink,rect.left,rect.top,rect.right,rect.bottom).length;
 before+=performance.now()-start;
 start=performance.now();
 for(const rect of viewports)queryInkStrokes(indexed,rect.left,rect.top,rect.right,rect.bottom);
 after+=performance.now()-start;
}
const viewer=readFileSync(new URL("../src/ViewerInkLayer.tsx",import.meta.url),"utf8");
assert.match(viewer,/useMemo\(\(\)=>indexInkStrokes\(strokes\),\[strokes\]\)/,
 "Build spatial index once per immutable z-order run");
assert.match(viewer,/queryInkStrokes\(spatialIndex,left,top,right,bottom\)/);
assert.doesNotMatch(viewer,/for \(const item of strokes\)/,
 "Do not scan the full ink group on every viewport raster repaint");
console.log(JSON.stringify({scenario:"15k strokes, "+viewports.length+
 " viewports × "+runs+" passes",visibleStrokeCountAcrossPasses:count,
 beforeFullScanMs:Number(before.toFixed(2)),afterIndexedQueryMs:Number(after.toFixed(2)),
 indexEntries:indexed.spans.length,longStrokes:indexed.longSpans.length,assertedIdenticalViews:viewports.length,
 timing:"Node CPU only, no browser FPS or GPU latency"}));
