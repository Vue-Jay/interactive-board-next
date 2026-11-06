import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const evidenceCode=ts.transpileModule(fs.readFileSync(
 "src/lektrusSkinEvidenceModel.ts","utf8"),{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText;
const evidence={};
new Function("exports",evidenceCode)(evidence);
assert.equal(evidence.SKIN_ILLUSTRATIVE_LAYERS.epidermisEnd,.065);
assert.equal(evidence.SKIN_ILLUSTRATIVE_LAYERS.dermisEnd,.67);
assert.equal(evidence.SKIN_SECTION_SCALE_IS_PHYSICAL,false);
assert.equal(evidence.skinIllustrativeLayerAt(.03),"epidermis");
assert.equal(evidence.skinIllustrativeLayerAt(.4),"dermis");
assert.equal(evidence.skinIllustrativeLayerAt(.8),"hypodermis");
assert.equal(evidence.skinEvidenceRegionAt({x:254,y:182}),"thin-skin-reference");
assert.equal(evidence.skinEvidenceRegionAt({x:55,y:332}),"unverified-region");
assert.equal(evidence.skinEvidenceRegionAt({x:225,y:560}),"unverified-region");
const code=ts.transpileModule(fs.readFileSync(
 "src/lektrusSkinEdgeSections.ts","utf8"),{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText;
const model={};
new Function("exports","require",code)(model,id=>{
 assert.equal(id,"./lektrusSkinEvidenceModel");return evidence;
});
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
assert.doesNotMatch(renderer,/createSkinEdgeRaster\(alpha,RASTER_WIDTH,RASTER_HEIGHT\)/,
 "Do not rasterize thousands of unnecessary faux micro-anatomy landmarks");
assert.doesNotMatch(renderer,/drawSkinEdgeDetails\(ctx,landmarks,cam.scale,visible,/,
 "Repeated pink vascular loops were not valid human histology");
assert.match(renderer,/drawSkinSectionBands\(ctx,thinContours,visible,cutawayAlpha\)/);
assert.doesNotMatch(renderer,/drawSkinMesoTiles|drawSkinSurfaceField|drawSkinMicrotiles/);
assert.doesNotMatch(renderer,/skin-semantic-lod\.webp/);
assert.doesNotMatch(renderer,/sectionBlend|modeRef/);
assert.match(ui,/aria-label="Слои кожи"/);
assert.match(renderer,/ctx\.drawImage\(neutralBody\?\?body,0,0,WORLD_WIDTH,WORLD_HEIGHT\)/);
assert.doesNotMatch(renderer,/globalAlpha=1-cutawayAlpha/);
assert.match(ui,/Плечо · тонкая кожа/);
assert.match(ui,/Кисть · разрез ладони/);
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
const tissue=record(10,visible),cells=record(360,visible);
assert.equal(tissue.count,1);assert.equal(cells.count,1);
assert.ok(cells.calls.length>tissue.calls.length+100,"Deep zoom reveals cells");
assert.deepEqual(cells.calls,record(360,visible).calls,"Pan/zoom must not randomize tissue");
assert.ok(cells.calls.some(c=>c[0]==="clip"),"Stay inside lateral section");
assert.doesNotMatch(renderer,/drawSkinTissueTexture\(/,
 "Unverified full-contour raster histology must not return");
assert.doesNotMatch(renderer,/edgeAtlas|detailCanvas|globalCompositeOperation="destination-in"/);
console.log("Skin detail LOD PASS: continuous reveals, cells, culling, deterministic geometry, exact silhouette mask.");

// Detailed cutaway geometry must be repeatable in world coordinates, rather
// than moving spots whenever the teacher pans or changes magnification.
const samples=[
 {x:82,y:205,inward:1},{x:278,y:205,inward:-1},
 {x:82,y:213,inward:1},{x:208,y:445,inward:-1}
];
for(const sample of samples){
 const value=model.skinEdgeDetailVariation(sample,23);
 assert.ok(value>=0&&value<1);
 assert.equal(model.skinEdgeDetailVariation(sample,23),value);
}
assert.ok(new Set(samples.map(p=>model.skinEdgeDetailVariation(p,23))).size>2,
 "Landmarks need varied natural forms, not identical stamps");
assert.equal(model.skinEdgeHasFollicle({x:150,y:80,inward:1}),false,
 "No schematic hair on the face");
assert.equal(model.skinEdgeHasFollicle({x:55,y:332,inward:1}),false,
 "No hair on the palm");
assert.equal(model.skinEdgeHasFollicle({x:225,y:550,inward:-1}),false,
 "Unmapped foot must not inherit a fictitious follicle");
assert.equal(model.skinEdgeHasFollicle({x:208,y:445,inward:-1}),false,
 "Unmapped leg must not get an invented follicle station");
const deltoidSamples=Array.from({length:20},(_,i)=>
 ({x:250+i*.18,y:174+i*.48,inward:1}));
assert.ok(deltoidSamples.some(p=>model.skinEdgeHasFollicle(p)) &&
 deltoidSamples.some(p=>!model.skinEdgeHasFollicle(p)),
 "Thin hairy skin should have varying follicle spacing");
const lowCell=record(6,visible),highCell=record(360,visible);
assert.ok(highCell.calls.filter(c=>c[0]==="bezierCurveTo").length>
 lowCell.calls.filter(c=>c[0]==="bezierCurveTo").length,
 "Deep zoom reveals finer connective fibres and basement membrane");
assert.ok(highCell.calls.filter(c=>c[0]==="moveTo").length>
 lowCell.calls.filter(c=>c[0]==="moveTo").length+50,
 "Fine epidermal stratum boundaries appear only at deep zoom");
assert.equal(model.skinEdgeDetailLevels(24).cells,0,
 "A 24x body view must not contain giant epidermal cells");
assert.deepEqual(record(180,visible).calls,highCell.calls,
 "Every detail remains anchored while zooming/panning");
console.log("High-detail lateral skin PASS: varied follicles, adipocytes, epidermal strata and stable world detail.");

// A vector cutaway must be sharp at 2021% and beyond. Verify the actual
// raster alpha generates six independent, smoothly interpolated flank paths.
const vectorCode=ts.transpileModule(fs.readFileSync(
 "src/lektrusSkinVectorSections.ts","utf8"),{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText;
const vector={};
new Function("exports","require",vectorCode)(vector,id=>{
 if(id==="./lektrusSkinEdgeSections")return model;
 assert.equal(id,"./lektrusSkinEvidenceModel");
 return evidence;
});
assert.ok(vector.SKIN_SECTION_WORLD_DEPTH>=7,
 "A 2.9-world-unit stripe is too thin to inspect at medium zoom");
assert.equal(vector.SKIN_SECTION_NEUTRAL_FRACTION,.20);
const stripes=vector.skinSectionContours(alpha,width,height,factor);
assert.ok(stripes.length>=6,"Every silhouette and each lateral edge needs its own path");
assert.ok(stripes.every(c=>c.points.length>=8));
assert.ok(stripes.every(c=>c.points.every(p=>Number.isFinite(p.x)&&
 Number.isFinite(p.y)&&Number.isFinite(p.depth)&&p.depth>=0)));
const crossAt=8; // world y=8 => synthetic row 24
const flank=stripes.filter(c=>c.minY<=crossAt&&c.maxY>=crossAt)
 .map(c=>({c,p:c.points.find(p=>Math.abs(p.y-crossAt)<.01)}))
 .filter(t=>t.p);
assert.equal(flank.length,6);
const sorted=flank.slice().sort((a,b)=>a.p.x-b.p.x);
assert.ok(sorted[0].p.x+sorted[0].p.depth<
 sorted[1].p.x-sorted[1].p.depth,
 "The left arm center must remain unpainted");
assert.ok(sorted[2].p.x+sorted[2].p.depth<
 sorted[3].p.x-sorted[3].p.depth,
 "The torso center must remain unpainted");
assert.ok(sorted[1].p.x<sorted[2].p.x,
 "The gap between arm and torso must not be filled");
const calls=[];
const fakeCtx=new Proxy({},{
 get:(_,name)=>(...args)=>{calls.push([name,...args]);},
 set:()=>true
});
const crop={minX:0,maxX:50,minY:5,maxY:14};
assert.ok(vector.drawSkinSectionBands(fakeCtx,stripes,crop)>=6);
assert.ok(calls.filter(c=>c[0]==="quadraticCurveTo").length>50,
 "Cutaway edges must use smooth vector curves, never enlarged image pixels");
assert.ok(calls.filter(c=>c[0]==="fill").length>=18,
 "Each edge contains epidermis, dermis and subcutis");
calls.length=0;
assert.ok(vector.clipSkinSection(fakeCtx,stripes,crop)>=6);
assert.ok(calls.some(c=>c[0]==="clip"));
assert.equal(vector.drawSkinSectionBands(fakeCtx,stripes,
 {minX:300,maxX:340,minY:50,maxY:60}),0);
assert.throws(()=>vector.skinSectionContours(alpha,width,1,factor),
 /Invalid skin alpha or dimensions/);
assert.match(renderer,/skinSectionContours\(alpha,RASTER_WIDTH,RASTER_HEIGHT\)/);
assert.doesNotMatch(renderer,/SKIN_SECTION_WORLD_DEPTH\/SKIN_EDGE_WORLD_WIDTH/);
console.log("Vector skin cross-section PASS: smooth paths, 3 independent regions, neutral centers, no raster zoom aliasing.");

// Physically calibrated cells are a separate continuous field. The widened
// teaching cutaway never scales their x radius or repeats 1-3 mm cells at 24x.
const microCode=ts.transpileModule(fs.readFileSync(
 "src/lektrusSkinHistologyDetail.ts","utf8"),{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText;
const micro={};
new Function("exports","require",microCode)(micro,id=>{
 assert.equal(id,"./lektrusSkinEvidenceModel");return evidence;
});
assert.equal(micro.SKIN_ADIPOCYTE_GRID_WORLD,.033);
assert.equal(micro.SKIN_KERATINOCYTE_GRID_WORLD,.0085);
assert.ok(micro.SKIN_MICRO_MAX_MARKS<=8500);
const adipocyte=micro.skinMicroCellDiameterMicrons("adipocyte");
const keratinocyte=micro.skinMicroCellDiameterMicrons("keratinocyte");
assert.ok(adipocyte.min>=50&&adipocyte.max<=150,
 "Adipocytes must be measured in tens of µm, not millimetres");
assert.ok(keratinocyte.min>=10&&keratinocyte.max<=35,
 "Keratinocytes must be much smaller than adipocytes");
assert.ok(keratinocyte.max<adipocyte.min);
assert.equal(micro.skinMicroOpacity(24).adipocytes,0);
assert.equal(micro.skinMicroOpacity(24).keratinocytes,0);
assert.ok(micro.skinMicroOpacity(24).collagen>0,
 "At 24x there should be collagen detail instead of oversized cells");
for(const name of ["collagen","adipocytes","keratinocytes"]){
 let before=0;
 for(let scale=1;scale<=360;scale+=.25){
  const now=micro.skinMicroOpacity(scale)[name];
  assert.ok(now>=before&&now<=1);
  assert.ok(now-before<.04,"Cell detail must fade in continuously");
  before=now;
 }
}
const microBounds={minX:2,maxX:14,minY:7,maxY:9};
function microDraw(scale,bounds=microBounds){
 const logged=[];
 const ctx=new Proxy({},{
  get:(_,name)=>(...args)=>{
   assert.ok(args.filter(n=>typeof n==="number").every(Number.isFinite));
   logged.push([name,...args]);
  },set:()=>true
 });
 return {count:micro.drawSkinMicroscopicDetails(ctx,stripes,scale,bounds),
  calls:logged};
}
const meso=microDraw(24),deep=microDraw(360),repeat=microDraw(360);
assert.equal(meso.count.adipocytes,0);
assert.equal(meso.count.keratinocytes,0);
assert.ok(meso.count.collagen>0);
assert.ok(deep.count.adipocytes>0&&deep.count.keratinocytes>0,
 "Both fat and epidermal cells must be present at deep magnification");
for(const count of Object.values(deep.count))
 assert.ok(count<=micro.SKIN_MICRO_MAX_MARKS);
assert.deepEqual(deep,repeat,
 "Cell coordinates and structure must not change after panning or zooming");
const deepEllipses=deep.calls.filter(c=>c[0]==="ellipse");
assert.ok(deepEllipses.length>50);
assert.ok(deepEllipses.every(c=>c[3]<=.02&&c[4]<=.02),
 "Individual cell radii should stay under 0.02 body-world units");
const outside=microDraw(360,{minX:200,maxX:220,minY:200,maxY:210});
assert.deepEqual(outside.count,
 {collagen:0,adipocytes:0,keratinocytes:0});
assert.doesNotMatch(renderer,/drawSkinMicroscopicDetails\(ctx,contours,cam.scale,visible\)/,
 "Never draw unverified cellular stamps inside the shared body zoom");
assert.match(renderer,/drawEpidermisAtlas\(ctx,thinContours/,
 "Microanatomy is restricted to a documented shoulder sample");
console.log("Calibrated microscopy PASS: biologically scaled cells, correct zoom LOD, bounded work, deterministic world-space rendering.");


// Deeper microscopy: cellular strata, tiny fibroblasts, papillary dermis,
// elastic fibres, subcutaneous septa and granular-layer keratohyalin.
assert.equal(micro.skinEpidermisStratum(.003),null);
assert.equal(micro.skinEpidermisStratum(.012),"corneum");
assert.equal(micro.skinEpidermisStratum(.018),"granulosum");
assert.equal(micro.skinEpidermisStratum(.035),"spinosum");
assert.equal(micro.skinEpidermisStratum(.060),"basale");
assert.equal(micro.skinEpidermisStratum(.07),null);
assert.equal(micro.skinFineStructureOpacity(24).granules,0);
assert.equal(micro.skinFineStructureOpacity(24).papillae,0);
assert.ok(micro.skinFineStructureOpacity(50).elastic>0,
 "Elastic fibres should appear well before individual epidermal cells");
for(const tier of Object.keys(micro.skinFineStructureOpacity(360))){
 let last=0;
 for(let scale=1;scale<=360;scale+=.25){
  const v=micro.skinFineStructureOpacity(scale)[tier];
  assert.ok(v>=last&&v<=1,"Monotone microscopic reveal: "+tier);
  assert.ok(v-last<.04,"No sharp detail popping: "+tier);
  last=v;
 }
 assert.equal(last,1);
}
function fineDraw(scale,bounds=microBounds){
 const calls=[];
 const ctx=new Proxy({},{
  get:(_,name)=>(...args)=>{
   assert.ok(args.filter(n=>typeof n==="number").every(Number.isFinite));
   calls.push([name,...args]);
  },set:()=>true
 });
 return {count:micro.drawSkinFineStructures(ctx,stripes,scale,bounds),calls};
}
const fineMid=fineDraw(50),fineMax=fineDraw(360);
assert.ok(fineMid.count.elastic>0);
assert.equal(fineMid.count.granules,0,
 "Keratohyalin granules cannot appear at organ-level zoom");
for(const [type,count] of Object.entries(fineMax.count)){
 assert.ok(count>0,"Missing fine histology tier: "+type);
 assert.ok(count<=micro.SKIN_FINE_MAX_MARKS,
  "Fine histology budget exceeded: "+type);
}
assert.deepEqual(fineDraw(360),fineMax,
 "All six microscopic tiers must be deterministic in world coordinates");
const fineOutside=fineDraw(360,
 {minX:200,maxX:220,minY:200,maxY:210});
assert.ok(Object.values(fineOutside.count).every(v=>v===0),
 "Offscreen microstructures must be culled");
assert.ok(fineMax.calls.some(c=>c[0]==="bezierCurveTo"),
 "Dermal elastin fibres need curved vector geometry");
assert.ok(fineMax.calls.some(c=>c[0]==="ellipse"),
 "Fine spindle-shaped fibroblasts and nuclei must be drawn");
assert.ok(fineMax.calls.filter(c=>c[0]==="arc").every(c=>c[3]<=.001),
 "Tiny keratohyalin granules must never be larger than cells");
assert.doesNotMatch(renderer,/drawSkinFineStructures\(ctx,contours,cam.scale,visible\)/,
 "Do not draw invented granular/fibroblast patterns");
assert.match(renderer,/drawEpidermisAtlas\(ctx,thinContours/,
 "Microanatomy is restricted to a documented shoulder sample");
console.log("Skin fine histology PASS: six sub-mm tiers, epidermal strata, world anchoring and mobile culling.");


// The detailed side cutaway should resemble H&E tissue rather than three
// flat bands with repeated identical anatomy icons. This is an original
// procedural world-space pigment field, with no fixed zoom image.
const shaderCode=ts.transpileModule(fs.readFileSync(
 "src/lektrusSkinTissueTexture.ts","utf8"),{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText;
const shader={};
new Function("exports","require",shaderCode)(shader,id=>{
 assert.equal(id,"./lektrusSkinEvidenceModel");return evidence;
});
assert.ok(shader.SKIN_TISSUE_MAX_PIXELS<=44000,
 "Procedural tissue must remain affordable on tablets");
assert.ok(shader.SKIN_TISSUE_MAX_WIDTH<=900);
const tissueAt=(fraction,scale=200,x=11.2,y=8.3)=>
 shader.skinTissueSample(x,y,fraction,scale);
const folds=Array.from({length:20},(_,i)=>shader.skinTissueReteBoundary(i*.057));
assert.ok(Math.min(...folds)>.058&&Math.max(...folds)<.072);
assert.ok(Math.max(...folds)-Math.min(...folds)>.003,
 "The basal epidermal boundary must have real world-anchored rete ridges");
assert.equal(shader.skinTissueReteBoundary(1.25),
 shader.skinTissueReteBoundary(1.25));
assert.equal(tissueAt(.03).region,"epidermis");
assert.equal(tissueAt(.062).region,"epidermis");
assert.equal(tissueAt(.18).region,"dermis");
assert.equal(tissueAt(.49).region,"dermis");
assert.equal(tissueAt(.88).region,"subcutis");
const corneum=tissueAt(.01),dermis=tissueAt(.3),fat=tissueAt(.75);
assert.ok(corneum.r!==dermis.r&&dermis.r!==fat.r);
assert.ok(fat.r>=fat.g&&fat.g>=fat.b);
assert.ok(dermis.r>dermis.g);
for(const frac of [.01,.036,.08,.125,.22,.4,.72,.95]){
 for(const scale of [1,20,125,360]){
  const p=tissueAt(frac,scale);
  assert.ok([p.r,p.g,p.b].every(x=>Number.isInteger(x)&&x>=0&&x<=255));
  assert.deepEqual(p,tissueAt(frac,scale),
   "A moving camera may not reroll the same tissue pixel");
 }
}
const dermalVariations=new Set(Array.from({length:20},(_,i)=>
 JSON.stringify(tissueAt(.36,120,15+i*.17,8.3+i*.11))));
assert.ok(dermalVariations.size>=5,
 "Subtle illustrative dermal tones should vary without pretending to be nuclei or vessels");
const microlow=tissueAt(.77,20,2.1,8.1);
const microhigh=tissueAt(.77,260,2.1,8.1);
assert.deepEqual(microlow,microhigh,
 "Illustrative tone must not invent new fat cells as zoom increases");
assert.equal(shader.skinTissueNoise(1.23,2.34,5),
 shader.skinTissueNoise(1.23,2.34,5));
// Minimal browser-canvas mock verifies the actual viewport rasterization,
// transparent limb gaps, memory cap, caching and stable screen registration.
const oldDocument=globalThis.document;
let putCount=0,lastImage=null,textureDraws=0;
const context={
 createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4),width:w,height:h}),
 putImageData:(data)=>{putCount++;lastImage=data}
};
let cameraShift=0;
const fakeSurface={width:150,height:75};
const fakeShaderCtx={
 canvas:fakeSurface,
 getTransform:()=>({a:3,d:3,e:cameraShift,f:0}),
 save:()=>{},restore:()=>{},
 setTransform:()=>{},drawImage:()=>{textureDraws++}
};
globalThis.document={createElement:(tag)=>{
 assert.equal(tag,"canvas");
 return {width:0,height:0,getContext:()=>context};
}};
try{
 const view={minX:0,maxX:50,minY:0,maxY:25};
 const first=shader.drawSkinTissueTexture(fakeShaderCtx,stripes,210,view);
 assert.ok(first.sampledPixels>0);
 assert.ok(first.sampledPixels<=shader.SKIN_TISSUE_MAX_PIXELS);
 assert.ok(putCount===1&&textureDraws===1);
 const px=(x,y)=>lastImage.data[(y*first.width+x)*4+3];
 assert.equal(px(0,24),0,"Background outside the silhouette stays clear");
 assert.equal(px(40,24),0,"Limb gap stays transparent");
 assert.equal(px(72,24),0,"Center of torso stays neutral");
 assert.ok(px(9,24)>0&&px(48,24)>0,
  "Actual side cross-sections receive the organic tissue paint");
 shader.drawSkinTissueTexture(fakeShaderCtx,stripes,210,view);
 assert.equal(putCount,1,"Identical camera must reuse the texture cache");
 cameraShift=4;
 shader.drawSkinTissueTexture(fakeShaderCtx,stripes,210,view);
 assert.equal(putCount,1,
  "Small pans must reproject cached world-space tissue without regenerating");
 cameraShift=35;
 shader.drawSkinTissueTexture(fakeShaderCtx,stripes,210,view);
 assert.equal(putCount,2,
  "A larger camera shift must refresh the same world-anchored texture");
}finally{globalThis.document=oldDocument;}
assert.doesNotMatch(renderer,/drawSkinTissueTexture\\(/,
 "High zoom must not bring back unverified expensive faux dermal noise");
assert.match(renderer,/drawEpidermisAtlas\(/);
assert.match(renderer,/setTimeout\(\(\)=>\{/);
assert.match(renderer,/},180\)/);
assert.doesNotMatch(renderer,/drawSkinEdgeDetails\(ctx/);
assert.doesNotMatch(renderer,/drawSkinMicroscopicDetails\(ctx/);
assert.doesNotMatch(renderer,/drawSkinFineStructures\(ctx/);
assert.doesNotMatch(shaderCode,/skinAdiposeField\(x,y\)/,
 "Sampling must not reintroduce the artificial fat-cell honeycomb");
assert.match(renderer,/drawEpidermisAtlas\(ctx,thinContours/,
 "Microanatomy is restricted to a documented shoulder sample");
console.log("Organic skin tissue PASS: layered pigment, fine collagen, fat lacunae, transparent gaps, pixel cap and world-anchored camera.");

assert.match(ui,/Ширина разреза и слоёв специально увеличена/);
console.log("Evidence-led skin proportions PASS: thinner epidermis, localized appendages, uncalibrated virtual cutaway.");
