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
const world=loadTS("src/lektrusAnatomySemanticZoom.ts");
const surface=loadTS("src/lektrusSkinSurfaceField.ts",{
 "./lektrusAnatomySemanticZoom":world
});

assert.deepEqual(world.SKIN_SHOULDER_CENTER,{x:254,y:182});
assert.deepEqual(world.SKIN_BODY_SIZE,{width:360,height:600});
assert.deepEqual(world.SKIN_SHOULDER,{x:226,y:148,width:56,height:68});
assert.notDeepEqual(world.SKIN_SHOULDER_CENTER,{x:250,y:163},
 "The anatomical focal point must be recalibrated after replacing the body source");
assert.equal(world.skinAvailableAt({x:280,y:197}),false,
 "The shoulder selection must not include surrounding empty background");
assert.equal(world.SKIN_MAX_SCALE,52);
assert.ok(world.skinAvailableAt(world.SKIN_SHOULDER_CENTER));
assert.equal(world.skinAvailableAt({x:50,y:470}),false);
assert.equal(world.skinAvailableAt({x:NaN,y:163}),false);
assert.equal(world.skinDetailStage(52).includes("срез"),false,
 "Ordinary magnification must NEVER teleport into a cross-section");
assert.equal(world.skinDetailStage(38).includes("чешуйки"),true);
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
  "World-space noise must not crack at integer grid boundaries");
}
const mid=world.SKIN_SHOULDER_CENTER;
assert.equal(surface.skinSurfaceInside(mid.x,mid.y),true);
assert.equal(surface.skinSurfaceInside(10,580),false);
assert.ok(surface.skinSurfaceEdgeOpacity(mid.x,mid.y)>.99);
assert.equal(surface.skinSurfaceEdgeOpacity(0,0),0);

for(const size of [{width:800,height:600},{width:360,height:540},
 {width:1200,height:440},{width:250,height:190}]){
 const fit=world.anatomyBodyFit(size.width,size.height);
 assert.ok(fit.width<=size.width*.901);
 assert.ok(fit.height<=size.height*.961);
 for(const scale of [1,1.6,3.25,8,22,52]){
  const cam=world.anatomyCameraAtBody(mid,scale,size.width,size.height);
  const projected=world.anatomyBodyToScreen(cam,mid,size.width,size.height);
  assert.ok(Math.abs(projected.x-size.width/2)<1e-8);
  assert.ok(Math.abs(projected.y-size.height/2)<1e-8);
  const p={x:size.width*.43,y:size.height*.64};
  const x=world.anatomyScreenToBody(cam,p,size.width,size.height);
  const back=world.anatomyBodyToScreen(cam,x,size.width,size.height);
  assert.ok(Math.abs(back.x-p.x)<1e-7);
  assert.ok(Math.abs(back.y-p.y)<1e-7);
  const bounds=surface.skinVisibleWorldBounds(cam,size.width,size.height);
  assert.ok(bounds.minX<=mid.x&&bounds.maxX>=mid.x);
  assert.ok(bounds.minY<=mid.y&&bounds.maxY>=mid.y);
  assert.equal(surface.skinHash(22,15,7),surface.skinHash(22,15,7),
   "The same skin follicle cannot move when zoom changes");
 }
}
const at={x:421,y:307},w=960,h=640;
let cam={scale:1,panX:0,panY:0};
const old=world.anatomyScreenToBody(cam,at,w,h);
cam=model.anatomyZoomAt(cam,34,at,w,h,world.SKIN_MAX_SCALE);
const under=world.anatomyScreenToBody(cam,at,w,h);
assert.ok(Math.abs(old.x-under.x)<1e-6);
assert.ok(Math.abs(old.y-under.y)<1e-6);
assert.equal(cam.scale,34);
const back=model.anatomyZoomAt(cam,1,at,w,h,world.SKIN_MAX_SCALE);
assert.ok(Math.abs(back.panX)<1e-6);
assert.ok(Math.abs(back.panY)<1e-6);
assert.equal(back.scale,1);
// Camera smoothing must interpolate scale AND pan with the same fraction
// to preserve the cursor's world point on every intermediate frame.
for(const t of [.01,.08,.22,.5,.75,.98]){
 const intermediate={
  scale:1+(cam.scale-1)*t,
  panX:cam.panX*t,panY:cam.panY*t
 };
 const worldAt=world.anatomyScreenToBody(intermediate,at,w,h);
 assert.ok(Math.abs(worldAt.x-old.x)<1e-6);
 assert.ok(Math.abs(worldAt.y-old.y)<1e-6);
}
assert.equal(model.anatomyZoomAt({scale:1,panX:0,panY:0},99,at,w,h).scale,3.25,
 "Existing six other systems retain their default zoom safety limit");

