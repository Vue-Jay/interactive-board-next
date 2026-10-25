/** The optics sheet is separate from mechanics and Cartesian graphs. */
export type OpticalKind="source"|"mirror"|"converging-lens"|"diverging-lens"|"interface"|"screen"|"prism";
export type OpticalElement={id:string;kind:OpticalKind;x:number;y:number;label:string;
  focalLength:number;length:number;n1:number;n2:number};
export type OpticalRay={id:string;sourceId:string;angle:number;color:string};
export type LegacyOpticsStroke={id:string;x1:number;y1:number;x2:number;y2:number;label:string;arrow:boolean};
export type OpticsDocument={version:1;elements:OpticalElement[];rays:OpticalRay[];grid:boolean;labels:boolean;normals:boolean;legacy?:LegacyOpticsStroke[]};
export type OpticalPoint={x:number;y:number};
export type OpticalInteraction={point:OpticalPoint;kind:"lens"|"mirror"|"refraction"|"tir"|"screen";text:string};
export type OpticalPath={id:string;color:string;points:OpticalPoint[];kind:"normal"|"reflected"|"refracted"|"lens"|"prism"|"straight";note:string;events?:OpticalInteraction[]};
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

/** Educational geometric ray tracing. Every encountered surface is handled
 * in travel order, including subsequent prism faces after total internal
 * reflection and optical elements encountered after leaving the prism.
 * Refraction uses Snell's law and lenses use the thin-lens approximation. */
