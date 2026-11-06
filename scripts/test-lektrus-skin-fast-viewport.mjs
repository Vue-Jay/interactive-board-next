import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const source=fs.readFileSync("src/lektrusSkinFastViewport.ts","utf8");
const js=ts.transpileModule(source,{compilerOptions:{
 module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const api={};new Function("exports",js)(api);
assert.equal(api.SKIN_UNVERIFIED_MICROSTRUCTURES_ENABLED,false);
assert.equal(api.SKIN_RENDER_MODEL_STATUS,"illustrative-uncalibrated");
for(const size of [[1080,1800],[360,600],[720,1200]]){
 const [w,h]=size;
 const full=api.skinVisibleImageCrop(
  {minX:0,minY:0,maxX:360,maxY:600},w,h,0);
 assert.deepEqual(full,{sx:0,sy:0,sw:w,sh:h,
  dx:0,dy:0,dw:360,dh:600});
 const close=api.skinVisibleImageCrop(
  {minX:250,minY:180,maxX:252,maxY:183},w,h,1);
 assert.ok(close);
 assert.equal(close.dw,4);
 assert.equal(close.dh,5);
 assert.equal(close.sw,4*w/360);
 assert.equal(close.sh,5*h/600);
 assert.ok(close.sw*close.sh/(w*h)<.0001,
  "At 4000% zoom only a tiny source patch may be rasterized");
 assert.equal(api.skinVisibleImageCrop(
  {minX:800,minY:800,maxX:900,maxY:900},w,h,0),null);
 assert.equal(api.skinVisibleImageCrop(
  {minX:-80,minY:-30,maxX:-5,maxY:0},w,h,0),null);
 assert.equal(api.skinVisibleImageCrop(
  {minX:20,minY:20,maxX:22,maxY:23},0,h,0),null);
}
const renderer=fs.readFileSync("src/LektrusSkinSemanticViewport.tsx","utf8");
const ast=ts.createSourceFile("src/LektrusSkinSemanticViewport.tsx",
 renderer,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
assert.equal(ast.parseDiagnostics.length,0);
assert.match(renderer,/skinVisibleImageCrop\(visible,/);
assert.match(renderer,/ctx\.drawImage\(body,crop\.sx,crop\.sy,crop\.sw,crop\.sh/);
assert.match(renderer,/drawSkinSectionBands\(ctx,contours,visible\)/);
assert.match(renderer,/if\(refined&&cam\.scale>2\.5&&cam\.scale<14\)/);
assert.match(renderer,/drawSkinTissueTexture\(ctx,contours,cam\.scale,visible\)/);
assert.doesNotMatch(renderer,/if\(refined\)drawSkinTissueTexture/);
for(const forbidden of [
 "drawSkinEdgeDetails(","drawSkinMicroscopicDetails(",
 "drawSkinFineStructures(",
 "createSkinEdgeRaster(","skinAdiposeField("
])assert.equal(renderer.includes(forbidden),false,
 "Fabricated skin or expensive per-frame path is still active: "+forbidden);
assert.match(renderer,/Условный боковой разрез/);
const ui=fs.readFileSync("src/LektrusHumanAnatomy.tsx","utf8");
assert.match(ui,/LektrusSkinSpecimens defaultOpen=\{displayCamera\.scale>=18\}/);
assert.match(ui,/Ниже доступны настоящие микроснимки/);
assert.doesNotMatch(ui,/Приближайте край: постепенно проявятся фолликулы/);
const stage=fs.readFileSync("src/lektrusAnatomySemanticZoom.ts","utf8");
assert.doesNotMatch(stage,/Микростроение кожи · отдельные клетки/);
console.log("Skin fast honesty PASS: native-resolution cropped atlas, unverified synthetic cells disabled, correct layers and real human reference.");
