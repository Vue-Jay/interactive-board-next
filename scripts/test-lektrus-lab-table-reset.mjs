/** The teacher's clear/kit action must not be undone by a late evaporation
 * tick, a stale fullscreen editor, or the board version-conflict rebase.
 * The cabinet remains UI-local across rerenders/remounts of the surface.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
const loadCache=new Map();
function load(file){
 const resolved=path.resolve(file);
 if(loadCache.has(resolved))return loadCache.get(resolved).exports;
 const mod={exports:{}};loadCache.set(resolved,mod);
 const js=ts.transpileModule(fs.readFileSync(resolved,"utf8"),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2023}
 }).outputText;
 new Function("require","module","exports",js)(name=>{
  if(!name.startsWith("."))throw Error("Unexpected "+name);
  return load(path.resolve(path.dirname(resolved),name+".ts"));
 },mod,mod.exports);
 return mod.exports;
}
const read=path=>fs.readFileSync(path,"utf8");
const lab=load("src/lektrusChemistryBenchModel.ts");
const kits=load("src/lektrusLabExperimentKits.ts");
const reaction=load("src/lektrusReactionDatabase.ts");
const boardMerge=load("src/lektrusBoardThreeWayMerge.ts");
const old=lab.defaultLabBench();
const oldWithEquipment=lab.addPlacedLabDevice(lab.addLabVessel(
 lab.putLabReagent(old,"v1","H2O",{value:30,unit:"ml"}),"flask"),"burner");
const heatingTick={...oldWithEquipment,
 vessels:oldWithEquipment.vessels.map(v=>({...v,temperatureC:80})),
 event:oldWithEquipment.event+1,simulationAtMs:30000};
const cleared=lab.clearLabTable(oldWithEquipment);
assert.notEqual(cleared,oldWithEquipment);
assert.ok(cleared.tableEpoch);
assert.equal(cleared.vessels.length,0);
assert.equal(cleared.placedDevices.length,0);
assert.equal(cleared.selectedId,"");
assert.equal(cleared.simulationAtMs,undefined);
assert.equal(lab.clearLabTable(cleared),cleared,
 "A second clear of an empty table must be a no-op");
assert.strictEqual(lab.mergeLabBench(oldWithEquipment,heatingTick,cleared),cleared,
 "An old thermal step cannot re-create a cleared tabletop");
assert.strictEqual(lab.mergeLabBench(oldWithEquipment,cleared,heatingTick),cleared,
 "A locally cleared tabletop must win against a late server heat revision");
assert.equal(lab.labSimulationTickWaitMs(cleared,30001),null,
 "Clearing equipment must stop the simulation clock");
// If a collaborator removes a vessel, even an unrelated local heating update
// to it must not put it back. Older boards without epochs need this guarantee.
const justOne={...oldWithEquipment,
 vessels:oldWithEquipment.vessels.filter(v=>v.id!=="v2")};
const accidentallyHeated=lab.mergeLabBench(oldWithEquipment,heatingTick,justOne);
assert.ok(accidentallyHeated.vessels.every(v=>v.id!=="v2"),
 "Peer vessel deletion wins over old temperature changes");

const caseData=reaction.reviewedReactionCases.find(row=>
 row.status==="reaction"&&row.environment==="aqueous"&&
 row.reactants.includes("AgNO3")&&row.reactants.includes("NaCl"));
assert.ok(caseData,"Test requires a known school precipitation example");
const prepared=kits.prepareLabExperimentKit(oldWithEquipment,caseData);
assert.notEqual(prepared.tableEpoch,oldWithEquipment.tableEpoch);
assert.ok(prepared.vessels.every(v=>v.reagents.length===1));
assert.deepEqual(lab.mergeLabBench(oldWithEquipment,heatingTick,prepared).vessels,
 prepared.vessels,
 "A late heating tick cannot overwrite the new experiment kit");
const secondClear=lab.clearLabTable(prepared);
assert.notEqual(secondClear.tableEpoch,prepared.tableEpoch);
assert.equal(lab.mergeLabBench(prepared,prepared,secondClear).vessels.length,0);

// A contested full-board server save needs the same chemical merger;
// the generic geometry-array merge would restore the removed beaker.
const wrap=bench=>({
 id:"chem1",kind:"graph",graphFigureId:"chem-experiment-free",
 x:0,y:0,width:650,height:420,text:"",scienceLabBench:bench
});
const base=[wrap(oldWithEquipment)],localTick=[wrap(heatingTick)];
const remoteClear=[wrap(cleared)];
const rebased=boardMerge.mergeBoardItems(base,localTick,remoteClear);
assert.equal(rebased[0].scienceLabBench.vessels.length,0,
 "Remote clear must survive a competing saved evaporation snapshot");
const localClear=boardMerge.mergeBoardItems(base,remoteClear,localTick);
assert.equal(localClear[0].scienceLabBench.vessels.length,0,
 "A local clear must survive a competing remote evaporation snapshot");
const remoteKit=boardMerge.mergeBoardItems(base,localTick,[wrap(prepared)]);
assert.deepEqual(remoteKit[0].scienceLabBench.vessels,prepared.vessels);
const doc=items=>({version:1,title:"School lab",view:{x:0,y:0,zoom:1},
 background:"#fff",backgroundShared:true,items,ink:[]});
const documentRebase=boardMerge.mergeBoardDocumentEdits(
 doc(base),doc(localTick),doc(remoteClear));
assert.equal(documentRebase.items[0].scienceLabBench.vessels.length,0,
 "An actual board-document conflict must not restore old chemistry");
const editor=read("src/LektrusChemistryBenchEditor.tsx");
const surface=read("src/LektrusChemistryBench.tsx");
const illustration=read("src/LektrusChemistryIllustration.tsx");
const app=read("src/App.tsx");
assert.match(surface,/openLabCabinets\.get\(cabinetSessionKey\)/,
 "A rerender/remount must retain an open reagent cupboard");
assert.match(surface,/openLabCabinets\.delete\(cabinetSessionKey\)/,
 "Explicit cupboard close must clear the local UI state");
assert.match(editor,/cabinetSessionKey=\{cabinetSessionKey\}/);
assert.match(editor,/clearLabCabinetSession\(cabinetSessionKey\)/,
 "Only explicit editor exit clears its cupboard UI session");
assert.match(illustration,/cabinetSessionKey=\{"board:"\+item\.id\}/);
assert.match(app,/simulationOnly&&readLabBench\(before\)\.tableEpoch!==readLabBench\(latest\)\.tableEpoch/,
 "Full-screen stale simulation callbacks cannot update a reset table");
assert.match(app,/simulationOnly&&readLabBench\(item\)\.tableEpoch!==readLabBench\(latest\)\.tableEpoch/,
 "Inline stale simulation callbacks cannot update a reset table");
const boardModel=read("src/boardModel.ts");
assert.match(boardModel,/bench\.tableEpoch\.length>45/);
for(const filename of ["src/LektrusChemistryBench.tsx",
 "src/LektrusChemistryBenchEditor.tsx","src/LektrusChemistryIllustration.tsx",
 "src/App.tsx"]){
 const file=ts.createSourceFile(filename,read(filename),ts.ScriptTarget.Latest,true,
 ts.ScriptKind.TSX);
 assert.equal(file.parseDiagnostics.length,0,filename+" must parse cleanly");
}
console.log("Lab cabinet preservation, clearing, replacement and stale simulation conflicts: OK");
