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
