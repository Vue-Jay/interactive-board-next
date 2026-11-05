import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const code=ts.transpileModule(fs.readFileSync(
 "src/lektrusSkinEdgeSections.ts","utf8"),{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText;
const model={};
new Function("exports",code)(model);
assert.equal(model.SKIN_EDGE_WORLD_WIDTH,2.9);
assert.equal(model.SKIN_EDGE_NATIVE_FACTOR,3);
assert.equal(model.skinEdgeLayerAt(.10),"epidermis");
assert.equal(model.skinEdgeLayerAt(.70),"dermis");
assert.equal(model.skinEdgeLayerAt(2.1),"subcutis");
assert.equal(model.skinEdgeLayerAt(-1),null);
assert.equal(model.skinEdgeLayerAt(5),null);
const width=150,height=75,factor=3;
const alpha=new Uint8ClampedArray(width*height);
// Three silhouettes (left arm, torso, right arm), separated by clear space.
for(let y=0;y<height;y++){
 for(const [start,end] of [[9,32],[48,96],[115,141]]){
  for(let x=start;x<=end;x++)alpha[y*width+x]=255;
 }
}
const rows=model.skinEdgeRuns(alpha,width,12);
assert.deepEqual(rows,[{start:9,end:32},{start:48,end:96},
 {start:115,end:141}]);
const result=model.createSkinEdgeRaster(alpha,width,height,factor);
const px=(x,y)=>Array.from(result.rgba.slice((y*width+x)*4,(y*width+x)*4+4));
assert.equal(px(0,24)[3],0,"Transparent exterior must remain unpainted");
assert.equal(px(40,24)[3],0,"Gap between limbs must remain empty");
assert.equal(px(72,24)[3],0,"Body center must remain neutral");
assert.equal(px(20,24)[3],0,"Arm center must remain unpainted");
assert.deepEqual(px(9,24).slice(0,3),model.SKIN_EDGE_COLORS.epidermis);
assert.deepEqual(px(11,24).slice(0,3),model.SKIN_EDGE_COLORS.dermis);
assert.deepEqual(px(15,24).slice(0,3),model.SKIN_EDGE_COLORS.subcutis);
assert.deepEqual(px(96,24).slice(0,3),model.SKIN_EDGE_COLORS.epidermis);
assert.deepEqual(px(94,24).slice(0,3),model.SKIN_EDGE_COLORS.dermis);
assert.deepEqual(px(90,24).slice(0,3),model.SKIN_EDGE_COLORS.subcutis);
assert.ok(result.landmarks.length>=12);
assert.ok(result.landmarks.every(p=>p.x>=0&&p.x<=50));
assert.ok(result.landmarks.every(p=>p.offsets.length===25&&p.offsets.every(Number.isFinite)));
// Sloped side: local detail coordinates follow the contour at each row.
const slope=new Uint8ClampedArray(width*height);
for(let y=0;y<height;y++)for(let x=12+y;x<140;x++)slope[y*width+x]=255;
const sloped=model.createSkinEdgeRaster(slope,width,height,factor);
const left=sloped.landmarks.find(p=>p.y===8&&p.inward===1);
assert.equal(left.offsets[0],-4);assert.equal(left.offsets[12],0);
assert.equal(left.offsets[24],4);
assert.equal(model.skinEdgeDetailsAlpha(1),0);
assert.ok(model.skinEdgeDetailsAlpha(5)>0);
assert.equal(model.skinEdgeDetailsAlpha(7),1);
// An inset hole must produce separate inner flank edges as well.
for(let x=58;x<=84;x++)alpha[50*width+x]=0;
const holes=model.skinEdgeRuns(alpha,width,50);
assert.ok(holes.length>3);
assert.throws(()=>model.createSkinEdgeRaster(alpha,width,1,factor),
 /dimensions mismatch|Invalid silhouette dimensions/);
const renderer=fs.readFileSync("src/LektrusSkinSemanticViewport.tsx","utf8");
const ui=fs.readFileSync("src/LektrusHumanAnatomy.tsx","utf8");
const stage=ts.createSourceFile("src/LektrusSkinSemanticViewport.tsx",
 renderer,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
assert.equal(stage.parseDiagnostics.length,0,"Cutaway viewport must parse");
assert.match(renderer,/createSkinEdgeRaster\(alpha,RASTER_WIDTH,RASTER_HEIGHT\)/);
assert.match(renderer,/drawSkinEdgeDetails\(detailCtx,landmarks,cam.scale,visible\)/);
assert.match(renderer,/ctx\.drawImage\(edgeAtlas,0,0,WORLD_WIDTH,WORLD_HEIGHT\)/);
assert.doesNotMatch(renderer,/drawSkinMesoTiles|drawSkinSurfaceField|drawSkinMicrotiles/);
assert.doesNotMatch(renderer,/skin-semantic-lod\.webp/);
assert.doesNotMatch(renderer,/sectionBlend|modeRef/);
assert.match(ui,/aria-label="Слои кожи"/);
assert.match(ui,/Левый бок/);
assert.match(ui,/Правый бок/);
assert.doesNotMatch(ui,/setSkinMode|skinMode|SkinViewMode/);
assert.match(ui,/camera=\{displayCamera\}/);
console.log("Lateral skin cross-section PASS: disjoint limb edges, 3 layers, untouched center, shared world camera and no full-body textures.");

// Continuous LOD, deterministic geometry and bounded rendering work.
for(const key of ["appendages","fibres","cells"]){
 let previous=0;
 for(let scale=1;scale<=360;scale+=.25){
  const value=model.skinEdgeDetailLevels(scale)[key];
  assert.ok(value>=previous&&value<=1);
  assert.ok(value-previous<.04,"No abrupt detail pop-in");previous=value;
 }
 assert.equal(model.skinEdgeDetailLevels(1)[key],0);
 assert.equal(model.skinEdgeDetailLevels(360)[key],1);
}
function record(scale,bounds){
 const calls=[];
 const ctx=new Proxy({}, {get:(_,name)=>(...args)=>{
  assert.ok(args.filter(x=>typeof x==="number").every(Number.isFinite));
  calls.push([name,...args]);
 },set:()=>true});
 const count=model.drawSkinEdgeDetails(ctx,[{x:10,y:20,inward:1}],scale,bounds);
 return {count,calls};
}
const visible={minX:8,maxX:14,minY:18,maxY:22};
assert.equal(record(1,visible).count,0);
assert.equal(record(360,{minX:100,maxX:110,minY:100,maxY:110}).count,0);
const tissue=record(30,visible),cells=record(150,visible);
assert.equal(tissue.count,1);assert.equal(cells.count,1);
assert.ok(cells.calls.length>tissue.calls.length+100,"Deep zoom reveals cells");
assert.deepEqual(cells.calls,record(150,visible).calls,"Pan/zoom must not randomize tissue");
assert.ok(cells.calls.some(c=>c[0]==="clip"),"Stay inside lateral section");
assert.match(renderer,/globalCompositeOperation="destination-in"/);
assert.match(renderer,/detailCtx\.drawImage\(edgeAtlas,0,0,WORLD_WIDTH,WORLD_HEIGHT\)/);
console.log("Skin detail LOD PASS: continuous reveals, cells, culling, deterministic geometry, exact silhouette mask.");
