import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const files=["src/App.tsx","src/LektrusSubjectBoard.tsx","src/boardModel.ts",
 "src/lektrusSubjectToolRegistry.ts","src/lektrusSubjectAccent.ts",
 "src/LektrusSubjectToolIcons.tsx","src/LektrusSubjectToolsPanel.tsx"];
for(const path of files){
 const source=ts.createSourceFile(path,read(path),ts.ScriptTarget.Latest,true,
  path.endsWith(".tsx")?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 assert.equal(source.parseDiagnostics.length,0,path+": "+source.parseDiagnostics.map(d=>d.messageText));
}
const registry=read("src/lektrusSubjectToolRegistry.ts");
const panel=read("src/LektrusSubjectToolsPanel.tsx");
const board=read("src/LektrusSubjectBoard.tsx");
const model=read("src/boardModel.ts");
const app=read("src/App.tsx");
const styles=read("src/lektrusSubjectBoard.css");
const chemical=read("src/lektrusChemicalBoardSurface.css");
assert.match(registry,/subject-board-\$\{SubjectTone\}/);
assert.match(registry,/subjectBoardEntries:\[\]/);
for(const name of ["chemistry","physics","mathematics","russian"]){
 assert.ok(panel.includes("subject-board-"+name),"Subject worksheet missing: "+name);
}
assert.ok(model.includes('"subjectBoardEntries"'),"Worksheets must persist after a reload");
assert.match(model,/subjectBoardEntries\?: SubjectBoardEntry\[\]/);
assert.match(model,/subjectBoardEntries\.length>48/);
assert.ok(board.includes('onAction("equation")')&&board.includes('onAction("task")'),
 "Two chemistry worksheet tools must be available on the board");
assert.match(board,/onAnswerChange\(entry\.id,e\.target\.value\)/);
assert.match(board,/entry\.revealed\?/);
assert.match(board,/LektrusChemicalEquationTypeset/);
assert.match(app,/id==="chem-formulas"\|\|id==="chem-assignments"/);
assert.match(app,/boards\.find\(value=>selected\.includes\(value\.id\)\)/,
 "The selected chemistry board must be preferred over creating duplicates");
assert.match(app,/patchSubjectBoardEntry\(item\.id,entryId,\{answer\}\)/,
 "Student work is stored in the same live board");
assert.match(app,/workChannel\.current\?\.publishEdit\(latest\.id,editorDiff\(latest,next\)\)/);
assert.match(app,/isSubjectBoard\(item\)&&<LektrusSubjectBoardView/);
assert.match(styles,/justify-content:flex-start/);
assert.match(styles,/flex-wrap:nowrap!important/);
assert.match(styles,/max-height:52px!important/);
assert.match(chemical,/background-color:#fcfefd/);
assert.match(chemical,/justify-content:flex-start/);
console.log("Subject worksheet: shared chemical equations, exercises, student answers, light top-left paper, fixed action strip: OK");
