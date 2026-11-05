import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const read=p=>fs.readFileSync(p,"utf8");
function importTS(file,mocks={}){
 const src=ts.transpileModule(read(file),{fileName:file,
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,
   esModuleInterop:true}}).outputText;
 const exports={};
 new Function("exports","require",src)(exports,id=>{
  assert.ok(id in mocks,"Unexpected import "+id);
  return mocks[id];
 });
 return exports;
}
const world=importTS("src/lektrusAnatomySemanticZoom.ts");
const surface=importTS("src/lektrusSkinSurfaceField.ts",{
 "./lektrusAnatomySemanticZoom":world
});
const meso=importTS("src/lektrusSkinMesoTiles.ts",{
 "./lektrusSkinSurfaceField":surface
});
assert.equal(meso.SKIN_MESO_TILE_WORLD,32);
assert.equal(meso.SKIN_MESO_TILE_PIXELS,224);
assert.equal(meso.SKIN_MESO_CREATIONS_PER_FRAME,3);
assert.ok(meso.SKIN_MESO_CACHE_LIMIT<=48);
assert.ok(meso.SKIN_MESO_CACHE_LIMIT*
 meso.SKIN_MESO_TILE_PIXELS**2*4<10*1024*1024,
 "Texture cache budget should stay below 10MB raw RGBA");
assert.equal(meso.skinMesoOpacity(1),0);
assert.ok(meso.skinMesoOpacity(6.86)>.80,
 "At the screenshot's 686% the skin grain must be clearly visible");
assert.ok(meso.skinMesoOpacity(10)>.99);
assert.equal(meso.skinMesoOpacity(48),0);
for(let scale=3.41,old=meso.skinMesoOpacity(3.4);scale<48;scale+=.02){
 const opacity=meso.skinMesoOpacity(scale);
 assert.ok(opacity>=0&&opacity<=1);
 assert.ok(Math.abs(opacity-old)<.04,"No visible LOD jump between wheel samples");
 old=opacity;
}
for(const [point,region] of [
 [{x:180,y:75},"face"],[{x:180,y:235},"torso"],
 [{x:82,y:245},"arm"],[{x:279,y:235},"arm"],
 [{x:57,y:335},"hand"],[{x:303,y:335},"hand"],
 [{x:136,y:446},"leg"],[{x:335,y:20},"general"]
]){
 const p=meso.skinMesoProfile(point.x,point.y);
 assert.equal(p.region,region);
 assert.ok(p.contrast>0&&p.furrowStep>0);
}
assert.notEqual(meso.skinMesoProfile(82,245).direction,
 meso.skinMesoProfile(57,335).direction,
 "An arm and a hand must not reuse one directional crease pattern");
assert.notEqual(meso.skinMesoTone(82,245),meso.skinMesoTone(94,245),
 "The whole arm must not be painted with one constant color");
assert.equal(meso.skinMesoTone(82,245),meso.skinMesoTone(82,245),
 "Moving/zooming must not randomize anatomical positions");
