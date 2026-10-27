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
const db=new Function(dbCode+"\nreturn {identifyReaction,reviewedReactionCases,substances};")();
const expandedCode=compile("src/lektrusEquationExtendedCases.ts");
const expanded=new Function(expandedCode+"\nreturn {expandedEquationCases,expandedEquationCount};")();
const additionalCode=compile("src/lektrusEquationAdditionalCases.ts");
const additional=new Function(additionalCode+"\nreturn {additionalEquationCases,additionalEquationCount};")();
assert.ok(additional.additionalEquationCount>=200,"At least 200 additional bounded reaction cases");
const poolCode=compile("src/lektrusEquationExamplePool.ts");
const pool=new Function("reviewedReactionCases","parseEquationDraft","expandedEquationCases","additionalEquationCases",poolCode+
 "\nreturn {equationExamplePool,equationExamplesByDomain,selectRandomEquationExample};")(
 db.reviewedReactionCases,model.parseEquationDraft,expanded.expandedEquationCases,additional.additionalEquationCases);
assert.ok(expanded.expandedEquationCount>=350,"At least 350 new bounded school chemistry cases");
assert.ok(pool.equationExamplePool.length>=800,"Eight hundred audited reaction references");
assert.ok(pool.equationExamplesByDomain("inorganic").length>=280);
assert.ok(pool.equationExamplesByDomain("organic").length>=100);
assert.ok(pool.equationExamplesByDomain("inorganic").length>=20,"At least twenty rotating inorganic examples");
assert.ok(pool.equationExamplesByDomain("organic").length>=20,"At least twenty rotating organic examples");
assert.ok(pool.equationExamplesByDomain("inorganic").length>=80,"Review 80+ curated inorganic reactions");
assert.ok(pool.equationExamplesByDomain("organic").length>=30,"Rotate thirty verified organic examples");
for(const ex of pool.equationExamplePool){
 const draft=model.parseEquationDraft(ex.equation);
 assert.ok(draft,"Reference should parse: "+ex.id);
 assert.equal(model.inspectEquationBalance(draft).status,"balanced","Reference should be atom balanced: "+ex.id);
}
const first=pool.selectRandomEquationExample("organic",undefined,()=>0);
assert.notEqual(pool.selectRandomEquationExample("organic",first.id,()=>0).id,first.id);
const formulaCode=compile("src/lektrusChemicalFormulaValidation.ts");
const {inspectChemicalSpecies,findKnownFormula}=new Function(
 "countFormulaAtoms","normalizeFormulaInput","parseEquationDraft","equationExamplePool","substances",
 formulaCode+"\nreturn {inspectChemicalSpecies,findKnownFormula};")(
 model.countFormulaAtoms,model.normalizeFormulaInput,model.parseEquationDraft,
 pool.equationExamplePool,db.substances);
const reviewCode=compile("src/lektrusEquationReview.ts");
const review=new Function(...["identifyReaction","reviewedReactionCases","countFormulaAtoms","inspectEquationBalance",
 "normalizeFormulaInput","parseEquationDraft","equationExamplePool","inspectChemicalSpecies"],reviewCode+
 "\nreturn {classroomEquationExamples,reviewEquationStep,reviewEquationChain,applyKnownProductMarks,balancedStep};")(
 db.identifyReaction,db.reviewedReactionCases,model.countFormulaAtoms,model.inspectEquationBalance,
 model.normalizeFormulaInput,model.parseEquationDraft,pool.equationExamplePool,inspectChemicalSpecies
);
const formulaIssues=(formula,domain="inorganic")=>inspectChemicalSpecies([
 {formula,coefficient:1,indicator:""}
],domain);
assert.ok(findKnownFormula("H2O"),"Common valid substance recognised");
assert.ok(findKnownFormula("Ca(OH)2"),"Polyatomic hydroxide correctly recognised");
assert.ok(formulaIssues("NaCl").length===0,"Sodium chloride valid");
assert.ok(!formulaIssues("H2O2").some(v=>v.severity==="error"),"Peroxide is valid");
assert.ok(!formulaIssues("Fe3O4").some(v=>v.severity==="error"),"Mixed-valence magnetite valid");
assert.ok(!formulaIssues("C6H6","organic").some(v=>v.severity==="error"),"Benzene valid");
assert.ok(!formulaIssues("C2H4Br2","organic").some(v=>v.severity==="error"),"Organic halides valid");
assert.ok(formulaIssues("NaCl2").some(v=>v.severity==="error"&&v.suggestion==="NaCl"),"Sodium chloride valence");
assert.ok(formulaIssues("MgCl").some(v=>v.severity==="error"&&v.suggestion==="MgCl2"),"Magnesium chloride valence");
assert.ok(formulaIssues("Ca(OH)").some(v=>v.severity==="error"&&v.suggestion==="Ca(OH)2"),"Hydroxide valence");
assert.ok(formulaIssues("NaCI").some(v=>v.severity==="error"&&v.suggestion==="NaCl"),"Capital I typo");
assert.ok(formulaIssues("H20").some(v=>v.severity==="error"&&v.suggestion==="H2O"),"Digit zero typo");
assert.ok(formulaIssues("H2(Q)").some(v=>v.severity==="error"),"Unknown element");
assert.ok(formulaIssues("H2O3").some(v=>v.severity==="info"),
 "Unrecognised but syntactically valid formula is not assumed impossible");
