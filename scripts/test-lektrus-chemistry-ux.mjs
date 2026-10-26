import assert from "node:assert/strict";
import "./test-lektrus-organic-workspace.mjs";
import fs from "node:fs";
import ts from "typescript";
const text=path=>fs.readFileSync(new URL("../"+path,import.meta.url),"utf8");
const periodic=text("src/lektrusPeriodicElements.ts");
const facts=text("src/lektrusElementFacts.ts");
const atom=text("src/lektrusAtomModel.ts");
const clean=source=>source.replace(/^import .*?;\s*$/gm,"").replace(/\bexport\s+(?=(?:type|interface|const|let|function|class)\b)/g,"");
const js=ts.transpileModule(clean([periodic,facts,atom].join("\n")),{
 compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}
}).outputText;
const results=new Function(js+"\nreturn {periodicElements,elementFacts,atomShells,atomViews,orbitalSublevels,defaultAtomModel,exampleIsotope};")();
const {periodicElements,elementFacts,atomShells,atomViews,orbitalSublevels}=results;
assert.equal(periodicElements.length,118,"all 118 symbols and names");
assert.equal(elementFacts.length,118,"each chemical element has offline reference data");
for(let i=0;i<118;i++){
 assert.equal(periodicElements[i].number,i+1);
 assert.ok(elementFacts[i].electronConfiguration,"configuration missing for Z="+(i+1));
 assert.ok(elementFacts[i].atomicMass,"atomic mass missing for Z="+(i+1));
 assert.equal(atomShells(i+1).reduce((a,b)=>a+b,0),i+1,
   "electron count must match atomic number Z="+(i+1));
 const subs=orbitalSublevels(i+1);
 assert.equal(subs.reduce((sum,row)=>sum+row.electrons,0),i+1,"complete orbital filling Z="+(i+1));
 assert.ok(subs.every(row=>row.spins.length===row.orbitals&&
   row.spins.flat().length===row.electrons&&row.spins.every(slot=>slot.length<=2)),
   "valid orbital occupancy Z="+(i+1));
}
assert.deepEqual(atomShells(1),[1]);
assert.deepEqual(atomShells(8),[2,6]);
assert.deepEqual(atomShells(11),[2,8,1]);
assert.deepEqual(atomShells(26),[2,8,14,2]);
assert.deepEqual(atomViews.map(m=>m.id),["shell","orbit","orbital","nucleus"]);
assert.equal(orbitalSublevels(8).find(level=>level.name==="2p")?.electrons,4);
assert.equal(orbitalSublevels(24).find(level=>level.name==="3d")?.electrons,5);
assert.equal(orbitalSublevels(29).find(level=>level.name==="3d")?.electrons,10);
assert.equal(results.defaultAtomModel.atomicNumber,8);
assert.deepEqual(results.exampleIsotope(6),{massNumber:12,neutrons:6},"carbon-12");
assert.deepEqual(results.exampleIsotope(17),{massNumber:35,neutrons:18},"chlorine-35");
assert.equal(results.exampleIsotope(43),null,"do not fabricate neutron count from atomic weight");

