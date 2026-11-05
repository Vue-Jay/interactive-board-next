import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const read=path=>fs.readFileSync(path,"utf8");
function loadTS(file,mocks={}){
 const code=ts.transpileModule(read(file),{fileName:file,compilerOptions:{
  module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true
 }}).outputText;
 const exports={};
 new Function("exports","require",code)(exports,id=>{
  assert.ok(id in mocks,"Unexpected dependency: "+id);return mocks[id];
 });
 return exports;
}
const model=loadTS("src/lektrusHumanAnatomyModel.ts",{
 "./lektrusBioHumanBodySystems":{
  HUMAN_BODY_SYSTEMS:[{id:"nervous"},{id:"respiratory"},{id:"circulatory"},
   {id:"digestive"},{id:"urinary"},{id:"musculoskeletal"},{id:"integumentary"}]
 }});
const lod=loadTS("src/lektrusAnatomySemanticZoom.ts");
const surface=loadTS("src/lektrusSkinSurfaceField.ts",{
 "./lektrusAnatomySemanticZoom":lod
});

assert.equal(lod.SKIN_DETAIL_ATLAS.columns,3);
assert.equal(lod.SKIN_DETAIL_NODES.length,4);
assert.deepEqual(lod.SKIN_DETAIL_NODES.map(n=>n.source),[
 "regional-image","procedural-surface","virtual-section","tissue-image"
]);
assert.equal(new Set(lod.SKIN_DETAIL_NODES.map(x=>x.id)).size,4);
for(const node of lod.SKIN_DETAIL_NODES){
 assert.equal(node.systemId,"integumentary");
 assert.equal(node.provenance,"atlas-reconstruction");
 assert.ok(node.width>0&&node.height>0);
 assert.deepEqual(node.anchor,lod.SKIN_SHOULDER_CENTER);
 assert.equal(typeof node.parentId,"string");
 assert.ok(node.scaleWindow.every(Number.isFinite));
 assert.ok(node.scaleWindow.every((v,i,values)=>i===0||v>=values[i-1]));
 assert.equal(lod.anatomyDetailOpacity(.5,node.scaleWindow),0);
 for(let scale=1;scale<=lod.SKIN_MAX_SCALE;scale+=.12){
  const opacity=lod.anatomyDetailOpacity(scale,node.scaleWindow);
  assert.ok(opacity>=0&&opacity<=1,node.id+" alpha "+opacity);
 }
 // Adjacent slider samples do not cause visible jumps in opacity.
 let before=lod.anatomyDetailOpacity(1,node.scaleWindow);
 for(let scale=1.01;scale<=lod.SKIN_MAX_SCALE;scale+=.01){
  const next=lod.anatomyDetailOpacity(scale,node.scaleWindow);
  assert.ok(Math.abs(next-before)<.028,"LOD opacity discontinuity "+node.id);
  before=next;
 }
}
assert.ok(lod.skinAvailableAt(lod.SKIN_SHOULDER_CENTER));
assert.equal(lod.skinAvailableAt({x:50,y:470}),false);
assert.equal(lod.skinAvailableAt({x:NaN,y:163}),false);
const seedA=lod.skinSurfacePores(777,30),seedB=lod.skinSurfacePores(777,30);
assert.deepEqual(seedA,seedB,"Procedural detail must not flicker on redraw");
assert.notDeepEqual(seedA,lod.skinSurfacePores(778,30));
assert.ok(seedA.every(p=>p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1));

