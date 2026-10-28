import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const sources=["src/App.tsx","src/LektrusSubjectBoard.tsx","src/boardModel.ts",
 "src/lektrusSubjectToolRegistry.ts","src/lektrusSubjectAccent.ts",
 "src/lektrusSubjectTaskTemplates.ts","src/LektrusSubjectToolsPanel.tsx",
 "src/LektrusSubjectBoardSolution.tsx","src/LektrusChemicalEquationEditor.tsx"];
for(const path of sources){
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
const templates=read("src/lektrusSubjectTaskTemplates.ts");
const colors=read("src/lektrusSubjectAccent.ts");
const themes=read("src/lektrusSubjectEditorThemes.css");
const toolIds=["chem-assignments","chem-formulas","physics-optics","physics-circuits",
 "math-geometry","math-coordinate","maps-atlas","contour-atlas",
 "history-atlas","bio-genetics","ru-morphemes","literature-analysis",
 "civics-structure","language-flashcards","info-programming"];
const colorRuntime=ts.transpileModule(colors,{compilerOptions:{
 target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext
}}).outputText.replace(/^export /gm,"");
const toneHelpers=new Function(colorRuntime+
 "\nreturn {subjectToneForToolId,subjectEditorStyle,subjectAccentPalette};")();
const expectedTones=["chemistry","physics","mathematics","geography",
 "history","biology","russian","literature","social","languages","informatics"];
for(const tone of expectedTones){
 const palette=toneHelpers.subjectAccentPalette[tone];
 assert.ok(palette?.accent&&palette?.soft,"Palette exists for "+tone);
 assert.equal(toneHelpers.subjectEditorStyle(tone)["--lektrus-tool-accent"],palette.accent);
 assert.equal(toneHelpers.subjectEditorStyle(tone)["--lektrus-tool-soft"],palette.soft);
}
for(const id of toolIds)assert.ok(toneHelpers.subjectToneForToolId(id),id+" gets subject colors");
for(const name of ["school","science","chem-equation","periodic","graph","optics",
 "mechanics","circuit","motion","fraction","atom","subject-tools"]){
 assert.ok(themes.includes(".lektrus-"+name),name+" editor inherits a subject theme");
}
assert.match(read("src/main.tsx"),/lektrusSubjectEditorThemes\.css/);
assert.match(app,/collectChemistryObject\(/);
assert.match(app,/!value\.subjectBoardStandalone/);
assert.match(app,/id==="chem-formulas"\|\|id==="chem-assignments"/);
assert.match(read("src/boardModel.ts"),/subjectBoardStandalone\?: boolean/);

const chemical=read("src/lektrusChemicalBoardSurface.css");
assert.match(board,/function LektrusTaskPreview\(/,"Ordinary subject tasks have a live student preview");
assert.match(board,/\<LektrusSubjectBoardView item=\{sheet\}/,
 "Preview reuses the real board renderer instead of a fake mockup");
assert.match(board,/onAnswerChange=\{\(_,value\)=>setAnswer\(value\)\}/,
 "Preview responses stay in local component state");
assert.match(styles,/\.lektrus-subject-task-editor>footer\{margin-top:auto\}/,
 "Dialog action footer stays pinned to its bottom");
assert.match(styles,/\.lektrus-subject-task-editor>\.lektrus-subject-task-body\{/,
 "Task body takes all available height instead of leaving whitespace");
assert.match(styles,/\.lektrus-task-preview-board\{/,"A preview surface is shown below the fields");
assert.match(app,/circle cx="15" cy="15\.5" r="2\.45"/,
 "Grid-snapping glyph must highlight a point at a grid intersection");
assert.match(app,/provisionalChemistryWorksheets\.current\.add\(target\.id\)/,
 "Chemistry subject-tool drafts are explicitly tracked for cleanup");
assert.match(app,/provisionalChemistryWorksheets\.current\.delete\(boardId\)/,
 "Deleting an unfinished assignment must not create an orphan worksheet");

assert.match(registry,/subject-board-\$\{SubjectTone\}/);
assert.match(registry,/subjectBoardEntries:\[\]/);
assert.doesNotMatch(panel,/subject-board-[a-z]+/,"No individual worksheet in subject catalogue");
assert.ok(app.includes('aria-label="Предметная доска"'),"One universal main toolbar entry");
assert.ok(app.includes('createUniversalSubjectBoard'),"Universal tool creates worksheet");
assert.ok(app.includes('subjectToneForSubject(lectrisBoardOrganization.subject)'),
 "Worksheet inherits the classroom subject");
assert.match(app,/isSubjectBoard\(item\)&&!subjectBoardLocked\(item\)/,
 "Only empty worksheets may follow subject changes");
assert.match(board,/subjectBoardLocked=\(item:Item\)/,
 "A worksheet with tasks must retain its subject");
assert.match(colors,/subjectToneForSubject/);
assert.ok(model.includes('"subjectBoardEntries"'),"Worksheet content persists");
assert.match(model,/details\?:Record<string,string>/);
assert.match(model,/subjectBoardEntries\.length>48/);
const subjects=["chemistry","physics","mathematics","russian","biology","geography",
 "history","informatics","languages","literature","social"];
for(const subject of subjects){
 assert.ok(templates.includes(subject+":[")||templates.includes(subject+": ["),subject+" needs task templates");
 assert.ok(colors.includes(subject+":{accent:"),subject+" has subject palette");
}
for(const label of ["Цепочка превращений","Геометрическая задача",
 "Текстовая задача","Расчётная задача","Лабораторная работа","Орфография","Синтаксический разбор",
 "Перевод","Грамматическое преобразование","Порядок слов"]){
 assert.ok(templates.includes(label),"Task type not found: "+label);
}
assert.match(templates,/physics:\[\s*task,\s*type\("calculation".*?\)/s,
 "Physics starts with an assignment and includes a calculation");
for(const subject of ["biology","geography","history","literature","social","informatics"]){
 assert.ok(templates.includes(subject+":[task]"),subject+" must show only the assignment type");
}
for(const example of ["Например:","Fe + HCl","Aa × Aa","Present Perfect","2x²","I ___"]){
 assert.ok(!templates.includes(example),"Field descriptions must not suggest an answer: "+example);
}
assert.ok(board.includes('options.length>1'),"One-type subjects hide type selection");
assert.ok(board.includes('onMove(entry.id,-1)')&&board.includes('onMove(entry.id,1)'),
 "Each task can be moved to a different position");
assert.ok(board.includes("onEditSolution(entry.id)"),"School-style worked solutions open from worksheets");
assert.ok(app.includes("moveSubjectBoardEntry"),"Reordering is persisted");
const solution=read("src/LektrusSubjectBoardSolution.tsx");
for(const label of ["Дано","Найти","Решение","Ответ"]){
 assert.ok(solution.includes(label),"Structured school solution missing "+label);
}
assert.ok(model.includes("workedSolution?:SubjectBoardWorkedSolution"),"Persist written solution");
assert.match(templates,/needsAutomaticWorkedSolution/);
assert.match(board,/LektrusSubjectBoardInlineSolution/);
assert.match(board,/onWorkedSolutionChange\?solution=>onWorkedSolutionChange\(entry.id,solution\)/);
assert.match(app,/onWorkedSolutionChange=\{canEdit&&!item.locked&&!presentation\?/);
assert.match(templates,/textProblem=type\("word-problem","Текстовая задача"/);
assert.match(templates,/Преподаватель вводит только условие/);
assert.ok(!templates.includes('type("word-problem","Текстовая задача","Задача по условию'),
 "Teachers should not fill pupils' given/find fields");
assert.match(templates,/subjectTaskTypeKnown/);

assert.ok(board.includes('onAction("equation")')&&board.includes('onAction("task")'),
 "Chemistry worksheet retains equation and task tools");
assert.match(board,/freshTaskDetails\(tone,format\)/);
assert.ok(!board.includes('<select value={options.some'),"Task types are buttons, not a dropdown");
assert.match(board,/entry\.details\?\.\[field\.id\]/);
assert.match(board,/onAnswerChange\(entry\.id,e\.target\.value\)/);
assert.match(board,/entry\.revealed\?/);
assert.match(board,/LektrusChemicalEquationTypeset/);
assert.match(app,/id==="chem-formulas"\|\|id==="chem-assignments"/);
assert.match(app,/const chosen=itemsRef\.current\.find/,"Selected chemistry board is the only implicit destination");
assert.match(app,/const target=makeSubjectToolItem\(id,centerX,centerY,createId\)/,
 "Standalone chemistry tool creates its own object");
assert.match(app,/collectChemistryObject\(/,"Standalone tasks and reactions can be explicitly moved");
assert.match(board,/item\.subjectBoardStandalone/,"Standalone chemistry task has distinct board chrome");
assert.ok(!app.includes("boards.find(value=>selected.includes(value.id))"),"Chemistry tools cannot silently append to an unrelated board");
assert.match(app,/provisionalChemistryWorksheets/,"Empty provisional chemistry sheets can be cleaned up");
assert.match(app,/patchSubjectBoardEntry\(item\.id,entryId,\{answer\}\)/);
assert.match(app,/workChannel\.current\?\.publishEdit\(latest\.id,editorDiff\(latest,next\)\)/);
assert.match(app,/isSubjectBoard\(item\)&&<LektrusSubjectBoardView/);
assert.match(styles,/var\(--subject-board-accent\)/);
assert.match(styles,/background-color:color-mix\(in srgb,var\(--subject-board-soft\)/);
assert.match(styles,/content:none!important/);
assert.match(styles,/flex-wrap:nowrap!important/);
assert.match(styles,/max-height:52px!important/);
assert.match(chemical,/background-color:#fcfefd/);
console.log("Subject worksheets: one tool, adaptive color, subject lock, typed exercises and shared answers OK");
