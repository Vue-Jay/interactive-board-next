/** The optics sheet is separate from mechanics and Cartesian graphs. */
export type OpticalKind="source"|"mirror"|"converging-lens"|"diverging-lens"|"interface"|"screen"|"prism";
export type OpticalElement={id:string;kind:OpticalKind;x:number;y:number;label:string;
  focalLength:number;length:number;n1:number;n2:number};
export type OpticalRay={id:string;sourceId:string;angle:number;color:string};
export type OpticsDocument={version:1;elements:OpticalElement[];rays:OpticalRay[];grid:boolean;labels:boolean;normals:boolean};
export type OpticalPoint={x:number;y:number};
export type OpticalPath={id:string;color:string;points:OpticalPoint[];kind:"normal"|"reflected"|"refracted"|"lens"|"straight";note:string};
export const OPTICS_WIDTH=960,OPTICS_HEIGHT=560;
export const opticsId=()=>Math.random().toString(36).slice(2,9)+Date.now().toString(36).slice(-5);
const bounded=(v:number,low:number,high:number)=>Math.max(low,Math.min(high,v));
export const emptyOptics=():OpticsDocument=>({version:1,elements:[],rays:[],grid:true,labels:true,normals:true});
export function makeOpticalElement(kind:OpticalKind,x:number,y:number):OpticalElement{
  return {id:opticsId(),kind,x:bounded(Math.round(x),35,925),y:bounded(Math.round(y),35,525),
    label:"",length:220,focalLength:130,n1:1,n2:1.5};
}
export function validOptics(d:unknown):d is OpticsDocument{
  if(!d||typeof d!=="object")return false;
  const v=d as Partial<OpticsDocument>;
  if(v.version!==1||!Array.isArray(v.elements)||!Array.isArray(v.rays)||
    v.elements.length>80||v.rays.length>160||
    typeof v.grid!=="boolean"||typeof v.labels!=="boolean"||typeof v.normals!=="boolean")return false;
  const ids=new Set<string>();
  const known=new Set<OpticalKind>(["source","mirror","converging-lens","diverging-lens","interface","screen","prism"]);
  for(const e of v.elements){
    if(!e||typeof e.id!=="string"||ids.has(e.id)||!known.has(e.kind)||
      ![e.x,e.y,e.focalLength,e.length,e.n1,e.n2].every(Number.isFinite)||
      e.x<0||e.x>960||e.y<0||e.y>560||e.length<30||e.length>530||
      e.focalLength<20||e.focalLength>500||e.n1<1||e.n1>3||e.n2<1||e.n2>3||
      typeof e.label!=="string"||e.label.length>75)return false;
    ids.add(e.id);
  }
  const rayIds=new Set<string>();
  for(const r of v.rays)if(!r||typeof r.id!=="string"||rayIds.has(r.id)||!ids.has(r.sourceId)||
    v.elements.find(e=>e.id===r.sourceId)?.kind!=="source"||
    !Number.isFinite(r.angle)||r.angle< -85||r.angle>85||
    typeof r.color!=="string"||!/^#[0-9a-fA-F]{6}$/.test(r.color))return false;
  else rayIds.add(r.id);
  return true;
}
const endpoint=(p:OpticalPoint,dx:number,dy:number):OpticalPoint=>{
  const tx=dx>0?(OPTICS_WIDTH-p.x)/dx:dx<0?-p.x/dx:Infinity;
  const ty=dy>0?(OPTICS_HEIGHT-p.y)/dy:dy<0?-p.y/dy:Infinity;
  const t=Math.max(0,Math.min(tx,ty,1600));
  return {x:p.x+dx*t,y:p.y+dy*t};
};
const limitAngle=(angle:number)=>bounded(angle,-85,85);
/** First contact ray sketch using thin-lens/paraxial and planar Snell models.
 * It is a learning construction, not a full optical ray-tracing solver. */
export function traceOpticalRay(doc:OpticsDocument,ray:OpticalRay):OpticalPath|null{
  const source=doc.elements.find(e=>e.id===ray.sourceId&&e.kind==="source");
  if(!source)return null;
  const angle=limitAngle(ray.angle)*Math.PI/180;
  const dir={x:Math.cos(angle),y:-Math.sin(angle)};
  const candidates=doc.elements.filter(e=>e.id!==source.id&&e.kind!=="source"&&e.kind!=="prism")
    .map(e=>{
      if(Math.abs(dir.x)<.00001)return null;
      const t=(e.x-source.x)/dir.x;
      const intersection={x:e.x,y:source.y+dir.y*t};
      return t>0&&Math.abs(intersection.y-e.y)<=e.length/2?{e,t,intersection}:null;
    }).filter((v):v is {e:OpticalElement;t:number;intersection:OpticalPoint}=>!!v)
    .sort((a,b)=>a.t-b.t);
  if(!candidates.length)return {id:ray.id,color:ray.color,points:[source,endpoint(source,dir.x,dir.y)],kind:"straight",note:"Прямолинейный ход луча"};
  const hit=candidates[0],e=hit.e,p=hit.intersection;
  if(e.kind==="screen")return {id:ray.id,color:ray.color,points:[source,p],kind:"straight",note:"Луч падает на экран"};
  if(e.kind==="mirror")return {id:ray.id,color:ray.color,points:[source,p,endpoint(p,-dir.x,dir.y)],kind:"reflected",note:"Угол отражения равен углу падения"};
  if(e.kind==="interface"){
    const ratio=e.n1/e.n2*Math.sin(angle);
    if(Math.abs(ratio)>1)return {id:ray.id,color:ray.color,points:[source,p,endpoint(p,-dir.x,dir.y)],kind:"reflected",note:"Полное внутреннее отражение"};
    const next=Math.asin(ratio);
    return {id:ray.id,color:ray.color,points:[source,p,endpoint(p,Math.sign(dir.x)*Math.cos(next),-Math.sin(next))],kind:"refracted",note:"Закон Снеллиуса: n₁ sin α = n₂ sin β"};
  }
  const focal=e.focalLength*(e.kind==="diverging-lens"?-1:1);
  // Paraxial ray through a thin lens: outgoing slope changes by -height/f.
  const incomingSlope=dir.y/dir.x;
  const outgoingSlope=bounded(incomingSlope-(p.y-e.y)/focal,-8,8);
  const dx=Math.sign(dir.x)/Math.sqrt(1+outgoingSlope*outgoingSlope);
  const dy=outgoingSlope*dx;
  return {id:ray.id,color:ray.color,points:[source,p,endpoint(p,dx,dy)],kind:"lens",note:"Тонкая линза, параксиальное приближение"};
}
export function traceOptics(doc:OpticsDocument):OpticalPath[]{return doc.rays.flatMap(r=>{const p=traceOpticalRay(doc,r);return p?[p]:[]})}
