import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const src=(path)=>fs.readFileSync(path,"utf8");
const load=(path)=>{
 const text=src(path);
 const module=ts.transpileModule(text,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};new Function("exports",module)(exports);return exports;
};
const model=load("src/lektrusBioMicroscopeModel.ts");
const detail=load("src/lektrusBioRepresentativeMicroplates.ts");
const all=detail.BIO_REPRESENTATIVE_MICRO_PLATES;
const species=["sparrow","perch","frog","bee","snail","pine","fern","wheat"];
assert.deepEqual(detail.BIO_REPRESENTATIVE_IDS,species);
assert.equal(all.length,48,"Eight real organisms × three branches × tissue + cell");
assert.equal(new Set(all.map(p=>p.organism+":"+p.level+":"+p.name)).size,48);
assert.equal(new Set(all.map(p=>p.kind)).size,24);
const plants=new Set(["pine","fern","wheat"]);
const found=new Set();
for(const organism of species){
 const nodes=model.bioNodes(organism);
 const systems=model.bioChildren(nodes,organism);
 assert.equal(systems.length,3,"Exactly three representative systems in "+organism);
 let tissue=0,cell=0;
 for(const node of nodes){
  const isDeep=node.level==="tissue"||node.level==="cell";
  const plate=detail.bioRepresentativeMicroFor(organism,node);
  if(!isDeep){assert.equal(plate,null,"Never replace full organism, system or organ");continue;}
  assert.ok(plate,"Missing exact species histology for "+node.id);
  assert.equal(plate.name,node.name);
  assert.equal(plate.organism,organism);
  assert.equal(plate.level,node.level);
  assert.equal(plate.note.length>35,true);
  assert.ok(plate.branch>=0&&plate.branch<=2);
  const rootBranch=model.bioAncestors(nodes,node.id)[1];
  assert.equal(rootBranch.id,systems[plate.branch].id,"Drawing must map to correct biological system");
  found.add(organism+":"+plate.kind+":"+plate.level);
  if(node.level==="tissue")tissue++;
  else {
   cell++;
   const facts=model.bioCellFeatures(node);
   assert.equal(facts.length,3,"Cell inspector must preserve three real structures: "+node.id);
   const ancestors=model.bioAncestors(nodes,node.id);
   assert.deepEqual(ancestors.map(x=>x.level),model.BIO_LEVELS);
   assert.ok(model.validBioMicroscope({...model.withBioOrganism(model.newBioMicroscope(),organism),assignmentPath:ancestors.map(x=>x.id)}));
  }
 }
 assert.equal(tissue,3);assert.equal(cell,3);
 for(const node of nodes.filter(n=>n.level==="cell"))for(const other of species.filter(o=>o!==organism))
  assert.equal(detail.bioRepresentativeMicroFor(other,node),null,"No borrowed cell art across species");
 assert.equal(plants.has(organism),model.BIO_ORGANISMS[organism].group==="plant");
}
assert.equal(found.size,48);
const pictures=src("src/LektrusBioRepresentativeMicroArt.tsx");
const tsx=ts.createSourceFile("src/LektrusBioRepresentativeMicroArt.tsx",pictures,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
assert.equal(tsx.parseDiagnostics.length,0,"Detailed histology TSX parse errors");
for(const kind of new Set(all.map(p=>p.kind)))
 assert.ok(pictures.includes('case "'+kind+'"'),"Missing dedicated illustrative family: "+kind);
for(const safety of [
 "Парабронхи","Кератин","Купула","невромаста","хитиновая",
 "Волосков","Митохондр","микроспоры", "тапетум"
]){
 const mapSrc=src("src/lektrusBioRepresentativeMicroplates.ts");
 // Descriptions are biology-first, not decorative decoration.
 assert.ok(mapSrc.toLocaleLowerCase("ru").includes(safety.toLocaleLowerCase("ru")),"Need explanatory biology: "+safety);
}
assert.match(pictures,/case "pine-needle-mesophyll":if\(cell\)return <g>/,
 "An intracellular picture cannot contain a resin canal");
assert.match(pictures,/case "pine-rhizodermis":case "wheat-rhizodermis":return <g>/);
assert.match(pictures,/<PlantCell x=\{x\} y=\{137\} w=\{w\} h=\{139\} chlor=\{false\}\/>/);
assert.match(pictures,/case "snail-foot-muscle":return <g>/,"Snail foot must be smooth, never striated skeletal muscle");
assert.match(pictures,/case "bee-rhabdom":return <g>/);
assert.match(pictures,/case "fish-neuromast":return <g>/);
assert.match(pictures,/data-bio-representative-micro=\{plate.kind\}/);
assert.match(pictures,/data-bio-representative-level=\{plate.level\}/);
assert.ok(!pictures.includes("<image"),"Completely offline SVG drawings");
const organs=src("src/LektrusBioOrganDetail.tsx");
const cells=src("src/LektrusBioCellDetail.tsx");
assert.match(organs,/node.level==="tissue"\?bioRepresentativeMicroFor\(organism,node\):null/);
assert.match(organs,/representative\?<LektrusBioRepresentativeMicroArt plate=\{representative\}\/>/);
assert.match(cells,/const representative=bioRepresentativeMicroFor\(organism,node\)/);
assert.match(cells,/representative\?<LektrusBioRepresentativeMicroArt plate=\{representative\}\/>/);
assert.match(cells,/Object.entries\(plate.landmarks\)/,"Keep 72 existing positioned feature hotspots");
assert.match(cells,/onKeyDown=\{e=>\{/);
for(const file of ["src/lektrusBioRepresentativeMicroplates.ts","src/LektrusBioOrganDetail.tsx","src/LektrusBioCellDetail.tsx"]){
 const text=src(file),parsed=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,file.endsWith(".tsx")?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 assert.equal(parsed.parseDiagnostics.length,0,"Source must parse: "+file);
}
console.log("Eight representative organisms: 24 anatomically differentiated families, 48 tissue/cell plates and all 72 existing cell features PASS.");
