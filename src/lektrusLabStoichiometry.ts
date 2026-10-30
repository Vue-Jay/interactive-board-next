/** Quantitative, mass-conserving representation for reviewed SCHOOL reactions.
 * Only balanced equations and measured stock (g or mol/L) are supported.
 * The 4-second animation is instructional, NOT a kinetic-rate prediction. */
import type {LabDose} from "./lektrusChemistryBenchModel";
import {substances,type ReactionCase} from "./lektrusReactionDatabase";
const substancesByFormula=(formula:string)=>substances.find(v=>v.id===formula);

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
 equation:string;elapsedSeconds:number;durationSeconds:number;startedAtMs?:number;
 extentMol:number;maxExtentMol:number;
 initialMol:Record<string,number>;remainingMol:Record<string,number>;
 productsMol:Record<string,number>;complete:boolean;
};

/** Parse nested formula groups and hydrate coefficients without guessing. */
function atomsOf(formula:string):Record<string,number>|null{
 const elements:Record<string,number>={};
 for(const part of formula.split("·")){
  const prefix=/^(\d+)(.*)$/.exec(part);
  const factor=prefix?Number(prefix[1]):1;
  const text=prefix?prefix[2]:part;
  let pos=0;
  const read=(closing?:string):Record<string,number>|null=>{
   const result:Record<string,number>={};
   while(pos<text.length){
    if(closing&&text[pos]===closing){pos++;return result}
    if(text[pos]==="("||text[pos]==="["){
     const pair=text[pos++]==="("?")":"]";
     const nested=read(pair);
     if(!nested)return null;
     const n=/^\d+/.exec(text.slice(pos));
     const count=n?Number(n[0]):1;
     if(n)pos+=n[0].length;
     for(const [name,value] of Object.entries(nested))
      result[name]=(result[name]??0)+value*count;
    }else{
     const symbol=/^[A-Z][a-z]?/.exec(text.slice(pos));
     if(!symbol||ATOMIC_MASS[symbol[0]]===undefined)return null;
     pos+=symbol[0].length;
     const n=/^\d+/.exec(text.slice(pos));
     const count=n?Number(n[0]):1;
     if(n)pos+=n[0].length;
     result[symbol[0]]=(result[symbol[0]]??0)+count;
    }
   }
   return closing?null:result;
  };
  const parsed=read();
  if(!parsed||pos!==text.length||!Object.keys(parsed).length)return null;
  for(const [name,n] of Object.entries(parsed))
   elements[name]=(elements[name]??0)+n*factor;
 }
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
  const m=/^(\d+)?\s*([A-Za-z(\[][A-Za-z0-9()[\]·]*)(?:[↑↓])?$/.exec(raw);
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
/** Source amount in moles from measured mass, known molarity, or
 * explicitly defined physical stocks. Gases use 25 °C / 1 atm ideal-gas
 * reference volume, not a guessed aqueous concentration. Neat-liquid
 * densities are 25 °C reference approximations (g/ml). */
const NEAT_DENSITY_G_ML:Record<string,number>={
 // Pure liquid densities match calorimetry and the Antoine evaporation
 // reference at ~25 °C. A prepared 0.1 M stock uses molarity INSTEAD.
 // NIST / CRC values; Br2: bromine engineering handbook, CH3CHO: PubChem.
 H2O:.997,C2H5OH:.789,CH3OH:.792,C3H8O:.785,Br2:3.1055,CH3CHO:.7846
};
const REFERENCE_GAS_MOLAR_VOLUME_ML=24465;
export function labDoseMoles(formula:string,dose:LabDose):number|undefined{
 if(!Number.isFinite(dose.value)||dose.value<=0)return undefined;
 if(dose.unit==="ml"){
  if(dose.concentrationM!==undefined)
   return Number.isFinite(dose.concentrationM)&&dose.concentrationM>0?
    dose.value*dose.concentrationM/1000:undefined;
  const substance=substancesByFormula(formula);
  if(substance?.kind==="газ")
   return dose.value/REFERENCE_GAS_MOLAR_VOLUME_ML;
  const density=NEAT_DENSITY_G_ML[formula];
  const mass=density!==undefined?labMolarMass(formula):undefined;
  return density!==undefined&&mass?dose.value*density/mass:undefined;
 }
 if(dose.unit!=="g")return undefined;
 const mass=labMolarMass(formula);
 return mass&&mass>0?dose.value/mass:undefined;
}
export function startQuantifiedLabReaction(
 reaction:ReactionCase,reactants:string[],doses:Record<string,LabDose>|undefined,
 startedAtMs?:number
):LabReactionAmounts|null{
 if(!doses||reaction.status!=="reaction")return null;
 const equation=parseBalancedLabEquation(reaction.equation);
 // Pure water is an optional solvent ONLY when absent from the balanced
 // equation. For metal + water, water remains a consumed stoichiometric
 // reagent. Other spectator species require explicit reaction modelling.
 const actual=reactants.filter(id=>id!=="H2O"||
  equation?.reactants.some(t=>t.formula==="H2O"));
 // A documented catalyst is physically present but does not appear on
 // either side of the net reaction. MnO2 catalyses peroxide decomposition.
 const consumed=equation?.reactants.map(t=>t.formula)??[];
 const nonConsumed=reaction.reactants.filter(id=>!consumed.includes(id));
 const explicitCatalysts=new Set(["MnO2"]);
 if(!equation||
  [...reaction.reactants].sort().join("|")!==[...actual].sort().join("|")||
  nonConsumed.some(id=>!explicitCatalysts.has(id))||
  consumed.some(id=>!reaction.reactants.includes(id))||
  consumed.length+nonConsumed.length!==reaction.reactants.length)return null;
 const initialMol:Record<string,number>={};
 for(const term of equation.reactants){
  const dose=doses[term.formula];
  const mol=dose?labDoseMoles(term.formula,dose):undefined;
  if(mol===undefined||mol<=0)return null;
  initialMol[term.formula]=mol;
 }
 const maxExtentMol=Math.min(...equation.reactants.map(t=>initialMol[t.formula]/t.coefficient));
 if(!Number.isFinite(maxExtentMol)||maxExtentMol<=0)return null;
 return {equation:reaction.equation,elapsedSeconds:0,durationSeconds:4,startedAtMs,
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