for(const p of [{x:82,y:245},{x:180,y:235},{x:57,y:335}]){
 const cam=world.anatomyCameraAtBody(p,6.86,850,530);
 const bounds=surface.skinVisibleWorldBounds(cam,850,530);
 const coords=meso.skinMesoTilesInBounds(bounds);
 assert.ok(coords.length>=8&&coords.length<=meso.SKIN_MESO_VISIBLE_TILE_LIMIT,
  "Medium zoom must be served by manageable visible tiles");
 assert.equal(new Set(coords.map(c=>c.key)).size,coords.length);
 assert.ok(bounds.minX<=p.x&&bounds.maxX>=p.x);
 assert.ok(bounds.minY<=p.y&&bounds.maxY>=p.y);
}
assert.deepEqual(meso.skinMesoTilesInBounds(
 {minX:20,maxX:40,minY:50,maxY:70}
),meso.skinMesoTilesInBounds(
 {minX:20,maxX:40,minY:50,maxY:70}
));
assert.notDeepEqual(meso.skinMesoTilesInBounds(
 {minX:20,maxX:40,minY:50,maxY:70}
),meso.skinMesoTilesInBounds(
 {minX:44,maxX:64,minY:50,maxY:70}
));
// Reconstructed skin must be a network of small anatomical furrows,
// NOT red and brown image-data dots or pigment noise.
const creases=meso.skinHandCreaseAnchors();
assert.equal(creases.length,30,"Hands need fixed joint crease landmarks");
assert.ok(creases.every(p=>p.length>0&&Number.isFinite(p.angle)));
for(const [x,y] of [[87,245],[55,335],[181,231]]){
 const ix=Math.floor(x/.72),iy=Math.floor(y/.72);
 const f=meso.skinFurrowAt(ix,iy);
 assert.ok(f.width>.04&&f.width<.10);
 assert.ok(Math.hypot(f.endX-f.x,f.endY-f.y)<.8,
  "Furrows must be short, not large dark strokes crossing limbs");
 assert.deepEqual(f,meso.skinFurrowAt(ix,iy),
  "Furrow geometry must not change on zoom or pan");
}
let created=0,schedules=0,draws=0,strokes=0;
const createContext=()=>({
 setTransform(){},stroke(){strokes++;},
 fill(){throw Error("Meso skin must not paint color patches");},
 beginPath(){},moveTo(){},lineTo(){},quadraticCurveTo(){},
 save(){},restore(){},drawImage(){draws++}
});
const originalDocument=globalThis.document;
try{
 globalThis.document={createElement(tag){
  assert.equal(tag,"canvas");created++;
  const context=createContext();
  return {width:0,height:0,getContext:()=>context};
 }};
 const renderer=createContext();
 const bounds={minX:78,maxX:110,minY:222,maxY:248};
 const coords=meso.skinMesoTilesInBounds(bounds);
 assert.ok(coords.length>=4);
 let drawn=meso.drawSkinMesoTiles(renderer,bounds,6.86,1,()=>schedules++);
 assert.ok(drawn<=meso.SKIN_MESO_CREATIONS_PER_FRAME);
 assert.ok(created<=meso.SKIN_MESO_CREATIONS_PER_FRAME);
 for(let i=0;i<coords.length+2;i++)
  meso.drawSkinMesoTiles(renderer,bounds,6.86,1,()=>schedules++);
 assert.equal(created,coords.length,
  "Each absolute-world tile is built only once");
 assert.ok(strokes>800,
  "Medium detail must DRAW visible fine furrows, not colored dots");
 const old=created;
 drawn=meso.drawSkinMesoTiles(renderer,bounds,6.86);
 assert.equal(drawn,coords.length);
 assert.equal(created,old,"Returning to the same position must reuse cached skin");
 assert.ok(meso.skinMesoCacheSize()<=meso.SKIN_MESO_CACHE_LIMIT);
 assert.ok(schedules>0,"Pending tiles should appear progressively");
 const beforeBroad=created,scheduledBroad=schedules;
 const broad={minX:0,maxX:360,minY:0,maxY:600};
 assert.equal(meso.drawSkinMesoTiles(renderer,broad,5,1,()=>schedules++),0);
 assert.equal(created,beforeBroad,"Do not allocate oversized viewport tile sets");
 assert.equal(schedules,scheduledBroad,
  "A viewport wider than the cache must not schedule infinite redraws");
 const before=draws;
 assert.equal(meso.drawSkinMesoTiles(renderer,bounds,1),0);
 assert.equal(draws,before,"Do not paint medium detail at full-body view");
}finally{
 if(originalDocument===undefined)delete globalThis.document;
 else globalThis.document=originalDocument;
}
const layer=read("src/LektrusSkinSemanticViewport.tsx");
const source=read("src/lektrusSkinMesoTiles.ts");
assert.match(layer,/drawSkinMesoTiles\(ctx,region,cam.scale,surfaceOpacity,requestDraw\)/);
assert.match(layer,/ctx\.globalAlpha=smoothBase\*\(\.025\+\.18\*skinSurfaceAlpha/);
assert.match(layer,/ctx\.globalCompositeOperation="source-atop"/);
assert.match(layer,/drawSkinSurfaceField\(ctx,cam.scale,region,surfaceOpacity\)/);
assert.match(source,/skinMesoTone\(worldX:number,worldY:number\)/);
assert.doesNotMatch(source,/ctx\.putImageData\(|ctx\.createImageData\(/,
 "No random pixel pigment overlay that produces dark blotches");
assert.doesNotMatch(source,/ctx\.ellipse\(|ctx\.fill\(/,
 "Skin relief must use fine strokes rather than dot/spot primitives");
assert.doesNotMatch(source,/Math\.random/);
const ast=ts.createSourceFile("src/LektrusSkinSemanticViewport.tsx",layer,
 ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
assert.equal(ast.parseDiagnostics.length,0);
console.log("Mid-zoom skin PASS: no blotchy pigment, fine anatomically oriented creases, stable world coordinates, bounded tiles and preserved body shading.");
