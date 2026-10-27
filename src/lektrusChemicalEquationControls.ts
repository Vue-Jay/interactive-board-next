/** Editor-only notation helpers, not a reaction prediction database. */
export type ReactionArrow="→"|"⇌"|"=";
export type ReactionTextParts={reactants:string;products:string;arrow:ReactionArrow;standalone:boolean};
// Prefer arrows and require spaces around equality so CH2=CH2 stays a molecule.
const arrowPattern=/(⇌|⇄|↔|→|⟶|⟹|->)|(?<=\s)=(?=\s)/;
export function readReactionText(expression:string):ReactionTextParts{
 const found=arrowPattern.exec(expression);
 if(!found)return {reactants:expression,products:"",arrow:"→",standalone:true};
 return {
  // Keep text and caret stable while typing, including spaces around "+".
  // Only strip the single spacer inserted by writeReactionText near the arrow.
  reactants:expression.slice(0,found.index).replace(/ $/,""),
  products:expression.slice(found.index+found[0].length).replace(/^ /,""),
  arrow:found[0]==="⇌"||found[0]==="⇄"||found[0]==="↔"?"⇌":found[0].includes("=")? "=":"→",
  standalone:false
 };
}
export function writeReactionText(parts:ReactionTextParts,keepStandalone=false):string{
 if(keepStandalone&&!parts.products.trim())return parts.reactants;
 return parts.reactants+" "+parts.arrow+" "+parts.products;
}

export type ConditionGroup={id:string;title:string;tokens:readonly string[]};
export const REACTION_CONDITION_GROUPS:readonly ConditionGroup[]=[
 {id:"heat",title:"Температура",tokens:[
  "t°","Δ","нагревание","охлаждение","−20 °C","0 °C","25 °C","80 °C","100 °C","170 °C","200 °C","450 °C"]},
 {id:"energy",title:"Свет и энергия",tokens:[
  "hν","свет","УФ","ИК","поджиг","электролиз","эл. ток","эл. разряд","микроволны","ультразвук"]},
 {id:"catalysts",title:"Катализаторы",tokens:[
  "кат.","Pt","Pd","Ni","кат. Линдлара","Fe","Cu","MnO₂","V₂O₅","Al₂O₃","Cr₂O₃","H₂SO₄ (конц.)","H₃PO₄","фермент"]},
 {id:"medium",title:"Среда и растворители",tokens:[
  "H₂O","водн. р-р","этанол","спирт","эфир","ацетон","бензол","толуол",
  "THF","DMSO","кислая среда","щелочная среда","нейтральная среда"]},
 {id:"pressure",title:"Давление и атмосфера",tokens:[
  "p↑","p↓","1 атм","10 атм","100 атм","вакуум","N₂","Ar","O₂","без доступа воздуха"]},
 {id:"other",title:"Дополнительно",tokens:[
  "1 ч","2 ч","24 ч","перемешивание","избыток","недостаток","сухая среда","конц.","разб.","осадок"]},
];
export const REACTION_CONDITION_LIMIT=180;
export const parseConditionTokens=(value:string):string[]=>value.split(/\s*,\s*/).map(v=>v.trim()).filter(Boolean);
export function toggleReactionCondition(value:string,token:string,limit=REACTION_CONDITION_LIMIT):string{
 const list=parseConditionTokens(value);
 const index=list.indexOf(token);
 if(index>=0)list.splice(index,1);
 else list.push(token);
 const updated=list.join(", ");
 return updated.length<=limit?updated:value;
}
