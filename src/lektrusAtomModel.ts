import {elementFacts} from "./lektrusElementFacts";
import {periodicElements} from "./lektrusPeriodicElements";
export type AtomViewMode="shell"|"orbit"|"lewis"|"nucleus";
export type AtomModel={
 atomicNumber:number;mode:AtomViewMode;
 labelX:number;labelY:number;showElectronConfiguration:boolean;
};
export const atomViews:{id:AtomViewMode;name:string;description:string}[]=[
 {id:"shell",name:"Модель Бора",description:"Электроны на концентрических оболочках"},
 {id:"orbit",name:"Планетарная модель",description:"Наглядная модель Резерфорда с орбитами"},
 {id:"lewis",name:"Схема Льюиса",description:"Символ и электроны внешнего уровня"},
 {id:"nucleus",name:"Состав атома",description:"Протоны, нейтроны и электроны"}
];
export const defaultAtomModel:AtomModel={atomicNumber:8,mode:"shell",labelX:0,labelY:0,showElectronConfiguration:true};
const nobleSymbolIndex=(symbol:string)=>periodicElements.findIndex(e=>e.symbol===symbol)+1;
function expandConfiguration(number:number,depth=0):string{
 if(depth>6||number<1||number>118)return "";
 const text=elementFacts[number-1]?.electronConfiguration??"";
 return text.replace(/\[([A-Za-z]{1,2})\]/g,(_match,base:string)=>{
  const n=nobleSymbolIndex(base);
  return n>0&&n<number?expandConfiguration(n,depth+1):"";
 });
}
/** Shell occupation is read from the reference electron configuration,
 * not guessed from 2n² filling. Configurations of newly discovered elements may be tentative. */
export function atomShells(number:number):number[]{
 const expanded=expandConfiguration(number);
 const shellCounts:number[]=[];
 const regex=/(\d+)\s*([spdfg])\s*(\d+)/g;
 for(const match of expanded.matchAll(regex)){
  const index=Number(match[1])-1,amount=Number(match[3]);
  if(index>=0&&index<8)shellCounts[index]=(shellCounts[index]??0)+amount;
 }
 if(shellCounts.reduce((a,b)=>a+(b??0),0)===number)
  return shellCounts.map(v=>v??0);
 const fallback:number[]=[];
 // Safe pedagogical fallback when a reference configuration is missing.
 let rest=number;
 for(const capacity of [2,8,18,32,32,18,8]){
  if(rest<=0)break;
  const fill=Math.min(capacity,rest);
  fallback.push(fill);rest-=fill;
 }
 return fallback;
}
export const elementByNumber=(number:number)=>periodicElements[number-1]??periodicElements[7];
