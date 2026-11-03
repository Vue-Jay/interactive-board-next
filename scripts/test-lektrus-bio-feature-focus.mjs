import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {createRequire} from "node:module";
import ts from "typescript";

/** Load TSX only in this Node regression test. TSX drawings use the existing
 * installed react/jsx-runtime, but are never mounted or sent to the DOM. */
const nativeRequire=createRequire(import.meta.url),cache=new Map();
function load(relative){
 const file=relative.endsWith(".ts")||relative.endsWith(".tsx")
  ?relative:fs.existsSync(relative+".ts")?relative+".ts":relative+".tsx";
 if(cache.has(file))return cache.get(file);
 const source=fs.readFileSync(file,"utf8"),exports={};cache.set(file,exports);
 const transpiled=ts.transpileModule(source,{fileName:file,compilerOptions:{
  module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,
  jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true
 }});
 assert.equal(transpiled.diagnostics?.length??0,0,"Broken TSX "+file);
 new Function("exports","require",transpiled.outputText)(exports,(name)=>
  name.startsWith(".")?load(path.join(path.dirname(file),name)):nativeRequire(name)
 );
 return exports;
}
const bio=load("src/lektrusBioMicroscopeModel.ts");
const zoom=load("src/lektrusBioUnifiedZoomModel.ts");
const focus=load("src/lektrusBioFeatureFocus.ts");
const coreArt=load("src/LektrusBioCoreMicroscopyArt.tsx");
const lineageArt=load("src/LektrusBioLineageMicroscopy.tsx");
const plates=load("src/lektrusBioCellPlates.ts");
const corePlates=load("src/lektrusBioCoreMicroscopyPlates.ts");
const species=Object.keys(bio.BIO_ORGANISMS);
assert.equal(species.length,20);
let checked=0,specific=0,core=0,lineages=0;
for(const organism of species){
 const nodes=bio.bioNodes(organism);
 const cells=nodes.filter(n=>n.level==="cell");
 assert.equal(cells.length,organism==="sunflower"?4:3,
  organism+" must retain its reviewed cell paths");
 for(const cell of cells){
  const features=bio.bioCellFeatures(cell);
  assert.equal(features.length,3,"Exactly 3 feature labels required "+cell.id);
  const spots=features.map(({name})=>focus.bioFeatureSpotFor(organism,cell,nodes,name));
  for(const spot of spots){
   assert.ok(spot,"Cannot navigate a feature on "+cell.id);
   assert.ok(spot.x>=30&&spot.x<=440&&spot.y>=30&&spot.y<=310,
    "Feature marker beyond 480x330 specimen view "+cell.id);
  }
  assert.equal(new Set(spots.map(p=>p.x+":"+p.y)).size,3,
   "Distinct organelles need non-overlapping pins in "+cell.id);
  assert.equal(focus.bioFeatureSpotFor(organism,cell,nodes,"несуществующая структура"),null);
  assert.equal(focus.bioFeatureSpotFor("human",cell,nodes,features[0].name),
   organism==="human"?spots[0]:null,"Cell features cannot leak between species");
  const reviewed=plates.bioCellPlateFor(organism,cell);
  const original=corePlates.bioCoreMicroscopyPlateFor(organism,cell);
  if(reviewed){
   specific++;
   spots.forEach((pos,i)=>assert.deepEqual(pos,reviewed.landmarks[features[i].name]));
  }else if(original){
   core++;
   spots.forEach((pos,i)=>assert.deepEqual(pos,coreArt.bioCoreMicroscopySpot(original.kind,i)));
  }else{
   lineages++;
   const rootSystems=bio.bioChildren(nodes,organism),parts=cell.id.split("/");
   const system=rootSystems.findIndex(item=>item.id===organism+"/"+parts[1]);
   assert.ok(system>=0&&system<3,"Unrecognized lineage branch "+cell.id);
   spots.forEach((pos,i)=>assert.deepEqual(pos,lineageArt.lineageMicroSpots(organism,system)[i]));
  }
  const current=zoom.bioZoomBound({scale:1.3,x:0,y:0});
  const camera=zoom.bioZoomFocusCamera(current,spots[0]);
  assert.ok(camera.scale>=2.35&&camera.scale<=3);
  const marker=zoom.bioZoomScreenPoint(camera,spots[0]);
  assert.ok(marker.x>=0&&marker.x<=480&&marker.y>=0&&marker.y<=330,
   "Focused feature must remain on screen");
  assert.deepEqual(zoom.bioZoomFocusCamera({x:0,y:0,scale:3},{x:240,y:165}),
   {x:0,y:0,scale:3},"User's larger zoom must remain unchanged");
  assert.ok(camera.x<=240*(camera.scale-1)&&camera.x>=-240*(camera.scale-1));
  checked++;
 }
}
assert.deepEqual([checked,specific,core,lineages],[61,24,13,24]);
const model=fs.readFileSync("src/lektrusBioUnifiedZoomModel.ts","utf8");
const component=fs.readFileSync("src/LektrusBioUnifiedZoom.tsx","utf8");
const css=fs.readFileSync("src/lektrusBioUnifiedZoom.css","utf8");
for(const file of ["src/LektrusBioUnifiedZoom.tsx","src/LektrusBioCoreMicroscopyArt.tsx",
 "src/LektrusBioLineageMicroscopy.tsx"]){
 const ast=ts.createSourceFile(file,fs.readFileSync(file,"utf8"),
  ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 assert.equal(ast.parseDiagnostics.length,0,"Malformed source "+file);
}
assert.match(model,/export function bioZoomFocusCamera\(/);
assert.match(component,/bioFeatureSpotFor\(organism,node,nodes,name\)/);
assert.match(component,/const target=bioZoomFocusCamera\(cameraRef.current,pt\)/);
assert.match(component,/setCam\(target\)/);
assert.match(component,/setFocusSeeking\(true\)/);
assert.match(component,/focusTravelTimer.current=window.setTimeout/);
assert.match(component,/is-feature-seeking/);
assert.match(component,/setFocus\(0\)/);
assert.match(component,/Показать всё поле выбранной ткани/);
assert.match(component,/onClick=\{\(\)=>focusFeature\(x.name\)\}/);
assert.match(component,/onFeatureSelect=\{includeMarkers&&node.level==="cell"\?focusFeature:undefined\}/);
assert.match(component,/data-bio-feature-target=\{feature\}/);
assert.match(component,/if\(photo&&photoError!==node.id\)return;/,
 "No fabricated subcellular spots on an unregistered photo");
assert.match(css,/lektrus-bio-feature-focus-ring/);
assert.match(css,/lektrus-bio-unified-world.is-feature-seeking\{transition:transform/);
assert.match(css,/lektrus-bio-unified-world.is-feature-seeking\{transition:none!important\}/);
assert.match(css,/lektrus-bio-feature-focus-ring\{animation:none\}/);
console.log("Microscope cellular focus: 20 organisms, 61 cells, 183 matching features, 24 specific + 13 core + 24 lineage plates, camera bounds and photo safeguards OK.");
