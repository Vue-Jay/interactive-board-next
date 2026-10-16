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
console.log("School geometry: ray, transversal angles, solid rotation and dimension projections OK.");
