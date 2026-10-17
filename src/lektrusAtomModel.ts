import {elementFacts} from "./lektrusElementFacts";
import {periodicElements} from "./lektrusPeriodicElements";
export type AtomViewMode="shell"|"orbit"|"orbital"|"nucleus"|"lewis";
export type AtomModel={
 atomicNumber:number;mode:AtomViewMode;
 labelX:number;labelY:number;showElectronConfiguration:boolean;
};
export const atomViews:{id:AtomViewMode;name:string;description:string}[]=[
 {id:"shell",name:"Модель Бора",description:"Электроны на концентрических оболочках"},
 {id:"orbit",name:"Планетарная модель",description:"Наглядная модель Резерфорда с орбитами"},
 {id:"orbital",name:"Орбитальная диаграмма",description:"Энергетическая лесенка: s, p, d, f и спины электронов"},
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

/** A school orbital box diagram. Ground-state counts are parsed from reference
 * configurations, preserving exceptions such as Cr/Cu rather than filling blindly. */
export type OrbitalSublevel={
 name:string;n:number;letter:"s"|"p"|"d"|"f"|"g";
 electrons:number;orbitals:number;spins:("↑"|"↓")[][];
};
const aufbauOrder=[
 "1s","2s","2p","3s","3p","4s","3d","4p","5s","4d","5p",
 "6s","4f","5d","6p","7s","5f","6d","7p","8s","5g"
];
const subshellOrbitals:Record<OrbitalSublevel["letter"],number>={s:1,p:3,d:5,f:7,g:9};
export function orbitalSublevels(number:number):OrbitalSublevel[]{
 if(!Number.isInteger(number)||number<1||number>118)return [];
 const config=expandConfiguration(number);
 const occupations=new Map<string,number>();
 for(const match of config.matchAll(/(\d+)\s*([spdfg])\s*(\d+)/g)){
   const key=match[1]+match[2];
   occupations.set(key,(occupations.get(key)??0)+Number(match[3]));
 }
 if([...occupations.values()].reduce((sum,n)=>sum+n,0)!==number)return [];
 const order=[...aufbauOrder,...occupations.keys()].filter((name,index,all)=>all.indexOf(name)===index);
 return order.filter(name=>(occupations.get(name)??0)>0).map(name=>{
   const electrons=occupations.get(name)??0;
   const letter=name.slice(-1) as OrbitalSublevel["letter"];
   const orbitals=subshellOrbitals[letter],slots:("↑"|"↓")[][]=Array.from({length:orbitals},()=>[]);
   // Hund: occupy each degenerate orbital singly with parallel spins,
   // then pair, respecting Pauli's exclusion principle.
   for(let i=0;i<Math.min(electrons,orbitals*2);i++){
     slots[i<orbitals?i:i-orbitals].push(i<orbitals?"↑":"↓");
   }
   return {name,n:Number(name.slice(0,-1)),letter,electrons,orbitals,spins:slots};
 });
}
export const elementByNumber=(number:number)=>periodicElements[number-1]??periodicElements[7];

/** A specifically named isotope for classroom diagrams, not atomic weight rounded to A.
 * Other elements intentionally do not receive an invented neutron count. */
export const exampleIsotopeMassNumbers:Readonly<Record<number,number>>={
 1:1,2:4,3:7,4:9,5:11,6:12,7:14,8:16,9:19,10:20,
 11:23,12:24,13:27,14:28,15:31,16:32,17:35,18:40,19:39,20:40,
 21:45,22:48,23:51,24:52,25:55,26:56,27:59,28:58,29:63,30:64,
 31:69,32:74,33:75,34:80,35:79,36:84,
 47:107,53:127,78:195,79:197,82:208,92:238
};
export function exampleIsotope(number:number):{massNumber:number;neutrons:number}|null{
 const massNumber=exampleIsotopeMassNumbers[number];
 return massNumber===undefined?null:{massNumber,neutrons:massNumber-number};
}
