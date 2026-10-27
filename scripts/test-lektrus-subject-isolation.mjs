import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
function stripped(path){
 return ts.transpileModule(read(path),{fileName:path,compilerOptions:{
  target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.React
 }}).outputText.replace(/^import[^;]*;\s*$/gm,"").replace(/^export /gm,"");
}
const templates=new Function(stripped("src/lektrusSubjectTaskTemplates.ts")+
 "\nreturn {subjectTaskTemplates,subjectBoardHasWork,freshTaskDetails,needsAutomaticWorkedSolution,subjectTaskTypeKnown};")();
const interactions=new Function(stripped("src/LektrusSubjectActivity.tsx")+
 "\nreturn {preferredActivityMode,freshActivity};")();
const toneCode=read("src/lektrusSubjectAccent.ts");
const palette={};
for(const tone of ["chemistry","physics","mathematics","geography","history","biology",
 "russian","literature","social","languages","informatics"])palette[tone]={label:tone};
const board=new Function("subjectTaskTemplates","subjectBoardHasWork","freshTaskDetails",
 "preferredActivityMode","freshActivity","subjectAccentPalette","subjectTaskTypeKnown",stripped("src/LektrusSubjectBoard.tsx")+
 "\nreturn {newSubjectBoardEntry,entryBelongsToSubject,boardTone,subjectBoardLocked};")(
 templates.subjectTaskTemplates,templates.subjectBoardHasWork,templates.freshTaskDetails,
 interactions.preferredActivityMode,interactions.freshActivity,palette,templates.subjectTaskTypeKnown);
const tones=Object.keys(palette);
for(const tone of tones){
 const formats=templates.subjectTaskTemplates[tone].map(x=>x.id);
 assert.equal(formats[0],"task",tone+" needs a generic written task");
 assert.equal(formats.length,new Set(formats).size,"Duplicate task format in "+tone);
 const boardItem={kind:"graph",graphFigureId:"subject-board-"+tone,subjectBoardEntries:[]};
 assert.equal(board.boardTone(boardItem),tone);
 const entry=board.newSubjectBoardEntry("entry-"+tone,"task",tone);
 assert.equal(entry.subject,tone,"Owner must be persisted");
 assert.equal(entry.format,"task");
 assert.equal(entry.activity,undefined,"Generic tasks must not default to an unrelated quiz");
 assert.equal(board.entryBelongsToSubject(tone,entry),true);
 assert.equal(board.subjectBoardLocked({...boardItem,subjectBoardEntries:[entry]}),false);
 for(const foreign of tones.filter(other=>other!==tone))
  assert.equal(board.entryBelongsToSubject(foreign,entry),false,
   "An exercise from "+tone+" must never appear on "+foreign);
 for(const format of formats){
   const activityMode=interactions.preferredActivityMode(tone,format);
   if(activityMode)assert.ok(["fill","choice","match","order"].includes(activityMode));
 }
}
for(const tone of tones.filter(tone=>tone!=="chemistry"))
 assert.throws(()=>board.newSubjectBoardEntry("e","equation",tone),/химических уравнений/);
const equation=board.newSubjectBoardEntry("e","equation","chemistry");
assert.equal(board.entryBelongsToSubject("chemistry",equation),true);
assert.equal(board.entryBelongsToSubject("mathematics",equation),false);
for(const tone of ["biology","geography","history","literature","social","informatics"]){
 assert.deepEqual(templates.subjectTaskTemplates[tone].map(x=>x.id),["task"]);
}
assert.deepEqual(templates.subjectTaskTemplates.physics.map(x=>x.id),["task","calculation","lab"]);
assert.deepEqual(templates.subjectTaskTemplates.chemistry.map(x=>x.id),
 ["task","chain","calculation","experiment"]);
assert.deepEqual(templates.subjectTaskTemplates.mathematics.map(x=>x.id),
 ["task","word-problem","equation","geometry","interactive"]);
assert.deepEqual(templates.subjectTaskTemplates.russian.map(x=>x.id),
 ["task","orthography","punctuation","morphemes","morphology","syntax","text","interactive"]);
for(const tone of ["mathematics","russian"]){
 for(const oldId of ["choice","matching","sequence"]){
  assert.equal(templates.subjectTaskTypeKnown(tone,oldId),true,
   "Previously saved exercises remain readable");
  assert.equal(templates.subjectTaskTemplates[tone].some(x=>x.id===oldId),false,
   "Redundant standalone activities no longer appear");
 }
}
assert.deepEqual(templates.subjectTaskTemplates.languages.map(x=>x.id),
 ["task","translation","gaps","vocabulary","word-order","grammar","reading","choice"]);
