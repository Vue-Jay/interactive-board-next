import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const source=p=>fs.readFileSync(p,"utf8");
function load(path,mocks={}){
 const code=ts.transpileModule(source(path),{fileName:path,
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
 }).outputText;
 const exports={};
 new Function("exports","require",code)(exports,id=>{
  assert.ok(id in mocks,"Unrecognized epidermis dependency: "+id);
  return mocks[id];
 });
 return exports;
}
const evidence=load("src/lektrusSkinEvidenceModel.ts");
const thick=load("src/lektrusThickEpidermis.ts",{
 "./lektrusSkinEvidenceModel":evidence
});
const atlas=load("src/lektrusEpidermisAtlas.ts",{
 "./lektrusSkinEvidenceModel":evidence,
 "./lektrusThickEpidermis":thick
});
const layerIds=["corneum","granulosum","spinosum","basale"];
assert.deepEqual([...atlas.EPIDERMIS_STRATA_ORDER],layerIds);
assert.deepEqual([...atlas.EPIDERMIS_THICK_STRATA_ORDER],
 ["corneum","lucidum","granulosum","spinosum","basale"]);
assert.ok(atlas.EPIDERMIS_RECORDS.lucidum.summary.includes("безъядерных"));
assert.ok(atlas.EPIDERMIS_RECORDS.lucidum.microAppearance.includes("тонкую"));
assert.equal(atlas.EPIDERMIS_RECORDS.lucidum.source,atlas.EPIDERMIS_SOURCES.leeds);
assert.deepEqual(atlas.EPIDERMIS_LAYER_FRACTIONS.map(x=>x.id),layerIds);
assert.equal(atlas.EPIDERMIS_LAYER_FRACTIONS[0].start,0);
assert.equal(atlas.EPIDERMIS_LAYER_FRACTIONS.at(-1).end,
 evidence.SKIN_ILLUSTRATIVE_LAYERS.epidermisEnd);
for(let i=1;i<4;i++)
 assert.equal(atlas.EPIDERMIS_LAYER_FRACTIONS[i-1].end,
  atlas.EPIDERMIS_LAYER_FRACTIONS[i].start);
assert.equal(evidence.SKIN_ILLUSTRATIVE_LAYERS.basaleStart,.057,
 "Single-row basal layer needs to be narrower than spinous tissue");
assert.ok(atlas.EPIDERMIS_RECORDS.corneum.microAppearance.includes("нет ядер"));
assert.ok(atlas.EPIDERMIS_RECORDS.granulosum.summary.includes("кератогиалина"));
assert.ok(atlas.EPIDERMIS_RECORDS.basale.summary.includes("Один ряд"));
assert.ok(atlas.EPIDERMIS_RECORDS.spinosum.microAppearance.includes("фиксации"));
assert.ok(atlas.EPIDERMIS_RECORDS.epidermis.microAppearance.includes("не содержит кровеносных сосудов"));
for(const id of ["epidermis",...atlas.EPIDERMIS_THICK_STRATA_ORDER,
 "keratinocyte","melanocyte","basement"]){
 const obj=atlas.EPIDERMIS_RECORDS[id];
 assert.equal(obj.id,id);
 assert.ok(obj.name&&obj.summary&&obj.function&&obj.microAppearance);
 assert.ok(obj.source.startsWith("https://"));
}
for(const layer of atlas.EPIDERMIS_LAYER_FRACTIONS)
 assert.equal(atlas.epidermisLayerAt((layer.start+layer.end)/2),layer.id);
assert.equal(atlas.epidermisLayerAt(-.01),null);
assert.equal(atlas.epidermisLayerAt(.10),null);
assert.equal(atlas.epidermisLayerAt(NaN),null);

const points=Array.from({length:1101},(_,i)=>({
 x:270,y:168+i*.05,depth:8.4
}));
const contour={inward:-1,points,minX:258,maxX:274,minY:168,maxY:223};
const pointAt=(fraction,y=181)=>({
 x:270-8.4*fraction,y
});
for(const layer of atlas.EPIDERMIS_LAYER_FRACTIONS){
 const midpoint=(layer.start+layer.end)/2;
 assert.equal(atlas.pickEpidermisAt([contour],pointAt(midpoint,181.10),230),
  layer.id,"Hit test must resolve "+layer.id+" in body coordinates");
}
assert.equal(atlas.pickEpidermisAt([contour],pointAt(.035),16),"epidermis",
 "At low magnification several thin strata should count as epidermis");
assert.equal(atlas.pickEpidermisAt([contour],pointAt(.3),230),null,
 "No selecting the epidermis from the dermis or neutral body");
assert.equal(atlas.pickEpidermisAt([contour],{x:270,y:500},360),null,
 "No cross-contour ghost hit outside anatomical skin");
