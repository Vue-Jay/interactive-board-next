import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const source=fs.readFileSync(new URL("../src/lektrusRussianSchoolModel.ts",import.meta.url),"utf8");
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,
 target:ts.ScriptTarget.ES2022}}).outputText;
const api={};
new Function("exports",code)(api);
const {russianToolIds,createRussianSchoolDiagram,validateRussianSchoolDiagram,totalSounds}=api;
for(const id of russianToolIds){
 assert.equal(validateRussianSchoolDiagram(createRussianSchoolDiagram(id)),true,id+" default invalid");
}
const m=createRussianSchoolDiagram("ru-morphology");
assert.equal(m.showAnalysis,false,"never expose prefilled grammatical answers");
assert.equal(validateRussianSchoolDiagram({...m,partOfSpeech:"unknown"}),false);
assert.equal(validateRussianSchoolDiagram({...m,rows:[{id:"a",group:"variable",feature:"",value:"Падеж"}]}),true);
assert.equal(validateRussianSchoolDiagram({...m,rows:[{id:"a",group:"variable",feature:"Падеж",value:"И."},{id:"a",group:"syntax",feature:"Роль",value:"Подлежащее"}]}),false);
const p=createRussianSchoolDiagram("ru-phonetics");
assert.equal(totalSounds(p.letters),0);
assert.equal(p.showSounds,false,"answers hidden until instructor enables");
assert.equal(validateRussianSchoolDiagram({...p,word:"аб",letters:[{id:"a",letter:"а",sounds:["а"],characteristic:"",stressed:true},{id:"b",letter:"б",sounds:["б"],characteristic:"",stressed:true}]}),false);
assert.equal(validateRussianSchoolDiagram({...p,word:"котик"}),false,
 "phoneme mapping must match the authored word");
assert.equal(validateRussianSchoolDiagram({...p,word:"а",letters:[{id:"a",letter:"а",sounds:["а","б","в"],characteristic:"",stressed:false}]}),false);
const silent={...p,word:"конь",letters:[
 {id:"1",letter:"к",sounds:["к"],characteristic:"",stressed:false},
 {id:"2",letter:"о",sounds:["о"],characteristic:"",stressed:true},
 {id:"3",letter:"н",sounds:["н'"],characteristic:"",stressed:false},
 {id:"4",letter:"ь",sounds:[],characteristic:"нет звука",stressed:false}
]};
assert.equal(validateRussianSchoolDiagram(silent),true,"soft signs may have zero sounds");
const blankO=createRussianSchoolDiagram("ru-orthography");
assert.deepEqual(blankO.questions,[]);
const o={...blankO,questions:[{id:"q1",prompt:"тр□ва",options:["а","о"],correct:0,explanation:"травы"}]};
assert.equal(o.questions[0].prompt.split("□").length,2);
assert.equal(validateRussianSchoolDiagram({...o,questions:[{...o.questions[0],prompt:"слово"}]}),false);
assert.equal(validateRussianSchoolDiagram({...o,questions:[{...o.questions[0],correct:8}]}),false);
assert.equal(validateRussianSchoolDiagram({...o,questions:[{...o.questions[0],options:["а","а"]}]}),false);
assert.equal(validateRussianSchoolDiagram({...o,questions:[...o.questions,o.questions[0]]}),false);
const registry=fs.readFileSync(new URL("../src/lektrusSubjectToolRegistry.ts",import.meta.url),"utf8");
for(const id of russianToolIds)assert.ok(registry.includes('id:"'+id+'"'),id+" missing subject menu");
const view=fs.readFileSync(new URL("../src/LektrusRussianSchoolView.tsx",import.meta.url),"utf8");
assert.match(view,/onClick=\{\(\)=>setChecked\(true\)\}/,"exercise must have check button");
assert.match(view,/picked===question\.correct/,"exercise evaluates teacher's correct answer");
assert.match(view,/onPointerDown=\{stop\}/,"answer interactions must not paint the board");
const controls=fs.readFileSync(new URL("../src/LektrusRussianSchoolControls.tsx",import.meta.url),"utf8");
const russianView=fs.readFileSync(new URL("../src/LektrusRussianSchoolView.tsx",import.meta.url),"utf8");
const nextView=fs.readFileSync(new URL("../src/LektrusNextSchoolView.tsx",import.meta.url),"utf8");
const approvedModel=fs.readFileSync(new URL("../src/lektrusApprovedSchoolModel.ts",import.meta.url),"utf8");
const approvedControls=fs.readFileSync(new URL("../src/LektrusApprovedSchoolControls.tsx",import.meta.url),"utf8");
assert.equal(validateRussianSchoolDiagram({...o,questions:[{id:"q2",prompt:"□",options:["",""],correct:0,explanation:""}]}),true,
 "Teacher can begin a spelling question without fake letters");
assert.equal(validateRussianSchoolDiagram({...createRussianSchoolDiagram("ru-morphology"),
 rows:[{id:"row1",group:"permanent",feature:"",value:""}]}),true,
 "Morphology can be authored incrementally without prefilled grammatical answers");
assert.ok(!controls.includes('prompt:"Сл□во"'),"No example must be inserted into an exercise");
assert.ok(!controls.includes('feature:"Новый признак"'),"No fake grammatical labels");
assert.ok(russianView.includes('question.options.every(option=>option.trim().length>0)'),
 "Pupils are not offered unfinished spelling questions");
assert.ok(russianView.includes('const signature=question?'),
 "Editing another question does not reset a pupil's current progress");
assert.ok(nextView.includes('onMark={onChange?'),"Standalone syntax diagram supports marking words directly");
assert.ok(approvedModel.includes('!okString(m.id,64)||!okString(m.text,24,true)'),
 "Blank morpheme drafts can be edited");
assert.ok(approvedControls.includes('(["prefix","root","suffix","ending","postfix"] as MorphemeRole[])'),
 "Standalone morpheme editor uses actual school components rather than placeholders");
console.log("Lektrus Russian grammar: morphology traits, silent sounds and stress, spelling quizzes all validated.");