assert.ok(!templates.subjectTaskTemplates.russian.some(x=>x.id==="cloze"),
 "Russian orthography already has a specialised gaps constructor");
assert.ok(!templates.subjectTaskTemplates.chemistry.some(x=>x.id==="balance"||x.id==="equation"),
 "Chemical equations and coefficients already have a dedicated equation editor");
for(const [tone,type] of [["mathematics","word-problem"],["physics","calculation"],["chemistry","calculation"]]){
 assert.equal(templates.needsAutomaticWorkedSolution(tone,type),true);
 assert.equal(templates.subjectTaskTemplates[tone].find(t=>t.id===type).fields.length,0,
  "Only pupils should extract given/find information");
}
assert.equal(templates.needsAutomaticWorkedSolution("mathematics","choice"),false);
assert.equal(templates.subjectTaskTypeKnown("mathematics","function"),true,"Keep old homework readable");
assert.equal(templates.subjectTaskTypeKnown("chemistry","balance"),true,"Keep old chemical tasks readable");
for(const [tone,format,expected] of [
 ["mathematics","equation",null],["mathematics","word-problem",null],
 ["mathematics","geometry",null],["mathematics","interactive","choice"],["mathematics","matching","match"],
 ["russian","morphology",null],["russian","syntax",null],["russian","morphemes",null],["russian","interactive","choice"],
 ["russian","orthography","fill"],["russian","punctuation","fill"],
 ["languages","translation",null],["languages","reading",null],["languages","grammar",null],
 ["languages","vocabulary","match"],["languages","word-order","order"]
])assert.equal(interactions.preferredActivityMode(tone,format),expected,tone+"/"+format);
const incompatible={...equation,kind:"task",subject:"mathematics",format:"matching"};
assert.equal(board.entryBelongsToSubject("chemistry",incompatible),false);
assert.equal(board.entryBelongsToSubject("mathematics",incompatible),true);
assert.equal(board.entryBelongsToSubject("russian",incompatible),false);
assert.equal(board.entryBelongsToSubject("chemistry",{...equation,subject:undefined}),true,
 "Legacy chemical equations are still supported");
assert.equal(board.entryBelongsToSubject("russian",{...equation,subject:undefined}),false,
 "Legacy equations may not leak onto language worksheets");
const filled={...board.newSubjectBoardEntry("written","task","mathematics"),prompt:"Условие"};
assert.equal(board.subjectBoardLocked({subjectBoardEntries:[filled]}),true,
 "Subject locks after a substantive question is written");
const app=read("src/App.tsx"),component=read("src/LektrusSubjectBoard.tsx");
assert.match(app,/if\(mode==="equation"&&tone!=="chemistry"\)/);
assert.match(app,/changes\.subject!==tone/);
assert.match(app,/!subjectTaskTypeAllowed\(tone,changes.format\)/);
assert.match(app,/entryBelongsToSubject\(boardTone\(latest\),current\)/);
assert.match(app,/subjectBoardEntries:\(item.subjectBoardEntries\?\?\[\]\)\.filter\(subjectBoardEntryFilled\)/);
assert.match(component,/allEntries\.filter\(entry=>entryBelongsToSubject\(tone,entry\)\)/);
assert.match(component,/activityMatchesTask\(tone,entry.format,entry.activity\)/);
const inline=read("src/LektrusSubjectBoardSolution.tsx");
assert.ok(inline.includes("LektrusSubjectBoardInlineSolution"));
for(const section of ["Дано","Найти","Решение","Ответ"]){
 assert.ok(inline.includes(section),"Missing school solution section: "+section);
}
assert.ok(inline.includes('onChange={onChange?text=>patch("answer",text):undefined}'));
assert.ok(inline.includes('onChange={onChange?text=>patch("given",text):undefined}'));
assert.ok(inline.includes('onChange={onChange?text=>patch("work",text):undefined}'));
assert.ok(component.includes("needsAutomaticWorkedSolution(tone,entry.format)"));
assert.ok(component.includes("onWorkedSolutionChange(entry.id,solution)"));
assert.ok(app.includes("patchSubjectBoardEntry(item.id,entryId,{workedSolution:solution})"));
assert.ok(app.includes('Object.keys(changes).some(key=>!["answer","workedSolution","activityResponse"].includes(key))'),
 "Students may submit answers, not alter teacher task content");
const model=read("src/boardModel.ts");
assert.match(model,/entry.subject===i.graphFigureId.slice\("subject-board-"\.length\)/);
console.log("Subject ownership: eleven subject partitions, native formats, legacy protection and invalid cross-subject edits OK");