const model=text("src/boardModel.ts"),editor=text("src/LektrusScienceEditor.tsx");
const tableView=text("src/LektrusPeriodicTableView.tsx");
const board=text("src/LektrusPeriodicBoard.tsx"),app=text("src/App.tsx");
const molecule=text("src/lektrusScienceInteractionNext.css");
const school=text("src/lektrusSchoolSubjects.ts");
assert.match(model,/labelDx\?:number;labelDy\?:number/);
assert.match(model,/scienceAtomModel/);
assert.match(model,/sciencePeriodicHighlights/);
assert.match(editor,/kind:"point"\|"point-label"\|"segment-label"/);
assert.match(editor,/lektrus-science-label-handle/);
assert.match(editor,/filteredElements=periodicElements\.filter/);
assert.match(editor,/application\/x-lektrus-element/);
assert.match(molecule,/lektrus-molecule-picker/);
assert.match(tableView,/textLength=\{Math\.min\(44/);
assert.match(tableView,/elementFacts/);
const floating=text("src/LektrusPeriodicFloatingInfo.tsx");
assert.match(board,/onToggle=\{onChange\?/,"board must expose element selection from the floating card");
assert.match(board,/onDoublePick=\{toggle\}/,"double-click must select without reopening editor");
assert.match(floating,/const defaultPosition:Point=\{x:1\.009,y:/,"element and atom card must open immediately to the right of the table");
assert.match(floating,/className="lektrus-chem-atom-toggle"/,"atom model must expand inside the existing card");
assert.doesNotMatch(floating,/renderWindow\("atom"/,"no second free-floating atom window");
assert.match(floating,/windowScale:/,"information window must scale with the board object");
assert.match(floating,/className="lektrus-chem-close"/,"window close button must use visible icon");
assert.match(floating,/panel\.addEventListener\("wheel",handleWheel,\{passive:false\}\)/,
 "Ctrl+wheel over chemistry windows must cancel browser page zoom");
assert.match(floating,/stage\.dispatchEvent\(new WheelEvent\("wheel"/,
 "Ctrl+wheel over portaled window must forward to the board zoom handler");
const atomView=text("src/LektrusAtomView.tsx");
const chemistryStyles=text("src/lektrusSubjectPolish2026.css");
assert.match(atomView,/const orbitalHeight=Math\.max\(260,102\+rows\.length\*rowHeight\+62\)/,
 "orbital diagram height follows the number of occupied sublevels");
assert.match(atomView,/exampleIsotope\(element\.number\)/,
 "nuclear neutron count comes from a named isotope rather than rounded atomic mass");
assert.match(atomView,/Число нейтронов зависит от выбранного изотопа/,
 "unknown isotope cannot be shown as a fabricated neutron count");
assert.match(chemistryStyles,/\.lektrus-chem-window--combined\.is-expanded\.is-orbital/,
 "orbital mode must have a readable wide presentation");
for(let z=1;z<=118;z++){
 const rows=orbitalSublevels(z).length;
 const canvas=Math.max(260,102+rows*40+62);
 const bottom=99+(Math.max(0,rows-1))*40+19;
 assert.ok(bottom<canvas-42,"all orbital rows fit for Z="+z);
}
const organicSource=text("src/lektrusOrganicFormula.ts");
assert.match(organicSource,/analyzeOrganicStructure/);
const organicModule=ts.transpileModule(clean(organicSource),{
 compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}
}).outputText;
const analyzeOrganic=new Function(organicModule+"\nreturn analyzeOrganicStructure;")();
const organicCase=(labels,bonds)=>analyzeOrganic({
 graphPoints:labels.map(label=>({label,x:0,y:0})),
 graphSegments:bonds.map(([a,b,bondOrder])=>({a,b,bondOrder,kind:"segment",label:"",measure:false}))
});
assert.equal(organicCase(["C","C"],[[0,1,1]]).formula,"C2H6","ethane");
assert.equal(organicCase(["C","C"],[[0,1,2]]).formula,"C2H4","ethene");
assert.equal(organicCase(["C","C"],[[0,1,3]]).formula,"C2H2","ethyne");
assert.equal(organicCase(["C","C","O","H"],[[0,1,1],[1,2,1],[2,3,1]]).formula,"C2H6O","ethanol");
assert.equal(organicCase(["C","C","O","O","H"],[[0,1,1],[1,2,2],[1,3,1],[3,4,1]]).formula,"C2H4O2","ethanoic acid");
const ring=Array.from({length:6},(_,i)=>[i,(i+1)%6,i%2===0?2:1]);
assert.equal(organicCase(Array(6).fill("C"),ring).formula,"C6H6","benzene");
assert.equal(organicCase(["C","C"],[[0,1,1],[0,1,3],[0,1,1]]).valid,false,
 "carbon cannot have five bond orders");
const organicPresets=text("src/lektrusSciencePresets.ts");
assert.match(organicPresets,/chem-organic-benzene/);
assert.match(organicPresets,/chem-organic-ethanol/);
assert.match(organicPresets,/chem-formula-combustion/);
assert.match(organicPresets,/chem-experiment-lime/);
const chemistryIllustrations=text("src/LektrusChemistryIllustration.tsx");
assert.match(chemistryIllustrations,/onStageChange/);
assert.match(chemistryIllustrations,/NaCl → Na⁺ \+ Cl⁻/);
assert.match(editor,/scienceExperimentStage/);
assert.match(app,/isChemicalIllustration\(item\)/);

assert.match(app,/onPeriodicChange=\{canEdit/);
assert.match(app,/atomEditorItem&&<LektrusAtomEditor/);
assert.match(school,/if\(lower==="физическая культура"/);
assert.doesNotMatch(school,/"Окружающий мир","Физическая культура"/);
console.log("Chemistry UX: 118 offline facts, electron counts, four atom models, draggable labels and interactive table.");
