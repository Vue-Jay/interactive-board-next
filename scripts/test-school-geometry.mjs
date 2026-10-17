import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";

const read=(file)=>readFileSync(new URL("../"+file,import.meta.url),"utf8");
async function loadTs(file){
  const javascript=ts.transpileModule(read(file),{
    compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}
  }).outputText;
  return import("data:text/javascript;base64,"+Buffer.from(javascript).toString("base64"));
}

const {mathPresets,makeMathPresetItem}=await loadTs("src/lektrusMathPresets.ts");
const {isSolidFigure,solidWorldPoints,projectSolid}=await loadTs("src/lektrusSolid3d.ts");
const app=read("src/App.tsx");
const editor=read("src/LektrusGraphEditor.tsx");

assert.equal(mathPresets.some(p=>p.id==="triangle-obtuse"),false,"no obtuse triangle button");
assert.equal(mathPresets.some(p=>p.id==="parallel"),true);
assert.equal(mathPresets.some(p=>p.id==="ray"),true);

const ray=makeMathPresetItem("ray",0,0,"test");
assert.equal(ray.graphSegments?.[0]?.kind,"ray");
assert.equal(ray.graphSnap,false,"direction is not snapped to integer degrees");
assert.equal(ray.graphPoints?.[0]?.label,"A");
assert.match(app,/if\(rayFigure&&i!==0\)return null/,"only one ray origin must be visible");
assert.match(app,/onRayChange=/,"line direction drag must be editable on board");
assert.match(editor,/Направление луча/);

const parallel=makeMathPresetItem("parallel",0,0,"parallel");
assert.equal(parallel.graphSegments?.length,2);
for(const kind of ["corresponding","alternate-interior","alternate-exterior","same-side-interior","vertical","adjacent"]){
  assert.ok(app.includes(kind),kind+" angle pair must render");
  assert.ok(editor.includes(kind),kind+" must be selectable");
}
assert.match(editor,/Добавить секущую/);
assert.match(editor,/Перпендикуляр между прямыми/);
assert.match(editor,/Биссектриса угла при секущей/);

for(const id of ["cube","rectangular-prism","prism","pyramid","triangular-pyramid","cylinder","cone"]){
  const figure=makeMathPresetItem(id,0,0,id);
  assert.ok(isSolidFigure(id));
  const before=projectSolid(figure,25,-35),after=projectSolid(figure,30,70);
  assert.equal(before.length,solidWorldPoints(figure).length,id+" point count");
  assert.ok(before.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)),id+" finite view");
  assert.ok(after.some((p,i)=>Math.abs(p.x-before[i].x)>0.01||Math.abs(p.y-before[i].y)>0.01),id+" rotates");
  const measured={...figure,graphGivenSides:["8","5","6"]};
  assert.ok(projectSolid(measured,40,-10).every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)),id+" measured projection");
}
assert.match(app,/className="lektrus-orbit-control"/);
assert.match(app,/onRotate=/);
assert.match(app,/projectSolidAxis/,"sphere meridians must follow orientation");

const {removeConstruction}=await loadTs("src/lektrusConstructionCleanup.ts");
const point=(x,y,label="")=>({x,y,label});
const seed={
  points:[point(0,0,"A"),point(1,0,"B"),point(0,1,"C"),point(5,5,"D")],
  segments:[],circles:[],polygons:[{points:[0,1,2],label:"",measure:true}],
  angles:[],midpoints:[]
};
const first=removeConstruction(seed,"polygon",0);
assert.deepEqual(first.points,[seed.points[3]],"polygon deletion discards its 3 vertices, retaining independent free points");
assert.deepEqual(first.polygons,[]);
const shared={
  ...seed,
  segments:[{a:2,b:3,kind:"segment",label:"",measure:false}]
};
const sharedNext=removeConstruction(shared,"polygon",0);
assert.deepEqual(sharedNext.points,[seed.points[2],seed.points[3]],"shared endpoint survives polygon deletion");
assert.deepEqual(sharedNext.segments.map(s=>[s.a,s.b]),[[0,1]],"segment links are reindexed after deleting orphan vertices");
const angleShape={
  points:[point(2,0,"A"),point(0,0,"O"),point(0,2,"B")],
  segments:[
    {a:1,b:0,kind:"ray",label:"",measure:false},
    {a:1,b:2,kind:"ray",label:"",measure:false}
  ],circles:[],polygons:[],angles:[{a:0,vertex:1,b:2,label:"45°"}],midpoints:[]
};
const angleNext=removeConstruction(angleShape,"angle",0);
assert.equal(angleNext.angles.length,0);
assert.equal(angleNext.segments.length,0,"angle removal also removes dependent rays");
assert.equal(angleNext.points.length,0,"angle and ray support vertices are removed");
const fullCircle={
  points:[point(1,1,"O"),point(4,1,"R")],segments:[],
  circles:[{center:0,edge:1,label:"",measure:false}],polygons:[],angles:[],midpoints:[]
};
assert.equal(removeConstruction(fullCircle,"circle",0).points.length,0,"deleted circle takes center and radius point");
const rightRectangle={
  points:[point(0,0,"A"),point(4,0,"B"),point(4,3,"C"),point(0,3,"D")],
  polygons:[{points:[0,1,2,3],label:"ABCD",measure:true}],
  angles:[{a:3,vertex:0,b:1,label:"90°"}],
  segments:[],circles:[],midpoints:[]
};
const withoutRectangle=removeConstruction(rightRectangle,"polygon",0);
assert.equal(withoutRectangle.points.length,0,"right-angle vertex annotations must be removed with their rectangle");
assert.equal(withoutRectangle.angles.length,0,"right-angle mark belongs to deleted rectangle");
const circleWithRadius={...fullCircle,segments:[{a:0,b:1,kind:"segment",label:"r",measure:false}]};
const withoutCircle=removeConstruction(circleWithRadius,"circle",0);
assert.equal(withoutCircle.segments.length,0,"radius line belongs to deleted circle");
assert.equal(withoutCircle.points.length,0,"circle deletion must not leave radius endpoints");
const {projectSolidSurfaces}=await loadTs("src/lektrusSolid3d.ts");
for(const id of ["cube","rectangular-prism","prism","pyramid","triangular-pyramid","cylinder","cone"]){
  const item=makeMathPresetItem(id,0,0,"mesh-"+id);
  for(const [x,y] of [[25,-35],[0,0],[45,65],[-75,170]]){
    const faces=projectSolidSurfaces(item,x,y);
    assert.ok(faces.length>3,id+" must have filled faces");
    assert.ok(faces.every(f=>f.points.length>=3&&f.points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y))),id+" finite mesh");
    assert.ok(faces.every(f=>Number.isFinite(f.depth)&&f.fill.length>0),id+" shaded depth");
    assert.ok(faces.every((f,i)=>i===0||faces[i-1].depth>=f.depth),id+" painter depth order");
    if(id==="cone"||id==="cylinder")assert.ok(faces.length>=60,id+" smooth curve");
  }
}
assert.equal(projectSolidSurfaces(makeMathPresetItem("sphere",0,0,"sphere"),25,30).length,0,"sphere keeps its existing good rendering");
assert.match(editor,/lektrus-school-element-row/,"compact dimension rows");
assert.doesNotMatch(editor,/pointOptions\(/,"no coordinate chooser in element cards");

console.log("School geometry: ray, transversal angles, solid rotation and dimension projections OK.");