assert.ok(!formulaIssues("H2O3").some(v=>v.severity==="error"),
 "Never reject unknown molecular substances merely because absent from references");
assert.ok(formulaIssues("Fe(OH2").some(v=>v.severity==="error"),"Missing parenthesis");
assert.ok(!formulaIssues("Na⁺").some(v=>v.severity==="error"),"Charged species are not automatically rejected");
assert.ok(!formulaIssues("CH2=CH2","organic").some(v=>v.severity==="error"),"Condensed double bond supported as unknown");
assert.ok(!formulaIssues("C11H24","organic").some(v=>v.severity==="error"),"Unlisted organic compound not falsely rejected");
assert.equal(inspectChemicalSpecies([
 {formula:"H2O",coefficient:1,indicator:""},
 {formula:"H2O",coefficient:1,indicator:""}],"inorganic").some(v=>v.index===1&&v.severity==="warning"),true,
 "Duplicate species highlighted separately");
const step=(expression,conditions="")=>({expression,conditions});
const inspect=(expression,domain="inorganic",conditions="")=>review.reviewEquationStep(step(expression,conditions),domain);
assert.equal(inspect("AgNO3 + NaCl → AgCl↓ + NaNO3").status,"correct");
assert.equal(inspect("AgNO3 + NaCl2 → AgCl↓ + NaNO3").status,"incorrect",
 "Formula valence errors are reported even when reference matching fails");
assert.ok(inspect("AgNO3 + NaCl2 → AgCl↓ + NaNO3").issues.some(v=>
 v.kind==="substance"&&v.side==="left"&&v.index===1&&v.severity==="error"),
 "Localise incorrect reactant exactly inside the reagent field");
assert.ok(inspect("CH4 + O2 → CO2 + H2O","organic","поджиг").issues.some(v=>
 v.kind==="coefficient"&&v.side==="left"&&v.index===1&&v.severity==="error"),
 "Wrong oxygen coefficient is highlighted directly on the offending reagent");
assert.ok(inspect("CH4 + O2 → CO2 + H2O","organic","поджиг").issues.some(v=>
 v.kind==="coefficient"&&v.side==="right"&&v.index===1&&v.severity==="error"),
 "Wrong water coefficient is highlighted directly on the offending product");
assert.ok(inspect("AgNO3 + NaCl → AgCl↓ + NaN03").issues.some(v=>
 v.kind==="substance"&&v.side==="right"&&v.index===1&&v.severity==="error"),
 "Localise a typo in a product formula");

assert.equal(inspect("AgNO3 + NaCl → ").issues.filter(i=>i.kind==="missing").length,2,
 "Known but unfinished equations report which products are missing");
assert.equal(inspect("AgNO3 + NaCl → KCl + NaNO3").status,"incorrect");
assert.equal(inspect("NaCl + KNO3 → KCl + NaNO3").status,"incorrect",
 "A balanced equation is not enough to establish a reaction");
assert.equal(inspect("Na2CO3 + 2HCl → 2NaCl + CO2↑ + H2O").status,"correct");
assert.equal(inspect("H2CO3 → H2O + CO2↑").status,"correct");
assert.equal(inspect("H3PO4 + NaOH → NaH2PO4 + H2O","inorganic","недостаток щёлочи").status,"correct");
assert.equal(inspect("H3PO4 + 2NaOH → Na2HPO4 + 2H2O","inorganic","частичная нейтрализация").status,"correct");
assert.equal(inspect("H3PO4 + 3NaOH → Na3PO4 + 3H2O","inorganic","избыток щёлочи").status,"correct");
assert.equal(inspect("H3PO4 + NaOH → NaH2PO4 + H2O","inorganic","").status,"partial",
 "A real partial-neutralisation product is not an extra species when conditions are missing");
