import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
function load(file){
 const transpiled=ts.transpileModule(fs.readFileSync(file,"utf8"),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
 }).outputText;
 const exports={};
 new Function("exports","require",transpiled)(exports,(name)=>{
  if(name==="./lektrusBioAdditionalCellPlates")return load("src/lektrusBioAdditionalCellPlates.ts");
  throw Error("Unexpected TS import "+name);
 });
 return exports;
}
const bio=load("src/lektrusBioMicroscopeModel.ts");
const base=load("src/lektrusBioCellPlates.ts");
const extra=load("src/lektrusBioAdditionalCellPlates.ts");
const species=["sparrow","perch","frog","bee","snail","pine","fern","wheat"];
const expectedExtraKinds={
 sparrow:["sparrow-keratinocyte","sparrow-cone"],
 perch:["perch-hair","perch-cardiomyocyte"],
 frog:["frog-lung-epithelium","frog-rod"],
 bee:["bee-tracheal-epithelium","bee-fiber"],
 snail:["snail-photoreceptor","snail-mantle-epithelium"],
 pine:["pine-root-hair","pine-microsporocyte"],
 fern:["fern-mesophyll","fern-root-cortex"],
 wheat:["wheat-mesophyll","wheat-root-hair"]
};
const all=Object.values(extra.BIO_ADDITIONAL_CELL_PLATES);
assert.equal(all.length,16,"All previously generic cell paths must now be individually drawn");
assert.equal(new Set(all.map(x=>x.kind)).size,16,"Every cell type needs its own SVG depiction");
let landmarks=0;
for(const organism of species){
 const nodes=bio.bioNodes(organism);
 const cellNodes=nodes.filter(n=>n.level==="cell");
 assert.equal(cellNodes.length,3,"Atlas still needs three independent chains per species: "+organism);
 const old=base.BIO_CELL_PLATES[organism];
 assert.ok(old);
 const newPlates=all.filter(p=>p.organism===organism);
 assert.equal(newPlates.length,2,"Exactly two newly drawn cell types per species: "+organism);
 assert.deepEqual(newPlates.map(p=>p.kind),expectedExtraKinds[organism]);
 const seen=new Set();
 for(const node of cellNodes){
  const plate=base.bioCellPlateFor(organism,node);
  assert.ok(plate,"Cell branch has no dedicated plate: "+node.id);
  assert.equal(plate.cellName,node.name);
  assert.ok(!seen.has(plate.cellName),"One species may not reuse the same cell plate twice");
  seen.add(plate.cellName);
  const parent=nodes.find(p=>p.id===node.parentId);
  assert.equal(parent?.level,"tissue","Cell is not the true child of a tissue");
  const features=bio.bioCellFeatures(node);
  const entries=Object.entries(plate.landmarks);
  assert.equal(features.length,3,"Missing reviewed cell features: "+node.id);
  assert.deepEqual(entries.map(([name])=>name),features.map(f=>f.name),
   "Interactive locations must refer to exactly this cell's real properties: "+node.id);
  assert.equal(entries.length,3);
  for(const [name,spot] of entries){
   const fact=features.find(f=>f.name===name);
   assert.ok(fact&&fact.description.length>=12);
   assert.ok(spot.x>=70&&spot.x<=400&&spot.y>=50&&spot.y<=290,
    "Click target outside specimen art "+node.id+" "+name);
  }
  assert.ok(plate.title.length>15&&plate.description.length>70&&plate.caveat.length>50);
  assert.match(plate.source.url,/^https:\/\//);
  for(const other of species.filter(s=>s!==organism)){
   assert.equal(base.bioCellPlateFor(other,node),null,
    "Cell must not leak between species even when their Russian names coincide");
  }
  landmarks+=entries.length;
 }
}
assert.equal(landmarks,72,"24 fully illustrated cell nodes should expose 72 genuine features");
for(const organism of ["human","cat","sunflower","oak"]){
 for(const node of bio.bioNodes(organism)){
  assert.equal(extra.bioAdditionalCellPlateFor(organism,node),null);
  assert.equal(base.bioCellPlateFor(organism,node),null);
 }
}
assert.match(extra.BIO_ADDITIONAL_CELL_PLATES["perch:Волосковая клетка"].description,/стереоцилий/);
assert.match(extra.BIO_ADDITIONAL_CELL_PLATES["snail:Фоторецепторная клетка"].caveat,/не имеет сетчатки позвоночного типа/);
assert.match(extra.BIO_ADDITIONAL_CELL_PLATES["pine:Микроспороцит"].description,/2n/);
assert.match(extra.BIO_ADDITIONAL_CELL_PLATES["wheat:Клетка с корневым волоском"].caveat,/не цепочкой отдельных клеток/);
const art=fs.readFileSync("src/LektrusBioAdditionalCellArt.tsx","utf8");
for(const kind of all.map(p=>p.kind))
 assert.ok(art.includes('"'+kind+'"'),"Missing a dedicated cellular SVG shape "+kind);
assert.match(art,/data-bio-extra-cell-art=\{kind\}/);
assert.ok(art.includes("function PerchHair()"));
assert.ok(art.includes("function SparrowCone()"));
assert.ok(art.includes("function PineRootHair()"));
assert.ok(art.includes("function WheatRootHair()"));
assert.ok(!art.includes("<image"),"Artwork must be offline and original");
const stage=fs.readFileSync("src/LektrusBioCellDetail.tsx","utf8");
assert.match(stage,/bioAdditionalCellPlateFor\(organism,node\)/);
assert.match(stage,/<LektrusBioAdditionalCellArt kind=\{extra\.kind\}\/>/);
assert.match(stage,/onFeatureSelect&&Object\.entries/,"No answer hotspots in assignments");
assert.match(stage,/aria-pressed=\{selectedFeature===name\}/);
assert.match(stage,/if\(e\.key==="Enter"\|\|e\.key===" "\)/);
const ui=fs.readFileSync("src/LektrusBioMicroscope.tsx","utf8");
assert.match(ui,/diagram\.activity==="explore"&&step===lower\?setActiveFeatureName:undefined/);
assert.match(ui,/diagram\.activity==="explore"&&step===upper\?setActiveFeatureName:undefined/);
for(const file of [
 "src/LektrusBioCellDetail.tsx",
 "src/LektrusBioAdditionalCellArt.tsx",
 "src/LektrusBioMicroscope.tsx"
]){
 const parsed=ts.createSourceFile(file,fs.readFileSync(file,"utf8"),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 assert.equal(parsed.parseDiagnostics.length,0,"Invalid TSX file "+file);
}
console.log("Biology atlas: all 24 cell paths rendered with unique plates (16 new), 72 real clickable structure descriptions, species isolation, assignment safety and TSX syntax pass.");
