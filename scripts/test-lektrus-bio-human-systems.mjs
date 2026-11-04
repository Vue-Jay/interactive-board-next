import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const model="src/lektrusBioHumanBodySystems.ts",text=fs.readFileSync(model,"utf8");
const transpiled=ts.transpileModule(text,{fileName:model,compilerOptions:{
 module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});
const exports={};
new Function("exports",transpiled.outputText)(exports);
const cfg=exports.HUMAN_BODY_SYSTEMS;
assert.equal(cfg.length,6,"Overview plus five school human anatomy systems");
assert.deepEqual(cfg.map(x=>x.id),[
 "all","nervous","respiratory","circulatory","digestive","musculoskeletal"]);
assert.equal(new Set(cfg.map(x=>x.id)).size,6);
for(const row of cfg){
 assert.ok(row.name&&row.description&&row.color.startsWith("#"));
 assert.ok(exports.humanSystemById(row.id).name===row.name);
}
for(const focus of cfg.slice(1)){
 assert.ok(exports.HUMAN_BODY_SYSTEM_ANCHORS[focus.id]);
 assert.ok(exports.HUMAN_SYSTEM_REGION[focus.id]);
 assert.equal(exports.humanSystemVisibility(focus.id,focus.id),1);
 assert.equal(exports.humanSystemVisibility("all",focus.id),.72);
 for(const other of cfg.slice(1)){
  if(other.id!==focus.id)
   assert.ok(exports.humanSystemVisibility(focus.id,other.id)<.1,
    "Unselected internal systems remain a visible but dim context");
 }
}
for(const id of ["nervous","respiratory","circulatory","digestive","musculoskeletal"]){
 const p=exports.HUMAN_BODY_SYSTEM_ANCHORS[id];
 assert.ok(p.x>350&&p.x<610&&p.y>30&&p.y<390);
}
const files=["src/LektrusBioMannequin.tsx",
 "src/LektrusBioHumanSystemStudy.tsx","src/LektrusBioContinuousHuman.tsx"];
for(const file of files){
 const code=fs.readFileSync(file,"utf8");
 const ast=ts.createSourceFile(file,code,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 assert.equal(ast.parseDiagnostics.length,0,"Broken TSX "+file);
}
const mannequin=fs.readFileSync(files[0],"utf8");
assert.match(mannequin,/import biomodel from "\.\/assets\/bio-atlas\/human-biomodel\.webp"/);
assert.match(mannequin,/human-biomodel-image-base/);
assert.match(mannequin,/human-biomodel-image-focus/);
assert.match(mannequin,/highlightMasks\[system\]/);
assert.match(mannequin,/musculoskeletal/);
assert.match(mannequin,/maskImage:focusMask,WebkitMaskImage:focusMask/);
const study=fs.readFileSync(files[1],"utf8");
assert.match(study,/function Digestive/);
assert.match(study,/function Muscle/);
assert.match(study,/function IntestinalVilli/);
assert.match(study,/function Enterocyte/);
assert.match(study,/level>=4/);
assert.match(study,/level===3/);
assert.match(study,/level===2/);
assert.match(study,/school/);
const viewer=fs.readFileSync(files[2],"utf8");
assert.match(viewer,/HUMAN_BODY_SYSTEMS.map\(entry=>/);
assert.match(viewer,/onClick=\{\(\)=>chooseSystem\(entry.id\)\}/);
assert.match(viewer,/aria-pressed=\{system===entry.id\}/);
assert.match(viewer,/HUMAN_BODY_SYSTEM_ANCHORS\[next\]/);
assert.match(viewer,/if\(camera.current.depth>=\.8\)travel/);
assert.match(viewer,/humanFocusAt\(point,camera.current.depth\)/);
assert.match(viewer,/study=\{study\} depth=\{3\}/);
assert.match(viewer,/study=\{study\} depth=\{4\}/);
assert.equal((viewer.match(/<LektrusBioMannequin system=\{system\}\/>/g)||[]).length,2,
 "Human figure and orientation minimap have exactly the same selected system");
assert.ok(!viewer.includes("body.webp"),"No inappropriate old portrait");
const css=fs.readFileSync("src/lektrusBioContinuousHuman.css","utf8");
assert.match(css,/\.lektrus-human-system-options button.is-active/);
assert.match(css,/\.lektrus-human-biomodel.is-focused/);
assert.match(css,/\.lektrus-human-biomodel-image-focus/);
assert.match(css,/@media\(max-width:650px\)/);
assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
const bytes=fs.readFileSync("src/assets/bio-atlas/human-biomodel.webp");
assert.ok(bytes.length>70000&&bytes.length<350000);
assert.equal(bytes.subarray(0,4).toString(),"RIFF");
assert.equal(bytes.subarray(8,12).toString(),"WEBP");
const parent=fs.readFileSync("src/LektrusBioMicroscope.tsx","utf8");
assert.match(parent,/activeOrganism==="human"&&<LektrusBioContinuousHuman\/>/);
assert.match(parent,/activeOrganism!=="human"&&<LektrusBioUnifiedZoom/);
console.log("Biology human biomodel PASS: approved translucent artwork; six system choices; dynamic highlights; four tissue depths; shared world camera; accessible mobile/desktop controls.");
