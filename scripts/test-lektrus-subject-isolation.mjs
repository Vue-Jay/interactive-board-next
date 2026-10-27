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
 "\nreturn {subjectTaskTemplates,subjectBoardHasWork,freshTaskDetails};")();
const interactions=new Function(stripped("src/LektrusSubjectActivity.tsx")+
 "\nreturn {preferredActivityMode,freshActivity};")();
const toneCode=read("src/lektrusSubjectAccent.ts");
const palette={};
for(const tone of ["chemistry","physics","mathematics","geography","history","biology",
 "russian","literature","social","languages","informatics"])palette[tone]={label:tone};
const board=new Function("subjectTaskTemplates","subjectBoardHasWork","freshTaskDetails",
 "preferredActivityMode","freshActivity","subjectAccentPalette",stripped("src/LektrusSubjectBoard.tsx")+
 "\nreturn {newSubjectBoardEntry,entryBelongsToSubject,boardTone,subjectBoardLocked};")(
 templates.subjectTaskTemplates,templates.subjectBoardHasWork,templates.freshTaskDetails,
 interactions.preferredActivityMode,interactions.freshActivity,palette);
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
for(const [tone,format,expected] of [
 ["mathematics","equation",null],["mathematics","word-problem",null],
 ["mathematics","geometry",null],["mathematics","matching","match"],
 ["russian","morphology",null],["russian","syntax",null],["russian","morphemes",null],
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
assert.match(app,/!subjectTaskTemplates\[tone\]\.some\(type=>type.id===changes.format\)/);
assert.match(app,/entryBelongsToSubject\(boardTone\(latest\),current\)/);
assert.match(app,/subjectBoardEntries:\(item.subjectBoardEntries\?\?\[\]\)\.filter\(subjectBoardEntryFilled\)/);
assert.match(component,/allEntries\.filter\(entry=>entryBelongsToSubject\(tone,entry\)\)/);
assert.match(component,/activityMatchesTask\(tone,entry.format,entry.activity\)/);
const model=read("src/boardModel.ts");
assert.match(model,/entry.subject===i.graphFigureId.slice\("subject-board-"\.length\)/);
console.log("Subject ownership: eleven subject partitions, native formats, legacy protection and invalid cross-subject edits OK");
