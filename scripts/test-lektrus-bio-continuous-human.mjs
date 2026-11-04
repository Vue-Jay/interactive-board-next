import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const modelFile="src/lektrusBioContinuousHumanModel.ts";
const raw=fs.readFileSync(modelFile,"utf8");
const code=ts.transpileModule(raw,{fileName:modelFile,compilerOptions:{
 module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022
}});
const m={};
new Function("exports",code.outputText)(m);
assert.deepEqual([m.HUMAN_ATLAS_WIDTH,m.HUMAN_ATLAS_HEIGHT,m.HUMAN_ATLAS_MAX_DEPTH],[960,640,4]);
assert.deepEqual(m.HUMAN_ZOOM_LABELS,["Организм","Органы","Орган","Ткань","Клетка"]);
const center={x:480,y:320};
const initial=m.HUMAN_INITIAL_CAMERA;
assert.equal(m.humanScale(0),1);
assert.ok(m.humanScale(4)>20);
assert.deepEqual(m.humanProject(initial,{x:483,y:194}),{x:483,y:194});
assert.deepEqual(m.humanUnproject(initial,{x:483,y:194}),{x:483,y:194});
for(const d of [0,.1,.45,.8,1,1.25,1.8,2,2.35,3,3.5,4]){
 const scale=m.humanScale(d);
 for(const point of [center,{x:480,y:190},{x:150,y:200},{x:812,y:515}]){
  const camera=m.humanZoomAt(initial,d,point);
  const world=m.humanUnproject(initial,point);
  const projected=m.humanProject(camera,world);
  assert.ok(Math.abs(projected.x-point.x)<1e-7&&Math.abs(projected.y-point.y)<1e-7,
   "Zoom must preserve cursor-anchored world coordinate");
  const back=m.humanUnproject(camera,projected);
  assert.ok(Math.abs(back.x-world.x)<1e-7&&Math.abs(back.y-world.y)<1e-7);
  assert.ok(camera.depth>=0&&camera.depth<=4);
 }
 const focus=m.humanFocusAt(m.HUMAN_ORGAN_ANCHORS.heart,d);
 const actual=m.humanProject(focus,m.HUMAN_ORGAN_ANCHORS.heart);
 // At low zoom there is not enough pan room to center an off-center
 // organ without exposing empty canvas. The bounded camera keeps it visible.
 if(d>=.75)assert.ok(Math.abs(actual.x-center.x)<1e-7&&Math.abs(actual.y-center.y)<1e-7);
 else assert.ok(actual.x>=0&&actual.x<=960&&actual.y>=0&&actual.y<=640);
 const moved=m.humanPan(focus,25,-19);
 assert.equal(moved.depth,focus.depth);
 assert.ok(Math.abs(moved.panX)<=960*(scale-1)/2+1e-8);
}
assert.deepEqual(m.humanCameraBound({depth:-10,panX:400,panY:-400}),initial);
assert.equal(m.humanCameraBound({depth:50,panX:0,panY:0}).depth,4);
assert.equal(m.humanRegionAt({x:483,y:194}),"heart");
assert.equal(m.humanRegionAt({x:450,y:193}),"lungs");
assert.equal(m.humanRegionAt({x:480,y:62}),"brain");
assert.equal(m.humanRegionAt({x:480,y:480}),"skin");
assert.equal(m.humanRegionAt({x:481,y:285}),"digestive");
assert.equal(m.humanRegionAt({x:365,y:238}),"musculoskeletal");
assert.deepEqual(m.humanRegionAnchor("digestive",{x:0,y:0}),m.HUMAN_ORGAN_ANCHORS.digestive);
assert.deepEqual(m.humanRegionAnchor("musculoskeletal",{x:0,y:0}),m.HUMAN_ORGAN_ANCHORS.musculoskeletal);
assert.equal(m.humanRegionAt({x:20,y:10}),"skin");
assert.deepEqual(m.humanRegionAnchor("skin",{x:503,y:420}),{x:503,y:420});
assert.deepEqual(m.humanRegionAnchor("brain",{x:503,y:420}),m.HUMAN_ORGAN_ANCHORS.brain);
assert.deepEqual(m.humanVisibleField(initial),{x:0,y:0,width:960,height:640});
for(let depth=0;depth<=4.001;depth+=.025){
 const a=[0,1,2,3,4].map(i=>m.humanLayerOpacity(depth,i));
 assert.ok(a.every(v=>v>=0&&v<=1));
 assert.ok(a.some(v=>v>.12),"No blank gaps between anatomically blended atlas depths");
}
assert.equal(m.humanLayerOpacity(0,0),1);
assert.equal(m.humanLayerOpacity(4,4),1);
assert.ok(m.humanLayerOpacity(1,0)>.4&&m.humanLayerOpacity(1,1)>.8,
 "Body/organ transition must cross-fade, not switch abruptly");