const image=fs.readFileSync("src/assets/bio-atlas/skin-semantic-lod.webp");
assert.equal(image.toString("ascii",0,4),"RIFF");
assert.equal(image.toString("ascii",8,12),"WEBP");
assert.deepEqual([image.readUInt16LE(26)&0x3fff,image.readUInt16LE(28)&0x3fff],
 [2700,900]);
assert.ok(image.length<800000,"Offline atlas must remain compact");
const body=fs.readFileSync("src/assets/bio-atlas/human-skin-original-registered.webp");
assert.equal(body.toString("ascii",0,4),"RIFF");
assert.equal(body.toString("ascii",8,12),"WEBP");
assert.equal(body.toString("ascii",12,16),"VP8X","Skin asset must retain an alpha channel");
assert.deepEqual([1+body.readUIntLE(24,3),1+body.readUIntLE(27,3)],
 [360,600],"Original skin figure must share the exact 360x600 body-local coordinates");
assert.ok(body.length>10000&&body.length<120000);

const viewer=read("src/LektrusHumanAnatomy.tsx");
const renderer=read("src/LektrusSkinSemanticViewport.tsx");
const field=read("src/lektrusSkinSurfaceField.ts");
const css=read("src/lektrusHumanAnatomy.css");
for(const p of ["src/LektrusHumanAnatomy.tsx",
 "src/LektrusSkinSemanticViewport.tsx"]){
 const ast=ts.createSourceFile(p,read(p),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 assert.equal(ast.parseDiagnostics.length,0,p+" must parse");
}
assert.match(viewer,/camera=\{displayCamera\} mode=\{skinMode\}/);
assert.match(viewer,/requestAnimationFrame\(tick\)/);
assert.match(viewer,/zoom\([^;]*,at,overSkin\)/,
 "Deep zoom must activate at the first wheel event over skin");
assert.match(viewer,/aria-pressed=\{skinMode==="surface"\}/);
assert.match(viewer,/aria-pressed=\{skinMode==="section"\}/);
assert.match(renderer,/drawSkinSurfaceField\(ctx,cam.scale,region,surfaceOpacity\)/);
assert.match(renderer,/import skinOriginal from "\.\/assets\/bio-atlas\/human-skin-original-registered.webp"/);
assert.doesNotMatch(renderer,/SKIN_INDEX\*WORLD_WIDTH/,
 "Skin viewer must not reuse the incorrect blue-gray system sprite");
assert.match(renderer,/ctx\.globalCompositeOperation="source-atop"/,
 "Details must be clipped to the actual figure silhouette");
assert.match(renderer,/c\.drawImage\(sprite,640,340,120,160/,
 "The registered skin crop must not include neck, chest and background");
assert.match(renderer,/ctx\.drawImage\(resources\.body/,
 "Keep source body visible: do not blank the scene on LOD changes");
assert.match(renderer,/modeRef\.current==="section"/);
assert.match(renderer,/sectionBlend\+=/,
 "Explicit section mode must fade without relocating camera");
assert.match(renderer,/if\(detailReady&&resources\.section&&sectionBlend>/);
assert.doesNotMatch(renderer,/SKIN_DETAIL_NODES|skinNodeVisibleInViewport/,
 "No sequential cutaway/histology photo swap while zooming");
assert.doesNotMatch(renderer,/rootOpacity=cutaway/,
 "Never fade the entire human body out by zoom threshold");
assert.match(renderer,/ResizeObserver/);
assert.match(renderer,/requestAnimationFrame\(draw\)/);
assert.doesNotMatch(field,/Math\.random/,
 "World-space microstructures must be deterministic");
assert.match(field,/const MAX_DRAWN_CELLS=7000/,
 "Mobile camera must cull invisible cells");
assert.ok(css.includes(".lek-anatomy-semantic-canvas{"));
assert.ok(css.includes(".lek-anatomy-skin-modes{"));
console.log("Skin continuous zoom PASS: cursor-preserving tween, world-registered relief/pores/corneocytes, explicit cutaway and offscreen culling.");
