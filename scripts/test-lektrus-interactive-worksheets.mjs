import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const file="src/LektrusSubjectActivity.tsx";
const src=read(file);
const code=ts.transpileModule(src,{fileName:file,compilerOptions:{
 target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.React
}}).outputText
 .replace(/^import\s+[^;]*;\s*$/gm,"")
 .replace(/^export\s+/gm,"");
const model=new Function(code+"\nreturn {interactiveSubjects,preferredActivityMode,freshActivity,activityComplete,activityScore,mixedIndices};")();
const {interactiveSubjects,preferredActivityMode,freshActivity,activityComplete,activityScore,mixedIndices}=model;
assert.equal(interactiveSubjects("mathematics"),true);
assert.equal(interactiveSubjects("russian"),true);
assert.equal(interactiveSubjects("languages"),true);
assert.equal(interactiveSubjects("physics"),false);
const defaults=[
 ["mathematics","equation","fill"],["mathematics","matching","match"],["mathematics","sequence","order"],
 ["russian","orthography","fill"],["russian","morphemes","match"],["russian","syntax","match"],
 ["russian","morphology","choice"],["russian","sequence","order"],
 ["languages","translation","fill"],["languages","gaps","fill"],["languages","vocabulary","match"],
 ["languages","grammar","choice"],["languages","word-order","order"],["languages","reading","choice"]
];
for(const [subject,format,mode] of defaults){
 assert.equal(preferredActivityMode(subject,format),mode,subject+" / "+format);
 assert.equal(freshActivity(mode).mode,mode);
}
const emptyModes=["choice","fill","match","order"];
for(const mode of emptyModes)assert.equal(activityComplete(freshActivity(mode)),false,
 "A blank task must not lock the worksheet subject");
const choice={mode:"choice",options:["Ответ A","Ответ B","Ответ C"],correctIndex:1};
assert.equal(activityComplete(choice),true);
assert.deepEqual(activityScore(choice,{selected:1}),{correct:1,total:1});
assert.deepEqual(activityScore(choice,{selected:2}),{correct:0,total:1});
const fill={mode:"fill",blanks:[{before:"Выберите ",answer:"слово"},{before:" и число ",answer:"12"}],tail:"."};
assert.equal(activityComplete(fill),true);
assert.deepEqual(activityScore(fill,{values:[" СЛОВО ","12."]}),{correct:2,total:2});
assert.deepEqual(activityScore(fill,{values:["слово","13"]}),{correct:1,total:2});
const pairs={mode:"match",pairs:[{left:"слово",right:"word"},{left:"дом",right:"house"},{left:"вода",right:"water"}]};
assert.equal(activityComplete(pairs),true);
assert.deepEqual(activityScore(pairs,{matched:[2,1,0]}),{correct:1,total:3});
assert.deepEqual(activityScore(pairs,{matched:[0,1,2]}),{correct:3,total:3});
const sequence={mode:"order",tokens:["сначала","потом","затем"]};
assert.equal(activityComplete(sequence),true);
assert.deepEqual(activityScore(sequence,{ordered:[2,0,1]}),{correct:0,total:3});
assert.deepEqual(activityScore(sequence,{ordered:[0,1,2]}),{correct:3,total:3});
for(const len of [2,3,4,6]){
 const mixed=mixedIndices(len);
 assert.equal(new Set(mixed).size,len);
 assert.notDeepEqual(mixed,Array.from({length:len},(_,i)=>i),"The displayed choices must shuffle");
}
const board=read("src/LektrusSubjectBoard.tsx");
const app=read("src/App.tsx");
const registry=read("src/lektrusSubjectTaskTemplates.ts");
const schema=read("src/boardModel.ts");
assert.match(board,/LektrusSubjectActivityBuilder/);
assert.match(board,/LektrusSubjectActivityRunner/);
assert.match(board,/onActivityAnswer\(entry.id,response\)/);
assert.match(app,/patchSubjectBoardEntry\(item.id,entryId,\{activityResponse:response\}\)/);
assert.ok(schema.includes("SubjectTaskActivityResponse"),"Student answers are persisted");
assert.ok(schema.includes("Повреждено интерактивное задание"),"Student answers are validated");
assert.ok(registry.includes('type("cloze","Заполни пропуски"'));
assert.ok(registry.includes('type("matching","Найди пары"'));
assert.ok(registry.includes('type("sequence","Собери решение"'));
for(const label of ["Текст с пропусками","Варианты ответа","Пары для сопоставления","Последовательность"]){
 assert.ok(src.includes(label),label);
}
console.log("Interactive worksheets: authoring presets, validation, scoring, answer sync and deterministic shuffle OK");
