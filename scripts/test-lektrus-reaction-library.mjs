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
const {substances,reviewedReactionCases,identifyReaction}=load("src/lektrusReactionDatabase.ts");
assert.ok(substances.length>=100,"At least 100 named and classified substances");
assert.ok(reviewedReactionCases.length>=40,"Maintain a reviewed set of at least 40 reaction/negative cases");
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
assert.equal(identifyReaction(["Mg","O2"],"ignited").status,"reaction");
assert.equal(identifyReaction(["Mg","O2"],"aqueous").status,"unknown");
assert.equal(identifyReaction(["NaCl","KNO3","HCl"],"aqueous").status,"unknown");
assert.equal(identifyReaction(["C2H6","CuSO4"],"aqueous").status,"unknown");
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
assert.match(scene,/matched\.status==="none"\?"none":"unknown"/);
assert.match(scene,/scienceReagents/);
const handwriting=read("src/LektrusOrganicHandwriting.tsx");
assert.match(handwriting,/suggestHandwriting/);
assert.match(handwriting,/onClick=\{apply\}/);
console.log("Chemical cases, element balance, honest unknown results and organic editor checks passed",
 substances.length,reviewedReactionCases.length);
