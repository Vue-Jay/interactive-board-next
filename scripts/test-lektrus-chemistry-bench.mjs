import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const load=(path,requireFn=()=>{throw Error("Unexpected import")})=>{
 const js=ts.transpileModule(read(path),{compilerOptions:{
  target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS
 }}).outputText;
 const exports={};
 new Function("require","exports",js)(requireFn,exports);
 return exports;
};
const reaction=load("src/lektrusReactionDatabase.ts");
const lab=load("src/lektrusChemistryBenchModel.ts",key=>{
 assert.equal(key,"./lektrusReactionDatabase");return reaction;
});
let bench=lab.defaultLabBench();
assert.equal(bench.vessels.length,1,"New lab starts with a single empty beaker");
assert.equal(bench.selectedId,"v1");
bench=lab.addLabVessel(bench,"tube");
assert.equal(bench.vessels.length,2,"Additional test tube sits on same bench");
assert.equal(bench.selectedId,"v2");
bench=lab.putLabReagent(bench,"v1","NaCl");
bench=lab.putLabReagent(bench,"v2","AgNO3");
assert.equal(lab.labObservation(bench.vessels[0]).status,"unknown","Unmixed solutions are not reacted");
assert.equal(lab.labObservation(bench.vessels[1]).status,"unknown");
bench=lab.pourLabVessel(bench,"v2","v1");
assert.equal(lab.labObservation(bench.vessels[0]).status,"reaction","Mixing triggers curated precipitation");
assert.equal(lab.labObservation(bench.vessels[0]).caseData.observation,"precipitate");
assert.equal(bench.vessels[1].reagents.length,0,"Transferred container is empty");
assert.deepEqual(bench.vessels[0].reagents,["NaCl","AgNO3"]);
let unknown=lab.putLabReagent(bench,"v1","HCl");
assert.equal(lab.labObservation(unknown.vessels[0]).status,"unknown",
 "Second-stage products cannot be predicted from original reactant IDs");
let heated=lab.defaultLabBench();
heated=lab.putLabReagent(heated,"v1","CaCO3");
assert.equal(lab.labObservation(heated.vessels[0]).status,"unknown");
heated=lab.setLabEnvironment(heated,"v1","heated");
assert.equal(lab.labObservation(heated.vessels[0]).status,"reaction",
 "Heating single validated reactant initiates decomposition");
assert.equal(lab.labObservation(heated.vessels[0]).caseData.observation,"gas");
let noReaction=lab.defaultLabBench();
noReaction=lab.putLabReagent(noReaction,"v1","NaCl");
noReaction=lab.putLabReagent(noReaction,"v1","KNO3");
assert.equal(lab.labObservation(noReaction.vessels[0]).status,"none");
let gas=lab.defaultLabBench();
gas=lab.putLabReagent(gas,"v1","NaHCO3");
gas=lab.putLabReagent(gas,"v1","HCl");
assert.equal(lab.labObservation(gas.vessels[0]).caseData.observation,"gas");
const invalidPour=lab.pourLabVessel(gas,"v1","v1");
assert.deepEqual(invalidPour,gas,"Cannot pour into the same container");
let full=lab.defaultLabBench();
for(let i=0;i<9;i++)full=lab.addLabVessel(full,"flask");
assert.equal(full.vessels.length,lab.MAX_BENCH_VESSELS,"Glassware is bounded");
assert.equal(new Set(full.vessels.map(v=>v.id)).size,full.vessels.length);
full=lab.positionLabVessel(full,"v1",-500,500);
assert.equal(full.vessels[0].x,10);assert.equal(full.vessels[0].y,90);
let indicatorBench=lab.defaultLabBench();
assert.equal(lab.setLabIndicator(indicatorBench,"v1","litmus"),indicatorBench,
 "Indicators cannot be inserted into empty glassware");
