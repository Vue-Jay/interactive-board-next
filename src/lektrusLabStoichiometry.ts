/** Quantitative, mass-conserving representation for reviewed SCHOOL reactions.
 * Only balanced equations and measured stock (g or mol/L) are supported.
 * The 4-second animation is instructional, NOT a kinetic-rate prediction. */
import type {LabDose} from "./lektrusChemistryBenchModel";
import type {ReactionCase} from "./lektrusReactionDatabase";

const ATOMIC_MASS:Record<string,number>={
 H:1.008,C:12.011,N:14.007,O:15.999,Na:22.989769,K:39.0983,
 Ca:40.078,Mg:24.305,Al:26.981538,Si:28.085,P:30.973762,
 S:32.06,Cl:35.45,Fe:55.845,Cu:63.546,Zn:65.38,Ag:107.8682,
 Ba:137.327,Pb:207.2,I:126.90447,Br:79.904,F:18.998403,
 Mn:54.938044,Cr:51.9961,Co:58.933194,Ni:58.6934,
 Li:6.94,B:10.81,Sr:87.62,Sn:118.71,Hg:200.59,Au:196.96657
};
export type LabEquationTerm={formula:string;coefficient:number};
export type LabBalancedEquation={reactants:LabEquationTerm[];products:LabEquationTerm[]};
export type LabReactionAmounts={
 equation:string;elapsedSeconds:number;durationSeconds:number;
 extentMol:number;maxExtentMol:number;
 initialMol:Record<string,number>;remainingMol:Record<string,number>;
 productsMol:Record<string,number>;complete:boolean;
};