// The basement interface undulates in world space; use the same edge
// for visual selection instead of testing an obsolete straight border.
const basalBoundary=atlas.epidermisStratumEdge(
 181,evidence.SKIN_ILLUSTRATIVE_LAYERS.epidermisEnd);
assert.equal(atlas.pickEpidermisAt([contour],
 pointAt(basalBoundary-.00045),250),"basement");
const nearMelano=Math.round(181/.31)*.31;
const atMelano=atlas.pickEpidermisAt([contour],
 pointAt((evidence.SKIN_ILLUSTRATIVE_LAYERS.basaleStart+
 evidence.SKIN_ILLUSTRATIVE_LAYERS.epidermisEnd)/2,nearMelano),260);
assert.equal(atMelano,"melanocyte");
const kerY=Math.round(181/.23)*.23;
const kerCenter=atlas.epidermisKeratinocyteCenter(contour,kerY);
assert.ok(kerCenter,"Representative keratinocyte must have a world anchor");
assert.equal(atlas.pickEpidermisAt([contour],kerCenter,260),"keratinocyte",
 "Clicking an actually drawn spinous keratinocyte must open its own card");
const melCenter=atlas.epidermisMelanocyteCenter(contour,nearMelano);
assert.ok(melCenter);
assert.equal(atlas.pickEpidermisAt([contour],melCenter,260),"melanocyte",
 "Only the real drawn melanocyte glyph may be targeted");
assert.equal(atlas.pickEpidermisAt([contour],
 {...kerCenter,y:kerCenter.y+.05},260)!=="keratinocyte",true,
 "Do not select arbitrary invisible keratinocyte targets");
for(let y=179;y<184;y+=.027){
 const actual=atlas.epidermisStratumEdge(y,
  evidence.SKIN_ILLUSTRATIVE_LAYERS.epidermisEnd);
 assert.ok(actual>.060&&actual<.070,
  "Papillary waves should be shallow, never false large spikes");
 assert.equal(actual,atlas.epidermisStratumEdge(y,
  evidence.SKIN_ILLUSTRATIVE_LAYERS.epidermisEnd));
}
// Glabrous-skin virtual windows must remain tied to real silhouette
// geometry, never silently classify all visible dorsal hand/foot edges.
const palmPoints=Array.from({length:401},(_,i)=>({
 x:312,y:332+i*.05,depth:8.4
}));
const footPoints=Array.from({length:401},(_,i)=>({
 x:241,y:571+i*.05,depth:5.2
}));
const palmContour={inward:-1,points:palmPoints,
 minX:300,maxX:314,minY:332,maxY:352};
const footContour={inward:-1,points:footPoints,
 minX:230,maxX:245,minY:571,maxY:591};
const palm=thick.resolveThickSkinSample([palmContour,footContour],"palm");
const sole=thick.resolveThickSkinSample([palmContour,footContour],"sole");
assert.ok(palm&&sole,"Both teaching sites must register to separate physical contours");
assert.equal(palm.contour,palmContour);
assert.equal(sole.contour,footContour);
assert.equal(thick.resolveThickSkinSample([],"palm"),null);
assert.ok(thick.thickSkinInfluence(palmContour,342,palm)>.999);
assert.equal(thick.thickSkinInfluence(footContour,342,palm),0);
assert.equal(thick.thickSkinInfluence(palmContour,365,palm),0);
const five=thick.thickSkinBandsAt(palmContour,342,palm);
assert.deepEqual(five.map(x=>x.id),[
 "corneum","lucidum","granulosum","spinosum","basale"]);
assert.equal(five[0].start,0);
assert.equal(five.at(-1).end,thick.THICK_SKIN_EPIDERMIS_END);
assert.ok(five[0].end>five[1].end-five[1].start,
 "Thick stratum corneum must be much wider than the thin lucidum");
for(let i=1;i<five.length;i++)assert.equal(five[i].start,five[i-1].end);
const thinAtHand=atlas.pickEpidermisAt(
 [palmContour],{x:312-8.4*.0815,y:342},260);
assert.equal(thinAtHand,null,
 "A frontal hand silhouette MUST NOT show lucidum unless a virtual palm sample is chosen");
const lucidMid=(five[1].start+five[1].end)/2;
const palmLucidHit=atlas.pickEpidermisAt(
 [palmContour],{x:312-8.4*lucidMid,y:342},260,palm);
assert.equal(palmLucidHit,"lucidum",
 "Clicking the actual translucent band must show stratum lucidum");
assert.equal(atlas.pickEpidermisAt(
 [footContour],{x:241-5.2*lucidMid,y:581},260,sole),"lucidum");
assert.notEqual(atlas.pickEpidermisAt(
 [palmContour],{x:312-8.4*lucidMid,y:342},260,sole),"lucidum",
 "The sole window may not reveal the palm's bands");
