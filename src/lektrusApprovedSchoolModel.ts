/** School tools explicitly selected by the Lectrus user. All educational answers
 * are teacher-authored. No automatic grammatical or family inference. */
export type ApprovedSchoolId="ru-morphemes"|"history-family-tree"|"language-flashcards";
export type MorphemeRole="prefix"|"root"|"suffix"|"ending"|"postfix";
export type Morpheme={id:string;text:string;role:MorphemeRole};
export type FamilyPerson={id:string;name:string;parents:string[]};
export type LanguageCard={id:string;term:string;translation:string;transcription:string};
export type ApprovedSchoolDiagram=
 |{kind:"morphemes";title:string;segments:Morpheme[];zeroEnding:boolean;showMarks:boolean;showBase:boolean}
 |{kind:"family-tree";title:string;people:FamilyPerson[];showGenerations:boolean}
 |{kind:"flashcards";title:string;cards:LanguageCard[];showTranslation:boolean;
   showTranscription:boolean;direction:"foreign-first"|"russian-first"};
export const approvedSchoolIds:ApprovedSchoolId[]=["ru-morphemes","history-family-tree","language-flashcards"];
export const morphemeNames:Record<MorphemeRole,string>={
 prefix:"Приставка",root:"Корень",suffix:"Суффикс",ending:"Окончание",postfix:"Постфикс"
};
const okString=(v:unknown,max:number,allowEmpty=false)=>typeof v==="string"&&v.length<=max&&
 (allowEmpty||v.trim().length>0);
export function isApprovedSchoolId(v:string|undefined):v is ApprovedSchoolId{
 return approvedSchoolIds.includes(v as ApprovedSchoolId);
}
export function createApprovedSchoolDiagram(id:ApprovedSchoolId):ApprovedSchoolDiagram{
 switch(id){
  case "ru-morphemes":return {kind:"morphemes",title:"Разбор слова по составу",
   segments:[],zeroEnding:true,showMarks:true,showBase:true};
  case "history-family-tree":return {kind:"family-tree",title:"Генеалогическое дерево",showGenerations:true,
   people:[]};
  case "language-flashcards":return {kind:"flashcards",title:"Карточки иностранных слов",
   showTranslation:false,showTranscription:true,direction:"foreign-first",
   cards:[]};
 }
}
export function validateApprovedSchoolDiagram(v:unknown):v is ApprovedSchoolDiagram{
 if(!v||typeof v!=="object")return false;
 const d=v as Record<string,unknown>;
 if(!okString(d.title,120))return false;
 if(d.kind==="morphemes"){
  if(typeof d.showMarks!=="boolean"||typeof d.showBase!=="boolean"||
   typeof d.zeroEnding!=="boolean"||!Array.isArray(d.segments)||
   d.segments.length>10)return false;
  const entries=d.segments as Morpheme[];
  if(entries.some(m=>!m||!okString(m.id,64)||!okString(m.text,24)||
   !Object.prototype.hasOwnProperty.call(morphemeNames,m.role))||
   new Set(entries.map(m=>m.id)).size!==entries.length)return false;
  const roots=entries.filter(m=>m.role==="root");
  const endings=entries.filter(m=>m.role==="ending");
  if((entries.length>0&&!roots.length)||roots.length>2||endings.length>1||
   (endings.length>0&&d.zeroEnding))return false;
  // Prefixes precede roots, suffixes/ending follow; postfix after inflexion.
  const firstRoot=entries.findIndex(m=>m.role==="root");
  const finalRoot=entries.map(m=>m.role).lastIndexOf("root");
  if(entries.some((m,i)=>(m.role==="prefix"&&i>firstRoot)||
    ((m.role==="suffix"||m.role==="ending"||m.role==="postfix")&&i<finalRoot)))return false;
  const endingIndex=entries.findIndex(m=>m.role==="ending");
  const postfixIndex=entries.findIndex(m=>m.role==="postfix");
  if(entries.filter(m=>m.role==="postfix").length>1)return false;
  if(endingIndex>=0&&entries.slice(endingIndex+1).some(m=>m.role!=="postfix"))return false;
  if(postfixIndex>=0&&postfixIndex!==entries.length-1)return false;
  return true;
 }
 if(d.kind==="family-tree"){
  if(typeof d.showGenerations!=="boolean"||!Array.isArray(d.people)||
   d.people.length>12)return false;
  const people=d.people as FamilyPerson[];
  if(people.some(p=>!p||!okString(p.id,64)||!okString(p.name,35)||
   !Array.isArray(p.parents)||p.parents.length>2||
   p.parents.some(parent=>!okString(parent,64))||
   new Set(p.parents).size!==p.parents.length)||
   new Set(people.map(p=>p.id)).size!==people.length)return false;
  const byId=new Map(people.map(p=>[p.id,p]));
  if(people.some(p=>p.parents.includes(p.id)||p.parents.some(id=>!byId.has(id))))return false;
  const visitState=new Map<string,0|1|2>();
  const walk=(id:string):boolean=>{
   const state=visitState.get(id)??0;
   if(state===1)return false;
   if(state===2)return true;
   visitState.set(id,1);
   for(const parent of byId.get(id)!.parents)if(!walk(parent))return false;
   visitState.set(id,2);
   return true;
  };
  return people.every(p=>walk(p.id));
 }
 if(d.kind==="flashcards"){
  if(typeof d.showTranslation!=="boolean"||typeof d.showTranscription!=="boolean"||
   !["foreign-first","russian-first"].includes(d.direction as string)||
   !Array.isArray(d.cards)||d.cards.length>30)return false;
  const cards=d.cards as LanguageCard[];
  return cards.every(c=>c&&okString(c.id,64)&&okString(c.term,65)&&
   okString(c.translation,80)&&okString(c.transcription,75,true))&&
   new Set(cards.map(c=>c.id)).size===cards.length;
 }
 return false;
}
export function familyGenerations(people:FamilyPerson[]){
 const map=new Map(people.map(p=>[p.id,p]));
 const memo=new Map<string,number>();
 const depth=(id:string):number=>{
  const cached=memo.get(id);if(cached!==undefined)return cached;
  const parents=map.get(id)?.parents??[];
  const level=parents.length?1+Math.max(...parents.map(depth)):0;
  memo.set(id,level);return level;
 };
 for(const person of people)depth(person.id);
 return memo;
}
