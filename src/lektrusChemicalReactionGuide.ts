/** Chemistry-aware helpers for the school equation editor.
 * Chemistry outcomes come ONLY from reviewedReactionCases, never from
 * coefficient algebra or generic reaction-family guesses.
 */
import {identifyReaction,reviewedReactionCases,substances,
 type ReactionCase,type ReactionEnvironment,type Substance} from "./lektrusReactionDatabase";
import {countFormulaAtoms,normalizeFormulaInput,parseEquationDraft,
 type EquationDraft,type EquationSpecies} from "./lektrusChemicalEquationModel";

export const reactionEnvironments:{id:ReactionEnvironment;label:string;help:string}[]=[
 {id:"aqueous",label:"В растворе",help:"Водные растворы и взаимодействие с кислотами"},
 {id:"dry",label:"Без раствора",help:"Сухие вещества, катализируемое разложение"},
 {id:"heated",label:"Нагревание",help:"Термические процессы"},
 {id:"ignited",label:"Горение",help:"Горение при достаточном количестве кислорода"}
];

const common=["HCl","NaOH","NaCl","AgNO3","CuSO4","CaCO3","O2","H2","H2O","Fe","Zn","H2SO4","Na2CO3","Ca(OH)2","CH4","KOH"];
export const substanceCategories=["Все","кислота","основание","соль","оксид","металл","неметалл","газ","органика","пероксид","простое вещество"] as const;
const trim=(formula:string)=>normalizeFormulaInput(formula).replace(/\s+/g,"");
export const schoolSubstances:Substance[]=substances.slice().sort((a,b)=>
 (common.indexOf(a.formula)<0?999:common.indexOf(a.formula))-
 (common.indexOf(b.formula)<0?999:common.indexOf(b.formula))||
 a.name.localeCompare(b.name,"ru"));
