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
assert.equal(world.SKIN_MAX_SCALE,360);
assert.ok(world.skinAvailableAt(world.SKIN_SHOULDER_CENTER));
assert.equal(world.skinAvailableAt({x:50,y:470}),false);
assert.equal(world.skinAvailableAt({x:NaN,y:163}),false);
assert.equal(world.skinDetailStage(52).includes("срез"),false,
 "Ordinary magnification must NEVER teleport into a cross-section");
assert.equal(world.skinDetailStage(10).includes("чешуйки"),false,
 "At 10x even small epidermal cells must not be exaggerated");
assert.equal(world.skinDetailStage(360).includes("разрез"),true);
assert.deepEqual(Object.keys(surface.SKIN_SURFACE_LEVELS),
 ["regional","relief","pores","corneocytes"]);

for(const level of Object.keys(surface.SKIN_SURFACE_LEVELS)){
 let prior=surface.skinSurfaceAlpha(1,level);
 assert.equal(prior,0);
 for(let scale=1.01;scale<360;scale+=.02){
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
assert.equal(surface.skinSurfaceInside(10,580),true,
 "Entire 360x600 body plane is navigable, not a shoulder-only ellipse");
assert.equal(surface.skinSurfaceInside(-1,550),false);
assert.equal(surface.skinSurfaceInside(120,601),false);
assert.equal(surface.MM_PER_WORLD_UNIT,1700/600);
assert.ok(surface.SKIN_PORE_STEP_WORLD<1);
assert.ok(surface.SKIN_CORNEOCYTE_STEP_WORLD<surface.SKIN_PORE_STEP_WORLD);
const tenXPixelDiameter=(.016+.020)*2*
 world.anatomyBodyFit(850,530).pixelPerWorld*10;
assert.ok(tenXPixelDiameter<1,
 "At 1029% pores should be subpixel, not huge circles or craters");
assert.equal(surface.skinSurfaceAlpha(10,"pores"),0);
assert.equal(surface.skinSurfaceAlpha(10,"corneocytes"),0);
assert.equal(surface.skinSurfaceAlpha(10,"relief")>0,true);
assert.ok(surface.skinSurfaceAlpha(25,"pores")>0);
assert.equal(surface.skinSurfaceAlpha(150,"corneocytes"),0,
 "Cell boundaries should not appear early at medium zoom");
assert.ok(surface.skinSurfaceAlpha(250,"corneocytes")>0);

for(const size of [{width:800,height:600},{width:360,height:540},
 {width:1200,height:440},{width:250,height:190}]){
 const fit=world.anatomyBodyFit(size.width,size.height);
 assert.ok(fit.width<=size.width*.901);
 assert.ok(fit.height<=size.height*.961);
 for(const scale of [1,1.6,3.25,8,22,52,180,360]){
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
  assert.ok(bounds.minX>=0&&bounds.maxX<=360);
  assert.ok(bounds.minY>=0&&bounds.maxY<=600);
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
const highRes=fs.readFileSync("src/assets/bio-atlas/human-skin-highres-registered.webp");
assert.equal(highRes.toString("ascii",0,4),"RIFF");
assert.equal(highRes.toString("ascii",8,12),"WEBP");
assert.equal(highRes.toString("ascii",12,16),"VP8X");
assert.ok((highRes[20]&0x10)!==0,
 "The high-resolution source must keep a transparent background");
assert.deepEqual([1+highRes.readUIntLE(24,3),1+highRes.readUIntLE(27,3)],
 [1080,1800],"High-res figure should be 3x the original 360x600 source");
assert.ok(highRes.length>50000&&highRes.length<350000,
 "High-resolution WebP should fit the offline/mobile texture bundle");
assert.deepEqual(world.SKIN_BODY_RASTER_SIZE,{width:1080,height:1800});
assert.equal(world.SKIN_BODY_RASTER_FACTOR,3);
for(const point of [
 {x:180,y:25},{x:254,y:182},{x:57,y:331},{x:303,y:331},
 {x:180,y:330},{x:220,y:549}
]){
 const native=world.skinWorldToRaster(point);
 assert.equal(native.x,point.x*3);
 assert.equal(native.y,point.y*3);
 assert.deepEqual(world.skinRasterToWorld(native),point,
  "High-res image coordinates must agree with existing camera anchors");
}

const viewer=read("src/LektrusHumanAnatomy.tsx");
const renderer=read("src/LektrusSkinSemanticViewport.tsx");
const field=read("src/lektrusSkinSurfaceField.ts");
const css=read("src/lektrusHumanAnatomy.css");
for(const p of ["src/LektrusHumanAnatomy.tsx",
 "src/LektrusSkinSemanticViewport.tsx"]){
 const ast=ts.createSourceFile(p,read(p),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 assert.equal(ast.parseDiagnostics.length,0,p+" must parse");
}
assert.match(viewer,/camera=\{displayCamera\}/);
assert.match(viewer,/requestAnimationFrame\(tick\)/);
assert.match(viewer,/zoom\(Math\.exp\(-clip\(e\.deltaY,-220,220\)\*\.0018\),at\)/,
 "Wheel zoom must work at any part of the body without activating a shoulder");
assert.doesNotMatch(viewer,/skinRouteActive|setSkinRouteActive|overSkin/,
 "Deep zoom must not depend on an old shoulder activation state");
assert.match(viewer,/Левый бок/);
assert.match(viewer,/Правый бок/);
assert.match(renderer,/createSkinEdgeRaster\(alpha,RASTER_WIDTH,RASTER_HEIGHT\)/);
assert.match(renderer,/import skinHighRes from "\.\/assets\/bio-atlas\/human-skin-highres-registered.webp"/);
assert.match(renderer,/import skinFallback from "\.\/assets\/bio-atlas\/human-skin-original-registered.webp"/);
assert.match(renderer,/body\.src=skinHighRes/);
assert.match(renderer,/ctx\.imageSmoothingQuality="high"/);
assert.match(renderer,/ctx\.drawImage\(body,0,0,WORLD_WIDTH,WORLD_HEIGHT\)/,
 "Native 3x raster must use exactly the old body-world rectangle");
assert.doesNotMatch(renderer,/cam\.scale\s*\?/,
 "Image registration cannot change with camera scale");
assert.doesNotMatch(renderer,/SKIN_INDEX\*WORLD_WIDTH/,
 "Skin viewer must not reuse the incorrect blue-gray system sprite");
assert.match(renderer,/ctx\.globalCompositeOperation="source-atop"/,
 "Details must be clipped to the actual figure silhouette");
assert.doesNotMatch(renderer,/cropFeathered|resources\.shoulder/,
 "No magnified shoulder rectangle is rendered at intermediate zoom");
assert.doesNotMatch(renderer,/ctx\.ellipse\(EDGE\.x\+EDGE\.width\/2/,
 "No huge oval or circular skin inset may cover the torso");
assert.match(renderer,/ctx\.fillRect\(0,0,WORLD_WIDTH,WORLD_HEIGHT\)/,
 "Smooth material must cover the full body coordinate system");
assert.match(renderer,/drawSkinEdgeDetails\(ctx,landmarks,cam.scale,visible\)/);
assert.match(renderer,/ctx\.drawImage\(body,0,0,WORLD_WIDTH,WORLD_HEIGHT\)/);
assert.match(renderer,/ctx\.drawImage\(edgeAtlas,0,0,WORLD_WIDTH,WORLD_HEIGHT\)/);
assert.doesNotMatch(renderer,/modeRef|sectionBlend|drawSkinMesoTiles|drawSkinMicrotiles|drawSkinSurfaceField/);
assert.doesNotMatch(renderer,/SKIN_DETAIL_NODES|skinNodeVisibleInViewport/,
 "No sequential cutaway/histology photo swap while zooming");
assert.doesNotMatch(renderer,/rootOpacity=cutaway/,
 "Never fade the entire human body out by zoom threshold");
assert.match(renderer,/ResizeObserver/);
assert.match(renderer,/requestAnimationFrame\(draw\)/);
assert.doesNotMatch(field,/Math\.random/,
 "World-space microstructures must be deterministic");
assert.match(field,/export const MAX_DRAWN_CELLS=8500/,
 "Mobile camera must cull invisible cells");
assert.ok(css.includes(".lek-anatomy-semantic-canvas{"));
assert.ok(css.includes(".lek-anatomy-skin-modes{"));
// Region-to-viewport transforms remain correct from head to ankle.
for(const point of [
 {x:180,y:64},{x:180,y:263},{x:253,y:193},
 {x:128,y:268},{x:207,y:460},{x:220,y:540}
]){
 for(const scale of [1,2.4,10.29,42,180,360]){
  const camera=world.anatomyCameraAtBody(point,scale,850,530);
  const back=world.anatomyScreenToBody(
   camera,{x:425,y:265},850,530);
  assert.ok(Math.abs(back.x-point.x)<1e-6);
  assert.ok(Math.abs(back.y-point.y)<1e-6);
 }
}
for(const point of [{x:180,y:55},{x:180,y:310},{x:230,y:400}]){
 const camera=world.anatomyCameraAtBody(point,10.29,850,530);
 const bounds=surface.skinVisibleWorldBounds(camera,850,530);
 assert.ok(bounds.minX<=point.x&&bounds.maxX>=point.x);
 assert.ok(bounds.minY<=point.y&&bounds.maxY>=point.y);
}
const overviewBounds=surface.skinVisibleWorldBounds(
 {scale:1,panX:0,panY:0},850,530);
assert.ok(overviewBounds.maxX-overviewBounds.minX>300);
assert.ok(overviewBounds.maxY-overviewBounds.minY>500,
 "Whole body is in the surface model, not one shoulder circle");
console.log("Whole-body skin semantic zoom PASS: calibrated tiny pores at 10x, continuous world coordinates, full-body texture, culling and explicit cutaway.");
