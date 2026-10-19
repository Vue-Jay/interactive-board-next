import type {Item} from "./boardModel";

const valence:Record<string,number>={C:4,H:1,O:2,N:3,S:2,F:1,Cl:1,Br:1,I:1};
const colors:Record<string,string>={C:"#395573",H:"#6788cb",O:"#cf555b",N:"#4382bf",S:"#d9a045",Cl:"#3c9a72"};
export const organicAtomColor=(symbol:string)=>colors[symbol]??"#516781";
export function analyzeOrganicStructure(item:Item):{formula:string;valid:boolean;note:string}{
 const points=item.graphPoints??[],edges=item.graphSegments??[];
 const atoms:Record<string,number>={},bonds=new Array(points.length).fill(0) as number[];
 if(points.length===0)return {formula:"",valid:false,note:"Добавьте атомы"};
 for(let i=0;i<points.length;i++){
  const label=points[i].label.trim();
  if(!(label in valence))return {formula:"",valid:false,note:"Автоматическая формула поддерживает C, H, N, O и галогены; другие группы подпишите вручную."};
  atoms[label]=(atoms[label]??0)+1;
 }
 for(const edge of edges){
  if(!points[edge.a]||!points[edge.b]||edge.a===edge.b)
   return {formula:"",valid:false,note:"В структуре есть некорректная связь"};
  const order=edge.bondOrder??1;
  bonds[edge.a]+=order;bonds[edge.b]+=order;
 }
 for(let i=0;i<points.length;i++){
  const symbol=points[i].label.trim(),free=valence[symbol]-bonds[i];
  if(free<0)return {formula:"",valid:false,note:"Превышена типичная валентность у "+symbol+" (атом "+(i+1)+")"};
  if(symbol==="C"||symbol==="N"||symbol==="O"||symbol==="S")atoms.H=(atoms.H??0)+free;
  else if(free>0&&symbol==="H")return {formula:"",valid:false,note:"У водорода должна быть одна связь"};
 }
 const keys=Object.keys(atoms).filter(sym=>atoms[sym]>0);
 const order=atoms.C?["C","H",...keys.filter(sym=>sym!=="C"&&sym!=="H").sort()]:keys.sort();
 const formula=order.filter((v,i)=>order.indexOf(v)===i).map(sym=>sym+(atoms[sym]===1?"":atoms[sym])).join("");
 return {formula,valid:true,note:"Указаны неявные H по типичной валентности C(IV), N(III), O(II), S(II). Для особых состояний и заряженных частиц требуется отдельная проверка."};
}

/** Conventional skeletal notation: unlabeled C corners, implicit H on heteroatoms. */
export function organicAtomCaption(symbol:string,degree:number,showCarbon=false):string{
 if(symbol==="C"&&!showCarbon)return "";
 const typical=valence[symbol];
 if(typical===undefined)return symbol;
 const free=Math.max(0,typical-degree);
 if(symbol==="H"||symbol==="F"||symbol==="Cl"||symbol==="Br"||symbol==="I")return symbol;
 if(free===0)return symbol;
 return symbol+"H"+(free===1?"":String(free).replace(/[0-9]/g,d=>"₀₁₂₃₄₅₆₇₈₉"[Number(d)]));
}
