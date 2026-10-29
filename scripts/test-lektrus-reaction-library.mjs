import "./test-lektrus-chemistry-bench.mjs";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const load=(path)=>{
 const js=ts.transpileModule(read(path),{compilerOptions:{
  target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS
 }}).outputText;
 const exports={};
 new Function("exports",js)(exports);
 return exports;
};
const {substances,reviewedReactionCases,identifyReaction,reactionAppearance,reactionProducts}=load("src/lektrusReactionDatabase.ts");
assert.ok(substances.length>=100,"At least 100 named and classified substances");
assert.ok(reviewedReactionCases.length>=150,"Maintain at least 120 explicit condition-specific reaction/negative cases");
const ids=new Set(substances.map(s=>s.id));
assert.equal(ids.size,substances.length,"No duplicated formulas/identifiers");
for(const row of substances)assert.ok(row.name&&row.kind&&row.formula);
const signatures=new Set();
for(const r of reviewedReactionCases){
 const key=r.environment+":"+r.reactants.slice().sort().join("|");
 assert.ok(!signatures.has(key),"No ambiguous duplicate scenario: "+key);
 signatures.add(key);
 assert.ok(r.reactants.every(id=>ids.has(id)),"Every reagent is known: "+key);
 assert.equal(r.confidence,"curated");
 if(r.status==="none")continue;
 assert.ok(r.equation.includes("→"),"Every supported reaction includes an equation: "+key);
}
assert.equal(identifyReaction(["NaCl","AgNO3"],"aqueous").status,"reaction");
assert.equal(identifyReaction(["AgNO3","NaCl"],"aqueous").status,"reaction");
assert.equal(identifyReaction(["NaCl","KNO3"],"aqueous").status,"none");
assert.equal(identifyReaction(["NaCl","KNO3"],"dry").status,"unknown");
assert.equal(identifyReaction(["Na2CO3","KBr"],"aqueous").status,"none",
 "Two soluble sodium/potassium salts have no net ionic change in dilute water");
assert.equal(identifyReaction(["Na2CO3","KBr"],"heated").status,"unknown",
 "Negative reaction assertions must never extrapolate to other environments");
assert.equal(identifyReaction(["Cu","ZnSO4"],"aqueous").status,"none",
 "Copper cannot displace zinc from a dilute aqueous salt");
assert.equal(identifyReaction(["Zn","CuSO4"],"aqueous").status,"reaction");
assert.equal(identifyReaction(["Mg","O2"],"ignited").status,"reaction");
assert.equal(identifyReaction(["Mg","O2"],"aqueous").status,"unknown");
assert.equal(identifyReaction(["NaCl","KNO3","HCl"],"aqueous").status,"unknown");
assert.equal(identifyReaction(["C2H6","CuSO4"],"aqueous").status,"unknown");
assert.equal(identifyReaction(["Na2S","CuSO4"],"aqueous").status,"reaction");
assert.equal(identifyReaction(["H2SO4","BaCl2"],"aqueous").status,"reaction");
assert.equal(identifyReaction(["Na2S","CuSO4"],"dry").status,"unknown");
const darkSolid=reactionAppearance(identifyReaction(["Na2S","CuSO4"],"aqueous").caseData);
assert.equal(darkSolid.solid,"CuS");
assert.equal(darkSolid.solidColor,"#202a32","Copper sulfide must be black, not bright blue");
const copperBlue=reactionAppearance(identifyReaction(["CuSO4","NaOH"],"aqueous").caseData);
assert.equal(copperBlue.solid,"Cu(OH)2");
assert.equal(copperBlue.solidColor,"#74badd","Copper hydroxide must form a blue precipitate");
assert.notEqual(copperBlue.solutionAfter,copperBlue.solidColor,
 "The mother liquor cannot be colored as the precipitate");
const gas=reactionAppearance(identifyReaction(["HCl","NaHCO3"],"aqueous").caseData);
assert.equal(gas.gas,"CO2");
assert.ok(reactionProducts("2H2O2 → 2H2O + O2↑").includes("O2↑"));

// Expansions span all named laboratory categories and never reclassify
// arbitrary mixtures as explosions or invent reactions for the wrong state.
assert.ok(reviewedReactionCases.length>=220,
 "The cupboard must support an expanded and diverse reviewed reaction library");
const familySet=new Set(reviewedReactionCases.filter(r=>r.status==="reaction").map(r=>r.family));
for(const family of ["combustion","synthesis","decomposition","displacement","redox",
 "hydration","organic","neutralization","exchange"])
 assert.ok(familySet.has(family),"Missing reaction family: "+family);
