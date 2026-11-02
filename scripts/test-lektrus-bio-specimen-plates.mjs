import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const load=(file)=>{
 const js=ts.transpileModule(fs.readFileSync(file,"utf8"),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
 }).outputText;
 const exports={};
 new Function("exports","require",js)(exports,(name)=>{
  if(name==="./lektrusBioAdditionalSpecimenPlates")return load("src/lektrusBioAdditionalSpecimenPlates.ts");
  throw Error("Unexpected dependency "+name);
 });
 return exports;
};
const bio=load("src/lektrusBioMicroscopeModel.ts");
const model=load("src/lektrusBioSpecimenPlates.ts");
const species=["sparrow","perch","frog","bee","snail","pine","fern","wheat"];
const plates=Object.entries(model.BIO_SPECIMEN_PLATES);
assert.equal(plates.length,species.length*2);
assert.equal(new Set(plates.map(([k,v])=>v.id)).size,plates.length);
for(const organism of species){
 const nodes=bio.bioNodes(organism),root=nodes[0],byId=new Map(nodes.map(n=>[n.id,n]));
 assert.equal(root.id,organism);
 const found=nodes.map(n=>model.bioSpecimenPlateFor(organism,n)).filter(Boolean);
 assert.equal(found.length,6,organism+" must have three real organ and three real tissue plates");
 for(const level of ["organ","tissue"]){
  const plate=model.BIO_SPECIMEN_PLATES[organism+":"+level];
  assert.ok(plate,"missing "+organism+" "+level);
  assert.equal(plate.organism,organism);
  assert.equal(plate.level,level);
  assert.match(plate.source,/^https:\/\//);
  assert.ok(plate.caption.length>55);
  assert.ok(plate.title.length>10);
  const n=nodes.find(n=>n.level===level&&n.name===plate.nodeName);
  assert.ok(n,"plate not tied to actual anatomical node "+organism+" "+level);
  assert.equal(model.bioSpecimenPlateFor(organism,n),plate);
  const kids=bio.bioChildren(nodes,n.id);
  assert.equal(kids.length,1,"a dedicated view needs exactly one child: "+n.id);
  const child=kids[0];
  assert.equal(byId.get(child.id),child);
  assert.equal(child.parentId,n.id);
  const spot=model.bioSpecimenChildSpot(organism,n,child);
  assert.ok(spot&&spot.x>=90&&spot.x<=385&&spot.y>=88&&spot.y<=230,
   "selected specimen tissue/cell must align with visible picture");
  assert.deepEqual(spot,plate.focus);
  assert.equal(model.bioSpecimenChildSpot(organism,n,root),null,
   "unrelated species node must not get a hotspot");
 }
 const uncovered=nodes.filter(n=>n.level==="organ"||n.level==="tissue")
  .filter(n=>!model.bioSpecimenPlateFor(organism,n));
 assert.equal(uncovered.length,0,"all eight-species organ and tissue branches now require their own art");
 assert.equal(found.filter(p=>p.level==="organ").length,3);
 assert.equal(found.filter(p=>p.level==="tissue").length,3);
}
for(const organism of ["human","cat","sunflower","oak"]){
 const nodes=bio.bioNodes(organism);
 assert.ok(nodes.every(n=>model.bioSpecimenPlateFor(organism,n)===null),
  "legacy species retain own anatomy: "+organism);
}
assert.match(model.BIO_SPECIMEN_PLATES["sparrow:organ"].caption,/не альвеолы/);
assert.match(model.BIO_SPECIMEN_PLATES["perch:organ"].caption,/ламелл/);
assert.match(model.BIO_SPECIMEN_PLATES["bee:organ"].caption,/рабдом/);
assert.match(model.BIO_SPECIMEN_PLATES["pine:organ"].caption,/две проводящие связки/);
assert.match(model.BIO_SPECIMEN_PLATES["wheat:organ"].caption,/тапетум/);
const art=fs.readFileSync("src/LektrusBioOrganDetail.tsx","utf8");
for(const id of species){
 assert.match(art,new RegExp(id+":\\w+"));
}
assert.match(art,/data-bio-specimen-plate=\{plate\.id\}/);
assert.match(art,/<Callout/);
const scene=fs.readFileSync("src/LektrusBioAnatomyScene.tsx","utf8");
assert.match(scene,/bioSpecimenPlateFor\(organism,node\)/);
assert.match(scene,/<LektrusBioOrganDetail organism=\{organism\} node=\{node\}\/>/);
assert.match(scene,/bioSpecimenChildSpot\(organism,node,child\)\?\?bioChildSpot/);
const microscope=fs.readFileSync("src/LektrusBioMicroscope.tsx","utf8");
assert.match(microscope,/bioSpecimenPlateFor\(activeOrganism,selected\)/);
assert.match(microscope,/href=\{specimenPlate\.source\}/);
assert.match(microscope,/specimenPlate\.caption/);
for(const file of ["src/LektrusBioOrganDetail.tsx","src/LektrusBioAnatomyScene.tsx","src/LektrusBioMicroscope.tsx"]){
 const ast=ts.createSourceFile(file,fs.readFileSync(file,"utf8"),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 assert.equal(ast.parseDiagnostics.length,0,file+" has malformed TSX");
}
console.log("Biology species organ plates: 16 unique views for eight modeled species, all exact organ/tissue IDs, science links, focused child landmarks and legacy compatible.");
