import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const read=p=>fs.readFileSync(p,"utf8");
function loadTS(file,mocks={}){
 const code=ts.transpileModule(read(file),{fileName:file,compilerOptions:{
  module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true
 }}).outputText;
 const exports={};
 new Function("exports","require",code)(exports,id=>{
  assert.ok(id in mocks,"Unexpected import "+id);
  return mocks[id];
 });
 return exports;
}
const world=loadTS("src/lektrusAnatomySemanticZoom.ts");
const surface=loadTS("src/lektrusSkinSurfaceField.ts",{
 "./lektrusAnatomySemanticZoom":world
});
const tiles=loadTS("src/lektrusSkinMicroTiles.ts",{
 "./lektrusSkinSurfaceField":surface
});
const sample={minX:178,maxX:181,minY:210,maxY:213};
const overview={minX:0,maxX:360,minY:0,maxY:600};

assert.equal(surface.skinRegionAt(57,331),"palm");
assert.equal(surface.skinRegionAt(303,331),"palm");
assert.equal(surface.skinRegionAt(254,182),"general");
assert.equal(surface.skinRegionAt(180,280),"general");
assert.equal(surface.skinPalmWeight(57,331),1);
assert.equal(surface.skinPalmWeight(180,280),0);
for(const [x,y] of [[57,331],[303,331]]){
 let before=surface.skinPalmWeight(x+7.5,y);
 for(let dx=7.51;dx<=14;dx+=.01){
  const weight=surface.skinPalmWeight(x+dx,y);
  assert.ok(weight>=0&&weight<=1);
  assert.ok(weight<=before+1e-8);
  assert.ok(before-weight<.008,"Palmar boundary must fade without a sharp oval edge");
  before=weight;
 }
}
for(const p of [{x:180,y:235},{x:57,y:331},{x:304,y:330}]){
 const cam=world.anatomyCameraAtBody(p,200,850,530);
 const bounds=surface.skinVisibleWorldBounds(cam,850,530);
 assert.ok(bounds.minX<=p.x&&bounds.maxX>=p.x);
 assert.ok(bounds.minY<=p.y&&bounds.maxY>=p.y);
 const list=tiles.skinVisibleMicrotiles(bounds);
 assert.ok(list.length>=1&&list.length<=tiles.SKIN_MICROTILE_CACHE_LIMIT,
  "No excessive skin tiles on a typical 850x530 viewport");
 const seen=new Set(list.map(t=>t.key));
 assert.equal(seen.size,list.length,"Tiles must not overlap by identity");
}
assert.equal(tiles.SKIN_MICROTILE_WORLD,1.3);
assert.equal(tiles.SKIN_MICROTILE_PIXELS,288);
assert.equal(tiles.SKIN_MICROTILE_CREATIONS_PER_FRAME,2);
assert.equal(tiles.SKIN_MICROTILE_CACHE_LIMIT,48);
const cellDiameterMicrons=surface.SKIN_CORNEOCYTE_STEP_WORLD*
 surface.MM_PER_WORLD_UNIT*1000;
assert.ok(cellDiameterMicrons>=25&&cellDiameterMicrons<=50,
 "Corneocyte model should use tens of micrometres, not huge visible plates");
assert.equal(tiles.skinCorneocyteAlpha(10),0);
assert.equal(tiles.skinCorneocyteAlpha(100),0);
assert.ok(tiles.skinCorneocyteAlpha(250)>0);
assert.equal(tiles.skinCorneocyteAlpha(360),1);
assert.deepEqual(tiles.skinCorneocyteGeometry(13,99),
 tiles.skinCorneocyteGeometry(13,99));
assert.notDeepEqual(tiles.skinCorneocyteGeometry(13,99),
 tiles.skinCorneocyteGeometry(13,100));
const sharedCell=tiles.skinCorneocyteGeometry(84,108);
assert.ok(Math.abs(sharedCell.x-(84+.5*(108%2))*
 surface.SKIN_CORNEOCYTE_STEP_WORLD)<1e-8);
assert.ok(sharedCell.radius>0);

// Previously an over-budget layer was silently removed in its entirety.
// The new plan retains existing samples, progressively reveals new ones.
const relief=surface.skinSamplingPlan(overview,surface.SKIN_RELIEF_STEP_WORLD);
assert.ok(relief.estimated>0&&relief.estimated<=surface.MAX_DRAWN_CELLS);
const pores=surface.skinSamplingPlan(overview,surface.SKIN_PORE_STEP_WORLD);
assert.ok(pores.estimated>0&&pores.estimated<=surface.MAX_DRAWN_CELLS);
for(const bounds of [overview,sample,
 {minX:10,maxX:150,minY:40,maxY:90},
 {minX:120,maxX:132,minY:180,maxY:188}]){
 for(const step of [surface.SKIN_RELIEF_STEP_WORLD,surface.SKIN_PORE_STEP_WORLD]){
  const p=surface.skinSamplingPlan(bounds,step);
  assert.ok(p.coarse>=p.fine);
  assert.ok(p.coarse===p.fine||p.coarse===p.fine*2);
  assert.ok(p.fineOpacity>=0&&p.fineOpacity<=1);
  assert.ok(p.estimated>=0&&p.estimated<=surface.MAX_DRAWN_CELLS);
 }
}
assert.ok(surface.skinDrawBudget(overview,surface.SKIN_RELIEF_STEP_WORLD,7,"relief")>0,
 "Detail drawing must not disappear because the whole-body grid is too large");
