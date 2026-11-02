import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const src=fs.readFileSync("src/lektrusBioMicroscopeModel.ts","utf8");
const js=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const exports={};
new Function("exports",js)(exports);
const {BIO_LEVELS,BIO_ORGANISMS,bioNodes,bioAncestors,newBioMicroscope,withBioOrganism,validBioMicroscope}=exports;
assert.deepEqual(BIO_LEVELS,["organism","system","organ","tissue","cell"]);
for(const id of Object.keys(BIO_ORGANISMS)){
 const nodes=bioNodes(id);
 assert.ok(nodes.length>=12,id+": too few biological structures");
 assert.equal(nodes[0].id,id);
 assert.equal(new Set(nodes.map(n=>n.id)).size,nodes.length,"Unique paths");
 for(const node of nodes){
  assert.ok(node.name&&node.description,id+": missing details for "+node.id);
  const a=bioAncestors(nodes,node.id);
  assert.equal(a.at(-1),node);
  assert.equal(a.length,BIO_LEVELS.indexOf(node.level)+1,"Every layer must have its own ancestor");
 }
 const doc=withBioOrganism(newBioMicroscope(),id);
 assert.ok(validBioMicroscope(doc),id+" should be saveable on a board");
 assert.equal(doc.assignmentPath.length,5);
 for(const activity of ["explore","label","assemble"])
  assert.ok(validBioMicroscope({...doc,activity}));
 assert.equal(validBioMicroscope({...doc,assignmentPath:[id]}),false,
  "Invalid answer chain cannot be persisted");
}
assert.ok(bioNodes("human").some(n=>n.name==="Кардиомиоцит"));
assert.ok(bioNodes("cat").some(n=>n.name==="Палочка"));
assert.ok(bioNodes("sunflower").some(n=>n.name==="Корневой волосок"));
assert.ok(bioNodes("oak").some(n=>n.name==="Сосудистый элемент"));
const panel=fs.readFileSync("src/LektrusSubjectToolsPanel.tsx","utf8");
assert.match(panel,/"биология":\[\{title:"Биологический микроскоп",ids:\["bio-microscope"\]/);
const old=fs.readFileSync("src/lektrusSchoolDiagramModel.ts","utf8");
assert.match(old,/case "bio-microscope":return validBioMicroscope/);
assert.match(old,/case "bio-cell"/,"Legacy biology boards still validate");
const view=fs.readFileSync("src/LektrusSchoolDiagramView.tsx","utf8");
assert.match(view,/case "bio-microscope":return <LektrusBioMicroscope/);
console.log("Biology microscope: animal/plant hierarchies, 5 layers, tasks, saved legacy compatibility OK");
