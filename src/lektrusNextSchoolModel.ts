/** Teacher-authored diagrams: no automatic grammar answers, algorithm execution or conversions. */
export type NextSchoolId="ru-syntax"|"info-flowchart"|"info-place-value";
export type WordRole="subject"|"predicate"|"attribute"|"object"|"adverbial"|"none";
export type AlgorithmNodeKind="start"|"end"|"process"|"decision"|"input"|"output";
export type AlgorithmNode={id:string;kind:AlgorithmNodeKind;label:string;lane:-1|0|1};
export type AlgorithmEdge={id:string;from:string;to:string;label:""|"да"|"нет"};
export type NextSchoolDiagram=
 |{kind:"syntax";title:string;showMarks:boolean;words:{id:string;text:string;role:WordRole}[]}
 |{kind:"flowchart";title:string;nodes:AlgorithmNode[];edges:AlgorithmEdge[];showEdgeLabels:boolean}
 |{kind:"place-value";title:string;base:2|8|10|16;digits:string;showPowers:boolean};
export const nextSchoolIds:NextSchoolId[]=["ru-syntax","info-flowchart","info-place-value"];
export const grammarRoles:Record<WordRole,string>={
 subject:"Подлежащее",predicate:"Сказуемое",attribute:"Определение",
 object:"Дополнение",adverbial:"Обстоятельство",none:"Не отмечать"
};
export const flowNodeNames:Record<AlgorithmNodeKind,string>={
 start:"Начало",end:"Конец",process:"Действие",decision:"Условие",
 input:"Ввод",output:"Вывод"
};
export const baseOptions=[2,8,10,16] as const;
export function isNextSchoolId(id:string|undefined):id is NextSchoolId{
 return nextSchoolIds.includes(id as NextSchoolId);
}
export function defaultNextSchoolDiagram(id:NextSchoolId):NextSchoolDiagram{
 if(id==="ru-syntax")return {kind:"syntax",title:"Разбор предложения",showMarks:true,words:[]};
 if(id==="info-flowchart")return {kind:"flowchart",title:"Блок-схема",showEdgeLabels:true,nodes:[],edges:[]};
 return {kind:"place-value",title:"Разрядная таблица",base:2,digits:"",showPowers:true};
}
const label=(s:unknown,length:number)=>typeof s==="string"&&s.length<=length&&s.trim().length>0;
const unique=(list:{id:string}[])=>new Set(list.map(v=>v.id)).size===list.length;
export function validNextSchoolDiagram(value:unknown):value is NextSchoolDiagram{
 if(!value||typeof value!=="object")return false;
 const d=value as Record<string,unknown>;
 if(!label(d.title,120))return false;
 if(d.kind==="syntax"){
  if(typeof d.showMarks!=="boolean"||!Array.isArray(d.words)||d.words.length<1||d.words.length>14)return false;
  const words=d.words as {id:string;text:string;role:string}[];
  return unique(words)&&words.every(w=>w&&label(w.id,64)&&label(w.text,28)&&
   Object.hasOwn(grammarRoles,w.role));
 }
 if(d.kind==="flowchart"){
  if(typeof d.showEdgeLabels!=="boolean"||!Array.isArray(d.nodes)||!Array.isArray(d.edges)||
   d.nodes.length<2||d.nodes.length>7||d.edges.length>18)return false;
  const nodes=d.nodes as AlgorithmNode[],edges=d.edges as AlgorithmEdge[];
  if(!unique(nodes)||!unique(edges))return false;
  if(nodes.filter(n=>n.kind==="start").length!==1||nodes.filter(n=>n.kind==="end").length!==1)return false;
  if(!nodes.every(n=>n&&label(n.id,64)&&label(n.label,48)&&Object.hasOwn(flowNodeNames,n.kind)&&
   [-1,0,1].includes(n.lane)))return false;
  const known=new Set(nodes.map(n=>n.id));
  if(!edges.every(e=>e&&label(e.id,64)&&known.has(e.from)&&known.has(e.to)&&e.from!==e.to&&
   ["","да","нет"].includes(e.label)))return false;
  if(new Set(edges.map(e=>e.from+"→"+e.to)).size!==edges.length)return false;
  for(const node of nodes){
   const outgoing=edges.filter(e=>e.from===node.id);
   if(node.kind==="end"&&outgoing.length)return false;
   if(node.kind==="decision"&&(outgoing.length!==2||
    new Set(outgoing.map(e=>e.label)).size!==2||
    !outgoing.some(e=>e.label==="да")||!outgoing.some(e=>e.label==="нет")))return false;
   if(node.kind!=="decision"&&outgoing.length>1)return false;
  }
  // Every node must be reachable from the start. Loops are allowed.
  const start=nodes.find(n=>n.kind==="start")!.id,visited=new Set([start]),queue=[start];
  while(queue.length){const current=queue.shift()!;for(const edge of edges.filter(e=>e.from===current))
   if(!visited.has(edge.to)){visited.add(edge.to);queue.push(edge.to)}}
  return visited.size===nodes.length&&visited.has(nodes.find(n=>n.kind==="end")!.id);
 }
 if(d.kind==="place-value"){
  if(!baseOptions.includes(d.base as 2|8|10|16)||typeof d.showPowers!=="boolean"||
   typeof d.digits!=="string"||d.digits.length<1||d.digits.length>10)return false;
  return /^[0-9A-F]+$/.test(d.digits)&&
   [...d.digits].every(v=>parseInt(v,16)<(d.base as number));
 }
 return false;
}
export function validPlaceDigit(value:string,base:2|8|10|16){
 return /^[0-9A-F]{1,10}$/.test(value)&&[...value].every(v=>parseInt(v,16)<base);
}
