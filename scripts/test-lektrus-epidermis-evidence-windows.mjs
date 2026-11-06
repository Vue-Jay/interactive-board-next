import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
function load(path,mocks={}){
 const code=ts.transpileModule(fs.readFileSync(path,"utf8"),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
 }).outputText;
 const exports={};
 new Function("exports","require",code)(exports,id=>{
  assert.ok(id in mocks,"Unknown dependency "+id);return mocks[id];
 });
 return exports;
}
const evidence=load("src/lektrusSkinEvidenceModel.ts");
const edges=load("src/lektrusSkinEdgeSections.ts",{
 "./lektrusSkinEvidenceModel":evidence
});
const vector=load("src/lektrusSkinVectorSections.ts",{
 "./lektrusSkinEvidenceModel":evidence,
 "./lektrusSkinEdgeSections":edges
});
function track(x,y0,y1,depth=8.4){
 const points=Array.from({length:y1-y0+1},(_,i)=>({
  x,y:y0+i,depth
 }));
 return {points,inward:-1,minX:x-depth-1,maxX:x+depth+1,
  minY:y0,maxY:y1};
}
const upperArm=track(270,140,220);
const digit=track(315,312,375,1.2);
const leg=track(260,430,530,8.4);
const windows=vector.skinUpperArmReferenceContours([upperArm,digit,leg]);
assert.equal(windows.length,1,"Only named upper-arm sample can reveal cutaway");
const section=windows[0];
assert.ok(section.points.length>15);
assert.ok(section.points.every(p=>p.x===270&&p.y>=140&&p.y<=220));
assert.ok(section.points.every(p=>p.depth<=8.4&&p.depth>0));
assert.ok(section.points.some(p=>p.depth>8),"Central cutaway is preserved");
assert.ok(section.points[0].depth<section.points[Math.floor(section.points.length/2)].depth,
 "The flank cutaway fades gently at its beginning");
assert.ok(section.points.at(-1).depth<section.points[Math.floor(section.points.length/2)].depth,
 "The flank cutaway fades gently at its end");
assert.ok(!windows.some(c=>c.minY>250),"Fingers, soles and legs remain intact");

// No deep-cell illustration at an unknown location. Keratinocyte geometry
// is no longer generated from pseudorandom images on every body edge.
const viewport=fs.readFileSync("src/LektrusSkinSemanticViewport.tsx","utf8");
assert.match(viewport,/drawEpidermisAtlas\(ctx,thinContours/);
assert.match(viewport,/pickEpidermisAt\(thinContours/);
assert.doesNotMatch(viewport,/drawSkinTissueTexture\(/);
const cells=fs.readFileSync("src/lektrusEpidermisCellSheet.ts","utf8");
assert.match(cells,/basale:\{columns:1/);
assert.match(cells,/id!=="corneum"/);
assert.match(cells,/EPIDERMIS_CELL_SHEET_BUDGET=1800/);
console.log("Anatomy epidermis evidence windows PASS: tapered shoulder sample, all distal digits unchanged, one basal tier, no random dermal texture.");