for(const size of [{width:800,height:600},{width:360,height:540},
 {width:1200,height:440},{width:250,height:190}]){
 const fit=lod.anatomyBodyFit(size.width,size.height);
 assert.ok(fit.width<=size.width*.901);
 assert.ok(fit.height<=size.height*.961);
 for(const scale of [1,1.6,3.25,8,22,52]){
  const cam=model.anatomyCameraAtBody?model.anatomyCameraAtBody(
   lod.SKIN_SHOULDER_CENTER,scale,size.width,size.height):
   lod.anatomyCameraAtBody(lod.SKIN_SHOULDER_CENTER,scale,size.width,size.height);
  const projected=lod.anatomyBodyToScreen(cam,lod.SKIN_SHOULDER_CENTER,size.width,size.height);
  assert.ok(Math.abs(projected.x-size.width/2)<1e-8);
  assert.ok(Math.abs(projected.y-size.height/2)<1e-8);
  const sample={x:size.width*.43,y:size.height*.64};
  const world=lod.anatomyScreenToBody(cam,sample,size.width,size.height);
  const back=lod.anatomyBodyToScreen(cam,world,size.width,size.height);
  assert.ok(Math.abs(back.x-sample.x)<1e-7);
  assert.ok(Math.abs(back.y-sample.y)<1e-7);
  assert.ok(lod.skinNodeVisibleInViewport(lod.SKIN_DETAIL_NODES[0],cam,size.width,size.height));
 }
}
const at={x:421,y:307},w=960,h=640;
let cam={scale:1,panX:0,panY:0};
const old=lod.anatomyScreenToBody(cam,at,w,h);
cam=model.anatomyZoomAt(cam,34,at,w,h,lod.SKIN_MAX_SCALE);
const underCursor=lod.anatomyScreenToBody(cam,at,w,h);
assert.ok(Math.abs(old.x-underCursor.x)<1e-6);
assert.ok(Math.abs(old.y-underCursor.y)<1e-6);
assert.equal(cam.scale,34);
const back=model.anatomyZoomAt(cam,1,at,w,h,lod.SKIN_MAX_SCALE);
assert.ok(Math.abs(back.panX)<1e-6);
assert.ok(Math.abs(back.panY)<1e-6);
assert.equal(back.scale,1);
assert.equal(model.anatomyZoomAt({scale:1,panX:0,panY:0},99,at,w,h).scale,3.25,
 "Existing six systems must retain their supported default cap");

const image=fs.readFileSync("src/assets/bio-atlas/skin-semantic-lod.webp");
assert.equal(image.toString("ascii",0,4),"RIFF");
assert.equal(image.toString("ascii",8,12),"WEBP");
assert.equal(image.toString("ascii",12,16),"VP8 ");
assert.deepEqual([image.readUInt16LE(26)&0x3fff,image.readUInt16LE(28)&0x3fff],
 [2700,900],"Reusable source is three 900x900 plates, not 52 new frames");
assert.ok(image.length<800000,"Keep offline mobile texture bundle compact");

