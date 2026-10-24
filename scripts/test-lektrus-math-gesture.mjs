import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";

const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const transpile=path=>ts.transpileModule(read(path),{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}
}).outputText;
function load(moduleCode,dependencies={}){
 const exports={};
 new Function("exports","require",moduleCode)(exports,name=>{
  if(name in dependencies)return dependencies[name];
  return {};
 });
 return exports;
}
const names=load(transpile("src/lektrusGeometryPointNames.ts"));
const math=load(transpile("src/LektrusGraphEditor.tsx"),{
 "./lektrusGeometryPointNames":names
});
const {nextGeometryPointLabel,availableGeometryLabel,isGeometryLabelInUse}=names;
const {appendFreeSketchPoint,closeFreeSketch,freeSketchClosingIndex,removeGraphPoint,closeFreeSketchBoard,removeGraphBoardPoint}=math;

assert.equal(nextGeometryPointLabel([]),"A");
assert.equal(nextGeometryPointLabel([{label:"A"},{label:"C"},{label:"c"}]),"B");
assert.equal(nextGeometryPointLabel(Array.from({length:26},(_,i)=>({label:String.fromCharCode(65+i)}))),"AA");
assert.equal(availableGeometryLabel([{label:"A"},{label:"B"}],"A"),"C");
assert.equal(availableGeometryLabel([{label:"A"}],"O"),"O");
assert.equal(isGeometryLabelInUse([{label:"A"},{label:"B"}],"a",0),false);
assert.equal(isGeometryLabelInUse([{label:"A"},{label:"B"}],"A",1),true);
const draft=()=>({
 figureId:"free",purpose:"geometry",points:[],segments:[],polygons:[],
 circles:[],angles:[],midpoints:[],showLabels:true
});
let free=draft();
for(const [x,y] of [[0,0],[4,0],[4,4]])free=appendFreeSketchPoint(free,x,y);
assert.deepEqual(free.points.map(p=>p.label),["A","B","C"]);
assert.deepEqual(free.segments.map(s=>[s.a,s.b]),[[0,1],[1,2]]);
assert.equal(freeSketchClosingIndex(free),0,"first vertex closes initial path");
const closed=closeFreeSketch(free);
assert.notEqual(closed,free);
assert.equal(closed.polygons.length,1);
assert.deepEqual(closed.polygons[0].points,[0,1,2]);
assert.equal(closed.segments.length,0,"polygon replaces temporary edges");
assert.equal(freeSketchClosingIndex(closed),null);
for(const [x,y] of [[7,1],[9,1],[8,3]])free=appendFreeSketchPoint(closed,x,y);
assert.deepEqual(free.points.map(p=>p.label),["A","B","C","D","E","F"]);
assert.deepEqual(free.segments.map(s=>[s.a,s.b]),[[3,4],[4,5]],
 "new figure must not connect to previous polygon");
assert.equal(freeSketchClosingIndex(free),3,"click new polygon's first vertex rather than first point of whole document");
const closedTwo=closeFreeSketch(free);
assert.deepEqual(closedTwo.polygons.map(p=>p.points),[[0,1,2],[3,4,5]]);
assert.equal(closeFreeSketch(closedTwo),closedTwo,"do not create duplicates when already closed");
let edited=draft();
for(const [x,y] of [[0,0],[4,0],[4,4],[0,4]])edited=appendFreeSketchPoint(edited,x,y);
const removedMiddle=removeGraphPoint(edited,1);
assert.deepEqual(removedMiddle.points.map(p=>p.label),["A","C","D"]);
assert.deepEqual(removedMiddle.segments.map(s=>[s.a,s.b]),[[1,2],[0,1]],
 "deleting one vertex reconnects the remaining unfinished polyline");
assert.equal(freeSketchClosingIndex(removedMiddle),0);
assert.equal(closeFreeSketch(removedMiddle).polygons.length,1);
const addedAfterDelete=appendFreeSketchPoint(removedMiddle,-1,3);
assert.deepEqual(addedAfterDelete.points.map(p=>p.label),["A","C","D","B"],
 "new vertices get a unique letter even when earlier indices have changed");
assert.equal(new Set(addedAfterDelete.points.map(p=>p.label)).size,4);
const boardItem={
 kind:"graph",graphFigureId:"free",graphPoints:edited.points,graphSegments:edited.segments,
 graphPolygons:[],graphCircles:[],graphAngles:[],graphMidpoints:[]
};
const boardRemove=removeGraphBoardPoint(boardItem,1);
assert.equal(freeSketchClosingIndex({
 figureId:boardRemove.graphFigureId,points:boardRemove.graphPoints,
 segments:boardRemove.graphSegments,polygons:boardRemove.graphPolygons,circles:boardRemove.graphCircles
}),0,"board should allow closure even after an intermediate point is removed");
const boardClosed=closeFreeSketchBoard(boardRemove);
assert.deepEqual(boardClosed.graphPolygons[0].points,[0,1,2]);
assert.equal(boardClosed.graphSegments.length,0);
assert.deepEqual(boardRemove.graphPolygons,[],"closing on board never mutates previous state");

const app=read("src/App.tsx"),editor=read("src/LektrusGraphEditor.tsx");
const css=read("src/lektrusMathTouchPolish.css"),main=read("src/main.tsx");
assert.match(app,/onCloseFreePolygon=\{\(\)=>setGraphDraft\(/,"preview closes polygon at first point");
assert.match(app,/onCloseFreePolygon=\{!item\.locked&&canEdit/,"saved board can close free geometry");
assert.match(app,/Math\.hypot\(ev\.clientX-startX,ev\.clientY-startY\)>7/,
 "tap does not instantly drag the vertex");
assert.match(app,/freeContacts\.current\.size>1/,
 "touch-down involving multiple fingers cannot create a random point");
assert.match(app,/onPointerCancel=\{event=>\{/,"cancelled touch never creates a point");
assert.doesNotMatch(app,/candidate\.graphFigureId==="free"\?String\.fromCharCode/,
 "saved board names must never depend on point index");
assert.match(editor,/↶ Отменить точку/);
assert.match(editor,/lektrus-free-build-status/);
assert.match(css,/\.lektrus-free-close-target/);
assert.match(css,/@media\(pointer:coarse\)/);
assert.match(main,/import "\.\/lektrusMathTouchPolish\.css"/);
console.log("Geometry touch and names: free contours, tap closure, deletion, second polygon, unique letters and mobile controls verified.");
