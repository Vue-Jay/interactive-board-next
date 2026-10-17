import assert from "node:assert/strict";
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
const results=new Function(js+"\nreturn {periodicElements,elementFacts,atomShells,atomViews,orbitalSublevels,defaultAtomModel};")();
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
assert.match(floating,/const atomDefaultRatio:Point=\{x:1\.014,y:\.02\}/,"atom window must open to the right of the table");
assert.match(floating,/windowScale:/,"information window must scale with the board object");
assert.match(floating,/className="lektrus-chem-close"/,"window close button must use visible icon");

assert.match(app,/onPeriodicChange=\{canEdit/);
assert.match(app,/atomEditorItem&&<LektrusAtomEditor/);
assert.match(school,/if\(lower==="физическая культура"/);
assert.doesNotMatch(school,/"Окружающий мир","Физическая культура"/);
console.log("Chemistry UX: 118 offline facts, electron counts, four atom models, draggable labels and interactive table.");
