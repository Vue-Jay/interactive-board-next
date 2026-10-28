import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const path="src/lektrusLanguageGapModel.ts";
const stripped=ts.transpileModule(read(path),{
 fileName:path,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}
}).outputText.replace(/^import[^;]*;\s*$/gm,"").replace(/^export /gm,"");
const model=new Function(stripped+"\nreturn {parseLanguageGapText,languageGapText,isLanguageGapExercise,preserveGapChoices};")();
const {parseLanguageGapText,languageGapText,isLanguageGapExercise,preserveGapChoices}=model;
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
assert.match(activityUi,/lektrus-activity-gap-choices/,"Teacher-created options appear immediately below their own gaps");
assert.ok(!activityUi.includes("lektrus-activity-quick-keys"),"No unsolicited global alphabet or punctuation palette");
assert.match(activityUi,/placeholder=""/,"Ordinary blanks have no prefilled answers or pickers");
assert.match(activityUi,/const pairs=quickSource.split/,"Teachers can paste vocabulary pairs");
assert.match(board,/punctuation=\{tone==="russian"/,"Pupil board distinguishes punctuation gaps");
assert.match(styles,/width:min\(1180px/,"Language editor gets enough working space");
const activityPath="src/LektrusSubjectActivity.tsx";
const activityJs=ts.transpileModule(read(activityPath),{fileName:activityPath,
 compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.React}
}).outputText.replace(/^import[^;]*;\s*$/gm,"").replace(/^export /gm,"");
const {activityComplete,activityScore}=new Function(activityJs+
 "\nreturn {activityComplete,activityScore};")();
const twoLetters={mode:"fill",blanks:[{before:"б",answer:"е",choices:["е","и"]}],tail:"реза"};
assert.equal(activityComplete(twoLetters),true,"Two distinct letters and a correct answer form a valid exercise");
assert.deepEqual(activityScore(twoLetters,{values:["и"]}),{correct:0,total:1});
assert.deepEqual(activityScore(twoLetters,{values:["е"]}),{correct:1,total:1});
assert.equal(activityComplete({...twoLetters,blanks:[{before:"б",answer:"е",choices:["е",""]}]}),false,
 "Missing distractor must not yield a completed exercise");
assert.equal(activityComplete({...twoLetters,blanks:[{before:"б",answer:"е",choices:["е","Е"]}]}),false,
 "Options cannot be the same letter in different case");
assert.equal(activityComplete({...twoLetters,blanks:[{before:"б",answer:"е"}]}),true,
 "A plain fill-in blank does not require choosing an answer");
const selectable=parseLanguageGapText("бер[е]за, п[о]ле");
selectable.activity.blanks[0].choices=["е","и"];
assert.equal(selectable.activity.blanks[1].choices,undefined,"Plain gaps remain plain");
const kept=preserveGapChoices(parseLanguageGapText("бер[е]за, п[о]ле!"),selectable.activity);
assert.deepEqual(kept.activity.blanks[0].choices,["е","и"],"Options survive changing surrounding text");
assert.equal(kept.activity.blanks[1].choices,undefined);
const deleted=preserveGapChoices(parseLanguageGapText("береза, п[о]ле"),selectable.activity);
assert.equal(deleted.activity.blanks[0].choices,undefined,"Removed gaps cannot transfer variants to a different answer");
const duplicate=parseLanguageGapText("тр[а]ва, з[а]ря");
duplicate.activity.blanks[1].choices=["а","о"];
const duplicateKept=preserveGapChoices(parseLanguageGapText("тр[а]ва, з[а]ря!"),duplicate.activity);
assert.equal(duplicateKept.activity.blanks[0].choices,undefined,"Identical correct letters do not steal each other's options");
assert.deepEqual(duplicateKept.activity.blanks[1].choices,["а","о"]);
assert.match(studio,/configureChoices/,"Teacher can switch one gap between typing and two options");
assert.match(studio,/updateDistractor/,"Teacher can supply the alternate letter");
// Grammar and reading use the existing answer field, without leaking one
// student's answers into another task or adding a second persistence path.
const foreignPath="src/LektrusForeignTaskAnswer.tsx";
const foreignJs=ts.transpileModule(read(foreignPath),{fileName:foreignPath,
 compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.React}
}).outputText.replace(/^import[^;]*;\s*$/gm,"").replace(/^export default /gm,"")
 .replace(/^export /gm,"");
const foreign=new Function(foreignJs+"\nreturn {foreignTaskLines,foreignAnswerAt,editForeignAnswer};")();
assert.deepEqual(foreign.foreignTaskLines("A sentence\n\nB sentence"),["A sentence","B sentence"]);
assert.equal(foreign.editForeignAnswer("",1,"Has she gone?",3),"\nHas she gone?\n");
assert.equal(foreign.foreignAnswerAt("\nHas she gone?\n",1),"Has she gone?");
assert.equal(foreign.editForeignAnswer("one\ntwo",0,"other\nline",2),"other line\ntwo",
 "Each grammar response stays on its own row");
assert.equal(foreign.editForeignAnswer("",0,"a".repeat(2001),1),"",
 "Stored answers must respect the board's 2000 character limit");
assert.match(board,/LektrusForeignTaskAnswer/,"Foreign pupil work is shown in the subject board");
assert.match(studio,/LektrusForeignTaskAnswer/,"Teacher sees the same foreign language worksheet");
assert.match(studio,/Предложения для преобразования/);
assert.match(studio,/Разметить знаки/,"Teacher can mark punctuation");
assert.match(studio,/Место без знака/,"Punctuation asks whether a mark is necessary");
assert.match(activityUi,/Объяснить постановку знаков/,"Student has to explain punctuation");
assert.match(activityUi,/Правило преподавателя/,"Teacher rule is revealed only after checking");
const punctuationDraft=parseLanguageGapText("Он сказал[,] что придёт[∅] завтра");
punctuationDraft.activity.blanks[0].rule="Части сложного предложения";
punctuationDraft.activity.blanks[1].rule="Знак не требуется";
const punctuationEdited=preserveGapChoices(
 parseLanguageGapText("Он сказал[,] что придёт[∅] завтра."),punctuationDraft.activity);
assert.equal(punctuationEdited.activity.blanks[0].rule,"Части сложного предложения");
assert.equal(punctuationEdited.activity.blanks[1].rule,"Знак не требуется");
assert.deepEqual(activityScore(punctuationEdited.activity,{values:[",","∅"]}),{correct:2,total:2});
console.log("Language studio: Russian spelling/punctuation, English gaps, authoring, safe preview, archived exercises OK");
