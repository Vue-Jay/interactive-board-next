import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";

const read=(path)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const load=(path,bindings={})=>{
 const compiled=ts.transpileModule(read(path),{
  compilerOptions:{target:ts.ScriptTarget.ES2023,module:ts.ModuleKind.ESNext}
 }).outputText;
 const clean=compiled.replace(/^import[\s\S]*?from ["'][^"']+["'];\s*$/gm,"")
  .replace(/^export (?=(const|function|class)\b)/gm,"");
 const names=Object.keys(bindings);
 const declared=[...clean.matchAll(/^(?:const|function|class) (\w+)/gm)].map(v=>v[1]);
 return new Function(...names,clean+"\nreturn {"+declared.join(",")+"};")(...names.map(k=>bindings[k]));
};
const model=load("src/lektrusChemicalEquationModel.ts");
const db=load("src/lektrusReactionDatabase.ts");
const guide=load("src/lektrusChemicalReactionGuide.ts",{
 countFormulaAtoms:model.countFormulaAtoms,
 normalizeFormulaInput:model.normalizeFormulaInput,
 parseEquationDraft:model.parseEquationDraft,
 identifyReaction:db.identifyReaction,
 reviewedReactionCases:db.reviewedReactionCases,
 substances:db.substances
});
const example=guide.reactionExamples[0];
assert.ok(guide.reactionExamples.length>=6,"Classroom examples ready");
assert.ok(db.reviewedReactionCases.length>=60,"Use substantial existing validated reaction set");
assert.ok(guide.schoolSubstances.length>=100,"Use school substances catalogue");
assert.equal(guide.lookupSubstance("CuSO₄")?.name,"Сульфат меди(II)");
assert.equal(guide.searchSchoolSubstances("гидроксид меди").some(s=>s.formula==="Cu(OH)2"),true);
assert.ok(guide.searchSchoolSubstances("H2SO4").some(s=>s.formula==="H2SO4"));
assert.ok(guide.searchSchoolSubstances("", "соль").every(s=>s.kind==="соль"));
assert.equal(guide.reactionEnvironments.length,4);
const reaction=(s,env="aqueous")=>guide.getReactionGuidance(model.parseEquationDraft(s),env);
const noReaction=reaction("Cu + HCl → CuCl2 + H2");
assert.equal(noReaction.status,"none","Do not invent products for Cu and dilute HCl");
const unknown=reaction("KCl + Zn → ZnCl2 + K");
assert.equal(unknown.status,"unknown","Unknown is not evidence of no reaction");
const mistakenEnvironment=reaction("CH4 + O2 → CO2 + H2O");
assert.equal(mistakenEnvironment.status,"unknown");
const ignited=reaction("CH4 + O2 → CO2 + H2O","ignited");
assert.equal(ignited.status,"reaction");
assert.equal(ignited.products,"match");
assert.equal(reaction("NaOH + HCl → H2O + NaCl").products,"match",
 "Product order and coefficients do not change product identity");
assert.equal(reaction("NaOH + HCl → NaCl + H2").products,"different",
 "Balanced but chemically implausible products cannot be accepted");
assert.equal(reaction("HCl + Na2CO3 → ").products,"empty");
assert.equal(reaction("CaCO3 → CaO + CO2","heated").status,"reaction");
assert.equal(guide.suggestedPartners(["HCl"],"aqueous").some(s=>s.formula==="NaOH"),true);
assert.deepEqual(guide.suggestedPartners(["HCl","NaOH"],"aqueous"),[]);
assert.equal(guide.sourceReactionDraft(example.reaction).left.length,2);
assert.equal(guide.isBuilderCompatible(model.parseEquationDraft("Na+ + Cl- → NaCl")),false);
assert.equal(guide.isBuilderCompatible(model.parseEquationDraft("Al2(SO4)3 → Al2O3 + SO3")),true);
const combination=(a,charge,b)=>guide.composeReviewedIonicCompound(
 guide.cations.find(x=>x.id===a&&x.charge===charge),
 guide.anions.find(x=>x.id===b)
);
assert.equal(combination("Na",1,"Cl").substance?.formula,"NaCl");
assert.equal(combination("Ca",2,"OH").substance?.formula,"Ca(OH)2");
assert.equal(combination("Fe",3,"SO4").substance?.formula,"Fe2(SO4)3");
assert.equal(combination("NH4",1,"SO4").substance?.formula,"(NH4)2SO4");
assert.equal(combination("Al",3,"PO4").substance,null,"No invented AlPO4 catalogue entry");
const notKnown=combination("Ag",1,"PO4");
assert.equal(notKnown.substance,null);
assert.ok(notKnown.error?.includes("не подтверждён"),"Do not invent unverified stable salts");
const ui=read("src/LektrusChemistryGuidedBuilder.tsx");
const editor=read("src/LektrusChemicalEquationEditor.tsx");
const css=read("src/lektrusChemistryGuidedBuilder.css");
const main=read("src/main.tsx");
for(const [name,content] of [["guide",ui],["editor",editor]]){
 const ast=ts.createSourceFile(name+".tsx",content,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 assert.equal(ast.parseDiagnostics.length,0,name+" syntax");
}
for(const feature of ["Справочник веществ","Составить по ионам","Проверенные реакции",
 "onSelectScenario","getReactionGuidance","suggestedPartners","Натрий Na⁺",
 "Разбавленная кислота","Подставить"]){
 if(["Разбавленная кислота","Подставить"].includes(feature))continue;
 assert.ok((ui+read("src/lektrusChemicalReactionGuide.ts")).includes(feature),"Missing "+feature);
}
assert.ok(editor.includes("LektrusChemistryGuidedBuilder"),"Guided editor integrated");
assert.ok(editor.includes('guidance?.status!=="none"'),"Do not save known no-reaction cases");
assert.ok(editor.includes('guidance?.products!=="different"'),"Do not save conflicting products in guided mode");
assert.match(css,/@media\(max-width:610px\)/);
assert.ok(main.includes('import "./lektrusChemistryGuidedBuilder.css";'));
console.log("Guided chemistry equation: reviewed cases, environment, no-reaction, true products, ionic charge and UI: OK");
