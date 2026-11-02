import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const load=(path)=>{
 const source=fs.readFileSync(path,"utf8");
 const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};new Function("exports",js)(exports);return exports;
};
const atlas=load("src/lektrusBioTaxonomy.ts");
const bio=load("src/lektrusBioMicroscopeModel.ts");
const {BIO_TAXA,BIO_TAXONOMY_SOURCES,searchBioTaxa,bioTaxaFor,bioTaxonForOrganism}=atlas;
assert.ok(BIO_TAXA.length>=59,"A broad, curated catalog must include both kingdoms");
assert.ok(bioTaxaFor("animal").length>=30);
assert.ok(bioTaxaFor("plant").length>=20);
assert.equal(new Set(BIO_TAXA.map(t=>t.id)).size,BIO_TAXA.length,"Unique and stable taxon IDs");
for(const t of BIO_TAXA){
 assert.ok(t.scientific&&t.name&&t.summary&&t.section&&t.sectionLatin);
 assert.ok(["класс","клада","подкласс","порядок"].includes(t.rank));
 assert.equal(t.traits.length,2);
 assert.ok(t.traits.every(Boolean));
 assert.ok(t.representatives.length>=1,"Every taxon must have a concrete representative: "+t.id);
 for(const r of t.representatives){
  assert.ok(r.name&&r.scientific);
  if(r.anatomy){
   assert.ok(Object.hasOwn(bio.BIO_ORGANISMS,r.anatomy),"Unbacked full-species diagram "+r.anatomy);
   assert.equal(bio.BIO_ORGANISMS[r.anatomy].scientific,r.scientific,
    "Do not substitute anatomy of another species");
   assert.equal(bio.BIO_ORGANISMS[r.anatomy].group,t.kingdom);
  }
 }
}
assert.equal(BIO_TAXA.find(t=>t.id==="monocots")?.rank,"клада");
assert.equal(BIO_TAXA.find(t=>t.id==="eudicots")?.rank,"клада");
assert.equal(BIO_TAXA.find(t=>t.id==="austrobaileyales")?.rank,"порядок");
assert.equal(BIO_TAXA.find(t=>t.id==="equisetidae")?.rank,"подкласс");
assert.ok(BIO_TAXA.find(t=>t.id==="reptilia")?.caution?.includes("птицы"));
assert.ok(BIO_TAXA.find(t=>t.id==="sarcopterygii")?.caution?.includes("четвероногие"));
assert.ok(BIO_TAXA.some(t=>t.id==="polytrichopsida"));
assert.equal(BIO_TAXA.find(t=>t.id==="bryopsida").representatives[0].scientific,"Funaria hygrometrica");
assert.ok(searchBioTaxa("MAMMALIA","animal").some(t=>t.id==="mammalia"));
assert.ok(searchBioTaxa("кошка","animal").some(t=>t.id==="mammalia"));
assert.ok(searchBioTaxa("подсолнечник","plant").some(t=>t.id==="eudicots"));
assert.equal(searchBioTaxa("absolutely unlisted taxon","plant").length,0);
for(const id of Object.keys(bio.BIO_ORGANISMS)){
 const t=bioTaxonForOrganism(id);
 assert.ok(t,"Existing atlas organism not assigned to a class: "+id);
 const cells=bio.bioNodes(id).filter(node=>node.level==="cell");
 assert.ok(cells.length>0);
 for(const cell of cells){
  const features=bio.bioCellFeatures(cell);
  assert.ok(features.length>=3,id+": cellular detail absent for "+cell.id);
  assert.ok(features.every(f=>f.name&&f.description));
 }
}
const vessel=bio.bioNodes("oak").find(n=>n.id.endsWith("/сосудистый-элемент"));
assert.ok(bio.bioCellFeatures(vessel).some(f=>f.description.includes("отсутствуют ядро")));
assert.equal(bio.bioCellFeatures(bio.bioNodes("oak")[0]).length,0);
for(const s of BIO_TAXONOMY_SOURCES)assert.match(s.url,/^https:\/\//);
for(const path of ["src/LektrusBioTaxonomyBrowser.tsx","src/LektrusBioMicroscope.tsx"]){
 const src=fs.readFileSync(path,"utf8");
 const result=ts.createSourceFile(path,src,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 assert.equal(result.parseDiagnostics.length,0,path+" JSX syntax errors");
}
const view=fs.readFileSync("src/LektrusBioMicroscope.tsx","utf8");
assert.match(view,/onExplore=\{exploreCatalogOrganism\}/,"Search results must open real specimens");
assert.match(view,/bioCellFeatures\(selected\)/,"Cell microstructures must appear in viewer");
assert.match(view,/withBioOrganism\(diagram,organism\)/,"New specimen requires a valid specific branch");
const browser=fs.readFileSync("src/LektrusBioTaxonomyBrowser.tsx","utf8");
assert.match(browser,/Карточка вида · анатомия готовится/,"Do not invent detailed anatomy for unreviewed species");
const css=fs.readFileSync("src/lektrusBioMicroscope.css","utf8");
assert.match(css,/\.lektrus-bio-atlas-columns/);
assert.match(css,/@media\(max-width:720px\)/);
console.log("Biology taxonomy:",BIO_TAXA.length,"taxa,",BIO_TAXA.reduce((v,t)=>v+t.representatives.length,0),"species examples; cell features, search, rank caveats and anatomy guards OK");