const byFormula=new Map(substances.map(s=>[trim(s.formula),s]));
export function lookupSubstance(value:string):Substance|undefined{return byFormula.get(trim(value));}
export function searchSchoolSubstances(query:string,kind:string="Все",limit=25):Substance[]{
 const search=query.trim().toLocaleLowerCase("ru");
 return schoolSubstances.filter(s=>(kind==="Все"||s.kind===kind)&&
 (!search||[s.name,s.formula,s.kind].some(v=>v.toLocaleLowerCase("ru").includes(search)))).slice(0,limit);
}
export type ReactionGuidance={
 status:"reaction"|"none"|"unknown";title:string;description:string;
 matched:ReactionCase|null;products:"match"|"different"|"empty"|"unknown";
 warning?:string;
};
const formulaList=(species:EquationSpecies[])=>species.filter(x=>x.formula.trim()).map(x=>trim(x.formula)).sort();
const equals=(a:string[],b:string[])=>a.length===b.length&&a.every((x,i)=>x===b[i]);
export function getReactionGuidance(draft:EquationDraft,environment:ReactionEnvironment):ReactionGuidance{
 const inputs=formulaList(draft.left);
 if(!inputs.length)return {status:"unknown",title:"Выберите реагенты",
  description:"Добавьте вещества из каталога либо введите известные формулы.",matched:null,products:"empty"};
 const found=identifyReaction(inputs,environment);
 if(found.status==="unknown")return {status:"unknown",title:"Нет подтверждённого сценария",
  description:found.message,matched:null,products:"unknown"};
 const reaction=found.caseData!;
 if(found.status==="none")return {status:"none",title:"Реакция не наблюдается",
  description:reaction.description,matched:reaction,products:"empty"};
 const suggested=parseEquationDraft(reaction.equation);
 const expected=suggested?formulaList(suggested.right):[];
 const actual=formulaList(draft.right);
 const state=actual.length===0?"empty":equals(actual,expected)?"match":"different";
 return {status:"reaction",title:"Проверенная школьная реакция",
  description:reaction.description,matched:reaction,products:state,
  ...(reaction.safety?{warning:reaction.safety}:{})};
}
export function suggestedPartners(current:string[],environment:ReactionEnvironment,limit=8):Substance[]{
 const ids=current.map(trim).filter(Boolean);
 if(ids.length!==1)return [];
 const first=ids[0];
 const suggestions=new Set<string>();
 for(const entry of reviewedReactionCases){
  if(entry.environment!==environment||entry.status!=="reaction"||entry.reactants.length!==2)continue;
  const reactants=entry.reactants.map(trim);
  if(!reactants.includes(first))continue;
  reactants.forEach(r=>{if(r!==first&&byFormula.has(r))suggestions.add(r);});
 }
 return [...suggestions].slice(0,limit).map(id=>byFormula.get(id)!).filter(Boolean);
}
export type ReactionExample={id:string;label:string;type:string;environment:ReactionEnvironment;reaction:ReactionCase};
const examples=[
 ["HCl","NaOH","aqueous","Нейтрализация"],
 ["AgNO3","NaCl","aqueous","Образование осадка"],
 ["HCl","Na2CO3","aqueous","Выделение газа"],
 ["Zn","HCl","aqueous","Замещение"],
 ["CH4","O2","ignited","Горение"],
 ["CaCO3",null,"heated","Разложение"],
 ["H2O2",null,"dry","Разложение"],
 ["CuSO4","NaOH","aqueous","Осадок гидроксида"]
] as const;
export const reactionExamples:ReactionExample[]=examples.flatMap(([a,b,environment,type],i)=>{
 const reactants=b?[a,b]:[a];
 const found=identifyReaction(reactants,environment);
 return found.status==="reaction"&&found.caseData?
  [{id:"example-"+i,label:found.caseData.equation,type,environment,reaction:found.caseData}]:[];
});
export function sourceReactionDraft(reaction:ReactionCase):EquationDraft|null{
 return parseEquationDraft(reaction.equation);
}
export function isBuilderCompatible(draft:EquationDraft):boolean{
 // Charged species require charge-balanced equations, not the neutral atom
 // conservation solver. Unrecognized ions stay in the source editor.
 return [...draft.left,...draft.right].every(s=>!s.formula.trim()||
  countFormulaAtoms(s.formula)!==null);
}
type Ion={id:string;name:string;charge:number};
export const cations:Ion[]=[
 {id:"Na",name:"Натрий Na⁺",charge:1},{id:"K",name:"Калий K⁺",charge:1},
 {id:"NH4",name:"Аммоний NH₄⁺",charge:1},{id:"Ag",name:"Серебро Ag⁺",charge:1},
 {id:"Ca",name:"Кальций Ca²⁺",charge:2},{id:"Mg",name:"Магний Mg²⁺",charge:2},
 {id:"Ba",name:"Барий Ba²⁺",charge:2},{id:"Zn",name:"Цинк Zn²⁺",charge:2},
 {id:"Cu",name:"Медь(II) Cu²⁺",charge:2},{id:"Fe",name:"Железо(II) Fe²⁺",charge:2},
 {id:"Fe",name:"Железо(III) Fe³⁺",charge:3},{id:"Al",name:"Алюминий Al³⁺",charge:3}
];
export const anions:Ion[]=[
 {id:"Cl",name:"Хлорид Cl⁻",charge:-1},{id:"Br",name:"Бромид Br⁻",charge:-1},
 {id:"I",name:"Иодид I⁻",charge:-1},{id:"NO3",name:"Нитрат NO₃⁻",charge:-1},
 {id:"OH",name:"Гидроксид OH⁻",charge:-1},{id:"SO4",name:"Сульфат SO₄²⁻",charge:-2},
 {id:"CO3",name:"Карбонат CO₃²⁻",charge:-2},{id:"S",name:"Сульфид S²⁻",charge:-2},
 {id:"PO4",name:"Фосфат PO₄³⁻",charge:-3}
];
const gcd=(a:number,b:number):number=>b?gcd(b,a%b):a;
export type IonicFormulaResult={formula:string;substance:Substance|null;error:string|null};
export function composeReviewedIonicCompound(cation:Ion,anion:Ion):IonicFormulaResult{
 if(cation.charge<=0||anion.charge>=0)return {formula:"",substance:null,error:"Нужно выбрать катион и анион."};
 const divisor=gcd(cation.charge,-anion.charge);
 const countA=-anion.charge/divisor,countB=cation.charge/divisor;
 const formatted=(ion:Ion,n:number)=>(n>1&&/\d/.test(ion.id)||
  n>1&&ion.id==="OH"?"("+ion.id+")":ion.id)+(n>1?n:"");
 const formula=formatted(cation,countA)+formatted(anion,countB);
 const found=lookupSubstance(formula)??null;
 return {formula,substance:found,error:found?null:
  "Такой состав не подтверждён каталогом Lektrus. Формула рассчитана только по зарядам, устойчивость вещества не проверялась."};
}