export function traceOpticalRay(doc:OpticsDocument,ray:OpticalRay):OpticalPath|null{
  const source=doc.elements.find(e=>e.id===ray.sourceId&&e.kind==="source");
  if(!source)return null;
  const theta=limitAngle(ray.angle)*Math.PI/180;
  type Hit={e:OpticalElement;t:number;point:OpticalPoint;facet?:[OpticalPoint,OpticalPoint]};
  const unit=(v:Vector):Vector=>{
    const size=Math.hypot(v.x,v.y)||1;
    return {x:v.x/size,y:v.y/size};
  };
  const reflected=(v:Vector,a:OpticalPoint,b:OpticalPoint):Vector=>{
    const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1;
    const nx=-dy/len,ny=dx/len,dot=v.x*nx+v.y*ny;
    return unit({x:v.x-2*dot*nx,y:v.y-2*dot*ny});
  };
  const cross=(a:OpticalPoint,b:OpticalPoint,c:OpticalPoint)=>
    (b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
  const insideTriangle=(p:OpticalPoint,e:OpticalElement)=>{
    const face=prismFaces(e);
    const corners=[face[0][0],face[0][1],face[1][1]];
    const values=corners.map((a,i)=>cross(a,corners[(i+1)%3],p));
    return values.every(v=>v>=-0.0001)||values.every(v=>v<=0.0001);
  };
  const points:OpticalPoint[]=[{x:source.x,y:source.y}];
  const events:OpticalInteraction[]=[];
  const degrees=(radians:number)=>Math.round(radians*180/Math.PI);
  const incidence=(d:Vector,a:OpticalPoint,b:OpticalPoint)=>{
    const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1;
    const perpendicular=Math.abs((d.x*(-dy)+d.y*dx)/len);
    return degrees(Math.acos(bounded(perpendicular,0,1)));
  };
  const append=(p:OpticalPoint)=>{
    const last=points[points.length-1];
    if(!last||Math.hypot(last.x-p.x,last.y-p.y)>0.0001)points.push(p);
  };
  let direction:Vector={x:Math.cos(theta),y:-Math.sin(theta)};
  let position:OpticalPoint=points[0];
  // A light source may be placed in a prism. It then starts in that medium.
  let medium=doc.elements.find(e=>e.kind==="prism"&&insideTriangle(position,e))?.id??null;
  let kind:OpticalPath["kind"]="straight";
  let note="Прямолинейное распространение света";
  let finished=false;
  // A finite cap protects the UI from mirror traps. It does not terminate
  // the ray at the first total internal reflection.
  for(let step=0;step<96;step++){
    const boundary=endpoint(position,direction.x,direction.y);
    const remaining=Math.hypot(boundary.x-position.x,boundary.y-position.y);
    if(remaining<0.0001){finished=true;break}
    const hits:Hit[]=[];
    for(const e of doc.elements){
      if(e.id===source.id||e.kind==="source")continue;
      // While inside the glass only the current prism faces are active.
      // Once it exits the full optical scene is traced again.
      if(medium&&e.id!==medium)continue;
      if(e.kind==="prism"){
        for(const facet of prismFaces(e)){
          const h=raySegmentHit(position,direction,facet[0],facet[1]);
          if(h&&h.t<remaining-0.0001)hits.push({e,...h,facet});
        }
      }else if(!medium&&Math.abs(direction.x)>0.000001){
        const t=(e.x-position.x)/direction.x;
        const y=position.y+direction.y*t;
        if(t>0.005&&t<remaining-0.0001&&Math.abs(y-e.y)<=e.length/2)
          hits.push({e,t,point:{x:e.x,y}});
      }
    }
    hits.sort((a,b)=>a.t-b.t);
    const hit=hits[0];
    if(!hit){
      append(boundary);
      finished=true;break;
    }
    append(hit.point);
    const {e}=hit,p=hit.point;
    if(e.kind==="screen"){
      events.push({point:p,kind:"screen",text:"Экран: луч остановлен"});
      kind="straight";note="Луч достиг экрана";finished=true;break;
    }
    if(e.kind==="mirror"){
      const angle=degrees(Math.atan2(Math.abs(direction.y),Math.abs(direction.x)));
      events.push({point:p,kind:"mirror",text:"Зеркало: отражение, угол "+angle+"°"});
      direction=unit({x:-direction.x,y:direction.y});
      kind="reflected";note="Отражение от зеркала, далее учитываются следующие поверхности";
    }else if(e.kind==="interface"){
      // A planar interface has its left medium n1 and right medium n2.
      const from=direction.x>0?e.n1:e.n2,to=direction.x>0?e.n2:e.n1;
      const sine=direction.y*from/to;
      if(Math.abs(sine)>1){
        events.push({point:p,kind:"tir",text:"Граница сред: полное внутреннее отражение"});
        direction=unit({x:-direction.x,y:direction.y});
        kind="reflected";note="Полное внутреннее отражение на границе сред";
      }else{
        events.push({point:p,kind:"refraction",text:"Граница сред: "+from+" → "+to});
        direction=unit({x:Math.sign(direction.x)*Math.sqrt(Math.max(0,1-sine*sine)),y:sine});
        kind="refracted";note="Преломление на границе сред; луч продолжает путь";
      }
    }else if(e.kind==="converging-lens"||e.kind==="diverging-lens"){
      const f=e.focalLength*(e.kind==="diverging-lens"?-1:1);
      // A thin lens bends a ray in either travel direction. Using |dx|
      // here previously broke optical reversibility: a ray reflected back
      // through a lens could turn the wrong way or cross at a false angle.
      const sign=Math.sign(direction.x)||1;
      const incomingSlope=direction.y/direction.x;
      const outgoingSlope=bounded(incomingSlope-sign*(p.y-e.y)/f,-8,8);
      direction=unit({x:sign,y:sign*outgoingSlope});
      events.push({point:p,kind:"lens",text:(e.kind==="diverging-lens"?"Рассеивающая":"Собирающая")+" линза"});
      kind="lens";note="Преломление в тонкой линзе в прямом и обратном направлениях";
    }else if(e.kind==="prism"&&hit.facet){
      const wasInside=medium===e.id;
      const from=wasInside?e.n2:e.n1,to=wasInside?e.n1:e.n2;
      const outgoing=refract(direction,hit.facet[0],hit.facet[1],from,to);
      if(outgoing){
        events.push({point:p,kind:"refraction",
          text:(wasInside?"Выход из призмы":"Вход в призму")+
            ": "+incidence(direction,hit.facet[0],hit.facet[1])+"°"});
        direction=unit(outgoing);
        medium=wasInside?null:e.id;
        kind="prism";
        note=wasInside
          ?"Луч вышел из призмы и продолжает движение к следующим объектам"
          :"Луч преломился и проходит внутри призмы";
      }else{
        // Total internal reflection is another interaction, not the end
        // of the path. The next search sees the following triangular face.
        events.push({point:p,kind:"tir",text:"ПВО в призме: "+
          incidence(direction,hit.facet[0],hit.facet[1])+"°"});
        direction=reflected(direction,hit.facet[0],hit.facet[1]);
        kind="reflected";
        note="Полное внутреннее отражение в призме; поиск следующей грани";
      }
    }
    // Nudge in the outgoing direction, never add this epsilon to the drawn
    // polyline. This avoids repeatedly hitting the same face at zero t.
    position={x:p.x+direction.x*0.03,y:p.y+direction.y*0.03};
  }
  if(!finished){
    // Pathological closed mirror/prism loops are explicitly bounded.
    // They should not freeze a lesson or pretend light disappeared.
    note="Достигнут предел 96 взаимодействий; проверьте замкнутую систему зеркал и призм";
  }
  return {id:ray.id,color:ray.color,points,kind,note,events};
}
export function traceOptics(doc:OpticsDocument):OpticalPath[]{
  return doc.rays.flatMap(r=>{const path=traceOpticalRay(doc,r);return path?[path]:[]});
}
