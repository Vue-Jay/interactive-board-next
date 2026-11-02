import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const load=(file)=>{
 const source=fs.readFileSync(file,"utf8");
 const transpiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};new Function("exports",transpiled)(exports);return exports;
};
const bio=load("src/lektrusBioMicroscopeModel.ts");
const micro=load("src/lektrusBioCoreMicroscopyPlates.ts");
const plates=micro.BIO_CORE_MICROSCOPY_PLATES;
assert.equal(plates.length,26,"13 branch tissue/cell pairs must be reviewed");
assert.equal(new Set(plates.map(p=>p.organism+":"+p.level+":"+p.name)).size,26,"All plates must be unique");

const organisms=["human","cat","sunflower","oak"];
const perOrganism={human:6,cat:6,sunflower:8,oak:6};
const kinds=new Set();
for(const organism of organisms){
 const nodes=bio.bioNodes(organism);
 const nested=nodes.filter(n=>n.level==="tissue"||n.level==="cell");
 assert.equal(nested.length,perOrganism[organism],"Missing reviewed atlas branch "+organism);
 assert.equal(plates.filter(p=>p.organism===organism).length,perOrganism[organism]);
 for(const node of nested){
  const plate=micro.bioCoreMicroscopyPlateFor(organism,node);
  assert.ok(plate,"Missing precise microscopic figure: "+node.id);
  assert.equal(plate.level,node.level);
  assert.equal(plate.name,node.name);
  assert.ok(plate.caption.length>35,"Insufficient scientific caption "+node.id);
  kinds.add(plate.kind);
  if(node.level==="cell")assert.equal(bio.bioCellFeatures(node).length,3,"Clickable structure descriptions must exist for "+node.id);
  const other=organisms.find(x=>x!==organism);
  assert.equal(micro.bioCoreMicroscopyPlateFor(other,node),null,"Never borrow images across species");
 }
 for(const node of nodes.filter(n=>["organism","system","organ"].includes(n.level))){
  assert.equal(micro.bioCoreMicroscopyPlateFor(organism,node),null,"Microscopic plate must not replace organism, system or organ");
 }
}
assert.equal(kinds.size,12,"No unrelated tissues may share one universal cartoon");
for(const species of Object.keys(bio.BIO_ORGANISMS).filter(x=>!organisms.includes(x))){
 for(const node of bio.bioNodes(species))assert.equal(micro.bioCoreMicroscopyPlateFor(species,node),null,"Do not substitute a core species cell into "+species);
}
const tissue=plates.find(p=>p.organism==="sunflower"&&p.name==="Эпидермис листа");
const guard=plates.find(p=>p.organism==="sunflower"&&p.name==="Замыкающая клетка устьица");
assert.equal(tissue.kind,"stomata");
assert.equal(guard.kind,"stomata");
assert.equal(plates.find(p=>p.organism==="oak"&&p.name==="Сосудистый элемент").kind,"xylem");

const source=fs.readFileSync("src/LektrusBioCoreMicroscopyArt.tsx","utf8");
const ast=ts.createSourceFile("src/LektrusBioCoreMicroscopyArt.tsx",source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
assert.equal(ast.parseDiagnostics.length,0,"Microscopic illustration TSX must parse");
for(const kind of kinds){
 assert.match(source,new RegExp('"'+kind+'":'),"Missing tissue or cell art "+kind);
 assert.match(source,new RegExp(kind.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")), "Missing a specialized art family");
}
assert.match(source,/data-bio-core-micro=\{plate\.kind\}/);
assert.match(source,/data-bio-core-feature=\{feature\.name\}/);
assert.match(source,/role="button" tabIndex=\{0\}/);
assert.match(source,/onKeyDown=\{e=>\{if\(e\.key==="Enter"\|\|e\.key===" "\)/);
assert.match(source,/features\.map\(\(feature,i\)=>/);
assert.match(source,/case "xylem":return <g>/);
assert.match(source,/без ядра и цитоплазмы/,"Mature xylem cannot contain living cell nuclei");
assert.match(source,/Волоски = выросты отдельных клеток/,"A root hair must not be modeled as a separate cell");
assert.match(source,/Пара клеток показана ради устьичной щели/,"A stomatal pore requires two guard cells");
const scene=fs.readFileSync("src/LektrusBioAnatomyScene.tsx","utf8");
assert.match(scene,/bioCoreMicroscopyPlateFor\(organism,node\)/);
assert.match(scene,/cellDetail\?\?detail\?\?coreDetail/,"Reviewed photomicrograph/specimen plates must retain priority");
assert.match(scene,/<LektrusBioCoreMicroscopyArt plate=\{corePlate\}/);
assert.match(scene,/features=\{bioCellFeatures\(node\)\}/);
assert.match(scene,/selectedFeature=\{activeFeatureName\} onFeatureSelect=\{onFeatureSelect\}/);
assert.ok(!source.includes("Микроскопическое увеличение ×"),"Do not invent optical calibration");
console.log("Core bio microscopic atlas: 26 reviewed tissue/cell nodes, 12 distinct histologies, 4 species, feature interaction, photo precedence and keyboard access OK.");
