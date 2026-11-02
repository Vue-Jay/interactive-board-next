import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
function load(file){
 const transpiled=ts.transpileModule(fs.readFileSync(file,"utf8"),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
 }).outputText;
 const exports={};
 new Function("exports","require",transpiled)(exports,(name)=>{
  if(name==="./lektrusBioAdditionalSpecimenPlates")
   return load("src/lektrusBioAdditionalSpecimenPlates.ts");
  throw new Error("Unexpected runtime import in model "+name);
 });
 return exports;
}
const bio=load("src/lektrusBioMicroscopeModel.ts");
const base=load("src/lektrusBioSpecimenPlates.ts");
const extra=load("src/lektrusBioAdditionalSpecimenPlates.ts");
const species=["sparrow","perch","frog","bee","snail","pine","fern","wheat"];
const extras=Object.values(extra.BIO_EXTRA_SPECIMEN_PLATES);
assert.equal(extras.length,32,"Expected sixteen distinct organ/tissue illustration pairs");
assert.equal(Object.keys(extra.BIO_EXTRA_SPECIMEN_PAIRS).length,16);
assert.equal(new Set(extras.map(x=>x.id)).size,extras.length);
for(const [kind,pair] of Object.entries(extra.BIO_EXTRA_SPECIMEN_PAIRS)){
 assert.equal(pair.length,2,kind+" needs an organ illustration and a tissue detail");
 const [organPlate,tissuePlate]=pair;
 assert.equal(organPlate.level,"organ");
 assert.equal(tissuePlate.level,"tissue");
 assert.equal(organPlate.kind,kind);
 assert.equal(tissuePlate.kind,kind);
 assert.equal(organPlate.organism,tissuePlate.organism);
 assert.equal(organPlate.source,tissuePlate.source);
 assert.notEqual(organPlate.id,tissuePlate.id);
 assert.ok(organPlate.title.length>12&&tissuePlate.title.length>12);
 assert.ok(organPlate.caption.length>60&&tissuePlate.caption.length>54);
 assert.match(organPlate.source,/^https:\/\//,"Source missing: "+kind);
}
let mapped=0;
for(const organism of species){
 const nodes=bio.bioNodes(organism);
 const byId=new Map(nodes.map(n=>[n.id,n]));
 const levels=nodes.filter(n=>n.level==="organ"||n.level==="tissue");
 assert.equal(levels.length,6,"Three organ→tissue chains per species "+organism);
 const all=levels.map(n=>base.bioSpecimenPlateFor(organism,n));
 assert.equal(all.filter(Boolean).length,6,"Every branch needs a custom anatomical illustration");
 assert.equal(new Set(all.map(p=>p.id)).size,6,"Same illustration ID reused across unrelated structures");
 assert.equal(all.filter(p=>p.level==="organ").length,3);
 assert.equal(all.filter(p=>p.level==="tissue").length,3);
 const additional=levels.map(n=>extra.bioExtraSpecimenPlateFor(organism,n)).filter(Boolean);
 assert.equal(additional.length,4,"Two extra organ/tissue pairs per organism: "+organism);
 for(const n of levels){
  const plate=base.bioSpecimenPlateFor(organism,n);
  assert.ok(plate&&plate.nodeName===n.name);
  assert.equal(plate.level,n.level);
  assert.equal(plate.organism,organism);
  const kids=bio.bioChildren(nodes,n.id);
  assert.equal(kids.length,1,n.id+" should lead to exactly one real tissue/cell");
  const child=kids[0];
  assert.equal(byId.get(child.id),child);
  assert.equal(child.parentId,n.id);
  assert.equal(child.level,n.level==="organ"?"tissue":"cell");
  const marker=base.bioSpecimenChildSpot(organism,n,child);
  assert.ok(marker&&marker.x>=90&&marker.x<=385&&marker.y>=88&&marker.y<=230,
    "Marker outside visible plate: "+n.id);
  assert.deepEqual(marker,plate.focus);
  assert.equal(base.bioSpecimenChildSpot(organism,n,nodes[0]),null,
   "Unrelated node must not inherit an anatomical focus marker");
  assert.ok(plate.caption.length>=55);
  assert.match(plate.source,/^https:\/\//);
  for(const other of species.filter(x=>x!==organism)){
   assert.equal(base.bioSpecimenPlateFor(other,n),null,"Never share anatomical plates across species");
  }
  mapped++;
 }
 for(const n of nodes.filter(n=>!["organ","tissue"].includes(n.level)))
  assert.equal(base.bioSpecimenPlateFor(organism,n),null,
   "Only organ and tissue nodes should use microscopic cross sections");
}
assert.equal(mapped,48,"All 24 organ and 24 tissue nodes must have own plate");
for(const organism of ["human","cat","sunflower","oak"]){
 for(const n of bio.bioNodes(organism)){
  assert.equal(extra.bioExtraSpecimenPlateFor(organism,n),null);
  assert.equal(base.bioSpecimenPlateFor(organism,n),null);
 }
}
const byKind=extra.BIO_EXTRA_SPECIMEN_PAIRS;
assert.match(byKind["sparrow-retina"][0].caption,/многослойную сетчатку/);
assert.match(byKind["perch-neuromast"][0].caption,/купула/);
assert.match(byKind["frog-lung"][0].caption,/без альвеолярного дерева/);
assert.match(byKind["bee-trachea"][0].caption,/спиральные утолщения/);
assert.match(byKind["snail-eye"][1].caption,/не подменяет их палочками и колбочками/);
assert.match(byKind["pine-root"][0].caption,/выросты отдельных живых клеток/);
assert.match(byKind["pine-microsporangium"][1].caption,/микроспороциты/);
assert.match(byKind["wheat-leaf"][0].caption,/параллельные проводящие пучки/);
const art=fs.readFileSync("src/LektrusBioAdditionalSpecimenArt.tsx","utf8");
for(const kind of Object.keys(byKind))
 assert.ok(art.includes('case "'+kind+'"'),"Missing individual SVG context "+kind);
assert.match(art,/data-bio-additional-specimen=\{kind\}/);
assert.match(art,/data-bio-level=\{tissue\?"tissue":"organ"\}/);
assert.match(art,/function SnailPhotoreceptorTissue/);
assert.match(art,/case "snail-eye":return tissue\?<SnailPhotoreceptorTissue\/>/);
assert.ok(!art.includes('case "snail-eye":return tissue?<RetinaLayers'));
assert.ok(!art.includes("<image"),"Vector drawings must work entirely offline");
const detail=fs.readFileSync("src/LektrusBioOrganDetail.tsx","utf8");
assert.match(detail,/bioExtraSpecimenPlateFor\(organism,node\)/);
assert.match(detail,/<LektrusBioAdditionalSpecimenArt kind=\{extra\.kind\} tissue=\{node\.level==="tissue"\}\/>/);
const scene=fs.readFileSync("src/LektrusBioAnatomyScene.tsx","utf8");
assert.match(scene,/bioSpecimenChildSpot\(organism,node,child\)\?\?bioChildSpot/);
const inspector=fs.readFileSync("src/LektrusBioMicroscope.tsx","utf8");
assert.match(inspector,/href=\{specimenPlate\.source\}/);
for(const filename of ["src/LektrusBioAdditionalSpecimenArt.tsx",
 "src/LektrusBioOrganDetail.tsx","src/LektrusBioAnatomyScene.tsx"]){
 const parsed=ts.createSourceFile(filename,fs.readFileSync(filename,"utf8"),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 assert.equal(parsed.parseDiagnostics.length,0,"Malformed SVG/TSX source: "+filename);
}
console.log("Biology anatomy: 48 real organ/tissue plates (32 added), sixteen distinct branches, exact child hotspots, tissue-to-cell navigation and scientific species isolation verified");