assert.ok(inspect("H3PO4 + NaOH → NaH2PO4 + H2O","inorganic","").issues.some(i=>i.kind==="condition"));
assert.equal(inspect("H2SO4 + NaOH → NaHSO4 + H2O","inorganic","недостаток щёлочи").status,"correct");
assert.equal(inspect("ZnSO4 + 2NaOH → Zn(OH)2↓ + Na2SO4").status,"correct");
assert.equal(inspect("ZnSO4 + 4NaOH → Na2[Zn(OH)4] + Na2SO4","inorganic","избыток щёлочи").status,"correct");
assert.equal(inspect("ZnSO4 + 4NaOH → Na2[Zn(OH)4] + Na2SO4","inorganic","").status,"partial");
assert.equal(inspect("AlCl3 + 4NaOH → Na[Al(OH)4] + 3NaCl","inorganic","избыток щёлочи").status,"correct");
assert.equal(inspect("Ca(OH)2 + 2CO2 → Ca(HCO3)2","inorganic","избыток CO₂").status,"correct");

assert.equal(inspect("Na2CO3 + 2HCl → 2NaCl + H2CO3").status,"correct",
 "Unstable carbonic acid can be represented as an intermediate chain step");
assert.equal(inspect("H2CO3 → H2O + CO2").issues.some(i=>i.kind==="indicator"),true);
const wrong=inspect("AgNO3 + NaCl → AgCl↓ + KNO3");
assert.equal(wrong.status,"incorrect");
assert.ok(wrong.issues.some(i=>i.kind==="missing"&&i.formula==="NaNO3"));
assert.ok(wrong.issues.some(i=>i.kind==="extra"&&i.formula==="KNO3"&&i.index===1));
assert.ok(wrong.issues.some(i=>i.kind==="formula"));
assert.equal(inspect("AgNO3 + NaCl → AgCl + NaNO3").issues.some(i=>i.kind==="indicator"),true);
assert.equal(inspect("Fe + CuSO4 → FeSO4 + Cu").issues.some(i=>i.kind==="indicator"),false,
 "Deposited metal symbol ↓ is optional when reviewed references legitimately disagree");
assert.equal(inspect("Fe + CuSO4 → FeSO4 + Cu").status,"correct");
assert.equal(review.applyKnownProductMarks(step("Fe + CuSO4 → FeSO4 + Cu"))?.expression,
 "Fe + CuSO4 → FeSO4 + Cu",
 "Auto-marking should preserve optional deposition notation");
assert.ok(inspect("AgNO3 + NaCl → AgCl↓ + NaNO3").canMarkProducts);
assert.equal(inspect("AgNO3 + NaCl → AgCl↓ + NaNO3").canBalance,false);
assert.equal(inspect("AgNO3 + NaCl → AgCl↓ + KNO3").status,"incorrect");
assert.equal(inspect("Cu + HCl → CuCl2 + H2").status,"incorrect",
 "A verified no-reaction case must flag invented products");
assert.equal(inspect("Cu + ZnSO4 → CuSO4 + Zn").status,"incorrect",
 "Less active copper must not displace zinc in water");
assert.equal(inspect("KCl + NaNO3 → KNO3 + NaCl").status,"incorrect",
 "Soluble-salt exchange without a driving force is not a reaction");
assert.equal(inspect("Fe + ZnSO4 → FeSO4 + Zn").status,"incorrect",
 "Iron does not displace more active zinc");
assert.equal(inspect("Zn + MgSO4 → ZnSO4 + Mg").status,"incorrect",
 "Zinc does not displace more active magnesium");
assert.equal(inspect("CH4 + 2O2 → CO2 + 2H2O","organic","поджиг").status,"correct");
assert.equal(inspect("C2H4 + H2 → C2H6","organic","Ni, t°").status,"correct");
assert.equal(inspect("C2H5OH → C2H4 + H2O","organic","H₂SO₄ (конц.), 170 °C").status,"correct");
assert.ok(inspect("C2H5OH → C2H4 + H2O","organic").issues.some(i=>i.kind==="condition"));
assert.equal(inspect("CH4 + Cl2 → CH3Cl + HCl","organic","hν").status,"correct");
assert.equal(inspect("C6H6 + HNO3 → C6H5NO2 + H2O","organic","H₂SO₄ (конц.)").status,"partial",
 "Structural orientation must not be certified from the molecular formula");
assert.ok(inspect("C6H6 + HNO3 → C6H5NO2 + H2O","organic","").issues.some(i=>i.kind==="condition"),
 "Nitration requires catalyst/acid conditions");
assert.ok(inspect("CH3Cl + NaOH → CH3OH + NaCl","organic","").issues.some(i=>i.kind==="condition"),
 "Haloalkane nucleophilic substitution has a required aqueous condition");
