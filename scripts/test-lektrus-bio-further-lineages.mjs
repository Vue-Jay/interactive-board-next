import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const load=(path)=>{
 const source=fs.readFileSync(path,"utf8");
 const js=ts.transpileModule(source,{compilerOptions:{
  module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022
 }}).outputText;
 const exports={};new Function("exports",js)(exports);return exports;
};
const bio=load("src/lektrusBioMicroscopeModel.ts");
const taxonomy=load("src/lektrusBioTaxonomy.ts");
const ids=["lizard","spider","clubmoss","magnolia"];
const expected={lizard:"reptilia",spider:"arachnida",clubmoss:"lycopodiopsida",magnolia:"magnoliids"};
assert.deepEqual(bio.BIO_FURTHER_IDS,ids);
assert.equal(Object.keys(bio.BIO_ORGANISMS).length,20);
assert.equal(new Set(Object.values(bio.BIO_ORGANISMS).map(x=>x.scientific)).size,20);
let paths=0,features=0,transitions=0;
for(const species of ids){
 const metadata=bio.BIO_ORGANISMS[species],taxon=taxonomy.bioTaxonForOrganism(species);
 assert.ok(taxon,"New specimen not connected to a real taxon: "+species);
 assert.equal(taxon.id,expected[species]);
 assert.equal(taxon.kingdom,metadata.group);
 assert.ok(taxon.representatives.some(r=>r.anatomy===species&&r.scientific===metadata.scientific));
 assert.ok(bio.BIO_FURTHER_SOURCES[species].title.length>10);
 assert.match(bio.BIO_FURTHER_SOURCES[species].url,/^https:\/\/[^/]+\/.+/);
 const nodes=bio.bioNodes(species),root=nodes[0];
 assert.equal(root.id,species);
 assert.equal(nodes.length,13,"Three distinct five-step branches expected");
 assert.equal(new Set(nodes.map(n=>n.id)).size,13);
 assert.equal(bio.bioChildren(nodes,species).length,3);
 assert.equal(new Set(nodes.filter(n=>n.level==="system").map(n=>n.name)).size,3);
 const rootChildren=bio.bioChildren(nodes,root.id);
 assert.deepEqual(rootChildren.map((n,i)=>bio.bioChildSpot(species,root,n,i,3)),
  bio.BIO_FURTHER_ROOT_POINTS[species]);
 for(const node of nodes){
  assert.ok(node.name&&node.description.length>24);
  if(node.level!=="organism")assert.equal(node.source?.url,bio.BIO_FURTHER_SOURCES[species].url);
  const children=bio.bioChildren(nodes,node.id);
  assert.equal(children.length,node.level==="cell"?0:node.level==="organism"?3:1);
  children.forEach((child,i)=>{
   const p=bio.bioChildSpot(species,node,child,i,children.length);
   assert.ok(p.x>=25&&p.x<=455&&p.y>=25&&p.y<=310);
   transitions++;
  });
 }
 for(const leaf of nodes.filter(n=>n.level==="cell")){
  paths++;
  const ancestors=bio.bioAncestors(nodes,leaf.id);
  assert.deepEqual(ancestors.map(x=>x.level),bio.BIO_LEVELS);
  assert.ok(bio.validBioMicroscope({...bio.withBioOrganism(bio.newBioMicroscope(),species),
   assignmentPath:ancestors.map(n=>n.id)}),"Saved biological task path invalid: "+leaf.id);
  const cell=bio.bioCellFeatures(leaf);
  assert.equal(cell.length,3,"Exactly three inspectable cell features");
  assert.equal(new Set(cell.map(x=>x.name)).size,3);
  assert.ok(cell.every(x=>x.description.length>=30));
  features+=cell.length;
 }
 assert.equal(bio.bioCellFeatures(root).length,0);
}
assert.equal(paths,12);assert.equal(features,36);assert.equal(transitions,48);
assert.equal(taxonomy.bioTaxonForOrganism("magnolia")?.rank,"клада");
assert.match(bio.BIO_FURTHER_CHAINS.lizard[1][3],/не в человеческом альвеолярном дереве/);
assert.match(bio.BIO_FURTHER_CHAINS.spider[0][3],/гемолимфа/);
assert.match(bio.BIO_FURTHER_CHAINS.clubmoss[1][3],/спорангии одного типа/);
assert.match(bio.BIO_FURTHER_CHAINS.magnolia[2][2],/Плодолистик/);
const visual=fs.readFileSync("src/LektrusBioFurtherSpeciesArt.tsx","utf8");
for(const id of ids)assert.ok(visual.includes('case "'+id+'"'),"Missing new organism SVG: "+id);
for(const slug of ["покровная-система","шёлкообразующая-система","спороносные-структуры","плодолистики-цветка"])
 assert.ok(visual.includes(slug),"Missing specialized anatomical branch: "+slug);
assert.match(visual,/data-bio-further-species=\{organism\}/);
assert.match(visual,/data-bio-further-feature=\{feature.name\}/);
assert.match(visual,/aria-pressed=\{selectedFeature===feature.name\}/);
assert.match(visual,/onKeyDown=\{e=>\{if\(e.key==="Enter"\|\|e.key===" "\)/);
assert.match(visual,/node.level==="cell"&&onFeatureSelect\?bioFurtherCellFeatures/);
assert.ok(!visual.includes("<image"),"Fully offline original SVG illustrations required");
const stage=fs.readFileSync("src/LektrusBioAnatomyScene.tsx","utf8");
assert.match(stage,/isBioFurtherOrganism\(organism\)/);
assert.match(stage,/<LektrusBioFurtherSpeciesArt organism=\{organism\} node=\{node\}/);
const ui=fs.readFileSync("src/LektrusBioMicroscope.tsx","utf8");
assert.match(ui,/isBioFurtherOrganism\(activeOrganism\)&&selected.level==="cell"&&diagram.activity==="explore"/);
assert.match(ui,/chosenFeature.description/);
for(const file of ["src/LektrusBioFurtherSpeciesArt.tsx","src/LektrusBioAnatomyScene.tsx","src/LektrusBioMicroscope.tsx"]){
 const ast=ts.createSourceFile(file,fs.readFileSync(file,"utf8"),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 assert.equal(ast.parseDiagnostics.length,0,"Bad TSX: "+file);
}
for(const old of ["human","cat","sunflower","oak","earthworm","seastar","crayfish","horsetail"]){
 const nodes=bio.bioNodes(old);
 assert.ok(nodes.every(n=>!n.id.startsWith("lizard/")&&!n.id.startsWith("magnolia/")));
 assert.ok(bio.bioChildren(nodes,nodes[0].id).length>=2,"Legacy organisms can share a shoot and retain fewer root systems");
}
assert.equal(bio.bioNodes("sunflower").find(n=>n.id.endsWith("/корневой-волосок")).id,
 "sunflower/корневая-система/корень/ризодерма/корневой-волосок");
console.log("Bio further lineages: 4 taxonomy reps, 12 detailed five-step anatomy branches, 48 nav transitions, 36 accessible cell features, academic sources and old board compatibility checked.");
