import type {RussianTaskWork} from "./boardModel";
import type {MorphemeRole} from "./lektrusApprovedSchoolModel";

export type WordPart={start:number;end:number;text:string;role:MorphemeRole|"unset"};
/** Shared tokenisation for classroom syntax work, never a grammatical parser. */
export const russianSentenceTokens=(value:string):string[]=>
 value.match(/[\p{L}\p{M}]+(?:[-’][\p{L}\p{M}]+)*|\d+|[^\s]/gu)??[];
export const russianLetters=(value:string)=>Array.from(value);
export function russianWordParts(word:string,work?:RussianTaskWork):WordPart[]{
 const letters=russianLetters(word);
 const cuts=Array.from(new Set((work?.cuts??[]).filter(n=>Number.isInteger(n)&&n>0&&n<letters.length))).sort((a,b)=>a-b);
 const positions=[0,...cuts,letters.length];
 return positions.slice(0,-1).map((start,index)=>({
  start,end:positions[index+1],text:letters.slice(start,positions[index+1]).join(""),
  role:work?.morphemeRoles?.[index]??"unset"
 }));
}
/** Preserve an existing analysis when a boundary is moved or removed. No guessed
 * linguistic roles: newly split fragments are left unassigned. */
export function changeRussianMorphemeBoundary(word:string,work:RussianTaskWork|undefined,at:number):Pick<RussianTaskWork,"cuts"|"morphemeRoles"|"zeroEnding">{
 const letters=russianLetters(word);
 if(!Number.isInteger(at)||at<=0||at>=letters.length){
  return {cuts:work?.cuts??[],morphemeRoles:work?.morphemeRoles??[],zeroEnding:work?.zeroEnding??false};
 }
 const current=russianWordParts(word,work);
 const cuts=(work?.cuts??[]).filter(n=>n>0&&n<letters.length);
 const next=cuts.includes(at)?cuts.filter(n=>n!==at):[...cuts,at];
 const positions=[0,...next.sort((a,b)=>a-b),letters.length];
 const roles=positions.slice(0,-1).map((start,i)=>{
  const end=positions[i+1];
  const matching=current.find(part=>part.start===start&&part.end===end);
  return matching?.role??"unset";
 });
 return {cuts:next,morphemeRoles:roles,zeroEnding:work?.zeroEnding??false};
}
export function russianTaskHasWork(work?:RussianTaskWork):boolean{
 if(!work)return false;
 return Boolean((work.cuts??[]).length||(work.morphemeRoles??[]).some(role=>role!=="unset")||
 work.zeroEnding||work.syntaxRoles?.some(role=>role!=="none")||work.partOfSpeech||
 work.permanent?.trim()||work.variable?.trim()||work.syntax?.trim()||
 work.textAnswers?.some(text=>text.trim()));
}
export function isSingleRussianWord(value:string):boolean{
 const letters=russianLetters(value.trim());
 return letters.length>0&&letters.length<=64&&/^[\p{L}\p{M}]+(?:[-’][\p{L}\p{M}]+)*$/u.test(value.trim());
}