const viewer=read("src/LektrusHumanAnatomy.tsx");
const renderer=read("src/LektrusSkinSemanticViewport.tsx");
const css=read("src/lektrusHumanAnatomy.css");
for(const p of ["src/LektrusHumanAnatomy.tsx","src/LektrusSkinSemanticViewport.tsx"]){
 const file=ts.createSourceFile(p,read(p),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 assert.equal(file.parseDiagnostics.length,0,p+" must parse as TSX");
}
assert.match(viewer,/<LektrusSkinSemanticViewport[\s\S]*?camera=\{displayCamera\} mode=\{skinMode\}/);
assert.match(viewer,/skinAvailableAt\(\s*anatomyScreenToBody\(/);
assert.match(viewer,/skinDetailStage\(displayCamera.scale\)/);
assert.match(viewer,/SKIN_MAX_SCALE/);
assert.match(viewer,/setSkinRouteActive\(true\)/);
assert.match(renderer,/requestAnimationFrame\(draw\)/);
assert.match(renderer,/canvas\.getContext\("2d"/);
assert.match(renderer,/drawSkinSurfaceField\(/);
assert.match(renderer,/modeRef\.current==="section"/);
assert.doesNotMatch(renderer,/SKIN_DETAIL_NODES/,
 "Surface must not be a slideshow of unrelated LOD frames");
assert.doesNotMatch(renderer,/rootOpacity=cutaway/,
 "The whole figure must never fade away on a scale threshold");
assert.doesNotMatch(renderer,/BODY_SKIN_INDEX\*WORLD_WIDTH[\s\S]*?rootOpacity/);
assert.match(renderer,/ResizeObserver/);
assert.match(renderer,/Виртуальный анатомический срез кожи плеча/);
assert.ok(css.includes(".lek-anatomy-semantic-canvas{"));
assert.ok(css.includes(".lek-anatomy-skin-explore{"));

// Independent continuous surface model: same coordinates at every scale.
assert.deepEqual(Object.keys(surface.SKIN_SURFACE_LEVELS),
 ["regional","relief","pores","corneocytes"]);
for(const level of Object.keys(surface.SKIN_SURFACE_LEVELS)){
 let prior=surface.skinSurfaceAlpha(1,level);
 assert.equal(prior,0);
 for(let scale=1.01;scale<52;scale+=.01){
  const alpha=surface.skinSurfaceAlpha(scale,level);
  assert.ok(alpha>=0&&alpha<=1);
  assert.ok(alpha>=prior-1e-10,level+" opacity must be monotone");
  assert.ok(alpha-prior<.04,level+" must not pop between small zoom steps");
  prior=alpha;
 }
}
assert.equal(surface.skinHash(17,34,2),surface.skinHash(17,34,2));
assert.notEqual(surface.skinHash(17,34,2),surface.skinHash(17,35,2));
assert.equal(surface.skinValueNoise(8,4,17),surface.skinValueNoise(8,4,17));
for(const shift of [1e-7,1e-5,.001]){
 assert.ok(Math.abs(surface.skinValueNoise(12-shift,7.3,99)-
  surface.skinValueNoise(12+shift,7.3,99))<shift*5+1e-6,
  "Noise should not introduce grid-aligned cracks");
}
const mid=lod.SKIN_SHOULDER_CENTER;
assert.equal(surface.skinSurfaceInside(mid.x,mid.y),true);
assert.equal(surface.skinSurfaceInside(10,580),false);
assert.ok(surface.skinSurfaceEdgeOpacity(mid.x,mid.y)>.99);
assert.equal(surface.skinSurfaceEdgeOpacity(0,0),0);
for(const scale of [1,2,4,8,16,34,52]){
 const {width,height}={width:930,height:620};
 const cam=lod.anatomyCameraAtBody(mid,scale,width,height);
 const bounds=surface.skinVisibleWorldBounds(cam,width,height);
 assert.ok(bounds.minX<=mid.x&&bounds.maxX>=mid.x);
 assert.ok(bounds.minY<=mid.y&&bounds.maxY>=mid.y);
 const sample=surface.skinHash(22,15,7);
 assert.equal(sample,surface.skinHash(22,15,7),
  "Microstructures cannot be randomized by zooming");
}
assert.match(viewer,/const \[displayCamera,setDisplayCamera\]/);
assert.match(viewer,/requestAnimationFrame\(tick\)/);
assert.match(viewer,/zoom\([^;]*,at,overSkin\)/,
 "The first wheel movement should enter deep zoom without waiting for React state");
assert.match(viewer,/aria-pressed=\{skinMode==="surface"\}/);
assert.match(viewer,/aria-pressed=\{skinMode==="section"\}/);
assert.match(renderer,/drawSkinSurfaceField\(ctx,cam.scale,region,surfaceOpacity\)/);
assert.match(renderer,/ctx\.drawImage\(resources\.body/,
 "Body remains visible behind spatially registered detail");
assert.match(renderer,/sectionBlend\+=/,
 "Changing to an explicit virtual section must fade smoothly");
assert.match(renderer,/if\(detailReady&&resources\.section&&sectionBlend>/);
const fieldSource=read("src/lektrusSkinSurfaceField.ts");
assert.doesNotMatch(fieldSource,/Math\.random/,
 "Skin pores must not jump to new positions during render");
assert.match(fieldSource,/const MAX_DRAWN_CELLS=7000/,
 "Offscreen detail must be culled for memory and mobile performance");

console.log("Skin continuous scene PASS: registered surface, deterministic pores, continuous camera, explicit cutaway, screen culling.");
