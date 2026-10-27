/** Reviewed classroom examples and conservative step-by-step diagnostics.
 * Never infer arbitrary products from stoichiometry. Unknown chemistry is UNKNOWN.
 */
import {identifyReaction,type ReactionEnvironment} from "./lektrusReactionDatabase";
import {inspectEquationBalance,normalizeFormulaInput,parseEquationDraft,type EquationDraft,type EquationSpecies} from "./lektrusChemicalEquationModel";
export type EquationDomain="inorganic"|"organic";
export type EquationStep={expression:string;conditions:string};
export type ReviewIssue={severity:"error"|"warning"|"info";kind:"missing"|"extra"|"coefficient"|"indicator"|"formula"|"condition"|"chain"|"reaction"|"unknown";side?:"left"|"right";index?:number;formula?:string;message:string};
export type ReviewedEquation={status:"correct"|"incorrect"|"partial"|"unknown";issues:ReviewIssue[];reference?:string;referenceConditions?:string;canFillProducts:boolean;canMarkProducts:boolean;canBalance:boolean;description:string};
export type ReactionExample={id:string;title:string;expression:string;conditions:string;domain:EquationDomain};
const example=(id:string,title:string,expression:string,conditions="",domain:EquationDomain="inorganic"):ReactionExample=>({id,title,expression,conditions,domain});
export const classroomEquationExamples:ReactionExample[]=[
 example("silver-chloride","Образование осадка","AgNO3 + NaCl → AgCl↓ + NaNO3"),
 example("neutralisation","Нейтрализация","HCl + NaOH → NaCl + H2O"),
 example("carbonate","Карбонат и кислота","Na2CO3 + 2HCl → 2NaCl + H2O + CO2↑"),
 example("decomposition","Распад угольной кислоты","H2CO3 → H2O + CO2↑"),
 example("lime","Обжиг известняка","CaCO3 → CaO + CO2↑","t°"),
 example("methane","Горение метана","CH4 + 2O2 → CO2 + 2H2O","поджиг","organic"),
 example("alkene","Гидрирование этена","C2H4 + H2 → C2H6","Ni, t°","organic"),
 example("addition","Присоединение брома","C2H4 + Br2 → C2H4Br2","","organic"),
 example("dehydration","Дегидратация этанола","C2H5OH → C2H4 + H2O","H₂SO₄ (конц.), 170 °C","organic"),
 example("ester","Этерификация","CH3COOH + C2H5OH ⇌ CH3COOC2H5 + H2O","H₂SO₄ (конц.), t°","organic"),
 example("organic-neutralisation","Уксусная кислота + щёлочь","CH3COOH + NaOH → CH3COONa + H2O","","organic"),
 example("chlorination","Хлорирование метана","CH4 + Cl2 → CH3Cl + HCl","hν","organic"),
 example("ethanol-combustion","Горение этанола","C2H5OH + 3O2 → 2CO2 + 3H2O","поджиг","organic")
];
type Reference={expression:string;conditions?:string;note:string;environment?:ReactionEnvironment};
const official=(equation:string,note:string,conditions="",environment?:ReactionEnvironment):Reference=>({expression:equation,conditions,note,environment});
const standaloneReferences:Reference[]=[
 official("H2CO3 → H2O + CO2↑","Нестойкая угольная кислота распадается с выделением CO₂ при его удалении из раствора."),
 official("Na2CO3 + 2HCl → 2NaCl + H2CO3","Промежуточная школьная запись. H₂CO₃ неустойчива и далее распадается; добавьте следующий этап."),
 official("NaHCO3 + HCl → NaCl + H2CO3","Промежуточная школьная запись. H₂CO₃ переходит в H₂O и CO₂; добавьте следующий этап."),
 ...classroomEquationExamples.filter(e=>e.domain==="organic").map(e=>official(e.expression,"Проверенный школьный пример при указанных условиях.",e.conditions))
];
const normalize=(s:string)=>normalizeFormulaInput(s).replace(/\s+/g,"");
const list=(values:EquationSpecies[])=>values.filter(s=>s.formula.trim()).map(s=>normalize(s.formula));
const normalizedReactants=(expression:string)=>{const draft=parseEquationDraft(expression);return draft?list(draft.left):[]};
const signature=(values:string[])=>values.slice().sort().join("|");
function referenceFor(draft:EquationDraft,domain:EquationDomain,conditions:string):Reference|undefined{
 const target=signature(list(draft.left));
 if(!target)return;
 if(domain==="organic"){
  const refs=standaloneReferences.filter(r=>classroomEquationExamples.some(e=>e.domain==="organic"&&e.expression===r.expression));
  return refs.find(r=>signature(normalizedReactants(r.expression))===target);
 }
 const special=standaloneReferences.filter(r=>!classroomEquationExamples.some(e=>e.domain==="organic"&&e.expression===r.expression));
 const intermediate=(draft.right.some(s=>normalize(s.formula)==="H2CO3"));
 const matches=special.filter(r=>signature(normalizedReactants(r.expression))===target);
 const exact=matches.find(r=>parseEquationDraft(r.expression)?.right.some(s=>normalize(s.formula)==="H2CO3")===intermediate);
 if(exact)return exact;
 // Only use the existing reviewed database. Its records are condition-specific.
 const environment:ReactionEnvironment=/поджиг|горен|плам|воспламен/i.test(conditions)?"ignited":
   /t°|Δ|нагрев|[0-9]+\s*°C/i.test(conditions)?"heated":"aqueous";
 const caseData=identifyReaction(list(draft.left),environment);
 if(caseData.status==="reaction"&&caseData.caseData)return official(caseData.caseData.equation,caseData.caseData.description,"",environment);
 // Missing required heat/light etc. may explain why a reference was not matched.
 return undefined;
}
export function reviewEquationStep(step:EquationStep,domain:EquationDomain):ReviewedEquation{
 const draft=parseEquationDraft(step.expression),issues:ReviewIssue[]=[];
 if(!draft)return {status:"unknown",issues:[{kind:"formula",severity:"warning",message:"Введите знак реакции и обе части уравнения."}],
  canFillProducts:false,canMarkProducts:false,canBalance:false,description:"Недостаточно данных"};
 const left=list(draft.left),right=list(draft.right);
 if(!left.length||!right.length)return {status:"partial",issues:[{kind:"formula",severity:"warning",message:"Заполните реагенты и продукты."}],
  canFillProducts:false,canMarkProducts:false,canBalance:false,description:"Уравнение не закончено"};
 const balance=inspectEquationBalance(draft);
 if(balance.status==="invalid")issues.push({kind:"formula",severity:"error",message:"Элементы слева и справа не совпадают. Проверьте состав веществ."});
 if(balance.status==="unbalanced")issues.push({kind:"coefficient",severity:"error",message:"Неправильные коэффициенты: число атомов не сохраняется. Требуются "+balance.coefficients?.join(", ")+". "});
 if(balance.status==="unsupported")issues.push({kind:"unknown",severity:"warning",message:"Автоматическая проверка атомного баланса для этой записи недоступна."});
 const reference=referenceFor(draft,domain,step.conditions);
 // A reviewed "no reaction" must never be represented as a legitimate equation.
 if(!reference&&domain==="inorganic"){
  const environment:ReactionEnvironment=/поджиг|горен|плам/i.test(step.conditions)?"ignited":
   /t°|Δ|нагрев|[0-9]+\s*°C/i.test(step.conditions)?"heated":"aqueous";
  const negative=identifyReaction(left,environment);
  if(negative.status==="none")
   issues.push({kind:"reaction",severity:"error",side:"left",
    message:"Для этих реагентов в указанных условиях реакция не наблюдается: "+negative.caseData?.description});
 }
 if(reference){
  const expected=parseEquationDraft(reference.expression)!;
  const products=list(expected.right);
  for(let i=0;i<draft.right.length;i++){
   const candidate=normalize(draft.right[i].formula);
   if(candidate&&!products.includes(candidate))issues.push({severity:"error",kind:"extra",side:"right",index:i,formula:draft.right[i].formula,
    message:"Лишний либо неверный продукт: "+draft.right[i].formula+"."});
  }
  for(const formula of new Set(products)){
   const count=products.filter(v=>v===formula).length-right.filter(v=>v===formula).length;
   for(let i=0;i<count;i++)issues.push({severity:"error",kind:"missing",side:"right",formula,message:"Не хватает продукта "+formula+"."});
  }
  if(!issues.some(i=>i.kind==="extra"||i.kind==="missing")){
   for(let i=0;i<draft.right.length;i++){
    const current=draft.right[i],expectedEntry=expected.right.find(s=>normalize(s.formula)===normalize(current.formula));
    if(expectedEntry&&expectedEntry.indicator!==current.indicator){
     issues.push({kind:"indicator",severity:"warning",side:"right",index:i,formula:current.formula,
      message:expectedEntry.indicator?("Для "+current.formula+" нужен знак "+expectedEntry.indicator+"."):
       ("У "+current.formula+" здесь не нужен знак "+current.indicator+".")});
    }
   }
  }
  if(reference.conditions&&!(reference.conditions.toLowerCase().split(/[, ]+/).filter(Boolean)
    .some(t=>step.conditions.toLowerCase().includes(t)))){
   issues.push({severity:"warning",kind:"condition",message:"Проверьте необходимые условия: "+reference.conditions+"."});
  }
 }
 const errors=issues.filter(i=>i.severity==="error"),allKnown=!!reference;
 const status=errors.length?"incorrect":!allKnown?"unknown":issues.length?"partial":"correct";
 if(!allKnown)issues.push({kind:"unknown",severity:"info",
  message:"Справочного совпадения для этой комбинации и условий нет. Проверка правильности продуктов не подтверждена."});
 return {status,issues,reference:reference?.expression,referenceConditions:reference?.conditions,
  canFillProducts:!!reference,canMarkProducts:!!reference,canBalance:balance.status==="unbalanced"&&!!balance.coefficients,
  description:reference?.note??"Атомный баланс проверен отдельно; химическое превращение не установлено."};
}
export function reviewEquationChain(steps:EquationStep[],domain:EquationDomain){
 return steps.map((step,index)=>{
  const reviewed=reviewEquationStep(step,domain);
  const currentDraft=parseEquationDraft(step.expression);
  if(currentDraft&&list(currentDraft.right).includes("H2CO3")&&
    (index===steps.length-1||!parseEquationDraft(steps[index+1].expression)?.left.some(s=>normalize(s.formula)==="H2CO3"))){
   reviewed.issues.push({kind:"chain",severity:"warning",
    message:"H₂CO₃ является неустойчивым промежуточным продуктом. Покажите следующий этап распада на H₂O и CO₂↑."});
   if(reviewed.status==="correct")reviewed.status="partial";
  }
  if(index===0)return reviewed;
  const before=parseEquationDraft(steps[index-1].expression),current=parseEquationDraft(step.expression);
  if(before&&current&&list(before.right).length&&list(current.left).length){
   const common=list(before.right).some(s=>list(current.left).includes(s));
   if(!common)reviewed.issues.push({kind:"chain",severity:"warning",message:"У этой стадии нет общего вещества с продуктами предыдущей. Проверьте переход цепочки."});
  }
  if(reviewed.status==="correct"&&reviewed.issues.some(v=>v.kind==="chain"))reviewed.status="partial";
  return reviewed;
 });
}
export function applyKnownProductMarks(step:EquationStep,domain:EquationDomain):EquationStep|null{
 const review=reviewEquationStep(step,domain);if(!review.reference)return null;
 const actual=parseEquationDraft(step.expression),expected=parseEquationDraft(review.reference);
 if(!actual||!expected)return null;
 if(signature(list(actual.right))!==signature(list(expected.right)))return null;
 const next={...actual,right:actual.right.map(s=>{
  const ref=expected.right.find(v=>normalize(v.formula)===normalize(s.formula));
  return {...s,indicator:ref?.indicator??s.indicator};
 })};
 const side=(values:EquationSpecies[])=>values.map(s=> (s.coefficient===1?"":s.coefficient)+s.formula+s.indicator).join(" + ");
 return {...step,expression:side(next.left)+" "+next.arrow+" "+side(next.right)};
}
export function balancedStep(step:EquationStep):EquationStep|null{
 const draft=parseEquationDraft(step.expression);if(!draft)return null;
 const balance=inspectEquationBalance(draft);if(balance.status!=="unbalanced"||!balance.coefficients)return null;
 const next={...draft,left:draft.left.map(s=>({...s})),right:draft.right.map(s=>({...s}))};let i=0;
 for(const side of ["left","right"] as const)next[side].forEach(s=>{s.coefficient=balance.coefficients![i++];});
 const format=(values:EquationSpecies[])=>values.map(s=>(s.coefficient===1?"":s.coefficient)+s.formula+s.indicator).join(" + ");
 return {...step,expression:format(next.left)+" "+next.arrow+" "+format(next.right)};
}
