import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const source=fs.readFileSync(new URL("../src/lektrusBiologyExtensionModel.ts",import.meta.url),"utf8");
const compiled=ts.transpileModule(source,{compilerOptions:{
 module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const api={};
new Function("exports",compiled)(api);
const {dnaComplement,newBiologyExtension,taxonomyExample,taxonomyRanks,
 validateBiologyExtension}=api;
assert.equal(dnaComplement("ATGC"),"TACG");
assert.equal(dnaComplement("AATTGGCC"),"TTAACCGG");
for(const id of ["bio-dna","bio-taxonomy"]){
 const diagram=newBiologyExtension(id);
 assert.equal(validateBiologyExtension(diagram),true,id+" default is valid");
}
const dna=newBiologyExtension("bio-dna");
assert.equal(validateBiologyExtension({...dna,sequence:"ATGGATCC"}),true);
assert.equal(validateBiologyExtension({...dna,sequence:"ATGN"}),false,"N is not supported here");
assert.equal(validateBiologyExtension({...dna,sequence:""}),false);
assert.equal(validateBiologyExtension({...dna,sequence:"A".repeat(25)}),false);
assert.equal(validateBiologyExtension({...dna,showDirection:"no"}),false);
for(const group of ["animal","plant"]){
 const model=taxonomyExample(group);
 assert.equal(validateBiologyExtension(model),true,group+" example validates");
 assert.deepEqual(model.rows.map(v=>v.rank),taxonomyRanks);
 assert.equal(validateBiologyExtension({...model,rows:model.rows.slice(1)}),false);
 assert.equal(validateBiologyExtension({...model,rows:model.rows.map((r,i)=>i===0?{...r,name:""}:r)}),false);
 assert.equal(validateBiologyExtension({...model,rows:[model.rows[1],model.rows[0],...model.rows.slice(2)]}),false);
}
const registry=fs.readFileSync(new URL("../src/lektrusSubjectToolRegistry.ts",import.meta.url),"utf8");
for(const id of ["bio-dna","bio-taxonomy"])assert.match(registry,new RegExp('id:"'+id+'"'));
const editor=fs.readFileSync(new URL("../src/LektrusSchoolDiagramEditor.tsx",import.meta.url),"utf8");
assert.match(editor,/LektrusBiologyExtensionControls/);
const view=fs.readFileSync(new URL("../src/LektrusSchoolDiagramView.tsx",import.meta.url),"utf8");
assert.match(view,/LektrusBiologyExtensionView/);
console.log("Biology extensions: validated complementarity, editable taxonomic ranks, editor and board wiring.");
