import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const periodic=read("src/lektrusPeriodicElements.ts");
const view=read("src/LektrusPeriodicTableView.tsx");
const editor=read("src/LektrusPeriodicTableEditor.tsx");
const subjects=read("src/lektrusSchoolSubjects.ts");
const board=read("src/boardModel.ts");
const app=read("src/App.tsx");
const registry=read("src/lektrusSubjectToolRegistry.ts");
const formulaStyle=read("src/lektrusFormulaWindow.css");
const source=(expression)=>{
  const match=periodic.match(expression);
  assert.ok(match,"missing source data");
  return [...match[1].matchAll(/"([^"]*)"/g)].map(x=>x[1]).join("");
};
const symbols=source(/const symbols=\(([\s\S]*?)\)\.trim\(\)\.split/).trim().split(/\s+/);
const names=source(/const names=\(([\s\S]*?)\)\.split/).split("|");
assert.equal(symbols.length,118);
assert.equal(names.length,118);
for(const [number,symbol,name] of [
  [1,"H","Водород"],[8,"O","Кислород"],[26,"Fe","Железо"],
  [79,"Au","Золото"],[118,"Og","Оганесон"]
]){
  assert.equal(symbols[number-1],symbol);
  assert.equal(names[number-1],name);
}
assert.match(editor,/role="dialog"/);
assert.match(editor,/aria-modal="true"/);
assert.match(editor,/setSelected/);
assert.match(view,/onPick/);
assert.match(board,/sciencePeriodicHighlights/);
assert.match(app,/item\.graphFigureId==="chem-periodic"/);
assert.match(app,/createPortal\(\s*<div\s+className="formula-editor-backdrop lektrus-formula-window"/);
assert.match(formulaStyle,/body > \.lektrus-formula-window \.formula-editor-main\s*\{/);
assert.match(formulaStyle,/grid-template-columns:minmax\(0,1\.15fr\) minmax\(295px,\.85fr\)/);
assert.match(formulaStyle,/formula-editor-footer/);
assert.match(registry,/id:"chem-periodic-table"/);
assert.match(registry,/scienceToolGroups.map/);
assert.doesNotMatch(subjects,/["']Алгебра["']/);
assert.doesNotMatch(subjects,/["']Геометрия["']/);
assert.match(subjects,/lower==="алгебра"\|\|lower==="геометрия"/);
assert.doesNotMatch(registry,/id:"chem-water"/);
assert.doesNotMatch(registry,/id:"physics-forces"/);
console.log("Subject editors: 118 elements, standalone formula layout, normalized mathematics, grouped science tools.");