assert.equal(inspect("CH3Cl + NaOH → CH3OH + NaCl","organic","водн. щёлочь, t°").status,"correct");
assert.equal(inspect("C2H5Br + KOH → C2H4 + KBr + H2O","organic","спирт. щёлочь, t°").status,"correct");
assert.equal(inspect("C2H5Br + KOH → C2H5OH + KBr","organic","водн. щёлочь, t°").status,"correct");
assert.equal(inspect("C2H5Br + KOH → C2H4 + KBr + H2O","organic","").status,"partial",
 "Elimination requires the alcoholic reaction conditions");
assert.equal(inspect("CH3COOCH3 + NaOH → CH3COONa + CH3OH","organic","водн. NaOH, t°").status,"correct");
assert.equal(inspect("Na2SO3 + 2HCl → 2NaCl + SO2↑ + H2O","inorganic","водн. р-р").status,"correct");
assert.equal(inspect("Fe + CuSO4 → FeSO4 + Cu","inorganic","").status,"correct");
assert.notEqual(inspect("C4H8 + H2 → C4H10","organic","Ni, t°").status,"correct",
 "Molecular formula cannot certify an organic structural isomer");
assert.equal(inspect("C4H8 + H2 → C4H10","organic","Ni, t°").status,"partial");
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
const unfinished=review.reviewEquationChain([step("Na2CO3 + 2HCl → 2NaCl + H2CO3")],"inorganic");
assert.equal(unfinished[0].status,"partial");
assert.ok(unfinished[0].issues.some(i=>i.kind==="chain"),"Unstable H2CO3 needs a decomposition stage");
const brokenChain=review.reviewEquationChain([
 step("H2CO3 → H2O + CO2↑"),
 step("C2H4 + H2 → C2H6","Ni")
],"organic");
assert.ok(brokenChain[1].issues.some(i=>i.kind==="chain"));
const code=read("src/LektrusChemicalEquationEditor.tsx");
assert.ok(code.includes("lektrus-chem-input-mirror"),"Formula underlines are inside each editable field");
assert.ok(code.includes("lektrus-chem-token-issue"),"Incorrect substance is highlighted in place");
assert.ok(code.includes("lektrus-chem-field-feedback"),"Feedback messages are in the input box");
assert.ok(code.includes("lektrus-chem-condition-feedback"),"Condition warnings are placed at their field");
assert.ok(code.includes("onScroll={e=>"),"Text highlights follow textarea scrolling");
assert.ok(code.includes("newBackgroundExample"),"Opening the editor rotates background examples");
assert.ok(code.includes('e.key==="="'),"Equal key shortcut targets the product side");
assert.ok(code.includes("inputs.current.right?.focus()"),"Equal key moves focus instead of inserting text");
assert.ok(code.includes("exampleParts.reactants")&&code.includes("exampleParts.products"),
 "Hints appear as input placeholders rather than inserted reactants");
assert.ok(!code.includes("insertExample"),"Example must never overwrite actual equation");
const AST=ts.createSourceFile("Editor.tsx",code,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
assert.equal(AST.parseDiagnostics.length,0,"Editor TSX parses");
for(const feature of ["selectRandomEquationExample","Неорганика","Органика","+ Этап",
 "Распад H₂CO₃","Расставить коэффициенты","Газы и осадки","Проверить",
 "reviewEquationChain","canTeach","scienceReactionSteps"])assert.ok(code.includes(feature),feature);
assert.match(code,/canTeach&&<section/,"Only teachers get reference checking UI");
const board=read("src/boardModel.ts");
assert.ok(board.includes("scienceReactionSteps?:"));
assert.ok(board.includes('"scienceReactionDomain","scienceReactionSteps"'));
const illustration=read("src/LektrusChemistryIllustration.tsx");
assert.ok(illustration.includes("<LektrusChemicalEquationBoardView item={item}/>"),
 "The board must use the same chemical renderer as the editor preview");
assert.ok(code.includes("<LektrusChemicalEquationBoardView item={item}/>"),
 "The preview must display the same chemical surface that is placed on the board");
const science=read("src/LektrusScienceEditor.tsx");
assert.ok(science.includes("canTeach={canTeach===true}"));
const presets=read("src/lektrusSciencePresets.ts");
assert.ok(presets.includes('"chem-formula-free":{title:"Химическое уравнение",expression:""}'),
 "A new equation starts empty, showing only a background reference");
const styles=read("src/lektrusEquationReview.css");
assert.match(styles,/@media\(max-width:540px\)/);
console.log(`Chemistry pathways: ${pool.equationExamplePool.length} atom-balanced references (${expanded.expandedEquationCount} expanded, ${additional.additionalEquationCount} additional), organic chains, conditions and teacher review: OK`);
