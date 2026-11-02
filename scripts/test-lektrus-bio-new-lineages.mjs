import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";
const load=(path)=>{
 const transpiled=ts.transpileModule(readFileSync(path,"utf8"),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
 }).outputText;
 const exports={};
 // Atlas must remain directly loadable by the old offline tests (no require).
 new Function("exports",transpiled)(exports);
 return exports;
};
const bio=load("src/lektrusBioMicroscopeModel.ts");
const taxonomy=load("src/lektrusBioTaxonomy.ts");
const ids=["earthworm","seastar","crayfish","horsetail"];
assert.equal(Object.keys(bio.BIO_ORGANISMS).length,20,"Earlier four lineages must remain available after further expansions");
assert.deepEqual(bio.BIO_NEW_IDS,ids);
assert.equal(new Set(ids.map(id=>bio.BIO_ORGANISMS[id].scientific)).size,4);
const expectedClasses={earthworm:"clitellata",seastar:"asteroidea",crayfish:"malacostraca",horsetail:"equisetidae"};
let cells=0,hotspots=0;
for(const id of ids){
 const organism=bio.BIO_ORGANISMS[id];
 const taxon=taxonomy.bioTaxonForOrganism(id);
 assert.equal(taxon?.id,expectedClasses[id],"Missing correct live class in taxonomy for "+id);
 assert.equal(taxon?.kingdom,organism.group);
 assert.ok(taxon.representatives.some(r=>r.anatomy===id&&r.scientific===organism.scientific));
 assert.ok(bio.BIO_NEW_SOURCES[id].url.startsWith("https://"));
 const nodes=bio.bioNodes(id);
 assert.equal(nodes.length,13,id+" should have one root and 3*4 anatomical descendants");
 assert.equal(new Set(nodes.map(x=>x.id)).size,nodes.length,"Duplicate anatomical IDs");
 assert.equal(nodes.filter(n=>n.level==="system").length,3);
 assert.equal(nodes.filter(n=>n.level==="organ").length,3);
 assert.equal(nodes.filter(n=>n.level==="tissue").length,3);
 const leaves=nodes.filter(n=>n.level==="cell");
 assert.equal(leaves.length,3);
 const points=bio.BIO_NEW_ROOT_POINTS[id];
 assert.equal(points.length,3);
 assert.equal(new Set(points.map(x=>x.x+":"+x.y)).size,3,"Root spots must differ");
 const root=nodes[0],systems=bio.bioChildren(nodes,root.id);
 assert.equal(systems.length,3);
 systems.forEach((n,i)=>{
  assert.deepEqual(bio.bioChildSpot(id,root,n,i,3),points[i]);
 });
 for(const n of nodes){
  assert.ok(n.description.length>25,id+": too vague: "+n.id);
  if(n.level!=="organism")assert.equal(n.source?.url,bio.BIO_NEW_SOURCES[id].url,
   id+": missing scientific attribution for "+n.name);
  const kids=bio.bioChildren(nodes,n.id);
  assert.equal(kids.length,n.level==="cell"?0:n.level==="organism"?3:1);
  kids.forEach((child,i)=>{
   const spot=bio.bioChildSpot(id,n,child,i,kids.length);
   assert.ok(spot.x>=25&&spot.x<=455&&spot.y>=25&&spot.y<=310);
   hotspots++;
  });
 }
 for(const leaf of leaves){
  const path=bio.bioAncestors(nodes,leaf.id);
  assert.deepEqual(path.map(n=>n.level),bio.BIO_LEVELS);
  assert.ok(bio.validBioMicroscope({...bio.withBioOrganism(bio.newBioMicroscope(),id),
   assignmentPath:path.map(n=>n.id)}),"Saved exercise path invalid: "+leaf.id);
  const facts=bio.bioCellFeatures(leaf);
  assert.equal(facts.length,3,"Each new cell needs three real facts: "+leaf.name);
  assert.equal(new Set(facts.map(f=>f.name)).size,3);
  assert.ok(facts.every(f=>f.description.length>=30));
  cells++;
 }
 assert.equal(bio.bioCellFeatures(nodes[0]).length,0);
 const rootSpotForUnknown=bio.bioChildSpot(id,root,systems[0],0,3);
 assert.equal(rootSpotForUnknown.x,points[0].x);
}
assert.equal(cells,12);
assert.equal(hotspots,48,"Each of twelve five-level branches has four clickable hops");
const file=readFileSync("src/LektrusBioNewSpeciesArt.tsx","utf8");
for(const id of ids)assert.ok(file.includes('case "'+id+'"'),"Species silhouette missing: "+id);
for(const kind of ["organism","system","organ","tissue","cell"])
 assert.ok(file.includes(kind),"Depth must have dedicated view handling "+kind);
assert.match(file,/data-bio-new-species=\{organism\}/);
assert.match(file,/data-bio-new-cell-feature=\{item\.name\}/);
assert.match(file,/onFeatureSelect\?\.\(item\.name\)/);
assert.match(file,/onKeyDown=\{e=>\{if\(e\.key==="Enter"\|\|e\.key===" "\)/);
assert.match(file,/const cellFeatures=node\.level==="cell"&&onFeatureSelect\?bioNewCellFeatures/);
assert.ok(file.includes("Ресничная клетка")||file.includes("Ресничная воронка"));
assert.ok(!file.includes("<image"),"Illustration should be offline");
for(const path of ["src/LektrusBioNewSpeciesArt.tsx","src/LektrusBioAnatomyScene.tsx","src/LektrusBioMicroscope.tsx"]){
 const parsed=ts.createSourceFile(path,readFileSync(path,"utf8"),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 assert.equal(parsed.parseDiagnostics.length,0,path+" has TSX syntax errors");
}
const stage=readFileSync("src/LektrusBioAnatomyScene.tsx","utf8");
assert.match(stage,/isBioNewOrganism\(organism\)/);
assert.match(stage,/<LektrusBioNewSpeciesArt organism=\{organism\} node=\{node\}/);
const ui=readFileSync("src/LektrusBioMicroscope.tsx","utf8");
assert.match(ui,/isBioNewOrganism\(activeOrganism\)&&selected\.level==="cell"&&diagram\.activity==="explore"/);
assert.match(ui,/chosenFeature\.description/);
assert.match(ui,/onFeatureSelect=\{diagram\.activity==="explore"/);
const taxonomyText=readFileSync("src/lektrusBioTaxonomy.ts","utf8");
for(const id of ids)assert.ok(taxonomyText.includes("|"+id+'"'),"Class browsing must link to atlas");
const old=bio.bioNodes("sunflower");
assert.equal(old.find(n=>n.id.endsWith("/корневой-волосок")).id,
 "sunflower/корневая-система/корень/ризодерма/корневой-волосок","Old boards must remain valid");
console.log("Biology expansion: 4 new lineages, 12 reviewed five-level branches, 48 navigable transitions, 36 interactive cell properties, source links and saved assignments OK");
