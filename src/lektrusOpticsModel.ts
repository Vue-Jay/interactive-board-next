/** The optics sheet is separate from mechanics and Cartesian graphs. */
export type OpticalKind="source"|"mirror"|"converging-lens"|"diverging-lens"|"interface"|"screen"|"prism";
export type OpticalElement={id:string;kind:OpticalKind;x:number;y:number;label:string;
  focalLength:number;length:number;n1:number;n2:number};
export type OpticalRay={id:string;sourceId:string;angle:number;color:string};
export type LegacyOpticsStroke={id:string;x1:number;y1:number;x2:number;y2:number;label:string;arrow:boolean};
export type OpticsDocument={version:1;elements:OpticalElement[];rays:OpticalRay[];grid:boolean;labels:boolean;normals:boolean;legacy?:LegacyOpticsStroke[]};
export type OpticalPoint={x:number;y:number};
export type OpticalPath={id:string;color:string;points:OpticalPoint[];kind:"normal"|"reflected"|"refracted"|"lens"|"prism"|"straight";note:string};
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
  if(v.legacy!=null&&(!Array.isArray(v.legacy)||v.legacy.length>200||
    v.legacy.some(segment=>!segment||typeof segment.id!=="string"||
      typeof segment.label!=="string"||segment.label.length>75||
      typeof segment.arrow!=="boolean"||
      ![segment.x1,segment.y1,segment.x2,segment.y2].every(Number.isFinite))))return false;
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
type Vector={x:number;y:number};
const prismFaces=(e:OpticalElement):[OpticalPoint,OpticalPoint][]=>{
  const a={x:e.x,y:e.y-85},b={x:e.x-74,y:e.y+65},c={x:e.x+74,y:e.y+65};
  return [[a,b],[b,c],[c,a]];
};
const raySegmentHit=(p:OpticalPoint,d:Vector,a:OpticalPoint,b:OpticalPoint)=>{
  const ex=b.x-a.x,ey=b.y-a.y,cross=d.x*ey-d.y*ex;
  if(Math.abs(cross)<1e-8)return null;
  const vx=a.x-p.x,vy=a.y-p.y;
  const t=(vx*ey-vy*ex)/cross;
  const u=(vx*d.y-vy*d.x)/cross;
  return t>.005&&u>=0&&u<=1?{t,point:{x:p.x+t*d.x,y:p.y+t*d.y}}:null;
};
const refract=(d:Vector,a:OpticalPoint,b:OpticalPoint,from:number,to:number):Vector|null=>{
  const len=Math.hypot(b.x-a.x,b.y-a.y)||1;
  let nx=-(b.y-a.y)/len,ny=(b.x-a.x)/len;
  if(nx*d.x+ny*d.y>0){nx=-nx;ny=-ny}
  const ci=-(nx*d.x+ny*d.y),eta=from/to;
  const k=1-eta*eta*(1-ci*ci);
  if(k<0)return null;
  return {x:eta*d.x+(eta*ci-Math.sqrt(k))*nx,
    y:eta*d.y+(eta*ci-Math.sqrt(k))*ny};
};

/** Iterate through all encountered optical surfaces.
 * Finite interaction and travel bounds prevent cyclic reflections from locking
 * the board. Optics are educational approximations, not spectral ray tracing. */
