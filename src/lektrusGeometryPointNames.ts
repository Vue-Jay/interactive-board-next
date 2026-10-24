/** Shared lettering for school geometry.
 * Never infer a new label from array length: deleted vertices and independently
 * added figures leave gaps, so that produced repeated A/B/C on the same drawing. */
export type NamedVertex={label?:string};
const latin=(index:number):string=>{
 let n=index,out="";
 do{out=String.fromCharCode(65+n%26)+out;n=Math.floor(n/26)-1}while(n>=0);
 return out;
};
export function nextGeometryPointLabel(points:readonly NamedVertex[]):string{
 const used=new Set(points.map(p=>(p.label??"").trim().toLocaleUpperCase("ru")).filter(Boolean));
 for(let i=0;i<1000;i++){
  const name=latin(i);
  if(!used.has(name))return name;
 }
 return "P"+String(points.length+1);
}
export function availableGeometryLabel(points:readonly NamedVertex[],requested:string):string{
 const name=requested.trim();
 if(!name)return nextGeometryPointLabel(points);
 const used=new Set(points.map(p=>(p.label??"").trim().toLocaleUpperCase("ru")).filter(Boolean));
 if(!used.has(name.toLocaleUpperCase("ru")))return name;
 return nextGeometryPointLabel(points);
}
export function isGeometryLabelInUse(points:readonly NamedVertex[],name:string,ignoreIndex=-1):boolean{
 const normalized=name.trim().toLocaleUpperCase("ru");
 return !!normalized&&points.some((point,index)=>index!==ignoreIndex&&(point.label??"").trim().toLocaleUpperCase("ru")===normalized);
}

/** Repair older drawings with repeated labels without renaming valid vertices.
 * Empty labels remain intentionally unlabeled. */
export function repairGeometryPointLabels<T extends NamedVertex>(points:readonly T[]):T[]{
 const occupied=new Set(points.map(p=>(p.label??"").trim().toLocaleUpperCase("ru")).filter(Boolean));
 const seen=new Set<string>();
 let modified=false;
 const fixed=points.map(point=>{
  const label=(point.label??"").trim(),key=label.toLocaleUpperCase("ru");
  if(!key)return point;
  if(!seen.has(key)){seen.add(key);return point}
  let index=0,candidate="";
  do{
   let n=index++,value="";
   do{value=String.fromCharCode(65+n%26)+value;n=Math.floor(n/26)-1}while(n>=0);
   candidate=value;
  }while(occupied.has(candidate.toLocaleUpperCase("ru"))&&index<1000);
  if(!candidate||occupied.has(candidate.toLocaleUpperCase("ru")))candidate="P"+String(points.length+index);
  const replacement=candidate.toLocaleUpperCase("ru");
  occupied.add(replacement);seen.add(replacement);
  modified=true;
  return {...point,label:candidate};
 });
 return modified?fixed:[...points];
}