const palmFocus=thick.thickSkinFocusPoint(palm);
assert.ok(Math.abs(palmFocus.x-(312-8.4*lucidMid))<1e-6);
assert.equal(palmFocus.y,342);
assert.equal(atlas.pickEpidermisAt([],pointAt(.022),260),null);
const fakeCtx=new Proxy({},{
 get:(_,name)=>(...args)=>{
  for(const a of args)if(typeof a==="number")assert.ok(Number.isFinite(a));
 },set:()=>true
});
const previous=globalThis.Path2D;
globalThis.Path2D=class{
 hasMove=false;
 moveTo(){this.hasMove=true;}
 lineTo(){}closePath(){}
 ellipse(){
  assert.ok(this.hasMove,
   "Each independent nucleus or granular ellipse needs its own Path2D.moveTo: otherwise Canvas connects them into giant false triangles");
  this.hasMove=false;
 }
};
try{
 const render=load("src/lektrusEpidermisRenderer.ts",{
  "./lektrusSkinEvidenceModel":evidence,
  "./lektrusEpidermisAtlas":atlas
 });
 assert.ok(render.EPIDERMIS_DETAIL_MAX_CELLS<=5000);
 assert.equal(render.epidermisStratumEdge,atlas.epidermisStratumEdge,
  "Drawing and hit-testing must share exactly one dermal papilla geometry");
 assert.ok(render.EPIDERMIS_MICRO_MIN_SCALE>=130);
 assert.ok(Math.abs(render.epidermisStratumEdge(182,.065)-.065)<.006);
 const b={minX:260,maxX:275,minY:180,maxY:182};
 const base=render.drawEpidermisAtlas(fakeCtx,[contour],80,b,"granulosum",false);
 assert.equal(base.bands,4);
 assert.equal(base.cells,0,"Pan/zoom animation must not draw individual cells");
 const full=render.drawEpidermisAtlas(fakeCtx,[contour],360,b,"basale",true);
 assert.equal(full.bands,4);
 assert.ok(full.cells>50,"High zoom should reveal tiny differentiated cells");
 assert.ok(full.granules>0,"Granulosum needs keratohyalin granules");
 assert.ok(full.melanocytes>0,"Only registered shoulder may show a model melanocyte");
 assert.ok(full.cells<=render.EPIDERMIS_DETAIL_MAX_CELLS);
 assert.deepEqual(full,render.drawEpidermisAtlas(
  fakeCtx,[contour],360,b,"basale",true),
  "Cell positions and drawing budget must be stable across camera frames");
 const other={...contour,points:points.map(p=>({...p,x:50})),
  minX:40,maxX:54};
 const invalid=render.drawEpidermisAtlas(fakeCtx,[other],360,
  {minX:40,maxX:55,minY:180,maxY:182},null,true);
 assert.equal(invalid.cells,0,
  "Never invent thin-skin cell maps on anatomically unregistered body areas");
}finally{globalThis.Path2D=previous;}
const thickRender=load("src/lektrusThickEpidermisRenderer.ts",{
 "./lektrusThickEpidermis":thick,
 "./lektrusEpidermisAtlas":atlas
});
assert.ok(thickRender.THICK_EPIDERMIS_MAX_CELLS<=1000);
const modeled=thickRender.drawThickEpidermisSample(
 fakeCtx,palm,220,{minX:301,maxX:315,minY:340,maxY:344},
 "lucidum",true,215);
assert.equal(modeled.bands,5);
assert.ok(modeled.lamellae>0);
assert.ok(modeled.cells>0);
assert.equal(thickRender.drawThickEpidermisSample(
 fakeCtx,null,220,{minX:301,maxX:315,minY:340,maxY:344},
 null,true,215).bands,0);
const viewport=source("src/LektrusSkinSemanticViewport.tsx");
const human=source("src/LektrusHumanAnatomy.tsx");
assert.match(viewport,/drawEpidermisAtlas\(/);
assert.match(viewport,/pickEpidermisAt\(contours,point,ppu\)/);
assert.match(viewport,/selectionRef\.current/);
assert.match(viewport,/cam\.scale>11/);
assert.match(human,/anatomyScreenToBody\(displayed\.current,target,width,height\)/);
assert.match(human,/blockedTaps\.current/);
assert.match(human,/between\(from,target\)<=8/);
assert.match(human,/setEpidermisSelection\(hit\)/);
assert.match(human,/aria-pressed=\{epidermisSelection===id\}/);
assert.match(human,/EPIDERMIS_RECORDS\[epidermisSelection\]\.source/);
assert.match(viewport,/drawThickEpidermisSample\(/);
assert.match(viewport,/resolveThickSkinSample\(contours,"palm"\)/);
assert.match(human,/EPIDERMIS_THICK_STRATA_ORDER/);
assert.match(human,/Ладонь · 5 слоёв/);
assert.match(human,/Подошва · 5 слоёв/);
console.log("Epidermis PASS: four thin and five thick layers, no false dorsal skin classification, world-space lucidum clicks, bounded microstructure and accessible cards.");
