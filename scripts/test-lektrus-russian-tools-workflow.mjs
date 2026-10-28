import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const isolate=path=>{
 const js=ts.transpileModule(read(path),{fileName:path,compilerOptions:{
  target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.React
 }}).outputText.replace(/^import[^;]*;\s*$/gm,"").replace(/^export /gm,"");
 return js;
};
const logic=new Function(isolate("src/lektrusRussianWorkLogic.ts")+
 "\nreturn {russianSentenceTokens,isSingleRussianWord,russianWordParts,changeRussianMorphemeBoundary,russianTaskHasWork};")();
assert.deepEqual(logic.russianSentenceTokens("Солнце светит. Ветер дует!"),
 ["Солнце","светит",".","Ветер","дует","!"]);
assert.deepEqual(logic.russianSentenceTokens("Старый-старый дом."),
 ["Старый-старый","дом","."]);
for(const word of ["ёлка","подъезд","кофе","по-русски"])assert.equal(logic.isSingleRussianWord(word),true,word);
for(const word of ["", "два слова", "слово!", "3 кота", "слово  " .repeat(15)])assert.equal(logic.isSingleRussianWord(word),false,word);
const word="подписка";
const previous={cuts:[3,6],morphemeRoles:["prefix","root","ending"],zeroEnding:false};
assert.deepEqual(logic.russianWordParts(word,previous).map(x=>x.text),["под","пис","ка"]);
const newCut=logic.changeRussianMorphemeBoundary(word,previous,7);
assert.deepEqual(newCut.cuts,[3,6,7]);
assert.deepEqual(newCut.morphemeRoles,["prefix","root","unset","unset"]);
const merged=logic.changeRussianMorphemeBoundary(word,previous,3);
assert.deepEqual(merged.cuts,[6]);
assert.deepEqual(merged.morphemeRoles,["unset","ending"]);
assert.deepEqual(logic.changeRussianMorphemeBoundary(word,previous,0).cuts,[3,6]);
assert.equal(logic.russianTaskHasWork({source:"слово"}),false);
assert.equal(logic.russianTaskHasWork({syntaxRoles:["none","predicate"]}),true);
assert.equal(logic.russianTaskHasWork({cuts:[3]}),true);

const model=new Function(isolate("src/lektrusRussianSchoolModel.ts")+
 "\nreturn {synchronizePhoneticLetters,phoneticWordValid,russianMorphologyFeatures};")();
const sound={id:"a",letter:"о",sounds:["о"],characteristic:"гласный",stressed:true};
const old=[sound,{id:"b",letter:"к",sounds:["к"],characteristic:"согласный",stressed:false}];
let counter=0;
const changed=model.synchronizePhoneticLetters("мок",old,()=>String(++counter));
assert.deepEqual(changed.map(x=>x.letter),["м","о","к"]);
assert.equal(changed[1].id,"a","Keep annotations after a prefix is added");
assert.deepEqual(changed[1].sounds,["о"]);
assert.equal(changed[2].id,"b");
assert.equal(changed[0].sounds.length,0,"Never fabricate transcription");
assert.equal(model.synchronizePhoneticLetters("ок",old,()=>String(++counter))[0].id,"a");
assert.equal(model.synchronizePhoneticLetters("от",old,()=>String(++counter))[1].sounds.length,0);
for(const word of ["","кот","кошка","по-русски"])assert.equal(model.phoneticWordValid(word),true);
for(const word of ["два слова","123","."])assert.equal(model.phoneticWordValid(word),false);
assert.ok(model.russianMorphologyFeatures.noun.permanent.includes("Склонение"));
assert.ok(model.russianMorphologyFeatures.verb.variable.includes("Наклонение"));
const pupil=read("src/LektrusRussianTaskAnswer.tsx");
const teacher=read("src/LektrusRussianSchoolControls.tsx");
const syntax=read("src/LektrusNextSchoolControls.tsx");
assert.ok(pupil.includes("changeRussianMorphemeBoundary(word,state,n)"));
assert.ok(pupil.includes('role===selectedRole?"none":selectedRole'),"Tap again to remove a grammar mark");
assert.ok(pupil.includes("Снять все подчёркивания"));
assert.ok(pupil.includes("Сбросить разбор"));
assert.ok(teacher.includes("synchronizePhoneticLetters"));
assert.ok(teacher.includes("phoneticWordValid"));
assert.ok(teacher.includes("russianMorphologyFeatures"));
assert.ok(teacher.includes("В тексте должен быть один пропуск"));
assert.ok(!teacher.includes('"новый вариант"'),"No example answers in new choices");
assert.ok(syntax.includes("SyntaxSentenceSetup"));
assert.ok(syntax.includes("Разместить слова на схеме"));
assert.ok(syntax.includes("russianSentenceTokens(source)"));
const board=read("src/LektrusSubjectBoard.tsx");
const studio=read("src/LektrusLanguageTaskStudio.tsx");
assert.ok(board.includes("LektrusRussianTaskAnswer entry={entry}"),"Inline school work is usable on the worksheet");
assert.ok(studio.includes("LektrusRussianTaskAnswer entry={entry}"),"Teacher can test Russian work in preview");
console.log("Russian workflows: word segmentation, reversible roles, phonetic preservation, native teacher tools and pupil work OK");
