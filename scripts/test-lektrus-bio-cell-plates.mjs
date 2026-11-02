import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
function load(file){
 const source=fs.readFileSync(file,"utf8");
 const transpiled=ts.transpileModule(source,{compilerOptions:{
  module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};new Function("exports",transpiled)(exports);return exports;
}
const bio=load("src/lektrusBioMicroscopeModel.ts");
const cell=load("src/lektrusBioCellPlates.ts");
const species=["sparrow","perch","frog","bee","snail","pine","fern","wheat"];
assert.deepEqual(Object.keys(cell.BIO_CELL_PLATES),species);
let featureCount=0;
for(const organism of species){
 const plate=cell.BIO_CELL_PLATES[organism];
 assert.ok(plate);
 assert.equal(plate.organism,organism);
 assert.ok(plate.description.length>75);
 assert.ok(plate.caveat.length>40);
 assert.ok(plate.source.title.length>10);
 assert.match(plate.source.url,/^https:\/\//);
 const nodes=bio.bioNodes(organism);
 const target=nodes.find(n=>n.level==="cell"&&n.name===plate.cellName);
 assert.ok(target,"Plate mapped to missing cell "+organism);
 assert.equal(cell.bioCellPlateFor(organism,target),plate);
 const parent=nodes.find(n=>n.id===target.parentId);
 assert.ok(parent&&parent.level==="tissue");
 const features=bio.bioCellFeatures(target);
 assert.equal(features.length,3,"All markers must link to existing features "+organism);
 const points=Object.entries(plate.landmarks);
 assert.deepEqual(points.map(([name])=>name),features.map(f=>f.name),
  "Marker names and order must match existing scientific features "+organism);
 for(const [name,pos] of points){
  assert.ok(features.some(f=>f.name===name&&f.description.length>=12),"Missing scientific description: "+organism+" "+name);
  assert.ok(pos.x>55&&pos.x<455&&pos.y>46&&pos.y<305,"Marker outside plate "+organism+" "+name);
 }
 assert.equal(new Set(points.map(([,pos])=>JSON.stringify(pos))).size,points.length,
  "All markers must be at different locations: "+organism);
 featureCount+=points.length;
 // A cell belongs to exactly one tissue and must not inherit another species' plate.
 for(const n of nodes.filter(n=>n.level==="cell"&&n.id!==target.id)){
  assert.equal(cell.bioCellPlateFor(organism,n),null);
 }
 for(const other of species.filter(s=>s!==organism)){
  assert.equal(cell.bioCellPlateFor(other,target),null);
 }
 assert.equal(cell.bioCellPlateFor(organism,parent),null,"Tissue cannot be rendered as cell");
}
assert.equal(featureCount,24);
assert.match(cell.BIO_CELL_PLATES.sparrow.caveat,/альвеол/);
assert.match(cell.BIO_CELL_PLATES.bee.description,/рабдом/);
assert.match(cell.BIO_CELL_PLATES.snail.description,/исчерченности нет/);
assert.match(cell.BIO_CELL_PLATES.fern.description,/2n/);
assert.match(cell.BIO_CELL_PLATES.wheat.caveat,/не исчезает в момент/);
for(const organism of ["human","cat","sunflower","oak"]){
 assert.ok(bio.bioNodes(organism).every(n=>cell.bioCellPlateFor(organism,n)===null));
}
const art=fs.readFileSync("src/LektrusBioCellDetail.tsx","utf8");
for(const organism of species)assert.ok(art.includes(organism+":"),"No original cell illustration for "+organism);
assert.match(art,/data-bio-cell-plate=\{organism\}/);
assert.match(art,/data-bio-cell-feature=\{name\}/);
assert.match(art,/aria-pressed=\{selectedFeature===name\}/);
assert.match(art,/if\(e\.key==="Enter"\|\|e\.key===" "\)/);
assert.match(art,/onFeatureSelect&&Object\.entries/,"Labels must stay hidden outside explore mode");
const scene=fs.readFileSync("src/LektrusBioAnatomyScene.tsx","utf8");
assert.match(scene,/bioCellPlateFor\(organism,node\)/);
assert.match(scene,/<LektrusBioCellDetail organism=\{organism\} node=\{node\}/);
assert.match(scene,/cellDetail\?\?detail\?\?/);
const ui=fs.readFileSync("src/LektrusBioMicroscope.tsx","utf8");
assert.match(ui,/bioCellPlateFor\(activeOrganism,selected\)/);
assert.match(ui,/useEffect\(\(\)=>setActiveFeatureName\(null\),\[activeOrganism,selected\.id\]\)/);
assert.match(ui,/diagram\.activity==="explore"&&step===lower\?setActiveFeatureName:undefined/);
assert.match(ui,/diagram\.activity==="explore"&&step===upper\?setActiveFeatureName:undefined/);
assert.match(ui,/const chosenFeature=cellFeatures\.find\(f=>f\.name===activeFeatureName\)\?\?null/);
assert.match(ui,/chosenFeature\.description/);
assert.match(ui,/href=\{cellPlate\.source\.url\}/);
for(const file of ["src/LektrusBioCellDetail.tsx","src/LektrusBioAnatomyScene.tsx","src/LektrusBioMicroscope.tsx"]){
 const parsed=ts.createSourceFile(file,fs.readFileSync(file,"utf8"),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 assert.equal(parsed.parseDiagnostics.length,0,"TSX syntax error "+file);
}
const css=fs.readFileSync("src/lektrusBioMicroscope.css","utf8");
assert.match(css,/\.lektrus-bio-cell-hotspot:focus-visible/);
assert.match(css,/\.lektrus-bio-cell-selection/);
console.log("Biology cell atlas: eight unique cell illustrations, 24 exact verified feature markers, keyboard and touch interactions, task-safe mode, sources and regression OK.");