assert.ok(surface.skinDrawBudget(overview,surface.SKIN_PORE_STEP_WORLD,20,"pores")>0);
assert.equal(surface.skinDrawBudget(overview,surface.SKIN_PORE_STEP_WORLD,10,"pores"),0);
for(const layer of Object.keys(surface.SKIN_SURFACE_LEVELS)){
 let prev=surface.skinSurfaceAlpha(1,layer);
 for(let scale=1.01;scale<=360;scale+=.1){
  const next=surface.skinSurfaceAlpha(scale,layer);
  assert.ok(next>=prev-1e-10,"LOD must be monotone: "+layer);
  assert.ok(next-prev<.06,"No sudden opacity jumps: "+layer);
  prev=next;
 }
}

// Exercise actual browser-only cache logic with a lightweight mock canvas.
// No frame is allowed to create more than two 288x288 textures.
const actualDocument=globalThis.document;
let created=0,strokes=0,drawCalls=0,scheduled=0;
const mockCtx=()=>{
 const ctx={
  setTransform(){},beginPath(){},moveTo(){},lineTo(){},closePath(){},
  save(){},restore(){},
  stroke(){strokes++;},drawImage(){drawCalls++;},
  fill(){},ellipse(){},bezierCurveTo(){},quadraticCurveTo(){}
 };
 return ctx;
};
try{
 globalThis.document={createElement(tag){
  assert.equal(tag,"canvas");created++;
  const c=mockCtx();
  return {width:0,height:0,getContext:()=>c};
 }};
 const ctx=mockCtx();
 const bounds={minX:180,maxX:182.2,minY:205,maxY:207.2};
 const keys=tiles.skinVisibleMicrotiles(bounds);
 assert.ok(keys.length>=4);
 let drawn=tiles.drawSkinMicrotiles(ctx,bounds,290,1,()=>scheduled++);
 assert.ok(drawn<=2&&created<=2);
 for(let i=0;i<keys.length+1;i++){
  tiles.drawSkinMicrotiles(ctx,bounds,290,1,()=>scheduled++);
 }
 assert.equal(created,keys.length,"Every world tile should be created once");
 assert.ok(strokes>2000,"High-detail corneocytes should render actual cell boundaries");
 const count=created;
 drawn=tiles.drawSkinMicrotiles(ctx,bounds,290,1,()=>scheduled++);
 assert.equal(drawn,keys.length);
 assert.equal(created,count,"Revisiting a region reuses cached cells");
 assert.ok(tiles.skinMicrotileCacheSize()<=tiles.SKIN_MICROTILE_CACHE_LIMIT);
 assert.ok(scheduled>=1,"Missing tiles schedule a progressive viewport refresh");
 const before=drawCalls;
 assert.equal(tiles.drawSkinMicrotiles(ctx,bounds,20,1),0);
 assert.equal(drawCalls,before,"No cell plates on whole-body/medium zoom");
}finally{
 if(actualDocument===undefined)delete globalThis.document;
 else globalThis.document=actualDocument;
}

const fieldSource=read("src/lektrusSkinSurfaceField.ts");
const tileSource=read("src/lektrusSkinMicroTiles.ts");
const canvasSource=read("src/LektrusSkinSemanticViewport.tsx");
const uiSource=read("src/LektrusHumanAnatomy.tsx");
for(const path of ["src/LektrusSkinSemanticViewport.tsx","src/LektrusHumanAnatomy.tsx"]){
 const ast=ts.createSourceFile(path,read(path),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 assert.equal(ast.parseDiagnostics.length,0,path+" must parse");
}
assert.doesNotMatch(fieldSource,/Math\.random/);
assert.doesNotMatch(tileSource,/Math\.random/);
assert.match(fieldSource,/const palm=skinPalmWeight\(x,y\)/);
assert.match(fieldSource,/if\(variant>\.972&&palm<\.998\)/,
 "No hair shaft on glabrous palm");
assert.match(fieldSource,/function drawPalmRidges/);
assert.match(tileSource,/SKIN_MICROTILE_CREATIONS_PER_FRAME/);
assert.match(canvasSource,/drawSkinMicrotiles\(ctx,region,cam.scale,surfaceOpacity,requestDraw\)/);
assert.doesNotMatch(canvasSource,/resources\.shoulder|cropFeathered/);
assert.match(uiSource,/Приближайте любой участок тела/);
console.log("Skin regional microtexture PASS: glabrous palms, stable 34µm corneocytes, gradual budgeted LOD, bounded tile cache and whole-body camera.");
