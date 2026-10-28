import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const file="src/LektrusRussianTaskAnswer.tsx";
const js=ts.transpileModule(read(file),{fileName:file,compilerOptions:{
 target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.React
}}).outputText.replace(/^import[^;]*;\s*$/gm,"").replace(/^export default /gm,"").replace(/^export /gm,"");
const tokenizerJs=ts.transpileModule(read("src/lektrusRussianWorkLogic.ts"),{
 fileName:"src/lektrusRussianWorkLogic.ts",
 compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}
}).outputText.replace(/^import[^\n]*;\s*$/gm,"").replace(/^export /gm,"");
const tokenizer=new Function(tokenizerJs+"\nreturn russianSentenceTokens;")();
const api=new Function("grammarRoles","morphemeNames","posNames","russianSentenceTokens",js+
 "\nreturn {splitRussianSentence,separateRussianQuestions,russianWorkSource};")(
 {subject:"Подлежащее",predicate:"Сказуемое",attribute:"Определение",
 object:"Дополнение",adverbial:"Обстоятельство",none:"Не отмечать"},
 {prefix:"Приставка",root:"Корень",suffix:"Суффикс",ending:"Окончание",postfix:"Постфикс"},
 {noun:"Имя существительное"},
 tokenizer
);
assert.deepEqual(api.splitRussianSentence("Тихо шумел лес."),
 ["Тихо","шумел","лес","."]);
assert.deepEqual(api.splitRussianSentence("По дороге шёл старый-старый кот."),
 ["По","дороге","шёл","старый-старый","кот","."]);
assert.deepEqual(api.separateRussianQuestions(" Что произошло?\n\n Почему?\n"),
 ["Что произошло?","Почему?"]);
assert.equal(api.separateRussianQuestions("Вопрос\n".repeat(23)).length,15);
assert.equal(api.russianWorkSource({format:"text",details:{material:"Весь рассказ",questions:"Кто герой?"}}),"Кто герой?");
assert.equal(api.russianWorkSource({format:"syntax",details:{material:"Птицы поют"}}),"Птицы поют");
const answer=read(file),board=read("src/LektrusSubjectBoard.tsx");
const app=read("src/App.tsx"),model=read("src/boardModel.ts");
const studio=read("src/LektrusLanguageTaskStudio.tsx");
const templates=read("src/lektrusSubjectTaskTemplates.ts");
const registry=read("src/lektrusSubjectToolRegistry.ts");
const panel=read("src/LektrusSubjectToolsPanel.tsx");
for(const text of [
 'morphemeNames','grammarRoles','posNames','Граница после буквы',
 'className="lektrus-rus-word-divider"','className="lektrus-rus-roles"',
 'Подчеркните члены предложения','Нулевое окончание',
 'Постоянные признаки','Непостоянные признаки','Синтаксическая роль',
 'Ответьте на вопросы к тексту'
])assert.ok(answer.includes(text),text);
assert.ok(board.includes('onRussianWorkChange(entry.id,work)'));
assert.ok(board.includes('["morphemes","syntax","morphology","text"].includes(entry.format'));
assert.ok(board.includes('LektrusRussianTaskAnswer'));
assert.ok(app.includes('patchSubjectBoardEntry(item.id,entryId,{russianWork:work})'));
assert.ok(app.includes('"russianWork"].includes(key)'),"Learners and guests may submit structured analyses");
assert.ok(model.includes('russianWork?:RussianTaskWork'));
assert.ok(model.includes('Повреждён разбор по русскому языку'));
assert.ok(studio.includes('previewRussian'));
assert.ok(studio.includes('LektrusRussianTaskAnswer entry={entry}'));
assert.ok(templates.includes('field("target","Разбираемое слово"'));
assert.ok(!templates.split(' russian:[')[1].split(' languages:[')[0].includes('type("interactive"'),
 "Do not show redundant Russian trainer in new task selector");
assert.ok(!registry.includes('{id:"ru-sentence-builder",label:'),
 "Old sentence builder must not be offered as an independent tool");
assert.ok(!panel.includes('ids:["ru-orthography","ru-sentence-builder"]'));
assert.ok(read("src/lektrusSubjectBoard.css").includes(".lektrus-rus-token.mark-subject"));
assert.ok(answer.includes("morphologyPlans"),"Morphological features depend on part of speech");
assert.ok(answer.includes("Начальная форма"),"Morphology asks for an initial form");
assert.ok(answer.includes("lektrus-rus-school-analysis"),"Morphology uses compact notebook layout");
assert.ok(answer.includes("lektrus-rus-school-number"),"School morphology uses Roman numeral outline");
assert.ok(!answer.includes("lektrus-rus-morph-step"),"Old oversized morphology cards are removed");
assert.ok(model.includes("initialForm?:string"),"Initial form is included in saved student work");
console.log("Russian schoolwork: morpheme boundaries, shared role markings, morphology, question answers and pupil permissions OK");
