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
const thick=load("src/lektrusThickEpidermis.ts",{
 "./lektrusSkinEvidenceModel":evidence
});
const atlas=load("src/lektrusEpidermisAtlas.ts",{
 "./lektrusSkinEvidenceModel":evidence,
 "./lektrusThickEpidermis":thick
});
const sheet=load("src/lektrusEpidermisCellSheet.ts",{
 "./lektrusEpidermisAtlas":atlas,
 "./lektrusSkinEvidenceModel":evidence
});
const p=atlas.sectionAtY(upperArm,182);
assert.ok(p);
const row=Math.round(182/.058),y=row*.058;
const fraction=evidence.SKIN_ILLUSTRATIVE_LAYERS.spinosumStart+
 (evidence.SKIN_ILLUSTRATIVE_LAYERS.basaleStart-
  evidence.SKIN_ILLUSTRATIVE_LAYERS.spinosumStart)*3.5/8;
const cellPoint={x:p.x-upperArm.points[0].depth*
 atlas.epidermisStratumEdge(y,fraction),y};
const hit=sheet.epidermisVisibleCellAt(upperArm,cellPoint);
assert.ok(hit,"A painted spinous keratinocyte is selectable at its center");
assert.equal(hit.layer,"spinosum");
assert.ok(Math.abs(hit.center.x-cellPoint.x)<.001);
assert.equal(sheet.epidermisVisibleCellAt(upperArm,
 {x:cellPoint.x-1.4,y}),null,
 "Outside any drawn epidermal cell there is no invisible hit target");
// Separate alpha boundary tracing must include the entire finger/tip,
// unlike tissue-section tracks, which intentionally omit thin segments.
const outline=load("src/lektrusSkinSilhouetteOutline.ts");
const sw=45,sh=55,aMask=new Uint8ClampedArray(sw*sh);
for(let y=2;y<=47;y++)for(let x=4;x<=10;x++)
 aMask[y*sw+x]=255;
for(let y=4;y<=53;y++)for(let x=19;x<=25;x++)
 aMask[y*sw+x]=255;
const loops=outline.traceSkinSilhouette(aMask,sw,sh,1);
assert.equal(loops.length,2,"Separate fingers must remain separate loops");
assert.deepEqual(loops.map(l=>l.maxY).sort((a,b)=>a-b),[48,54],
 "The closing stroke includes BOTH fingertip ends without truncation");
assert.ok(loops.every(l=>l.points.length>=4));
console.log("Anatomy epidermis evidence windows PASS: localized samples, complete separate digit outlines, one basal tier, precise cell picks.");
