import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";

const read=(path)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const compile=(path)=>ts.transpileModule(read(path),{compilerOptions:{
 target:ts.ScriptTarget.ES2023,module:ts.ModuleKind.ESNext
}}).outputText.replace(/^import[\s\S]*?from ["'][^"']+["'];\s*$/gm,"")
 .replace(/^export /gm,"");
const modelCode=compile("src/lektrusChemicalEquationModel.ts");
const model=new Function(modelCode+"\nreturn {countFormulaAtoms,inspectEquationBalance,normalizeFormulaInput,parseEquationDraft};")();
const dbCode=compile("src/lektrusReactionDatabase.ts");
const db=new Function(dbCode+"\nreturn {identifyReaction,reviewedReactionCases};")();
const reviewCode=compile("src/lektrusEquationReview.ts");
const review=new Function(...["identifyReaction","reviewedReactionCases","countFormulaAtoms","inspectEquationBalance",
 "normalizeFormulaInput","parseEquationDraft"],reviewCode+
 "\nreturn {classroomEquationExamples,reviewEquationStep,reviewEquationChain,applyKnownProductMarks,balancedStep};")(
 db.identifyReaction,db.reviewedReactionCases,model.countFormulaAtoms,model.inspectEquationBalance,
 model.normalizeFormulaInput,model.parseEquationDraft
);
const step=(expression,conditions="")=>({expression,conditions});
const inspect=(expression,domain="inorganic",conditions="")=>review.reviewEquationStep(step(expression,conditions),domain);
assert.equal(inspect("AgNO3 + NaCl → AgCl↓ + NaNO3").status,"correct");
assert.equal(inspect("Na2CO3 + 2HCl → 2NaCl + CO2↑ + H2O").status,"correct");
assert.equal(inspect("H2CO3 → H2O + CO2↑").status,"correct");
assert.equal(inspect("Na2CO3 + 2HCl → 2NaCl + H2CO3").status,"correct",
 "Unstable carbonic acid can be represented as an intermediate chain step");
assert.equal(inspect("H2CO3 → H2O + CO2").issues.some(i=>i.kind==="indicator"),true);
const wrong=inspect("AgNO3 + NaCl → AgCl↓ + KNO3");
assert.equal(wrong.status,"incorrect");
assert.ok(wrong.issues.some(i=>i.kind==="missing"&&i.formula==="NaNO3"));
assert.ok(wrong.issues.some(i=>i.kind==="extra"&&i.formula==="KNO3"&&i.index===1));
assert.ok(wrong.issues.some(i=>i.kind==="formula"));
assert.equal(inspect("AgNO3 + NaCl → AgCl + NaNO3").issues.some(i=>i.kind==="indicator"),true);
assert.ok(inspect("AgNO3 + NaCl → AgCl↓ + NaNO3").canMarkProducts);
assert.equal(inspect("AgNO3 + NaCl → AgCl↓ + NaNO3").canBalance,false);
assert.equal(inspect("AgNO3 + NaCl → AgCl↓ + KNO3").status,"incorrect");
assert.equal(inspect("Cu + HCl → CuCl2 + H2").status,"unknown",
 "Do not invent reference for a reaction that is not verified");
assert.equal(inspect("CH4 + 2O2 → CO2 + 2H2O","organic","поджиг").status,"correct");
assert.equal(inspect("C2H4 + H2 → C2H6","organic","Ni, t°").status,"correct");
assert.equal(inspect("C2H5OH → C2H4 + H2O","organic","H₂SO₄ (конц.), 170 °C").status,"correct");
assert.ok(inspect("C2H5OH → C2H4 + H2O","organic").issues.some(i=>i.kind==="condition"));
assert.equal(inspect("CH4 + Cl2 → CH3Cl + HCl","organic","hν").status,"correct");
for(const ex of review.classroomEquationExamples){
 const draft=model.parseEquationDraft(ex.expression);
 assert.ok(draft,"Example must parse: "+ex.id);
 const balance=model.inspectEquationBalance(draft);
 assert.equal(balance.status,"balanced","Template must be chemically atom-balanced: "+ex.id);
 assert.notEqual(inspect(ex.expression,ex.domain,ex.conditions).status,"incorrect",
  "Reviewed example should pass diagnostics: "+ex.id);
}
const unbalanced=step("CH4 + O2 → CO2 + H2O");
assert.equal(review.balancedStep(unbalanced)?.expression,"CH4 + 2O2 → CO2 + 2H2O");
assert.equal(review.applyKnownProductMarks(step("AgNO3 + NaCl → AgCl + NaNO3"))?.expression,
 "AgNO3 + NaCl → AgCl↓ + NaNO3");
assert.equal(review.applyKnownProductMarks(step("AgNO3 + NaCl → KCl + NaNO3")),null);
const chain=review.reviewEquationChain([
 step("Na2CO3 + 2HCl → 2NaCl + H2CO3"),
 step("H2CO3 → H2O + CO2↑")
],"inorganic");
assert.equal(chain.length,2);
assert.equal(chain[0].status,"correct");assert.equal(chain[1].status,"correct");
const brokenChain=review.reviewEquationChain([
 step("H2CO3 → H2O + CO2↑"),
 step("C2H4 + H2 → C2H6","Ni")
],"organic");
assert.ok(brokenChain[1].issues.some(i=>i.kind==="chain"));
const code=read("src/LektrusChemicalEquationEditor.tsx");
const AST=ts.createSourceFile("Editor.tsx",code,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
assert.equal(AST.parseDiagnostics.length,0,"Editor TSX parses");
for(const feature of ["classroomEquationExamples","Неорганика","Органика","+ Этап",
 "Распад H₂CO₃","Расставить коэффициенты","Газы и осадки","Проверить",
 "reviewEquationChain","canTeach","scienceReactionSteps"])assert.ok(code.includes(feature),feature);
assert.match(code,/canTeach&&<section/,"Only teachers get reference checking UI");
const board=read("src/boardModel.ts");
assert.ok(board.includes("scienceReactionSteps?:"));
assert.ok(board.includes('"scienceReactionDomain","scienceReactionSteps"'));
const illustration=read("src/LektrusChemistryIllustration.tsx");
assert.ok(illustration.includes("scienceReactionSteps?.length>1"));
const science=read("src/LektrusScienceEditor.tsx");
assert.ok(science.includes("canTeach={canTeach===true}"));
const presets=read("src/lektrusSciencePresets.ts");
assert.ok(presets.includes("AgNO3 + NaCl → AgCl↓ + NaNO3"),
 "Default template is real, balanced precipitation");
const styles=read("src/lektrusEquationReview.css");
assert.match(styles,/@media\(max-width:540px\)/);
console.log("Chemistry pathways: 13 reviewed templates, intermediate decomposition, organic tab, validation, chain continuity and teacher actions: OK");