function atomsOf(formula:string):Record<string,number>|null{
 const elements:Record<string,number>={};
 let cursor=0;
 const readGroup=(closing?:string):Record<string,number>|null=>{
  const atoms:Record<string,number>={};
  while(cursor<formula.length){
   const chr=formula[cursor];
   if(closing&&chr===closing){cursor++;return atoms}
   if(chr==="("||chr==="["){
    cursor++;const nested=readGroup(chr==="("?")":"]");
    if(!nested)return null;
    const m=/^\d+/.exec(formula.slice(cursor));const factor=m?Number(m[0]):1;
    if(m)cursor+=m[0].length;
    for(const [id,n] of Object.entries(nested))atoms[id]=(atoms[id]??0)+n*factor;
   }else{
    const match=/^[A-Z][a-z]?/.exec(formula.slice(cursor));
    if(!match||ATOMIC_MASS[match[0]]===undefined)return null;
    cursor+=match[0].length;
    const amount=/^\d+/.exec(formula.slice(cursor));
    if(amount)cursor+=amount[0].length;
    atoms[match[0]]=(atoms[match[0]]??0)+(amount?Number(amount[0]):1);
   }
  }
  return closing?null:atoms;
 };
 // Hydrates can contain a multiple of water: CuSO4·5H2O.
 for(const part of formula.split(/[·]/)){
  const leading=/^(\d+)(.+)$/.exec(part);
  const factor=leading?Number(leading[1]):1;
  const cleaned=leading?leading[2]:part;
  cursor=0;
  // Parse each hydrate section separately (the recursive closure reads formula).
  const priorFormula=formula;
  const readAtoms=(text:string):Record<string,number>|null=>{
   let index=0;
   const parse=(end?:string):Record<string,number>|null=>{
    const result:Record<string,number>={};
    while(index<text.length){
     const char=text[index];
     if(end&&char===end){index++;return result}
     if(char==="("||char==="["){
      index++;const inner=parse(char==="("?")":"]");
      if(!inner)return null;
      const n=/^\d+/.exec(text.slice(index));const count=n?Number(n[0]):1;
      if(n)index+=n[0].length;
      for(const [name,v] of Object.entries(inner))result[name]=(result[name]??0)+v*count;
     }else{
      const e=/^[A-Z][a-z]?/.exec(text.slice(index));
      if(!e||ATOMIC_MASS[e[0]]===undefined)return null;
      index+=e[0].length;
      const n=/^\d+/.exec(text.slice(index));const count=n?Number(n[0]):1;
      if(n)index+=n[0].length;
      result[e[0]]=(result[e[0]]??0)+count;
     }
    }
    return end?null:result;
   };
   const found=parse();
   return index===text.length?found:null;
  };
  const parsed=readAtoms(cleaned);
  if(!parsed||!Object.keys(parsed).length)return null;
  for(const [name,n] of Object.entries(parsed))elements[name]=(elements[name]??0)+n*factor;
  void priorFormula;
 }
 void readGroup;
 return Object.keys(elements).length?elements:null;
}
export function labMolarMass(formula:string):number|undefined{
 const atoms=atomsOf(formula);
 if(!atoms)return undefined;
 return Object.entries(atoms).reduce((sum,[id,n])=>sum+ATOMIC_MASS[id]*n,0);
}
const parseSide=(source:string):LabEquationTerm[]|null=>{
 const terms=source.split(/\s+\+\s+/).map(v=>v.trim());
 if(!terms.length)return null;
 const parsed=terms.map(raw=>{
  const m=/^(\d+)?\s*([A-Za-z][A-Za-z0-9()[\]·]*)(?:[↑↓])?$/.exec(raw);
  return m?{coefficient:m[1]?Number(m[1]):1,formula:m[2]}:null;
 });
 return parsed.every(t=>t&&t.coefficient>0&&t.coefficient<=100)?
  parsed as LabEquationTerm[]:null;
};
/** Reject unbalanced or unsupported formulas rather than invent products. */
export function parseBalancedLabEquation(equation:string):LabBalancedEquation|null{
 const parts=equation.split("→");
 if(parts.length!==2)return null;
 const reactants=parseSide(parts[0]),products=parseSide(parts[1]);
 if(!reactants||!products)return null;
 const sideAtoms=(side:LabEquationTerm[])=>{
  const out:Record<string,number>={};
  for(const term of side){
   const atom=atomsOf(term.formula);
   if(!atom)return null;
   for(const [el,count] of Object.entries(atom))
    out[el]=(out[el]??0)+count*term.coefficient;
  }
  return out;
 };
 const a=sideAtoms(reactants),b=sideAtoms(products);
 if(!a||!b||Object.keys(a).length!==Object.keys(b).length||
  Object.entries(a).some(([id,n])=>n!==b[id]))return null;
 return {reactants,products};
}
export function labDoseMoles(formula:string,dose:LabDose):number|undefined{
 if(!Number.isFinite(dose.value)||dose.value<=0)return undefined;
 if(dose.unit==="ml")return dose.concentrationM!==undefined&&
  Number.isFinite(dose.concentrationM)&&dose.concentrationM>0?
  dose.value*dose.concentrationM/1000:undefined;
 if(dose.unit!=="g")return undefined;
 const mass=labMolarMass(formula);
 return mass&&mass>0?dose.value/mass:undefined;
}
export function startQuantifiedLabReaction(
 reaction:ReactionCase,reactants:string[],doses:Record<string,LabDose>|undefined
):LabReactionAmounts|null{
 if(!doses||reaction.status!=="reaction")return null;
 const equation=parseBalancedLabEquation(reaction.equation);
 if(!equation||equation.reactants.length!==reaction.reactants.length||
  [...reaction.reactants].sort().join("|")!==[...reactants].sort().join("|")||
  [...reaction.reactants].sort().join("|")!==
   equation.reactants.map(t=>t.formula).sort().join("|"))return null;
 const initialMol:Record<string,number>={};
 for(const term of equation.reactants){
  const dose=doses[term.formula];
  const mol=dose?labDoseMoles(term.formula,dose):undefined;
  if(mol===undefined||mol<=0)return null;
  initialMol[term.formula]=mol;
 }
 const maxExtentMol=Math.min(...equation.reactants.map(t=>initialMol[t.formula]/t.coefficient));
 if(!Number.isFinite(maxExtentMol)||maxExtentMol<=0)return null;
 return {equation:reaction.equation,elapsedSeconds:0,durationSeconds:4,
  extentMol:0,maxExtentMol,initialMol,remainingMol:{...initialMol},
  productsMol:Object.fromEntries(equation.products.map(t=>[t.formula,0])),complete:false};
}
export function advanceQuantifiedLabReaction(
 state:LabReactionAmounts,seconds:number
):LabReactionAmounts{
 if(state.complete||!Number.isFinite(seconds)||seconds<=0)return state;
 const equation=parseBalancedLabEquation(state.equation);
 if(!equation)return state;
 const elapsedSeconds=Math.min(state.durationSeconds,state.elapsedSeconds+seconds);
 const extentMol=state.maxExtentMol*elapsedSeconds/state.durationSeconds;
 const remainingMol=Object.fromEntries(equation.reactants.map(term=>[
  term.formula,Math.max(0,state.initialMol[term.formula]-extentMol*term.coefficient)
 ]));
 const productsMol=Object.fromEntries(equation.products.map(term=>[
  term.formula,extentMol*term.coefficient
 ]));
 return {...state,elapsedSeconds,extentMol,remainingMol,productsMol,
  complete:elapsedSeconds>=state.durationSeconds};
}
