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
const results=new Function(js+"\nreturn {periodicElements,elementFacts,atomShells,atomViews,defaultAtomModel};")();
const {periodicElements,elementFacts,atomShells,atomViews}=results;
assert.equal(periodicElements.length,118,"all 118 symbols and names");
assert.equal(elementFacts.length,118,"each chemical element has offline reference data");
for(let i=0;i<118;i++){
 assert.equal(periodicElements[i].number,i+1);
 assert.ok(elementFacts[i].electronConfiguration,"configuration missing for Z="+(i+1));
 assert.ok(elementFacts[i].atomicMass,"atomic mass missing for Z="+(i+1));
 assert.equal(atomShells(i+1).reduce((a,b)=>a+b,0),i+1,
   "electron count must match atomic number Z="+(i+1));
}
assert.deepEqual(atomShells(1),[1]);
assert.deepEqual(atomShells(8),[2,6]);
assert.deepEqual(atomShells(11),[2,8,1]);
assert.deepEqual(atomShells(26),[2,8,14,2]);
assert.deepEqual(atomViews.map(m=>m.id),["shell","orbit","lewis","nucleus"]);
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
assert.match(board,/onToggle=\{onChange\?change:undefined\}/);
assert.match(app,/onPeriodicChange=\{canEdit/);
assert.match(app,/atomEditorItem&&<LektrusAtomEditor/);
assert.match(school,/if\(lower==="физическая культура"/);
assert.doesNotMatch(school,/"Окружающий мир","Физическая культура"/);
console.log("Chemistry UX: 118 offline facts, electron counts, four atom models, draggable labels and interactive table.");
