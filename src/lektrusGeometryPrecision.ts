/** Import-free planar calculations for the school geometry editor.
 * Coordinates are diagram units. Displayed values are approximations
 * calculated from the current geometry, not measurements in centimetres. */
export type GeometryPoint={x:number;y:number};
export type PrecisionMode="horizontal"|"vertical"|"distance"|"angle";
export type PrecisionResult<T>={draft:T;error?:string};
const EPS=1e-7;
export function geometryDistance(a:GeometryPoint,b:GeometryPoint):number{
 return Math.hypot(b.x-a.x,b.y-a.y);
}
export function geometryAngle(a:GeometryPoint,vertex:GeometryPoint,b:GeometryPoint):number|null{
 const ax=a.x-vertex.x,ay=a.y-vertex.y,bx=b.x-vertex.x,by=b.y-vertex.y;
 const la=Math.hypot(ax,ay),lb=Math.hypot(bx,by);
 if(la<EPS||lb<EPS)return null;
 return Math.atan2(Math.abs(ax*by-ay*bx),ax*bx+ay*by)*180/Math.PI;
}
export function geometryPolygonMetrics(points:readonly GeometryPoint[]):{perimeter:number;area:number}|null{
 if(points.length<3||points.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)))return null;
 let signed=0,perimeter=0;
 for(let i=0;i<points.length;i++){
  const a=points[i],b=points[(i+1)%points.length];
  signed+=a.x*b.y-a.y*b.x;
  perimeter+=geometryDistance(a,b);
 }
 return {perimeter,area:Math.abs(signed)/2};
}
export const formatGeometryMetric=(value:number)=>
 Number.isFinite(value)?Number(value.toFixed(2)).toLocaleString("ru-RU",{maximumFractionDigits:2}):"—";

type HasPoints={points:GeometryPoint[];xMin?:number;xMax?:number;yMin?:number;yMax?:number};
/** Apply a *one-time* geometric adjustment. Existing constructions follow
 * references automatically, but this deliberately does not create a persistent
 * solver constraint that could fight the user's later drag gestures. */
export function adjustGeometryPoints<T extends HasPoints>(
 draft:T,selection:readonly number[],mode:PrecisionMode,target?:number
):PrecisionResult<T>{
 const fail=(error:string):PrecisionResult<T>=>({draft,error});
 const needed=mode==="angle"?3:2;
 if(selection.length!==needed||new Set(selection).size!==needed||
    selection.some(i=>!Number.isInteger(i)||i<0||i>=draft.points.length))
  return fail("Выберите "+needed+" разные вершины.");
 const pts=selection.map(i=>draft.points[i]);
 if(pts.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)))
  return fail("Координаты выбранных вершин некорректны.");
 const [a,b,c]=pts;
 let x=b.x,y=b.y,changedIndex=selection[1];
 if(mode==="horizontal"){y=a.y;}
 else if(mode==="vertical"){x=a.x;}
 else if(mode==="distance"){
  if(!Number.isFinite(target)||target!>1000||target!<=0)return fail("Укажите положительную длину не более 1000.");
  const current=geometryDistance(a,b);
  if(current<EPS)return fail("Совпадающие вершины не задают направление. Сначала разведите точки.");
  const factor=target!/current;
  x=a.x+(b.x-a.x)*factor;
  y=a.y+(b.y-a.y)*factor;
 }else{
  if(!Number.isFinite(target)||target!<=0||target!>180)
   return fail("Укажите угол от 0 до 180°.");
  const current=geometryAngle(a,b,c);
  if(current===null)return fail("Совпадающие вершины не задают угол.");
  const ray={x:a.x-b.x,y:a.y-b.y};
  const length=geometryDistance(b,c),rayLength=Math.hypot(ray.x,ray.y);
  const cross=ray.x*(c.y-b.y)-ray.y*(c.x-b.x);
  const signedAngle=(cross<0?-1:1)*target!*Math.PI/180;
  const co=Math.cos(signedAngle),si=Math.sin(signedAngle);
  x=b.x+length/rayLength*(ray.x*co-ray.y*si);
  y=b.y+length/rayLength*(ray.x*si+ray.y*co);
  changedIndex=selection[2];
 }
 if(!Number.isFinite(x)||!Number.isFinite(y))return fail("Не удалось получить координаты.");
 // The viewport boundary is the editing limit: never silently lose a vertex
 // outside the visible diagram after typing a large dimension.
 if(draft.xMin!==undefined&&x<draft.xMin-EPS||draft.xMax!==undefined&&x>draft.xMax+EPS||
    draft.yMin!==undefined&&y<draft.yMin-EPS||draft.yMax!==undefined&&y>draft.yMax+EPS)
  return fail("Точка выйдет за границы рисунка. Увеличьте диапазон осей во вкладке «Фигура».");
 const rounded={x:Number(x.toFixed(6)),y:Number(y.toFixed(6))};
 if(Math.abs(rounded.x-draft.points[changedIndex].x)<EPS&&
    Math.abs(rounded.y-draft.points[changedIndex].y)<EPS)return {draft};
 return {draft:{...draft,points:draft.points.map((p,i)=>i===changedIndex?{...p,...rounded}:p)}};
}