indicatorBench=lab.putLabReagent(indicatorBench,"v1","HCl");
indicatorBench=lab.setLabIndicator(indicatorBench,"v1","litmus");
assert.equal(lab.labIndicatorResult(indicatorBench.vessels[0]).medium,"acid");
assert.equal(lab.labIndicatorResult(indicatorBench.vessels[0]).color,"#d85761");
indicatorBench=lab.emptyLabVessel(indicatorBench,"v1");
assert.equal(indicatorBench.vessels[0].indicator,undefined,"Cleaning also removes indicator");
indicatorBench=lab.putLabReagent(indicatorBench,"v1","NaOH");
indicatorBench=lab.setLabIndicator(indicatorBench,"v1","phenolphthalein");
assert.equal(lab.labIndicatorResult(indicatorBench.vessels[0]).medium,"base");
assert.equal(lab.labIndicatorResult(indicatorBench.vessels[0]).color,"#d83a96");
let neutral=lab.putLabReagent(lab.defaultLabBench(),"v1","H2O");
neutral=lab.setLabIndicator(neutral,"v1","universal");
assert.equal(lab.labIndicatorResult(neutral.vessels[0]).medium,"neutral");
let salt=lab.putLabReagent(lab.defaultLabBench(),"v1","NaCl");
salt=lab.setLabIndicator(salt,"v1","universal");
assert.equal(lab.labIndicatorResult(salt.vessels[0]).medium,"unknown",
 "The model must not infer pH from an unspecified salt solution");
let transferred=lab.addLabVessel(neutral,"tube");
transferred=lab.pourLabVessel(transferred,"v1","v2");
assert.equal(transferred.vessels[0].indicator,undefined,"Empty source has no indicator");
assert.equal(transferred.vessels[1].indicator,"universal","Indicator travels with solution");
let mixed=lab.addLabVessel(indicatorBench,"flask");
mixed=lab.putLabReagent(mixed,mixed.selectedId,"HCl");
mixed=lab.pourLabVessel(mixed,mixed.selectedId,"v1");
assert.equal(lab.labIndicatorResult(mixed.vessels[0]).medium,"unknown",
 "Neutralisation cannot give an exact indicator colour without quantities");
let precip=lab.defaultLabBench();
precip=lab.putLabReagent(precip,"v1","NaCl",{value:12,unit:"ml"});
precip=lab.addLabVessel(precip,"tube");
precip=lab.putLabReagent(precip,"v2","AgNO3",{value:7,unit:"ml"});
precip=lab.pourLabVessel(precip,"v2","v1");
assert.equal(lab.labObservation(precip.vessels[0]).caseData.observation,"precipitate");
precip=lab.addLabVessel(precip,"flask");
const decanted=lab.pourLabVessel(precip,"v1","v3");
assert.equal(lab.labObservation(decanted.vessels[2]).status,"reaction",
 "Previously reacted material stays visibly reacted after pouring into clean glassware");
assert.equal(lab.labObservation(decanted.vessels[2]).caseData.observation,"precipitate");
assert.ok(decanted.vessels[2].completedReaction,"The verified result is preserved separately from reactant IDs");
assert.equal(decanted.vessels[2].doses.NaCl.value,12);
assert.equal(decanted.vessels[2].doses.AgNO3.value,7);
assert.equal(decanted.vessels[0].completedReaction,undefined,"Emptied source loses its products");
const postReaction=lab.putLabReagent(decanted,"v3","HCl",{value:5,unit:"ml"});
assert.equal(lab.labObservation(postReaction.vessels[2]).status,"unknown",
 "Further transformation of spent mixture must not be invented");
assert.ok(postReaction.vessels[2].completedReaction,"Previously precipitated solid should remain visible as last known appearance");
const cleaned=lab.emptyLabVessel(postReaction,"v3");
assert.equal(cleaned.vessels[2].completedReaction,undefined,"Sink removes all products");
const stored=lab.removeLabVessel(cleaned,"v3");
assert.equal(stored.vessels.length,2,"Only cleaned glassware returns to cupboard");
assert.equal(lab.removeLabVessel(decanted,"v3"),decanted,"A filled flask cannot be stored before draining");
const settings=lab.setLabBenchSettings(lab.defaultLabBench(),{showEquationBoard:true,animateEffects:false});
assert.equal(lab.labBenchSettings(settings).showEquationBoard,true);
assert.equal(lab.labBenchSettings(settings).animateEffects,false);
const palette=load("src/lektrusLabAppearance.ts",key=>{
 assert.equal(key,"./lektrusReactionDatabase");return reaction;
});
assert.equal(palette.reagentAppearance("CuSO4").color,"#61a9d3");
assert.equal(palette.reagentAppearance("FeCl3").color,"#e1b66d");
assert.equal(palette.reagentAppearance("NaCl").phase,"solution");
assert.equal(palette.reagentAppearance("CuO").phase,"solid");
for(const substance of reaction.substances)
 assert.ok(palette.reagentAppearance(substance.id).color,
  "Every catalogued reagent must have a representative appearance");
