import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const load=(file)=>{
 const source=fs.readFileSync(file,"utf8");
 const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};new Function("exports",js)(exports);return exports;
};
const bio=load("src/lektrusBioMicroscopeModel.ts");
const expected={
 earthworm:["cuticle","nephrostome","typhlosole"],
 seastar:["podia","pyloric","ossicles"],
 crayfish:["gill","green-gland","muscle"],
 horsetail:["chlorenchyma","stoma","spores"],
 lizard:["keratin","foveola","cone"],
 spider:["book-lung","silk-gland","rhabdomere"],
 clubmoss:["microphyll","sporangium","rhizodermis"],
 magnolia:["mesophyll","tapetum","stigma"]
};
const art=fs.readFileSync("src/LektrusBioLineageMicroscopy.tsx","utf8");
const file=ts.createSourceFile("src/LektrusBioLineageMicroscopy.tsx",art,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
assert.equal(file.parseDiagnostics.length,0,"Anatomical cutaways must parse as valid TSX");
const kinds=Object.values(expected).flat();
assert.equal(new Set(kinds).size,24,"24 specific histological families expected");
assert.match(art,/data-bio-lineage-micro=\{kind\}/);
assert.match(art,/data-bio-lineage-level=\{level\}/);

const spotSection=art.slice(art.indexOf("const featureSpots:"),art.indexOf("export function lineageMicroSpots"));
assert.match(art,/lineageMicroSpots\(organism:Species,branch:number\):Three/);
let counted=0;
for(const kind of kinds){
 const coords=new RegExp('\\[\\{x:\\d+,y:\\d+\\},\\{x:\\d+,y:\\d+\\},\\{x:\\d+,y:\\d+\\}\\]','g');
 const groups=spotSection.match(coords)??[];
 assert.equal(groups.length,24,"Each anatomy branch needs three specific non-overlapping structure points");
 for(const group of groups){
  const pairs=[...group.matchAll(/x:(\d+),y:(\d+)/g)].map(x=>({x:Number(x[1]),y:Number(x[2])}));
  assert.equal(pairs.length,3);
  assert.ok(pairs.every(p=>p.x>25&&p.x<455&&p.y>65&&p.y<310));
  assert.equal(new Set(pairs.map(x=>x.x+":"+x.y)).size,3);
  counted++;
 }
 break;
}
assert.equal(counted,24);

assert.match(art,/data-bio-lineage-species=\{organism\}/);
for(const kind of kinds){
 assert.match(art,new RegExp('case "'+kind+'":'),"No detailed anatomy switch for "+kind);
}
assert.match(art,/Спороцит 2n/,"Sporocytes are diploid prior to meiosis");
assert.match(art,/НЕ человеческие альвеолы/,"Reptile lung must not be represented as mammalian alveoli");
assert.match(art,/Ламеллы с гемолимфой/,"Spider book lungs must not be confused with insect trachea");
assert.match(art,/Тифлозоль/,"Earthworm intestines do not have mammalian villi");
assert.match(art,/Спорофилл/,"Clubmoss produces spores, not seeds");
assert.match(art,/case "rhizodermis":return <g><Plant cell=\{cell\} photosynthetic=\{false\}\/>/,"Root epidermis must not display chloroplasts");
let branches=0;
for(const [species,keys] of Object.entries(expected)){
 const nodes=bio.bioNodes(species);
 const systems=bio.bioChildren(nodes,species);
 assert.equal(systems.length,3,species+" should have three illustrated organ systems");
 assert.equal(keys.length,3);
 systems.forEach((system,branch)=>{
  const chain=[system];
  while(chain.at(-1).level!=="cell"){
   const children=bio.bioChildren(nodes,chain.at(-1).id);
   assert.equal(children.length,1,"Broken specimen branch: "+chain.at(-1).id);
   chain.push(children[0]);
  }
  assert.deepEqual(chain.map(n=>n.level),["system","organ","tissue","cell"]);
  const [,,tissue,cell]=chain;
  assert.equal(bio.bioCellFeatures(cell).length,3,"Inspectable features lost for "+cell.id);
  const all=bio.bioAncestors(nodes,cell.id);
  assert.deepEqual(all.map(n=>n.level),bio.BIO_LEVELS);
  assert.ok(bio.validBioMicroscope({...bio.withBioOrganism(bio.newBioMicroscope(),species),assignmentPath:all.map(n=>n.id)}));
  assert.match(art,new RegExp('"'+keys[branch]+'"'),"Anatomy kind mapping missing: "+species+"/"+branch);
  branches++;
 });
}
assert.equal(branches,24);
const newLineages=fs.readFileSync("src/LektrusBioNewSpeciesArt.tsx","utf8");
const further=fs.readFileSync("src/LektrusBioFurtherSpeciesArt.tsx","utf8");
for(const src of [newLineages,further]){
 assert.match(src,/import LektrusBioLineageMicroscopy,\{lineageMicroSpots\} from "\.\/LektrusBioLineageMicroscopy"/);
 assert.match(src,/node\.level==="tissue"\|\|node\.level==="cell"/);
 assert.match(src,/<LektrusBioLineageMicroscopy organism=\{organism\}/);
 assert.match(src,/lineageMicroSpots\(organism,/,"Each taxon needs anatomical feature placement");
 assert.match(src,/aria-pressed=\{selectedFeature===/,"Cell inspection controls must remain present");
 assert.match(src,/onKeyDown=\{e=>\{if\(e.key==="Enter"\|\|e.key===" "\)/,"Keyboard accessible hotspots required");
}
const scene=fs.readFileSync("src/LektrusBioAnatomyScene.tsx","utf8");
assert.match(scene,/isBioNewOrganism\(organism\)/);
assert.match(scene,/isBioFurtherOrganism\(organism\)/);
const microscope=fs.readFileSync("src/LektrusBioUnifiedZoom.tsx","utf8");
assert.match(microscope,/bioZoomPath\(nodes,current.id\)/,"The same microscope camera and saved atlas graph remain in use");
assert.ok(!art.includes("<image"),"Cutaways must stay usable offline");
console.log("Detailed biology: 8 lineages, 24 anatomy branches, 48 tissue/cell plates, unchanged saved paths and accessible cell features OK.");
