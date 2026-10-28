import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const path="src/lektrusLanguageGapModel.ts";
const stripped=ts.transpileModule(read(path),{
 fileName:path,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}
}).outputText.replace(/^import[^;]*;\s*$/gm,"").replace(/^export /gm,"");
const model=new Function(stripped+"\nreturn {parseLanguageGapText,languageGapText,isLanguageGapExercise};")();
const {parseLanguageGapText,languageGapText,isLanguageGapExercise}=model;
for(const [tone,type,expected] of [
 ["russian","orthography",true],["russian","punctuation",true],
 ["russian","morphology",false],["russian","syntax",false],
 ["languages","gaps",true],["languages","translation",false],
 ["languages","word-order",false],["mathematics","equation",false]
])assert.equal(isLanguageGapExercise(tone,type),expected);
const cases=[
 {src:"бер[е]за",answers:["е"],before:["бер"],tail:"за"},
 {src:"[В]ода, [в]етер.",answers:["В","в"],before:["","ода, "],tail:"етер."},
 {src:"Стемнело[,] когда мы вышли[.]",answers:[",","."],before:["Стемнело"," когда мы вышли"],tail:""},
 {src:"We [have] [been] studying.",answers:["have","been"],before:["We "," "],tail:" studying."},
 {src:"Четыре + [пять] = девять",answers:["пять"],before:["Четыре + "],tail:" = девять"}
];
for(const item of cases){
 const data=parseLanguageGapText(item.src);
 assert.equal(data.issue,null,item.src);
 assert.equal(data.count,item.answers.length,item.src);
 assert.equal(data.activity.mode,"fill");
 assert.deepEqual(data.activity.blanks.map(x=>x.answer),item.answers);
 assert.deepEqual(data.activity.blanks.map(x=>x.before),item.before);
 assert.equal(data.activity.tail,item.tail);
 assert.equal(languageGapText(data.activity),item.src,"Roundtrip preserves original text");
}
for(const input of ["[","]","а[]б","а[б[в]","abc", "[x]".repeat(9)]){
 const value=parseLanguageGapText(input);
 assert.ok(value.issue,input+" must have a useful error");
 assert.equal(value.activity,undefined);
}
assert.equal(parseLanguageGapText("").issue,null);
assert.equal(parseLanguageGapText("").activity,undefined);
assert.equal(languageGapText({mode:"fill",blanks:[{before:"",answer:""}],tail:""}),"",
 "A new exercise must not open with a fabricated bracket placeholder");
const studio=read("src/LektrusLanguageTaskStudio.tsx");
const board=read("src/LektrusSubjectBoard.tsx");
const registry=read("src/lektrusSubjectTaskTemplates.ts");
assert.match(studio,/Сделать пропуск/);
assert.match(studio,/selectedRef.current/);
assert.match(studio,/parseLanguageGapText\(value\)/);
assert.match(studio,/entry.details\?\.markup\?\?languageGapText\(entry.activity\)/);
assert.match(studio,/onChange=\{next=>\{patch\(\{activity:next,activityResponse:undefined\}\)/);
assert.match(studio,/На доске ученика/);
assert.match(studio,/LektrusSubjectActivityRunner/);
assert.match(board,/tone==="russian"\|\|tone==="languages"/);
assert.match(board,/LektrusLanguageTaskStudio/);
assert.match(board,/key!=="markup"/);
const mathOptions=registry.split(" mathematics:[")[1].split(" physics:[")[0];
assert.ok(!mathOptions.includes('type("interactive"'),
 "New math tasks must not expose interactive training");
assert.ok(registry.includes('type("interactive","Интерактивный тренажёр","Сохранённое интерактивное упражнение")'),
 "Do not delete legacy mathematical exercises");
const activityUi=read("src/LektrusSubjectActivity.tsx");
const styles=read("src/lektrusSubjectBoard.css");
assert.match(studio,/const removeGap=/,"Teacher can remove a single hidden fragment");
assert.match(studio,/const insertPunctuation=/,"Punctuation offers sign insertion at cursor");
assert.match(studio,/lektrus-language-target/,"Morphology word can be chosen from a sentence");
assert.match(studio,/lektrus-language-question-row/,"Reading questions use editable rows");
assert.match(studio,/Сделать пропуск/,"Highlighted material becomes a masked exercise");
assert.match(activityUi,/lektrus-activity-quick-keys/,"Pupil has quick keys for language exercises");
assert.match(activityUi,/const pairs=quickSource.split/,"Teachers can paste vocabulary pairs");
assert.match(board,/orthography=\{tone==="russian"/,"Pupil board enables the orthography palette");
assert.match(styles,/width:min\(1180px/,"Language editor gets enough working space");
console.log("Language studio: Russian spelling/punctuation, English gaps, authoring, safe preview, archived exercises OK");