const base=lab.defaultLabBench();
const left=lab.putLabReagent(base,"v1","HCl");
const right=lab.addLabVessel(base,"flask");
const merged=lab.mergeLabBench(base,left,right);
assert.ok(merged.vessels.some(v=>v.kind==="flask"),"Peer added glassware survives");
assert.ok(merged.vessels.some(v=>v.reagents.includes("HCl")),"Local reagent addition survives");
assert.deepEqual(lab.readLabBench({scienceReagents:["NaCl"],scienceEnvironment:"aqueous",
 scienceExperimentStage:0}).vessels[0].reagents,["NaCl"],"Older experiment data migrate");
for(const p of ["src/LektrusChemistryBench.tsx","src/LektrusChemistryBenchEditor.tsx",
 "src/LektrusScienceEditor.tsx","src/LektrusChemistryIllustration.tsx"]){
 const source=ts.createSourceFile(p,read(p),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 assert.equal(source.parseDiagnostics.length,0,p+" has invalid TSX");
}
const editor=read("src/LektrusChemistryBenchEditor.tsx");
assert.match(editor,/onPour=\{pour\}/);
assert.match(editor,/onDropReagent=\{addReagent\}/);
assert.match(read("src/LektrusChemistryBench.tsx"),/addLabVessel/);
assert.match(editor,/setLabEnvironment/);
assert.match(read("src/LektrusChemistryBench.tsx"),/lektrus-lab-modal-reagents/);
assert.match(read("src/LektrusChemistryBench.tsx"),/lektrus-lab-glass-cupboard/);
assert.match(read("src/LektrusChemistryBench.tsx"),/lektrus-lab-sink/);
assert.match(read("src/LektrusChemistryBench.tsx"),/lektrus-lab-chalkboard/);
assert.match(read("src/LektrusChemistryBench.tsx"),/lektrus-lab-modal-settings/);
assert.match(editor,/labIndicatorResult/);
assert.match(editor,/setLabIndicator/);
const app=read("src/App.tsx");
assert.match(app,/liveChemistryBenchUpdate/);
assert.match(app,/mergeLabBench\(/);
assert.match(app,/onExperimentLiveChange=\{/);
assert.match(app,/onLabBenchChange=\{/,"On-board glassware can be moved without reopening the editor");
assert.match(read("src/LektrusChemistryIllustration.tsx"),/editable=\{!!onBenchChange\}/,
 "On-board chemistry table enables direct vessel interaction when permitted");
assert.match(read("src/LektrusChemistryBench.tsx"),/targetAt\(/,
 "Dragging a filled vessel over another triggers the transfer target");
assert.match(read("src/LektrusChemistryIllustration.tsx"),/onPour=\{onBenchChange\?pour:undefined\}/,
 "On-board laboratory can pour mixtures without opening an editor");
assert.doesNotMatch(read("src/LektrusChemistryIllustration.tsx"),/lektrus-lab-board-controls/,
 "The old bottom toolbar must not overlay the interactive bench");
assert.match(read("src/LektrusChemistryBench.tsx"),/data-board-interactive="true"/,
 "Glassware gestures do not drag the surrounding board object");
assert.match(read("src/lektrusSciencePresets.ts"),/x:x-410,y:y-250,text:"Химический стол"/,
 "Bench must be centered under the insertion cursor");

const model=read("src/boardModel.ts");
assert.match(model,/"scienceLabBench"/);
assert.match(model,/Повреждено состояние химического стола/);
assert.match(read("src/main.tsx"),/lektrusChemistryBench\.css/);
assert.match(read("src/lektrusChemistryBench.css"),/prefers-reduced-motion:reduce/);
console.log("Virtual chemistry bench: glassware, mixing, curated results, heating, persistence and peer merge passed");
