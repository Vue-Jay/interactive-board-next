import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";

const read=(path)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const modelSource=read("src/lektrusChemicalEquationModel.ts");
const js=ts.transpileModule(modelSource,{compilerOptions:{
 target:ts.ScriptTarget.ES2023,module:ts.ModuleKind.None
}}).outputText.replace(/\bexport\s+(?=(?:const|function)\b)/g,"");
const {parseEquationDraft,writeEquationDraft,splitEquationSide,readSpecies,countFormulaAtoms,
 inspectEquationBalance}=new Function(js+"\nreturn {parseEquationDraft,writeEquationDraft,splitEquationSide,readSpecies,countFormulaAtoms,inspectEquationBalance};")();

const parse=(text)=>parseEquationDraft(text);
const check=(text)=>inspectEquationBalance(parse(text));
const balances=(text,coefficients)=>{
 const result=check(text);
 assert.equal(result.status,"unbalanced",text);
 assert.deepEqual(result.coefficients,coefficients,text);
 const draft=parse(text);let index=0;
 [...draft.left,...draft.right].forEach(p=>p.coefficient=coefficients[index++]);
 assert.equal(inspectEquationBalance(draft).status,"balanced",text+" after balancing");
};
assert.deepEqual(splitEquationSide("Fe + O2"),["Fe","O2"]);
assert.deepEqual(splitEquationSide("Na+ + Cl-"),["Na+","Cl-"],
 "Ion charges must not be mistaken for substance delimiters");
assert.deepEqual(readSpecies("2H₂O↑"),{formula:"H₂O",coefficient:2,indicator:"↑"});
const reaction=parse("Na2CO3 + 2HCl → 2NaCl + CO2↑ + H2O");
assert.equal(reaction.left.length,2);
assert.equal(reaction.right.length,3);
assert.equal(reaction.left[1].coefficient,2);
assert.equal(reaction.right[1].indicator,"↑");
assert.equal(writeEquationDraft(reaction),"Na2CO3 + 2HCl → 2NaCl + CO2↑ + H2O");
assert.equal(parse("H2O"),null,"Standalone molecular formula must stay in source mode");
assert.equal(parse(" ").arrow,"→");
assert.equal(parse("H2 +  → ").left.length,2,"Editing must preserve blank added card");
assert.equal(parse("H2 + O2 ⇌ H2O").arrow,"⇌");
assert.equal(parse("H2 + O2 = H2O").arrow,"=");
assert.deepEqual([...countFormulaAtoms("Ca(OH)2")], [["Ca",1n],["O",2n],["H",2n]]);
assert.deepEqual([...countFormulaAtoms("CuSO4·5H2O")], [["Cu",1n],["S",1n],["O",9n],["H",10n]]);
assert.deepEqual([...countFormulaAtoms("Al2(SO4)3")],[["Al",2n],["S",3n],["O",12n]]);
assert.deepEqual([...countFormulaAtoms("K4[Fe(CN)6]")],
 [["K",4n],["Fe",1n],["C",6n],["N",6n]]);
assert.equal(countFormulaAtoms("Na+"),null);
assert.equal(countFormulaAtoms("C6H12O6^2-"),null);
assert.equal(countFormulaAtoms("Xx2"),null);
assert.equal(countFormulaAtoms("Mg(OH"),null);
assert.equal(check("H2 → H2O").status,"invalid");
assert.equal(check("Na+ + Cl- → NaCl").status,"unsupported");
assert.equal(check("H2 + H2 → H2").status,"unsupported");
assert.equal(check("H2 + O2 → ").status,"incomplete");
assert.equal(check("2H2 + O2 → 2H2O").status,"balanced");
balances("H2 + O2 → H2O",[2,1,2]);
balances("Fe + O2 → Fe2O3",[4,3,2]);
balances("C3H8 + O2 → CO2 + H2O",[1,5,3,4]);
balances("Al + HCl → AlCl3 + H2",[2,6,2,3]);
balances("KMnO4 → K2MnO4 + MnO2 + O2",[2,1,1,1]);
balances("Na2CO3 + HCl → NaCl + CO2 + H2O",[1,2,2,1,1]);
const ui=read("src/LektrusChemicalEquationEditor.tsx");
const styles=read("src/lektrusChemicalEquationWorkspace.css");
const main=read("src/main.tsx");
const science=read("src/LektrusScienceEditor.tsx");
const syntax=ts.createSourceFile("editor.tsx",ui,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
assert.equal(syntax.parseDiagnostics.length,0,"No TSX syntax regressions");
for(const text of ["lektrus-chem-species-card","lektrus-chem-add-species","autoBalance",
 "lektrus-chem-equation-condition-field","lektrus-chem-equation-preview","lektrus-chem-palettes",
 'role="tablist"',"onKeyDown","onCancel","⇌"])
 assert.ok(ui.includes(text),"Editor feature missing: "+text);
assert.match(styles,/@media\(max-width:610px\)/,"Phone layout");
assert.match(styles, /max-height:100dvh/,"Responsive full viewport");
assert.ok(main.includes('import "./lektrusChemicalEquationWorkspace.css";'),"Load new equation styles");
assert.ok(science.includes('if(formula)return <LektrusChemicalEquationEditor'),
 "Use this editor in chemistry");
assert.ok(science.includes('onSave={()=>onSave(draft)} onCancel={onCancel}'),
 "Cancel must not silently commit changes");
console.log("Chemistry equations: balanced chemistry, ions safety, indicators, legacy formulas, mobile UI and cancel: OK");
