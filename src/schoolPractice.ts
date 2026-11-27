/** Shared exercise interaction, separate from immutable teacher-authored content.
 * A configuration key prevents restoring answers into a different assignment. */
import {validSchoolPractice,type SchoolPractice} from "./boardModel";
export {validSchoolPractice,type SchoolPractice,type SchoolPracticeBinding} from "./boardModel";
const obj=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==="object"&&!Array.isArray(v);
export function practiceKey(value:unknown):string{
 // Only selected configuration fields are passed here. Object key order is
 // immaterial: PostgreSQL JSONB can reorder keys on every fetch.
 const stable=(v:unknown):unknown=>Array.isArray(v)?v.map(stable):obj(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,stable(v[k])])):v;
 const text=JSON.stringify(stable(value));let h=2166136261;
 for(let i=0;i<text.length;i++)h=Math.imul(h^text.charCodeAt(i),16777619);
 return (h>>>0).toString(16).padStart(8,"0");
}
export function practiceOrder(codes:readonly string[],key:string):string[]{
 const result=[...codes];let seed=parseInt(key,16)>>>0;
 for(let i=result.length-1;i>0;i--){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const j=seed%(i+1);[result[i],result[j]]=[result[j],result[i]];}
 if(result.length>1&&result.every((v,i)=>v===codes[i]))[result[0],result[1]]=[result[1],result[0]];
 return result;
}
export function orthographyPracticeInitial(questions:readonly unknown[],candidate?:SchoolPractice):Extract<SchoolPractice,{kind:"orthography"}>{
 const index=candidate?.kind==="orthography"?Math.min(candidate.index,Math.max(0,questions.length-1)):0;
 return {kind:"orthography",key:practiceKey(questions[index]??null),index,picked:null,checked:false};
}
export function practiceFitsDiagram(value:SchoolPractice,diagram:unknown):boolean{
 if(!validSchoolPractice(value)||!obj(diagram))return false;
 const d=diagram;
 const sameSet=(list:string[],source:unknown)=>Array.isArray(source)&&list.length===source.length&&list.every(id=>source.includes(id));
 if(value.kind==="sentence")return d.kind==="sentence-builder"&&Array.isArray(d.parts)&&sameSet(value.order,d.parts.map(p=>obj(p)?p.id:null))&&value.key===practiceKey(d.parts);
 if(value.kind==="geo-matching"||value.kind==="geo-cards")return d.kind==="geo-training"&&d.exercise===(value.kind==="geo-matching"?"matching":"cards")&&sameSet(value.order,d.countryCodes)&&value.key===practiceKey([d.countryCodes,d.relation,d.reverse,d.exercise]);
 if(value.kind==="language-cards")return d.kind==="flashcards"&&Array.isArray(d.cards)&&value.index<d.cards.length&&value.key===practiceKey([d.cards,d.direction]);
 if(value.kind==="orthography"){
  if(d.kind!=="orthography"||!Array.isArray(d.questions)||value.index>=d.questions.length)return false;
  const q=d.questions[value.index];return obj(q)&&Array.isArray(q.options)&&(value.picked===null||value.picked<q.options.length)&&value.key===practiceKey(q);
 }
 return false;
}