const check=(reagents,env,family,visual)=>{
 const row=identifyReaction(reagents,env);
 assert.equal(row.status,"reaction","Unsupported reviewed scenario "+reagents+" "+env);
 assert.equal(row.caseData.family,family);
 assert.equal(row.caseData.visual,visual);
 return row.caseData;
};
check(["Na","Cl2"],"ignited","synthesis","flash");
check(["H2","O2"],"ignited","combustion","flash");
check(["P","O2"],"ignited","combustion","smoke");
check(["Cu","O2"],"heated","synthesis","colorShift");
check(["FeCl3","KI"],"aqueous","redox","colorShift");
check(["AgNO3"],"heated","decomposition","smoke");
check(["CH3OH","O2"],"ignited","combustion","flame");
check(["CuO","H2"],"heated","redox","colorShift");
check(["Na","H2O"],"aqueous","displacement","fizz");
assert.equal(identifyReaction(["Na","H2O"],"heated").status,"unknown");
assert.ok(identifyReaction(["Fe2O3","CO"],"heated").caseData.minTemperatureC>=650);
assert.ok(identifyReaction(["Zn","S"],"heated").caseData.minTemperatureC>=170);
assert.equal(reactionAppearance(identifyReaction(["Mg","O2"],"ignited").caseData).productSolid,"MgO");
assert.equal(reactionAppearance(identifyReaction(["CuO","H2"],"heated").caseData).productSolid,"Cu");
assert.equal(reactionAppearance(identifyReaction(["KI","Cl2"],"aqueous").caseData).solutionAfter,"#9d6b36");
const benchScene=read("src/LektrusChemistryBench.tsx");
assert.match(benchScene,/LabReactionBurst/);
assert.match(benchScene,/visualStartedAtMs/);
assert.match(benchScene,/lektrus-lab-virtual-ignition/);
assert.match(benchScene,/reactionFamilyLabels/);
assert.doesNotMatch(benchScene,/slice\(0,260\)/,"No arbitrary cap may hide newly verified reactions");
const fxCss=read("src/lektrusChemistryBench.css");
for(const effect of ["flash","flame","sparks","smoke","glow","thermal","fizz","crystals"])
 assert.ok(fxCss.includes(".is-"+effect),"Missing chemistry visual effect: "+effect);
assert.match(fxCss,/@media\(prefers-reduced-motion:reduce\)/);

// Element conservation check handles nested stoichiometric groups.
function atoms(formula){
 formula=formula.replace(/[↓↑]/g,"").trim();
 const coefficient=/^(\d+)\s*/.exec(formula);
 const factor=coefficient?Number(coefficient[1]):1;
 const input=coefficient?formula.slice(coefficient[0].length):formula;
 const stack=[{}];let i=0;
 while(i<input.length){
  const char=input[i];
  if(char==="("||char==="["){stack.push({});i++;continue}
  if(char===")"||char==="]"){
   i++;const size=/^\d+/.exec(input.slice(i));const n=size?Number(size[0]):1;
   if(size)i+=size[0].length;
   const group=stack.pop();assert.ok(group&&stack.length,"Unmatched bracket: "+formula);
   for(const [el,count] of Object.entries(group))stack.at(-1)[el]=(stack.at(-1)[el]??0)+count*n;
   continue;
  }
  const el=/^[A-Z][a-z]?/.exec(input.slice(i));assert.ok(el,"Unknown symbol in "+formula);
  i+=el[0].length;
  const size=/^\d+/.exec(input.slice(i)),n=size?Number(size[0]):1;
  if(size)i+=size[0].length;
  stack.at(-1)[el[0]]=(stack.at(-1)[el[0]]??0)+n;
 }
 assert.equal(stack.length,1,"Unclosed bracket: "+formula);
 return Object.fromEntries(Object.entries(stack[0]).map(([k,v])=>[k,v*factor]));
}
const balance=side=>{
 const total={};
 for(const formula of side.split("+").map(s=>s.trim()).filter(Boolean)){
  for(const [el,n] of Object.entries(atoms(formula)))total[el]=(total[el]??0)+n;
 }
 return Object.fromEntries(Object.entries(total).sort((a,b)=>a[0].localeCompare(b[0])));
};
for(const r of reviewedReactionCases.filter(r=>r.status==="reaction")){
 const [left,right]=r.equation.split("→");
 assert.deepEqual(balance(left),balance(right),"Unbalanced chemical equation: "+r.equation);
}
const catalog=read("src/lektrusScienceCatalog.ts");
assert.match(catalog,/id:"chem-organic-free"/);
assert.doesNotMatch(catalog,/id:"chem-organic-ethane"/,"No fixed organic templates in chooser");
assert.doesNotMatch(catalog,/id:"chem-experiment-salt"/,"Reagent builder replaces preset experiment chooser");
const scene=read("src/LektrusReactionLab.tsx");
assert.match(scene,/lektrus-reaction-catalog-tabs/);
assert.match(scene,/lektrus-reaction-examples/);
assert.match(scene,/reactionAppearance\(matchedCase\)/);
assert.match(scene,/lektrus-reaction-falling-particle/);
assert.match(scene,/lektrus-reaction-bubble/);
const labCss=read("src/lektrusReactionLabNext.css");
assert.match(labCss,/@media\(prefers-reduced-motion:reduce\)/);
assert.match(labCss,/lektrus-chem-settle/);
assert.match(labCss,/lektrus-chem-rise/);

assert.match(scene,/matched\.status==="none"\?"none":"unknown"/);
assert.match(scene,/scienceReagents/);
const handwriting=read("src/LektrusOrganicHandwriting.tsx");
assert.match(handwriting,/suggestHandwriting/);
assert.match(handwriting,/onClick=\{apply\}/);
console.log("Chemical cases, element balance, honest unknown results and organic editor checks passed",
 substances.length,reviewedReactionCases.length);
