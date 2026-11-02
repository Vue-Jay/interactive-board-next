import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const load=(path)=>{
 const source=fs.readFileSync(path,"utf8");
 const output=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};new Function("exports",output)(exports);return exports;
};
const bio=load("src/lektrusBioMicroscopeModel.ts");
const atlas=load("src/lektrusBioTaxonomy.ts");
const addition=["sparrow","perch","frog","bee","snail","pine","fern","wheat"];
assert.equal(Object.keys(bio.BIO_ORGANISMS).length,12);
for(const id of addition){
 const nodes=bio.bioNodes(id),root=nodes[0];
 assert.equal(root.level,"organism");
 assert.equal(root.id,id);
 assert.equal(new Set(nodes.map(n=>n.id)).size,nodes.length,id+" duplicate IDs");
 assert.ok(nodes.filter(n=>n.level==="system").length>=3,id+": too few independent atlas branches");
 const leafNodes=nodes.filter(n=>n.level==="cell");
 assert.equal(leafNodes.length,3,id+": expected three documented cellular branches");
 const catalog=atlas.bioTaxonForOrganism(id);
 assert.ok(catalog,"No class catalog entry for "+id);
 assert.equal(catalog.kingdom,bio.BIO_ORGANISMS[id].group);
 assert.ok(catalog.representatives.some(r=>r.anatomy===id&&r.scientific===bio.BIO_ORGANISMS[id].scientific));
 for(const leaf of leafNodes){
  const ancestors=bio.bioAncestors(nodes,leaf.id);
  assert.deepEqual(ancestors.map(n=>n.level),bio.BIO_LEVELS);
  assert.equal(ancestors.at(-1),leaf);
  assert.ok(leaf.description.trim().length>12);
  assert.ok(bio.bioCellFeatures(leaf).length>=3,id+" missing cell details: "+leaf.name);
  assert.ok(bio.validBioMicroscope({...bio.withBioOrganism(bio.newBioMicroscope(),id),
   assignmentPath:ancestors.map(n=>n.id)}),id+" saved anatomy chain invalid");
 }
 for(const node of nodes){
  const children=bio.bioChildren(nodes,node.id);
  assert.equal(new Set(children.map(n=>n.id)).size,children.length);
  children.forEach((child,i)=>{
   const pt=bio.bioChildSpot(id,node,child,i,children.length);
   assert.ok(Number.isFinite(pt.x)&&pt.x>=25&&pt.x<=455&&Number.isFinite(pt.y)&&pt.y>=25&&pt.y<=310,
    "Hotspot outside anatomy image: "+child.id);
  });
  assert.equal(new Set(children.map((child,i)=>{
   const pt=bio.bioChildSpot(id,node,child,i,children.length);return pt.x+":"+pt.y;
  })).size,children.length,"Hotspots overlap for "+node.id);
  if(node.source)assert.ok(node.source.url.startsWith("https://"));
 }
}
for(const [species,cell,expected] of [
 ["perch","Волосковая клетка","lateral-line"],
 ["perch","Эпителиальная клетка ламеллы","gills"],
 ["bee","Трахейная эпителиальная клетка","trachea"],
 ["bee","Рабдомерный фоторецептор","compound-eye"],
 ["snail","Гладкий миоцит","foot"],
 ["pine","Микроспороцит","microsporangium"],
 ["fern","Материнская клетка спор","sporangium"],
 ["wheat","Клетка тапетума","anther"]
]){
 const node=bio.bioNodes(species).find(n=>n.name===cell);
 assert.ok(node,species+" "+cell+" not found");
 assert.equal(bio.bioVisualKey(node),expected,"Wrong diagram for "+cell);
}
for(const species of ["sparrow","perch","frog","bee","snail","pine","fern","wheat"]){
 const source=fs.readFileSync("src/LektrusBioSpeciesArt.tsx","utf8");
 assert.match(source,new RegExp('case "'+species+'"'),"Missing silhouette "+species);
}
for(const path of ["src/LektrusBioSpeciesArt.tsx","src/LektrusBioAnatomyScene.tsx"]){
 const source=fs.readFileSync(path,"utf8");
 const parsed=ts.createSourceFile(path,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 assert.equal(parsed.parseDiagnostics.length,0,path+" malformed TSX");
}
const art=fs.readFileSync("src/LektrusBioSpeciesArt.tsx","utf8");
assert.match(art,/node.level==="tissue"/);
assert.match(art,/node.level==="organ"/);
const scene=fs.readFileSync("src/LektrusBioAnatomyScene.tsx","utf8");
assert.match(scene,/<LektrusBioSpeciesArt organism=\{organism\} node=\{node\}\/>/);
const saved=bio.bioNodes("sunflower");
assert.equal(saved.find(n=>n.id.endsWith("/корневой-волосок")).id,
 "sunflower/корневая-система/корень/ризодерма/корневой-волосок",
 "Legacy node IDs must remain stable");
console.log("Biology extended:",addition.length,"new species, 12 complete example organisms, 24 additional cell paths, matching diagrams and saved IDs OK");
