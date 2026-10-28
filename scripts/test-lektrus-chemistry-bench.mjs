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
const titration=load("src/lektrusLabTitration.ts");
const lab=load("src/lektrusChemistryBenchModel.ts",key=>{
 if(key==="./lektrusLabTitration")return titration;
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
assert.equal(unknown.vessels[0].completedReaction?.observation,"precipitate",
 "Existing precipitate must stay visually represented even when later chemistry is unknown");
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
let devices=lab.defaultLabBench();
for(const device of lab.labDevices)devices=lab.toggleLabDevice(devices,device.id);
assert.equal(devices.devices.length,5,"The lab supports all five installed devices");
devices=lab.putLabReagent(devices,"v1","CaCO3");
devices=lab.useLabDevice(devices,"hotplate","v1");
assert.equal(lab.labObservation(devices.vessels[0]).caseData.observation,"gas",
 "Hotplate applies validated heated conditions to the chosen vessel");
devices=lab.useLabDevice(devices,"stirrer","v1");
assert.equal(devices.stirringVesselId,"v1","Mixer starts on the selected vessel");
devices=lab.useLabDevice(devices,"stirrer","v1");
assert.equal(devices.stirringVesselId,undefined,"Mixer can be stopped");
devices=lab.useLabDevice(devices,"stirrer","v1");
devices=lab.toggleLabDevice(devices,"stirrer");
assert.equal(devices.stirringVesselId,undefined,"Storing the mixer must stop stirring");
assert.equal(devices.devices.includes("stirrer"),false,"Devices can be returned to storage");
let extra=lab.defaultLabBench();
for(const kind of lab.labGlassware.slice(5)){
 extra=lab.addLabVessel(extra,kind);
}
assert.equal(extra.vessels.length,lab.MAX_BENCH_VESSELS);
assert.ok(lab.labGlassware.some(v=>v.id==="burette"));
assert.ok(lab.labGlassware.some(v=>v.id==="pipette"));
assert.ok(lab.labGlassware.some(v=>v.id==="conical"));
let titrationBench=lab.defaultLabBench();
titrationBench=lab.setLabTitration(titrationBench,titration.defaultTitration());
assert.equal(titration.titrationReading(titrationBench.titration).pH,1);
titrationBench=lab.dripLabTitration(titrationBench,24);
assert.ok(titration.titrationReading(titrationBench.titration).pH<7);
titrationBench=lab.dripLabTitration(titrationBench,1);
assert.equal(titration.titrationReading(titrationBench.titration).pH,7);
assert.equal(titration.titrationReading(titrationBench.titration).endPointMl,25);
titrationBench=lab.dripLabTitration(titrationBench,1);
assert.ok(titration.titrationReading(titrationBench.titration).pH>7);
titrationBench=lab.restartLabTitration(titrationBench);
assert.equal(titrationBench.titration.addedMl,0);
const reversed=titration.updateTitration(titration.defaultTitration(),{analyte:"base"});
assert.ok(titration.titrationReading(reversed).pH>12);
assert.equal(titration.titrationReading({...reversed,addedMl:25}).pH,7);
assert.equal(titration.updateTitration(reversed,{concentrationAnalyte:-2}),reversed,
 "Invalid concentration must not be accepted");
const paletteForCatalog=load("src/lektrusLabAppearance.ts",key=>{
 assert.equal(key,"./lektrusReactionDatabase");return reaction;
});
const labCatalog=load("src/lektrusLabCatalog.ts",key=>{
 if(key==="./lektrusReactionDatabase")return reaction;
 assert.equal(key,"./lektrusLabAppearance");return paletteForCatalog;
});
assert.equal(labCatalog.cabinetPhase(reaction.substances.find(x=>x.id==="NaCl")),"solid");
assert.equal(labCatalog.cabinetPhase(reaction.substances.find(x=>x.id==="HCl")),"liquid");
assert.equal(labCatalog.cabinetPhase(reaction.substances.find(x=>x.id==="CO2")),"gas");
const grouped=labCatalog.buildLabCatalog({group:"class",phase:"solid",sort:"formula"});
assert.ok(grouped.length>2,"Chemical groups must appear as separate catalogue sections");
assert.ok(grouped.flatMap(g=>g.items).every(v=>labCatalog.cabinetPhase(v)==="solid"));
assert.ok(grouped.some(g=>g.title==="Соли"),"Salt cabinet section exists");
const catalogSource=read("src/LektrusChemistryBench.tsx");
assert.match(catalogSource,/lektrus-lab-modal-sortbar/);
assert.match(catalogSource,/lektrus-lab-reagent-group-grid/);
assert.doesNotMatch(catalogSource,/openCabinet\("titration"\)/,
 "Titration runs between real vessels without an independent editor");
assert.match(catalogSource,/lektrus-lab-titration-on-table/);
assert.match(catalogSource,/lektrus-lab-class-tabs/);
assert.match(catalogSource,/labDevices\.map/);
assert.match(catalogSource,/useLabDevice\(/);
assert.match(read("src/lektrusChemistryBench.css"),/white-space:normal!important/,
 "Long glassware names should wrap naturally instead of ellipsizing");
const labLayout=load("src/lektrusLabLayout.ts");
for(const count of [1,2,3,4,5,6]){
 let arranged=lab.defaultLabBench();
 for(let i=1;i<count;i++)arranged=lab.addLabVessel(arranged,"tube");
 arranged=lab.arrangeLabVessels(arranged);
 assert.equal(arranged.vessels.length,count);
 const projected=arranged.vessels.map(v=>labLayout.labDisplayPoint(v,count>3));
 const width=count>3?10:10.8, height=count>3?19:30;
 for(let i=0;i<projected.length;i++){
  const a=projected[i];
  assert.ok(a.x-width/2>26&&a.x+width/2<80,
   "Placed vessels must stay clear of left controls and right sink");
  assert.ok(a.y-height*.56>42&&a.y+height*.44<94,
   "Placed vessels must stay inside the available work surface");
  for(let j=i+1;j<projected.length;j++){
   const b=projected[j];
   assert.ok(Math.abs(a.x-b.x)>=width||Math.abs(a.y-b.y)>=height,
    "Vessels should not overlap after auto arrangement: "+count+" vessels");
  }
  const roundtrip=labLayout.labLogicalPoint(a);
  assert.ok(Math.abs(roundtrip.x-arranged.vessels[i].x)<.0001);
  assert.ok(Math.abs(roundtrip.y-arranged.vessels[i].y)<.0001);
 }
}
const legacyVessel=labLayout.labDisplayPoint({x:10,y:90});
assert.ok(legacyVessel.x>=26&&legacyVessel.x<80,
 "Saved vessels at extreme old coordinates must not cover furniture");
for(const crowded of [false,true]){
 for(const y of [10,90]){
  const projectedEdge=labLayout.labDisplayPoint({x:50,y},crowded);
  const occupiedHeight=crowded?19:30;
  assert.ok(projectedEdge.y-occupiedHeight*.56>=42,
   "Glassware must never extend into the wall cabinets");
  assert.ok(projectedEdge.y+occupiedHeight*.44<=97,
   "Glassware must not cross the front of the bench");
 }
}
assert.equal(labLayout.isLabSink({x:85,y:70}),true);
assert.equal(labLayout.isLabCupboard({x:67,y:22}),true);
assert.equal(labLayout.isLabWorktop({x:50,y:73}),true);
assert.equal(labLayout.isLabWorktop({x:14,y:73}),false);
const redesignedLab=read("src/LektrusChemistryBench.tsx");
assert.match(redesignedLab,/lektrus-lab-scene-header/);
assert.match(redesignedLab,/lektrus-lab-worktop-zone/);
assert.match(redesignedLab,/labDisplayPoint\(preview\?\.id===v\.id\?preview:v,bench\.vessels\.length>3\)/);
assert.match(redesignedLab,/arrangeLabVessels\(bench\)/);
assert.match(redesignedLab,/lektrus-lab-chalk-steps/);
const redesignedCss=read("src/lektrusChemistryBench.css");
assert.match(redesignedCss,/lektrus-lab-reagent-furniture[\s\S]*?lektrus-lab-glass-cupboard/);
assert.match(redesignedCss,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
assert.match(redesignedCss,/lektrus-lab-worktop-zone/);
let realBench=lab.defaultLabBench();
realBench=lab.putLabReagent(realBench,"v1","HCl",
 {value:25,unit:"ml",concentrationM:.1});
realBench=lab.addLabVessel(realBench,"burette");
const burette=realBench.vessels.find(v=>v.kind==="burette");
assert.ok(burette);
realBench=lab.putLabReagent(realBench,burette.id,"NaOH",
 {value:30,unit:"ml",concentrationM:.1});
realBench=lab.setLabIndicator(realBench,"v1","phenolphthalein");
assert.equal(lab.labTitrationTargets(realBench,burette.id).length,1);
assert.equal(lab.dripLabVessel(realBench,"v1",burette.id,1),realBench,
 "Drops cannot flow backwards from the target flask");
realBench=lab.dripLabVessel(realBench,burette.id,"v1",1);
assert.equal(realBench.titration?.addedMl,1);
assert.equal(realBench.vessels.find(v=>v.id===burette.id)?.doses?.NaOH.value,29);
assert.equal(realBench.vessels.find(v=>v.id==="v1")?.doses?.NaOH.value,1);
assert.equal(realBench.titrationPair?.targetId,"v1");
realBench=lab.dripLabVessel(realBench,burette.id,"v1",24);
assert.equal(titration.titrationReading(realBench.titration).pH,7,
 "At 25 ml of 0.1 M NaOH the 25 ml of 0.1 M acid reaches equivalence");
assert.equal(realBench.vessels.find(v=>v.id===burette.id)?.doses?.NaOH.value,5);
realBench=lab.dripLabVessel(realBench,burette.id,"v1",.1);
assert.ok(titration.titrationReading(realBench.titration).pH>7);
const drainedTarget=lab.emptyLabVessel(realBench,"v1");
assert.equal(drainedTarget.titrationPair,undefined,
 "Pouring out a titrated sample ends the vessel-linked titration");
const icons=read("src/LektrusLabGlasswareIcon.tsx");
for(const kind of lab.labGlassware)assert.match(icons,new RegExp("^\\s*"+kind.id+":","m"),
 "Each glassware type has an independent vector pictogram");
assert.match(read("src/lektrusSciencePresets.ts"),/width:1660,height:1060/,
 "New chemistry benches must have sufficient tabletop space");
const base=lab.defaultLabBench();
const left=lab.putLabReagent(base,"v1","HCl");
const right=lab.addLabVessel(base,"flask");
const merged=lab.mergeLabBench(base,left,right);
assert.ok(merged.vessels.some(v=>v.kind==="flask"),"Peer added glassware survives");
assert.ok(merged.vessels.some(v=>v.reagents.includes("HCl")),"Local reagent addition survives");
assert.deepEqual(lab.readLabBench({scienceReagents:["NaCl"],scienceEnvironment:"aqueous",
 scienceExperimentStage:0}).vessels[0].reagents,["NaCl"],"Older experiment data migrate");
for(const p of ["src/LektrusChemistryBench.tsx","src/LektrusChemistryBenchEditor.tsx",
 "src/LektrusScienceEditor.tsx","src/LektrusChemistryIllustration.tsx",
  "src/LektrusLabGlasswareIcon.tsx"]){
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
assert.match(read("src/lektrusSciencePresets.ts"),/x:x-830,y:y-530,text:"Химический стол"/,
 "Bench must be centered under the insertion cursor");

// The visual stage is scrollable for old boards without clipping apparatus.
const subjectInsertion=read("src/App.tsx");
assert.match(subjectInsertion,/if\(id==="chem-experiments"\)\{/,
 "The subject tool should create a laboratory directly on the board");
assert.match(subjectInsertion,/commit\(\[\.\.\.itemsRef\.current,item\]\)/,
 "The new laboratory must be saved as a board object");
assert.match(subjectInsertion,/setSelected\(\[item\.id\]\)/,
 "Newly created laboratory must be selected for resize and movement");
assert.match(subjectInsertion,/if\(item\.graphFigureId==="chem-experiment-free"\)/,
 "The object edit command should select a laboratory without reopening the modal");
assert.doesNotMatch(read("src/LektrusScienceEditor.tsx"),/import LektrusChemistryBenchEditor/,
 "The obsolete experiment editor is no longer imported");
assert.doesNotMatch(read("src/LektrusChemistryBench.tsx"),/lektrus-lab-journal-trigger/,
 "There must be no button reopening the obsolete dialog");
const boardLaboratory=read("src/LektrusChemistryIllustration.tsx");
const editorLaboratory=read("src/LektrusChemistryBenchEditor.tsx");
assert.match(boardLaboratory,/lektrus-lab-object-grip/,
 "Lab object must have an unobstructed whole-object drag handle");
assert.doesNotMatch(boardLaboratory,/className="lektrus-chemistry-bench-on-board"[^>]*data-board-interactive/,
 "The object wrapper must not suppress the board's normal transform gestures");

const hugeLabCss=read("src/lektrusChemistryBench.css");
assert.match(boardLaboratory,/className="lektrus-chemistry-bench-on-board"[\s\S]*?onWheel=\{e=>e\.stopPropagation\(\)\}/,
 "Scrolling inside the board lab must not zoom the board");
assert.match(editorLaboratory,/className="lektrus-lab-editor-bench-viewport"/,
 "All lab content must scroll even in the smaller editing modal");
assert.match(hugeLabCss,/lektrus-chemistry-bench-on-board\{[\s\S]*?overflow:auto!important/,
 "The board lab viewport must allow scrolling");
assert.match(hugeLabCss,/min-width:1600px!important/,
 "The laboratory must have a full-size unclipped stage at any object size");
assert.match(hugeLabCss,/grid-template-columns:repeat\(4,minmax\(0,1fr\)\)!important/,
 "All 11 vessel cards must fit in a four-column shelf");
assert.match(hugeLabCss,/grid-template-rows:repeat\(3,minmax\(0,1fr\)\)!important/,
 "The vessel shelf must display all glassware in three rows");
assert.match(hugeLabCss,/overflow:visible!important;touch-action:manipulation!important/,
 "Glassware cupboard must not rely on scrollbars");
const deviceIcons=read("src/LektrusLabDeviceIcon.tsx");
for(const device of lab.labDevices){
 assert.match(deviceIcons,new RegExp('kind==="'+device.id+'"'),
  "Each lab device requires a distinct SVG icon: "+device.name);
}
assert.match(read("src/LektrusChemistryBench.tsx"),/LektrusLabDeviceIcon/);
assert.doesNotMatch(read("src/LektrusChemistryBench.tsx"),
 /className=\{"lektrus-lab-device-art/,
 "The installed tools must no longer render placeholder text glyphs");
const cabinetSurface=read("src/LektrusChemistryBench.tsx");
const cabinetCss=read("src/lektrusChemistryBench.css");
assert.match(cabinetSurface,/createPortal\(<div className=\{"lektrus-lab-furniture-modal is-"/,
 "Cabinet must be portalled above the board, independent of canvas scale");
assert.match(cabinetSurface,/document\.body\)\}/,
 "The cabinet portal must attach to document.body");
assert.match(cabinetSurface,/onWheel=\{e=>e\.stopPropagation\(\)\}/,
 "Wheel input inside the cabinet must not zoom the surrounding board");
assert.match(cabinetSurface,/onTouchMove=\{e=>e\.stopPropagation\(\)\}/,
 "Finger scrolling must stay within the cabinet");
assert.match(cabinetSurface,/scrollRef\.current\?\.scrollBy/,
 "Mouse users need scroll controls in addition to the scrollbar");
assert.match(cabinetSurface,/role="region" tabIndex=\{0\}/,
 "Scrollable catalogue must support keyboard navigation");
assert.match(cabinetSurface,/lektrus-lab-modal-results-head/,
 "Cabinet shows filtered result count and scroll help");
assert.match(cabinetSurface,/lektrus-lab-sink-art/,
 "A real faucet and washbasin replace the circular placeholder");
assert.doesNotMatch(cabinetSurface,/lektrus-lab-sink-basin"[^\n]*>◉/,
 "Old circular sink glyph must not return");
assert.match(cabinetCss,/\.lektrus-lab-furniture-modal\{\s*position:fixed!important/,
 "Catalog must have full-viewport positioning");
assert.match(cabinetCss,/overflow-y:auto!important/,
 "Substance grid must have native wheel/touch scrolling");
assert.match(cabinetCss,/touch-action:pan-y/,
 "Touch users must be able to drag-scroll through substances");
assert.match(cabinetCss,/@container\(max-width:380px\)/,
 "Furniture must adapt to the actual board-object width");
const model=read("src/boardModel.ts");
assert.match(model,/"scienceLabBench"/);
assert.match(model,/Повреждено состояние химического стола/);
assert.match(read("src/main.tsx"),/lektrusChemistryBench\.css/);
assert.match(read("src/lektrusChemistryBench.css"),/prefers-reduced-motion:reduce/);
console.log("Virtual chemistry bench: glassware, mixing, curated results, heating, persistence and peer merge passed");