const app="src/LektrusBioContinuousHuman.tsx";
const src=fs.readFileSync(app,"utf8");
const ast=ts.createSourceFile(app,src,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
assert.equal(ast.parseDiagnostics.length,0,"Continuous explorer TSX must parse");
for(const asset of ["organs","heart","tissue","cell"]){
 const filename="src/assets/bio-atlas/"+asset+".webp";
 assert.ok(fs.existsSync(filename),"Visual concept art missing from repo "+filename);
 const file=fs.readFileSync(filename);
 assert.equal(file.subarray(0,4).toString("utf8"),"RIFF");
 assert.equal(file.subarray(8,12).toString("utf8"),"WEBP");
 assert.ok(file.length>1000&&file.length<35000,"App images must remain optimized");
 assert.match(src,new RegExp("assets/bio-atlas/"+asset+"\\.webp"));
}
const mannequinFile="src/LektrusBioMannequin.tsx";
const mannequin=fs.readFileSync(mannequinFile,"utf8");
const modelAsset="src/assets/bio-atlas/human-biomodel.webp";
assert.ok(fs.existsSync(modelAsset),"Approved translucent human artwork must be local");
const approved=fs.readFileSync(modelAsset);
assert.equal(approved.subarray(0,4).toString("utf8"),"RIFF");
assert.equal(approved.subarray(8,12).toString("utf8"),"WEBP");
assert.ok(approved.length>75000&&approved.length<350000,
 "Approved anatomical asset should retain detail without excessive loading");
const mannequinAst=ts.createSourceFile(mannequinFile,mannequin,
 ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
assert.equal(mannequinAst.parseDiagnostics.length,0,"Mannequin SVG component must parse");
assert.match(mannequin,/export default memo\(LektrusBioMannequin\)/);
assert.match(mannequin,/useId\(\)/,"Both figures must use unique SVG gradient ids");
assert.match(mannequin,/human-biomodel\.webp/);
assert.match(mannequin,/highlightMasks/);
assert.match(mannequin,/data-bio-active-system=\{system\}/);
assert.match(mannequin,/musculoskeletal/);
assert.match(mannequin,/approved semi-transparent biomodel/i);
assert.match(mannequin,/is-overview/);
assert.match(mannequin,/aria-hidden="true"/);
assert.match(src,/import LektrusBioMannequin from "\.\/LektrusBioMannequin"/);
assert.equal(src.includes("assets/bio-atlas/body.webp"),false,
 "Do not display the realistic photograph in the school atlas");
assert.equal((src.match(/<LektrusBioMannequin system=\{system\}\/>/g)||[]).length,2,
 "Main body and minimap must show exactly the same mannequin");
assert.match(src,/onPointerDown=\{press\} onPointerMove=\{move\}/);
assert.match(src,/onPointerUp=\{release\} onPointerCancel=\{release\}/);
assert.match(src,/addEventListener\("wheel",wheel,\{passive:false\}\)/);
assert.match(src,/humanZoomAt\(before,before.depth\+delta,point\)/);
assert.match(src,/Math.log\(d1\/d0\)\/Math.log\(2.18\)/,"Pinch must zoom smoothly, not advance an atlas page");
assert.match(src,/humanRegionAt\(point\)/);
assert.match(src,/humanRegionAnchor\(region,selectedSpot\)/);
assert.match(src,/HUMAN_BODY_SYSTEMS\.map\(entry=>/);
assert.match(src,/onClick=\{\(\)=>chooseSystem\(entry.id\)\}/);
assert.match(src,/aria-pressed=\{system===entry.id\}/);
assert.match(src,/study=\{study\} depth=\{4\}/);
assert.match(src,/humanLayerOpacity\(cam.depth,i\)/);
assert.match(src,/humanUnproject\(camera.current,point\)/);
assert.match(src,/humanVisibleField\(cam\)/);
assert.match(src,/role="application"/);
assert.match(src,/role="status"/);
assert.match(src,/aria-label="Глубина приближения"/);
assert.match(src,/SkinSection depth=\{depth\?\?2\}/);
assert.match(src,/неразмеченных областях показана типовая модель кожи/);
const parent=fs.readFileSync("src/LektrusBioMicroscope.tsx","utf8");
assert.match(parent,/activeOrganism==="human"&&<LektrusBioContinuousHuman\/>/);
assert.match(parent,/activeOrganism!=="human"&&<LektrusBioUnifiedZoom/);
assert.match(parent,/showExercise=Boolean\(diagram.activity==="label"\|\|diagram.activity==="assemble"\)/);
const css=fs.readFileSync("src/lektrusBioContinuousHuman.css","utf8");
assert.match(css,/touch-action:none/);
assert.match(css,/\.lektrus-human-biomodel-image-focus/);
assert.match(css,/\.lektrus-human-system-options button.is-active/);
assert.match(css,/\.lektrus-human-minimap \.lektrus-human-biomodel/);
assert.equal(css.includes(".lektrus-human-body img{"),false,
 "Photograph-specific body styles must be removed");
assert.match(css,/\.lektrus-human-world.is-travelling\{transition:transform/);
assert.match(css,/mask-image:radial-gradient/);
assert.match(css,/@media\(max-width:650px\)/);
assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
console.log("Continuous human atlas PASS: approved translucent biological figure, five selectable systems, four deep atlas images, correct cursor-anchored zoom, full-body minimap and touch/pinch gestures.");
