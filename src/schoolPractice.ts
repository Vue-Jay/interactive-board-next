/** Shared exercise interaction, separate from immutable teacher-authored content.
 * A configuration key prevents restoring answers into a different assignment. */
export type SchoolPractice =
 | {kind:"sentence";key:string;order:string[];checked:boolean}
 | {kind:"geo-matching";key:string;order:string[];matched:string[];selected:{side:"left"|"right";code:string}|null;wrong:number;feedback:""|"correct"|"wrong"}
 | {kind:"geo-cards";key:string;order:string[];index:number;revealed:boolean;known:string[]}
 | {kind:"language-cards";key:string;index:number;revealed:boolean}
 | {kind:"orthography";key:string;index:number;picked:number|null;checked:boolean};
export type SchoolPracticeBinding={value?:SchoolPractice;onChange?:(value:SchoolPractice)=>void};
const obj=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==="object"&&!Array.isArray(v);
const integer=(v:unknown,max:number):v is number=>typeof v==="number"&&Number.isSafeInteger(v)&&v>=0&&v<=max;
const ids=(v:unknown,max:number):v is string[]=>Array.isArray(v)&&v.length<=max&&v.every(id=>typeof id==="string"&&id.length>0&&id.length<=100)&&new Set(v).size===v.length;
const keys=(v:Record<string,unknown>,expected:string[])=>Object.keys(v).length===expected.length&&expected.every(k=>Object.hasOwn(v,k));
export function validSchoolPractice(value:unknown):value is SchoolPractice{
 if(!obj(value)||typeof value.key!=="string"||!/^[0-9a-f]{8}$/.test(value.key))return false;
 const v=value;
 switch(v.kind){
 case "sentence":return keys(v,["kind","key","order","checked"])&&ids(v.order,24)&&v.order.length>=2&&typeof v.checked==="boolean";
 case "geo-matching":return keys(v,["kind","key","order","matched","selected","wrong","feedback"])&&ids(v.order,12)&&v.order.length>=2&&ids(v.matched,12)&&v.matched.every(id=>(v.order as string[]).includes(id))&&integer(v.wrong,100000)&&typeof v.feedback==="string"&&["","correct","wrong"].includes(v.feedback)&&(v.selected===null||obj(v.selected)&&keys(v.selected,["side","code"])&&(v.selected.side==="left"||v.selected.side==="right")&&typeof v.selected.code==="string"&&(v.order as string[]).includes(v.selected.code));
 case "geo-cards":return keys(v,["kind","key","order","index","revealed","known"])&&ids(v.order,12)&&v.order.length>=2&&integer(v.index,v.order.length-1)&&typeof v.revealed==="boolean"&&ids(v.known,12)&&v.known.every(id=>(v.order as string[]).includes(id));
 case "language-cards":return keys(v,["kind","key","index","revealed"])&&integer(v.index,29)&&typeof v.revealed==="boolean";
 case "orthography":return keys(v,["kind","key","index","picked","checked"])&&integer(v.index,99)&&(v.picked===null||integer(v.picked,7))&&typeof v.checked==="boolean"&&(!v.checked||v.picked!==null);
 default:return false;
 }
}
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
export function practiceFitsDiagram(value:SchoolPractice,diagram:unknown):boolean{
 if(!validSchoolPractice(value)||!obj(diagram))return false;
 const d=diagram;
 const sameSet=(list:string[],source:unknown)=>Array.isArray(source)&&list.length===source.length&&list.every(id=>source.includes(id));
 if(value.kind==="sentence")return d.kind==="sentence-builder"&&Array.isArray(d.parts)&&sameSet(value.order,d.parts.map(p=>obj(p)?p.id:null))&&value.key===practiceKey(d.parts);
 if(value.kind==="geo-matching"||value.kind==="geo-cards")return d.kind==="geo-training"&&d.exercise===(value.kind==="geo-matching"?"matching":"cards")&&sameSet(value.order,d.countryCodes)&&value.key===practiceKey([d.countryCodes,d.relation,d.reverse,d.exercise]);
 if(value.kind==="language-cards")return d.kind==="flashcards"&&Array.isArray(d.cards)&&value.index<d.cards.length&&value.key===practiceKey([d.cards,d.direction]);
 if(value.kind==="orthography"){
  if(d.kind!=="orthography"||!Array.isArray(d.questions)||value.index>=d.questions.length)return false;
  const q=d.questions[value.index];return obj(q)&&Array.isArray(q.options)&&(value.picked===null||value.picked<q.options.length)&&value.key===practiceKey(d.questions);
 }
 return false;
}
