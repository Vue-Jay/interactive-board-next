import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const compile=(path)=>{
 const source=fs.readFileSync(path,"utf8");
 const result=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});
 const exports={};new Function("exports",result.outputText)(exports);
 return exports;
};
const alt=compile("src/lektrusBioAlternativeAtlas.ts"),taxonomy=compile("src/lektrusBioTaxonomy.ts");
const {
 BIO_ALTERNATIVE_SPECIES,BIO_ALT_SOURCES,BIO_ALT_KIND_LABELS,bioAltChildren,bioAltPath,bioAltValid
}=alt;
const ids=["sponge","hydra","moss","chlamydomonas","spirogyra"];
assert.deepEqual(Object.keys(BIO_ALTERNATIVE_SPECIES),ids);
for(const id of ids){
 const specimen=BIO_ALTERNATIVE_SPECIES[id];
 assert.ok(bioAltValid(specimen),id+": invalid linked atlas graph");
 assert.equal(specimen.nodes[0].id,id);
 assert.equal(new Set(specimen.nodes.map(n=>n.id)).size,specimen.nodes.length,id+": duplicate structure IDs");
 assert.ok(specimen.nodes.length>=8);
 assert.match(specimen.source.url,/^https:\/\//);
 assert.equal(specimen.source.url,BIO_ALT_SOURCES[id].url);
 assert.ok(specimen.warning&&specimen.intro);
 const listing=taxonomy.BIO_TAXA.flatMap(t=>t.representatives.map(r=>({...r,kingdom:t.kingdom})))
  .filter(r=>r.microscopy===id);
 assert.equal(listing.length,1,id+": missing or duplicate taxon link");
 assert.equal(listing[0].scientific,specimen.scientific,id+": unrelated exemplar linked");
 assert.equal(listing[0].kingdom,specimen.group,id+": wrong taxonomy kingdom");
 assert.ok(!listing[0].anatomy,id+": cannot silently substitute legacy five-layer atlas");
 for(const node of specimen.nodes){
  assert.ok(BIO_ALT_KIND_LABELS[node.kind]);
  const path=bioAltPath(specimen,node.id);
  assert.ok(path.length>=1&&path[0].id===id&&path.at(-1).id===node.id);
  assert.equal(path.length,new Set(path.map(n=>n.id)).size,"cycle in graph");
  for(let i=1;i<path.length;i++)assert.equal(path[i].parentId,path[i-1].id);
  if(node.spot)assert.ok(node.spot.x>=30&&node.spot.x<=455&&node.spot.y>=25&&node.spot.y<=315,
   "Hotspot outside image "+node.id);
  const children=bioAltChildren(specimen,node.id);
  assert.ok(children.every(c=>c.parentId===node.id));
  assert.equal(new Set(children.map(n=>n.id)).size,children.length);
  assert.equal(new Set(children.map((child,i)=>{
   const p=child.spot??{x:100+i%3*145,y:120+Math.floor(i/3)*95};
   return p.x+":"+p.y;
  })).size,children.length,id+": overlapping hotspot children under "+node.id);
 }
}
const sponge=BIO_ALTERNATIVE_SPECIES.sponge;
assert.equal(sponge.nodes.filter(n=>n.kind==="tissue").length,0,"Sponges must not be given true tissues");
assert.equal(sponge.nodes.filter(n=>n.kind==="cell").length,2,"Choanocytes and amoebocytes are distinct");
assert.ok(sponge.nodes.some(n=>n.name==="Хоаноцит"));
assert.ok(sponge.nodes.some(n=>n.name==="Геммула"));
const hydra=BIO_ALTERNATIVE_SPECIES.hydra;
assert.ok(hydra.nodes.some(n=>n.name==="Книдоцит"));
assert.ok(hydra.nodes.some(n=>n.name==="Нематоциста"));
assert.ok(hydra.nodes.some(n=>n.name==="Гастродерма"));
const chlamy=BIO_ALTERNATIVE_SPECIES.chlamydomonas;
assert.ok(chlamy.nodes.every(n=>!["tissue","generation"].includes(n.kind)));
assert.ok(chlamy.nodes.every(n=>n.id==="chlamydomonas"||n.kind==="organelle"));
assert.ok(chlamy.nodes.some(n=>n.name==="Два жгутика"));
const moss=BIO_ALTERNATIVE_SPECIES.moss;
assert.equal(moss.cycle.length,6);
assert.ok(moss.cycle.some(n=>n.ploidy==="n"));
assert.ok(moss.cycle.some(n=>n.ploidy==="2n"));
assert.ok(moss.nodes.some(n=>n.id.endsWith("/zygote")&&n.ploidy==="2n"));
assert.ok(moss.nodes.some(n=>n.id.endsWith("/gametangium")&&n.ploidy==="n"));
assert.ok(!moss.nodes.some(n=>n.name==="Корень"));
const spir=BIO_ALTERNATIVE_SPECIES.spirogyra;
assert.equal(spir.cycle.length,4);
assert.ok(spir.nodes.some(n=>n.name==="Спиральный хлоропласт"));
assert.ok(spir.nodes.some(n=>n.name.includes("Зигоспора")));
const depths=ids.flatMap(id=>BIO_ALTERNATIVE_SPECIES[id].nodes.map(n=>bioAltPath(BIO_ALTERNATIVE_SPECIES[id],n.id).length));
assert.ok(new Set(depths).size>=4,"Variable-depth navigation not exercised");
for(const path of ["src/LektrusBioAlternativeView.tsx","src/LektrusBioMicroscope.tsx","src/LektrusBioTaxonomyBrowser.tsx"]){
 const source=fs.readFileSync(path,"utf8");
 const parsed=ts.createSourceFile(path,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 assert.equal(parsed.parseDiagnostics.length,0,path+" invalid TSX");
}
const view=fs.readFileSync("src/LektrusBioAlternativeView.tsx","utf8");
assert.match(view,/data-bio-alt-node=\{child\.id\}/,"SVG markers must carry actual scientific node IDs");
assert.match(view,/onKeyDown=\{e=>/,"Keyboard navigation missing");
assert.match(view,/species\.cycle\.map/,"Life cycles must be navigable");
const atlasView=fs.readFileSync("src/LektrusBioMicroscope.tsx","utf8");
assert.match(atlasView,/onExploreAlternative=\{exploreAlternative\}/);
assert.match(atlasView,/setAlternativeId\(null\);setAtlasOpen\(true\)/);
const taxonView=fs.readFileSync("src/LektrusBioTaxonomyBrowser.tsx","utf8");
assert.match(taxonView,/r\.microscopy\?/);
console.log("Biology variable-depth atlas:",ids.length,"species,",depths.length,"linked nodes, verified life-cycle stages and active taxon navigation OK");
