import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const src=fs.readFileSync(new URL("../src/lektrusLanguageSocialModel.ts",import.meta.url),"utf8");
const javascript=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,
 target:ts.ScriptTarget.ES2022}}).outputText;
const api={};
new Function("exports",javascript)(api);
const {sentencePatterns,civicsTemplates,tokenizeSentence,initialScramble,
 validateLanguageSocialDiagram,newLanguageSocialDiagram}=api;
assert.ok(sentencePatterns.length>=30,"expect extensive reviewed grammar patterns, not just three canned examples");
assert.equal(new Set(sentencePatterns.map(p=>p.id)).size,sentencePatterns.length,"reference patterns should have stable unique IDs");
for(const p of sentencePatterns){
 assert.equal(p.sample.length>6,true,"every reference pattern should have a real example");
 assert.equal(p.tip.length>15,true,"every reference pattern needs practical punctuation guidance");
}
const sentence=newLanguageSocialDiagram("ru-sentence-builder");
assert.equal(validateLanguageSocialDiagram(sentence),true);
assert.equal(sentence.showKey,false,"do not reveal teacher answers to students");
const tokens=tokenizeSentence("Когда наступила весна, птицы вернулись.");
assert.equal(tokens.length,5);
const randomized=initialScramble(tokens);
assert.equal(randomized.length,tokens.length);
assert.equal(new Set(randomized).size,tokens.length);
assert.deepEqual([...randomized].sort(),tokens.map(p=>p.id).sort());
assert.notDeepEqual(randomized,tokens.map(p=>p.id),"not allowed to open with the solved order");
assert.deepEqual(initialScramble(tokens),randomized,"lesson reload must not randomly change token positions");
for(let n=2;n<=24;n++){
 const parts=Array.from({length:n},(_,i)=>({id:"id"+i,text:"Слово "+i}));
 const shuffled=initialScramble(parts);
 assert.equal(shuffled.length,n);
 assert.equal(new Set(shuffled).size,n);
 assert.notDeepEqual(shuffled,parts.map(p=>p.id));
}
assert.equal(validateLanguageSocialDiagram({...sentence,parts:[
 {id:"a",text:"слово"},{id:"a",text:"слово"}]}),false);
assert.equal(validateLanguageSocialDiagram({...sentence,parts:[
 {id:"a",text:""}]}),false);
const civics=newLanguageSocialDiagram("civics-structure");
assert.equal(validateLanguageSocialDiagram(civics),true);
assert.equal(civics.edges.length,0,"separation of powers must not imply hierarchy by default");
assert.equal(civics.nodes.length,3);
assert.ok(Object.keys(civicsTemplates).length>=3);
for(const template of Object.values(civicsTemplates)){
 const draft={...civics,nodes:structuredClone(template.nodes),edges:structuredClone(template.edges)};
 assert.equal(validateLanguageSocialDiagram(draft),true,template.label+" should validate");
}
assert.equal(validateLanguageSocialDiagram({...civics,edges:[
 {id:"e1",from:"leg",to:"leg",kind:"subordinate"}]}),false,"no self-relations");
assert.equal(validateLanguageSocialDiagram({...civics,nodes:civics.nodes.map(n=>({...n,column:0,row:0}))}),false,
 "blocks in same grid slot must be rejected");
assert.equal(validateLanguageSocialDiagram({...civics,edges:[
 {id:"e1",from:"leg",to:"missing",kind:"part"}]}),false);
const registry=fs.readFileSync(new URL("../src/lektrusSubjectToolRegistry.ts",import.meta.url),"utf8");
for(const id of ["language-sentence-builder","civics-structure","literature-analysis"])
 assert.match(registry,new RegExp('id:"'+id+'"'),"active classroom tool appears in the subject menu");
assert.ok(!registry.includes('{id:"ru-sentence-builder",label:'),"Retired Russian sentence builder is not offered as a duplicate tool");
assert.equal(validateLanguageSocialDiagram(newLanguageSocialDiagram("ru-sentence-builder")),true,"Previously saved Russian sentence diagrams stay readable");
assert.equal(validateLanguageSocialDiagram(newLanguageSocialDiagram("literature-analysis")),true);
assert.equal(validateLanguageSocialDiagram(newLanguageSocialDiagram("language-sentence-builder")),true);
const view=fs.readFileSync(new URL("../src/LektrusLanguageSocialView.tsx",import.meta.url),"utf8");
assert.match(view,/picked|chosen/);
assert.match(view,/onPointerDown=\{stop\}/);
assert.match(view,/Правильно!/);
console.log("Lektrus sentence builder and civics: curriculum patterns, deterministic word shuffle, strict graph validation and interactive checking passed.");
