/** Conservative diagnostics for chemical substances inside an equation.
 * No universal substance inference: flag malformed syntax, impossible charge
 * balance in bounded fixed-valence salts, and a few unambiguous typing errors.
 * Do not reject unfamiliar neutral molecules or organic isomers.
 */
import {countFormulaAtoms,normalizeFormulaInput,parseEquationDraft,type EquationSpecies} from "./lektrusChemicalEquationModel";
import {equationExamplePool} from "./lektrusEquationExamplePool";
import {substances} from "./lektrusReactionDatabase";

export type FormulaFinding={
 severity:"error"|"warning"|"info";
 message:string;formula:string;index:number;suggestion?:string;
};
const familiar=new Set<string>(substances.map(s=>normalizeFormulaInput(s.formula)));
for(const example of equationExamplePool){
 const draft=parseEquationDraft(example.equation);
 if(!draft)continue;
 for(const s of [...draft.left,...draft.right])familiar.add(normalizeFormula(s.formula));
}
const gcd=(a:number,b:number):number=>b?gcd(b,a%b):a;
const lcm=(a:number,b:number)=>a/gcd(a,b)*b;
const cations=new Map<string,number[]>([
 ["Li",[1]],["Na",[1]],["K",[1]],["Ag",[1]],
 ["Mg",[2]],["Ca",[2]],["Sr",[2]],["Ba",[2]],["Zn",[2]],["Cd",[2]],
 ["Al",[3]],["Cu",[1,2]],["Fe",[2,3]],["Ni",[2]],["Co",[2,3]],
 ["Pb",[2,4]],["Mn",[2,3,4]],
]);
const anions=new Map<string,number>([
 ["F",1],["Cl",1],["Br",1],["I",1],
 ["OH",1],["NO3",1],["NO2",1],["HCO3",1],["H2PO4",1],["HSO4",1],
 ["CH3COO",1],["SO4",2],["SO3",2],["CO3",2],["HPO4",2],["S",2],["O",2],
 ["CrO4",2],["C2O4",2],["PO4",3]
]);
const polyatomic=new Set([...anions.keys()].filter(s=>s.length>2));
const specialValence=new Set(["Fe3O4","Pb3O4","Cu2O2","Na2O2","K2O2","BaO2","MgO2","CaO2","Li2O2"]);
function normalizeFormula(text:string):string{
 return normalizeFormulaInput(text).replace(/\s+/g,"");
}
function canonicalSalt(metal:string,cationCharge:number,anion:string,anionCharge:number){
 const quantity=lcm(cationCharge,anionCharge);
 const cm=quantity/cationCharge,am=quantity/anionCharge;
 return metal+(cm>1?cm:"")+(polyatomic.has(anion)&&am>1?"("+anion+")":anion)+(am>1?am:"");
}
function checkFixedValence(formula:string):{suggestion:string;isError:boolean}|null{
 if(specialValence.has(formula)||familiar.has(formula))return null;
 const match=/^([A-Z][a-z]?)([1-9]\d{0,2})?(\(.+\)|[A-Z][A-Za-z0-9]*)([1-9]\d{0,2})?$/.exec(formula);
 if(!match)return null;
 const [,metal,metalCount,tail,tailCount]=match,oxidations=cations.get(metal);
 if(!oxidations)return null;
 // Only a SIMPLE binary ionic formula or a single recognised polyatomic ion.
 // Compounds containing water, peroxides, complexes, etc. are outside this rule.
 let anion="",count=Number(tailCount||1);
 if(tail.startsWith("(")&&tail.endsWith(")")){
  anion=tail.slice(1,-1);
  if(!polyatomic.has(anion))return null;
 }else{
  if(anions.has(tail))anion=tail;
  else{
   const possible=[...anions.keys()].filter(a=>tail.startsWith(a)&&/^[1-9]\d{0,2}$/.test(tail.slice(a.length)));
   if(possible.length!==1)return null;
   anion=possible[0];count=Number(tail.slice(anion.length));
  }
 }
 const charge=anions.get(anion);
 if(!charge)return null;
 const numMetal=Number(metalCount||1);
 if(oxidations.some(v=>numMetal*v===count*charge))return null;
 const suggested=oxidations.map(v=>canonicalSalt(metal,v,anion,charge));
 if(suggested.some(v=>familiar.has(v)))return {suggestion:suggested.find(v=>familiar.has(v))!,isError:oxidations.length===1};
 return {suggestion:suggested[0],isError:oxidations.length===1};
}
const spellingErrors=new Map([
 ["H20","H2O"],["C02","CO2"],["S02","SO2"],["S03","SO3"],
 ["H202","H2O2"],["H2S04","H2SO4"],["H2S03","H2SO3"],
 ["NaCI","NaCl"],["KCI","KCl"],["CaCI2","CaCl2"],["HCI","HCl"],
 ["FeCI3","FeCl3"],["AgCI","AgCl"],["CuS04","CuSO4"],["NaN03","NaNO3"],
]);
/** One species can produce several distinct, localised diagnostics. */
export function inspectChemicalSpecies(species:EquationSpecies[],domain:"inorganic"|"organic"):FormulaFinding[]{
 const result:FormulaFinding[]=[];
 const present=new Map<string,number>();
 for(const [index,s] of species.entries()){
  const formula=normalizeFormula(s.formula);
  if(!formula)continue;
  const add=(severity:FormulaFinding["severity"],message:string,suggestion?:string)=>
   result.push({index,formula:s.formula,severity,message,suggestion});
  const previous=present.get(formula);
  if(previous!==undefined)add("warning","Вещество повторяется. Обычно его записывают одним слагаемым с коэффициентом.");
  else present.set(formula,index);
  if(s.coefficient<1||!Number.isInteger(s.coefficient)||s.coefficient>999)
   add("error","Коэффициент должен быть целым положительным числом.");
  const typo=spellingErrors.get(formula);
  if(typo){add("error","Похоже на опечатку в формуле. Возможно, "+typo+".",typo);continue;}
  if(formula==="e⁻"||formula==="e-"||formula==="e⁺"||formula==="e+"){
   add("info","Электроны допустимы в полуреакциях; требуется отдельная проверка заряда.");continue;
  }
  const atoms=countFormulaAtoms(formula);
  if(!atoms){
   if(domain==="organic"&&/[=#]/.test(formula)){
    add("info","Структурные связи не проверяются атомным парсером; нужен структурный анализ.");continue;
   }
   if(/(?:\^?\d*[+⁺⁻−-])$/.test(formula)){
    add("info","Для ионов требуется проверка заряда, одного баланса атомов недостаточно.");continue;
   }
   add("error","Проверьте формулу: неизвестный символ элемента, незакрытая скобка или неверный индекс.");
   continue;
  }
  if(domain==="inorganic"){
   const valence=checkFixedValence(formula);
   if(valence)add(valence.isError?"error":"warning",
    "Не совпадают заряды ионов в типичной соли. Возможно, "+valence.suggestion+".",valence.suggestion);
  }
 }
 return result;
}
/** Distinguishes invalid species from unknown-but-possible ones. */
export function findKnownFormula(formula:string):boolean{return familiar.has(normalizeFormula(formula));}
