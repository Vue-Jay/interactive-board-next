import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";

const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const stripped=path=>ts.transpileModule(read(path),{fileName:path,compilerOptions:{
 target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.React
}}).outputText.replace(/^import[^;]*;\s*$/gm,"").replace(/^export /gm,"");
const registry=new Function(stripped("src/lektrusSubjectTaskTemplates.ts")+
 "\nreturn {subjectTaskTemplates,subjectTaskTypeKnown,subjectTaskTypeAllowed};")();
const interaction=new Function(stripped("src/LektrusSubjectActivity.tsx")+
 "\nreturn {preferredActivityMode,activityMatchesTask,interactiveModesForSubject,activityScore};")();
const solution=new Function(stripped("src/LektrusSubjectBoardSolution.tsx")+
 "\nreturn {givenWithLegacyUnits,withoutSeparateUnits,hasWorkedSolution};")();
const expected={
 mathematics:["task","word-problem","equation","geometry"],
 physics:["task","calculation","lab"],
 chemistry:["task","chain","calculation","experiment"],
 russian:["task","orthography","punctuation","morphemes","morphology","syntax","text"],
 languages:["task","translation","gaps","vocabulary","word-order"],
 biology:["task"],geography:["task"],history:["task"],literature:["task"],
 social:["task"],informatics:["task"]
};
for(const [tone,formats] of Object.entries(expected)){
 const actual=registry.subjectTaskTemplates[tone];
 assert.deepEqual(actual.map(x=>x.id),formats,tone+" offers only pedagogically relevant work");
 assert.equal(new Set(actual.map(x=>x.id)).size,formats.length,tone+" contains duplicate modes");
 for(const task of actual){
  assert.ok(task.title.trim()&&task.instruction.trim(),tone+"/"+task.id+" must explain its purpose");
  assert.equal(registry.subjectTaskTypeAllowed(tone,task.id),true);
 }
}
const math=registry.subjectTaskTemplates.mathematics;
assert.equal(math.find(x=>x.id==="word-problem").fields.length,0,
 "Teacher supplies the problem only, pupil fills the school solution");
assert.deepEqual(interaction.interactiveModesForSubject("mathematics"),["choice","fill","match","order"]);
assert.deepEqual(interaction.interactiveModesForSubject("russian"),["choice","match","order"]);
assert.equal(interaction.activityMatchesTask("mathematics","interactive",{mode:"fill"}),true);
assert.equal(interaction.activityMatchesTask("russian","interactive",{mode:"order"}),true);
assert.equal(interaction.activityMatchesTask("russian","interactive",{mode:"fill"}),false);
for(const [tone,format,mode] of [
 ["russian","orthography","fill"],["russian","punctuation","fill"],
 ["russian","morphemes",null],["russian","morphology",null],
 ["russian","syntax",null],["russian","text",null],
 ["languages","vocabulary","match"],["languages","word-order","order"],
 ["languages","gaps","fill"],["languages","translation",null],
 ["languages","grammar",null],["languages","reading",null],
 ["physics","lab",null],["chemistry","chain",null]
])assert.equal(interaction.preferredActivityMode(tone,format),mode,
 "Use only meaningful interaction for "+tone+"/"+format);
for(const [tone,oldFormats] of [
 ["mathematics",["interactive","choice","cloze","matching","sequence","expression","function"]],
 ["russian",["interactive","choice","matching","sequence","cloze"]],
 ["chemistry",["equation","balance"]],
 ["languages",["matching","sequence","cloze","grammar","reading","choice"]]
]){
 for(const format of oldFormats){
  assert.equal(registry.subjectTaskTypeKnown(tone,format),true,"Preserve older "+tone+"/"+format);
  assert.equal(registry.subjectTaskTypeAllowed(tone,format),false,"Retired types must not be offered anew");
 }
}
const prev={given:"m = 2 кг",find:"v",si:"m = 2000 г",work:"",answer:""};
assert.equal(solution.givenWithLegacyUnits(prev),"m = 2 кг\nm = 2000 г");
assert.deepEqual(solution.withoutSeparateUnits(prev),
 {...prev,given:"m = 2 кг\nm = 2000 г",si:""});
assert.equal(solution.hasWorkedSolution({...prev,given:"",si:"100 см = 1 м"}),true);
const ui=read("src/LektrusSubjectBoardSolution.tsx");
assert.ok(!ui.includes('<strong>СИ'),"No stand-alone conversion box in the school notebook");
assert.ok(!ui.includes('label="СИ"'),"No SI input on the worksheet");
assert.ok(!ui.includes('className="lektrus-school-solution-si"'),"No SI input in expanded editor");
assert.match(ui,/value=\{givenWithLegacyUnits\(current\)\}/);
assert.match(ui,/withoutSeparateUnits\(current\)/);
const board=read("src/LektrusSubjectBoard.tsx");
assert.match(board,/isIntegratedInteractiveTask\(tone,current.id\)/);
assert.match(board,/interactiveModesForSubject\(tone\)\.map/);
assert.match(board,/onClick=\{\(\)=>\{patch\(\{activity:freshActivity\(activityMode\)/);
assert.match(board,/options.length>1/);
const app=read("src/App.tsx");
assert.match(app,/!subjectTaskTypeAllowed\(tone,changes.format\)/);
const punctuation={mode:"fill",blanks:[{before:"Вставьте знак: ",answer:","}],tail:""};
assert.deepEqual(interaction.activityScore(punctuation,{values:[","]}),{correct:1,total:1});
assert.deepEqual(interaction.activityScore(punctuation,{values:["."]}),{correct:0,total:1});
assert.deepEqual(interaction.activityScore({mode:"fill",blanks:[{before:"Ответ: ",answer:"12"}],tail:""},
 {values:["12."]}),{correct:1,total:1});
console.log("Subject audit: concise types, meaningful builders, preserved legacy homework, exact punctuation and no separate SI field OK");