export function traceOpticalRay(doc:OpticsDocument,ray:OpticalRay):OpticalPath|null{
  const source=doc.elements.find(e=>e.id===ray.sourceId&&e.kind==="source");
  if(!source)return null;
  const theta=limitAngle(ray.angle)*Math.PI/180;
  let direction:Vector={x:Math.cos(theta),y:-Math.sin(theta)};
  let position:OpticalPoint={x:source.x,y:source.y};
  const points:OpticalPoint[]=[position];
  let previousId="";
  let note="Прямолинейный ход луча";
  let kind:OpticalPath["kind"]="straight";
  const unit=(v:Vector):Vector=>{
    const len=Math.hypot(v.x,v.y)||1;return {x:v.x/len,y:v.y/len};
  };
  const advance=(p:OpticalPoint,v:Vector,amount:number):OpticalPoint=>
    ({x:p.x+v.x*amount,y:p.y+v.y*amount});
  const addPoint=(p:OpticalPoint)=>{if(!points.some(q=>Math.abs(q.x-p.x)<.0001&&Math.abs(q.y-p.y)<.0001))points.push(p)};
  for(let pass=0;pass<18;pass++){
    type Hit={e:OpticalElement;point:OpticalPoint;t:number;facet?:[OpticalPoint,OpticalPoint]};
    const candidates:Hit[]=[];
    for(const e of doc.elements){
      if(e.id===source.id||e.kind==="source")continue;
      if(e.kind==="prism"){
        for(const facet of prismFaces(e)){
          const hit=raySegmentHit(position,direction,...facet);
          if(hit&&hit.t>.08&&!(previousId===e.id&&hit.t<1))
            candidates.push({e,...hit,facet});
        }
        continue;
      }
      if(Math.abs(direction.x)<1e-7)continue;
      const t=(e.x-position.x)/direction.x;
      if(t<=.08||previousId===e.id&&t<1)continue;
      const y=position.y+direction.y*t;
      if(Math.abs(y-e.y)<=e.length/2) candidates.push({e,t,point:{x:e.x,y}});
    }
    const hit=candidates.sort((a,b)=>a.t-b.t)[0];
    if(!hit){
      addPoint(endpoint(position,direction.x,direction.y));
      break;
    }
    const {e,point:p}=hit;
    addPoint(p);
    previousId=e.id;
    if(e.kind==="screen"){
      kind="straight";note="Луч поглощён экраном";break;
    }
    if(e.kind==="mirror"){
      direction={x:-direction.x,y:direction.y};
      position=advance(p,direction,.2);
      kind="reflected";note="Последовательное отражение от зеркальных поверхностей";
      continue;
    }
    if(e.kind==="interface"){
      const entering=direction.x>0;
      const ratio=(entering?e.n1:e.n2)/(entering?e.n2:e.n1);
      const sine=direction.y*ratio;
      if(Math.abs(sine)>1){
        direction={x:-direction.x,y:direction.y};
        kind="reflected";note="Полное внутреннее отражение на границе сред";
      }else{
        direction=unit({x:Math.sign(direction.x)*Math.sqrt(Math.max(0,1-sine*sine)),y:sine});
        kind="refracted";note="Преломление по закону Снеллиуса на последовательных границах";
      }
      position=advance(p,direction,.2);
      continue;
    }
    if(e.kind==="converging-lens"||e.kind==="diverging-lens"){
      const focal=e.focalLength*(e.kind==="diverging-lens"?-1:1);
      const slope=direction.y/Math.max(.00001,Math.abs(direction.x));
      const newSlope=bounded(slope-(p.y-e.y)/focal,-8,8);
      const sign=Math.sign(direction.x)||1;
      direction=unit({x:sign,y:newSlope});
      position=advance(p,direction,.2);
      kind="lens";note="Последовательное прохождение через тонкие линзы (параксиальная модель)";
      continue;
    }
    if(e.kind==="prism"&&hit.facet){
      const inside=refract(direction,hit.facet[0],hit.facet[1],e.n1,e.n2);
      if(!inside){
        const edge=hit.facet,dx=edge[1].x-edge[0].x,dy=edge[1].y-edge[0].y;
        const len=Math.hypot(dx,dy)||1;
        let nx=-dy/len,ny=dx/len;
        if(direction.x*nx+direction.y*ny>0){nx=-nx;ny=-ny}
        const dot=direction.x*nx+direction.y*ny;
        direction=unit({x:direction.x-2*dot*nx,y:direction.y-2*dot*ny});
        position=advance(p,direction,.2);
        kind="reflected";note="Полное отражение от грани призмы";continue;
      }
      const entry=advance(p,inside,.08);
      const exits=prismFaces(e).flatMap(facet=>{
        const result=raySegmentHit(entry,inside,...facet);
        return result&&result.t>.15?[{...result,facet}]:[];
      }).sort((a,b)=>a.t-b.t);
      if(!exits.length){
        direction=inside;position=entry;kind="prism";note="Преломление на входе в призму";
        continue;
      }
      const exit=exits[0];
      addPoint(exit.point);
      const outward=refract(inside,exit.facet[0],exit.facet[1],e.n2,e.n1);
      if(!outward){
        // At present the simple teaching model stops at internal reflection;
        // following every bounce inside a polygon is a separate advanced mode.
        kind="prism";note="Внутреннее отражение в призме";break;
      }
      direction=unit(outward);
      position=advance(exit.point,direction,.2);
      kind="prism";note="Преломление в призме и дальнейшее прохождение через элементы";
      continue;
    }
  }
  if(points.length===1)addPoint(endpoint(position,direction.x,direction.y));
  if(points.length>1&&points.length<20){
    const last=points[points.length-1];
    if(last.x>0&&last.x<OPTICS_WIDTH&&last.y>0&&last.y<OPTICS_HEIGHT&&
      !doc.elements.some(e=>e.kind==="screen"&&Math.abs(e.x-last.x)<1&&Math.abs(e.y-last.y)<e.length/2) &&
      !note.includes("Внутреннее отражение в призме")){
      // Looped rays can reach the cap. Do not silently leave a floating endpoint.
      if(points.length>=18)addPoint(endpoint(position,direction.x,direction.y));
    }
  }
  return {id:ray.id,color:ray.color,points,kind,note};
}
export function traceOptics(doc:OpticsDocument):OpticalPath[]{return doc.rays.flatMap(r=>{const p=traceOpticalRay(doc,r);return p?[p]:[]})}
