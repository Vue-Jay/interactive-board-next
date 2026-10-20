/** Classroom diagrams are intentionally simplified. They neither diagnose nor
 * reconstruct real geography from artificial numbers. */
export type FurtherSchoolId="bio-organ-systems"|"geo-relief-profile";
export type OrganSystem="digestive"|"respiratory";
export const organOptions={
 digestive:[
  {id:"mouth",label:"Ротовая полость"},
  {id:"esophagus",label:"Пищевод"},
  {id:"stomach",label:"Желудок"},
  {id:"liver",label:"Печень"},
  {id:"pancreas",label:"Поджелудочная железа"},
  {id:"small-intestine",label:"Тонкая кишка"},
  {id:"large-intestine",label:"Толстая кишка"}
 ],
 respiratory:[
  {id:"nasal-cavity",label:"Носовая полость"},
  {id:"larynx",label:"Гортань"},
  {id:"trachea",label:"Трахея"},
  {id:"bronchi",label:"Бронхи"},
  {id:"lungs",label:"Лёгкие"},
  {id:"diaphragm",label:"Диафрагма"}
 ]
} as const;
export type FurtherDiagram=
 |{kind:"organs";title:string;system:OrganSystem;labels:string[]}
 |{kind:"relief";title:string;showGrid:boolean;showLabels:boolean;
   points:{id:string;distance:number;height:number;label:string}[]};
export const furtherIds:FurtherSchoolId[]=["bio-organ-systems","geo-relief-profile"];
export function isFurtherId(id:string|undefined):id is FurtherSchoolId{
 return furtherIds.includes(id as FurtherSchoolId);
}
export function defaultFurtherDiagram(id:FurtherSchoolId):FurtherDiagram{
 if(id==="bio-organ-systems")return {
  kind:"organs",title:"Пищеварительная система человека",system:"digestive",
  labels:organOptions.digestive.map(x=>x.id)
 };
 return {kind:"relief",title:"Профиль рельефа · учебный пример",showLabels:true,showGrid:true,
  points:[
   {id:"a",distance:0,height:120,label:"Начало"},
   {id:"b",distance:8,height:300,label:"Возвышенность"},
   {id:"c",distance:15,height:80,label:"Долина"},
   {id:"d",distance:27,height:410,label:"Вершина"},
   {id:"e",distance:40,height:160,label:"Конец"}
  ]
 };
}
const text=(v:unknown,n:number)=>typeof v==="string"&&v.trim().length>0&&v.length<=n;
const numeric=(v:unknown,min:number,max:number)=>typeof v==="number"&&Number.isFinite(v)&&v>=min&&v<=max;
export function validFurtherDiagram(value:unknown):value is FurtherDiagram{
 if(!value||typeof value!=="object")return false;
 const d=value as Record<string,unknown>;
 if(!text(d.title,120))return false;
 if(d.kind==="organs"){
  if(d.system!=="digestive"&&d.system!=="respiratory"||!Array.isArray(d.labels))return false;
  const known=new Set<string>(organOptions[d.system].map(x=>x.id));
  return d.labels.length<=known.size&&d.labels.every(v=>typeof v==="string"&&known.has(v))&&
   new Set(d.labels).size===d.labels.length;
 }
 if(d.kind==="relief"){
  if(typeof d.showGrid!=="boolean"||typeof d.showLabels!=="boolean"||!Array.isArray(d.points)||
   d.points.length<2||d.points.length>10)return false;
  const points=d.points as Record<string,unknown>[];
  if(!points.every(p=>p&&typeof p==="object"&&text(p.id,64)&&typeof p.label==="string"&&p.label.length<=40&&
   numeric(p.distance,0,5000)&&numeric(p.height,-500,9000)))return false;
  return new Set(points.map(p=>p.id)).size===points.length&&
   new Set(points.map(p=>p.distance)).size===points.length;
 }
 return false;
}
