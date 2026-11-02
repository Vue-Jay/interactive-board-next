import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";
const read=path=>readFileSync(path,"utf8");
function compile(source,filename,modules={}){
 const js=ts.transpileModule(source,{fileName:filename,compilerOptions:{
  module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022
 }}).outputText;
 const exports={};
 new Function("exports","require",js)(exports,id=>{
  if(Object.hasOwn(modules,id))return modules[id];
  throw Error("Unreviewed import "+id);
 });
 return exports;
}
const biology=compile(read("src/lektrusBioMicroscopeModel.ts"),"bio.ts");
const assembly=compile(read("src/lektrusBioAssemblyModel.ts"),"assembly.ts",{
 "./lektrusBioMicroscopeModel":biology
});
const {bioNodes,bioAncestors,BIO_ORGANISMS,validBioMicroscope,newBioMicroscope}=biology;
const {BIO_ASSEMBLY_LEVELS,bioAssemblyAnswer,bioAssemblyPalette,bioAssemblyEvaluate,
 bioAssemblyPlace,bioAssemblyRemove,bioAssemblyPathForSelection}=assembly;
assert.deepEqual(BIO_ASSEMBLY_LEVELS,["system","organ","tissue","cell"]);
const allSpecies=Object.keys(BIO_ORGANISMS);
for(const species of allSpecies){
 const nodes=bioNodes(species);
 const leaves=nodes.filter(n=>n.level==="cell");
 assert.ok(leaves.length>=3,"Each organism needs multiple coherent anatomy branches");
 for(const leaf of leaves){
  const path=bioAncestors(nodes,leaf.id).map(n=>n.id);
  assert.equal(path.length,5,"Atlas hierarchy must contain all four student slots");
  const answer=bioAssemblyAnswer(nodes,path);
  assert.equal(answer.length,5,"Teacher path must resolve");
  assert.equal(answer[0].id,species);
  assert.deepEqual(bioAssemblyPathForSelection(nodes,leaf.id),path);
  const palette=bioAssemblyPalette(nodes,path);
  assert.ok(palette.length>=8,"A valid task should contain meaningful decoys");
  assert.equal(new Set(palette.map(n=>n.id)).size,palette.length,"Palette tokens are unique");
  assert.ok(palette.length<=12,"Keep the bank comfortably small on a phone");
  assert.deepEqual(bioAssemblyPalette(nodes,path).map(n=>n.id),palette.map(n=>n.id),
   "Stable nonrandom order prevents collaborative view reshuffling");
  for(const node of answer.slice(1))assert.ok(palette.some(item=>item.id===node.id),
   "Every true answer must be present: "+node.id);
  assert.deepEqual(bioAssemblyEvaluate(nodes,path,{}).results,{
   system:"empty",organ:"empty",tissue:"empty",cell:"empty"
  });
  let placements={};
  for(const node of answer.slice(1)){
   const next=bioAssemblyPlace(nodes,placements,node.level,node.id);
   assert.ok(next,"A correct card must fit the matching slot");
   placements=next;
  }
  assert.equal(bioAssemblyEvaluate(nodes,path,placements).passed,true,
   "All 4 parent-child links must be correct");
  assert.equal(bioAssemblyEvaluate(nodes,path,placements).correct,4);
  const wrong=palette.find(n=>n.level==="organ"&&n.id!==answer[2].id);
  assert.ok(wrong,"Each branch must have a plausible wrong organ");
  const wrongPlacements=bioAssemblyPlace(nodes,placements,"organ",wrong.id);
  const evaluated=bioAssemblyEvaluate(nodes,path,wrongPlacements);
  assert.equal(evaluated.correct,3);
  assert.equal(evaluated.passed,false);
  assert.equal(evaluated.results.organ,"wrong",
   "An organ from another anatomy branch must never be accepted");
  assert.equal(bioAssemblyPlace(nodes,placements,"organ",answer[4].id),null,
   "A cell cannot be dropped in an organ slot");
  const other=allSpecies.find(name=>name!==species);
  const otherCell=bioNodes(other).find(n=>n.level==="cell");
  assert.equal(bioAssemblyPlace(nodes,placements,"cell",otherCell.id),null,
   "Reject valid-looking nodes from a different species");
  const removed=bioAssemblyRemove(placements,"tissue");
  assert.equal(bioAssemblyEvaluate(nodes,path,removed).complete,false);
  assert.equal(bioAssemblyEvaluate(nodes,path,removed).results.tissue,"empty");
  assert.equal(bioAssemblyEvaluate(nodes,path,placements).passed,true,
   "Immutable placement operations must not change the previous answer");
  const wrongOrder=[path[0],path[2],path[1],path[3],path[4]];
  assert.deepEqual(bioAssemblyAnswer(nodes,wrongOrder),[],
   "A correct list of names in the wrong ancestry order must not validate");
 }
}
assert.deepEqual(bioAssemblyAnswer(bioNodes("human"),["other"]),[]);
assert.equal(validBioMicroscope(newBioMicroscope()),true,
 "Existing teacher assignments remain valid without migration");
const component=read("src/LektrusBioAssemblyBoard.tsx");
const view=read("src/LektrusBioMicroscope.tsx");
const anatomy=read("src/LektrusBioAnatomyScene.tsx");
for(const [name,source] of [["BioAssemblyBoard",component],["BioMicroscope",view],["BioAnatomyScene",anatomy]]){
 const parsed=ts.createSourceFile(name+".tsx",source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 assert.equal(parsed.parseDiagnostics.length,0,"Broken TSX "+name);
}
for(const pattern of [
 /data-bio-drop-level=\{level\}/,
 /onPointerDown=\{e=>onDown\(e,node.id\)\}/,
 /onPointerMove=\{onMove\}/,
 /onPointerUp=\{onUp\}/,
 /elementFromPoint/,
 /onClick=\{e=>\{if\(e.detail===0\)choose\(node.id\);\}\}/,
 /bioAssemblyEvaluate\(nodes,path,placements\)/,
 /setPlacements\(\{\}\)/,
 /pointerEvents:none/
]){
 // The last selector is implemented in the CSS instead of the JSX.
 if(pattern.source==="pointerEvents:none")continue;
 assert.match(component,pattern,"Missing drag, touch, keyboard or evaluation mechanism");
}
assert.match(view,/diagram\.activity==="assemble"\?\s*<LektrusBioAssemblyBoard/,
 "Assembly must be a graphical activity, not the old multiple-choice form");
assert.match(view,/diagram\.activity!=="assemble"&&<div className="lektrus-bio-stage">/,
 "Do not display a second redundant anatomy viewport in assembly mode");
assert.match(anatomy,/focusChildId/, "Scene accepts an anatomical focus marker");
assert.match(component,/focusChildId=\{path\[1\]\}/,
 "Reference image highlights the exact branch from the teacher's path");
const css=read("src/lektrusBioMicroscope.css");
assert.match(css,/\.lektrus-bio-build-ghost\{[^}]*pointer-events:none/,
 "The moving card must not block the drop target underneath");
assert.match(css,/\.lektrus-bio-build-card\{[^}]*touch-action:none/,
 "Touch-screen drag must not trigger page scrolling");
assert.match(css,/@media\(max-width:720px\)/,
 "The visual workbench must collapse to a single column on phones");
console.log("Biology build exercises: all branches, decoys, touch/pointer/keyboard drop, validation and old board compatibility OK");
