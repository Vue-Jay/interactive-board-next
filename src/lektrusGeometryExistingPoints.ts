import type {Item} from "./boardModel";
import {availableGeometryLabel} from "./lektrusGeometryPointNames";

export type ExistingPointTool="segment"|"line"|"ray"|"polygon"|"angle"|"circle"|"midpoint"|"measure";

type Geometry={
  points:NonNullable<Item["graphPoints"]>;
  segments:NonNullable<Item["graphSegments"]>;
  polygons:NonNullable<Item["graphPolygons"]>;
  angles:NonNullable<Item["graphAngles"]>;
  circles:NonNullable<Item["graphCircles"]>;
  midpoints:NonNullable<Item["graphMidpoints"]>;
};
export type ExistingPointResult<T>={draft:T;error?:string};
export const existingPointTools:readonly {id:ExistingPointTool;label:string;needed:number}[]=[
  {id:"segment",label:"Отрезок",needed:2},
  {id:"line",label:"Прямая",needed:2},
  {id:"ray",label:"Луч",needed:2},
  {id:"polygon",label:"Многоугольник",needed:3},
  {id:"angle",label:"Угол",needed:3},
  {id:"circle",label:"Окружность",needed:2},
  {id:"midpoint",label:"Середина",needed:2},
  {id:"measure",label:"Измерить / выровнять",needed:2}
];
const samePair=(a:number,b:number,c:number,d:number)=>a===c&&b===d||a===d&&b===c;
const cross=(a:{x:number;y:number},b:{x:number;y:number},c:{x:number;y:number})=>
  (b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
const intersect=(a:{x:number;y:number},b:{x:number;y:number},c:{x:number;y:number},d:{x:number;y:number})=>{
  const ab1=cross(a,b,c),ab2=cross(a,b,d),cd1=cross(c,d,a),cd2=cross(c,d,b);
  // Nonadjacent polygon edges may not touch or overlap.
  const between=(p:{x:number;y:number},q:{x:number;y:number},r:{x:number;y:number})=>
    Math.min(p.x,r.x)-1e-7<=q.x&&q.x<=Math.max(p.x,r.x)+1e-7&&
    Math.min(p.y,r.y)-1e-7<=q.y&&q.y<=Math.max(p.y,r.y)+1e-7;
  if(Math.abs(ab1)<1e-7&&between(a,c,b)||Math.abs(ab2)<1e-7&&between(a,d,b)||
     Math.abs(cd1)<1e-7&&between(c,a,d)||Math.abs(cd2)<1e-7&&between(c,b,d))return true;
  return (ab1>0)!==(ab2>0)&&(cd1>0)!==(cd2>0);
};
const sameCycle=(a:readonly number[],b:readonly number[])=>{
  if(a.length!==b.length)return false;
  for(let start=0;start<b.length;start++)if(b[start]===a[0])
    for(const dir of [1,-1]){
      if(a.every((id,i)=>id===b[(start+dir*i+b.length*2)%b.length]))return true;
    }
  return false;
};
/** Build an actual construction from vertex *references*, never duplicate points.
 * All tools work on any planar school drawing, including finished polygons.
 * Invalid attempts keep the existing draft untouched. */
export function linkExistingPoints<T extends Geometry>(
  draft:T,kind:ExistingPointTool,chosen:readonly number[]
):ExistingPointResult<T>{
  const error=(reason:string):ExistingPointResult<T>=>({draft,error:reason});
  if(kind==="measure")return error("Для измерения выберите точки и используйте панель точных построений.");
  const count=kind==="polygon"?3:kind==="angle"?3:2;
  if(chosen.length<count||(kind!=="polygon"&&chosen.length!==count))
    return error("Выберите "+(kind==="polygon"?"не менее трёх":"нужное количество")+" точек.");
  if(kind==="polygon"&&chosen.length>20)return error("Многоугольник может содержать не более 20 вершин.");
  if(new Set(chosen).size!==chosen.length)return error("Одна вершина не может повторяться в построении.");
  if(!chosen.every(index=>Number.isInteger(index)&&index>=0&&index<draft.points.length&&
    Number.isFinite(draft.points[index].x)&&Number.isFinite(draft.points[index].y)))
    return error("Некоторые выбранные точки недоступны.");
  const p=chosen.map(i=>draft.points[i]);
  if(p.some((a,i)=>p.slice(i+1).some(b=>Math.hypot(a.x-b.x,a.y-b.y)<1e-6)))
    return error("Совпадающие по положению точки нельзя соединить. Разведите вершины.");
  if(kind==="polygon"){
    if(draft.polygons.length>=20)return error("На чертеже уже 20 многоугольников.");
    const area=Math.abs(p.reduce((total,a,i)=>total+a.x*p[(i+1)%p.length].y-
      p[(i+1)%p.length].x*a.y,0))/2;
    if(area<1e-6)return error("Вершины лежат на одной прямой. Площадь фигуры равна нулю.");
    for(let i=0;i<p.length;i++)for(let j=i+1;j<p.length;j++){
      if(j===i+1||i===0&&j===p.length-1)continue;
      if(intersect(p[i],p[(i+1)%p.length],p[j],p[(j+1)%p.length]))
        return error("Стороны пересекаются. Выберите вершины по контуру фигуры.");
    }
    if(draft.polygons.some(poly=>sameCycle(poly.points,chosen)))
      return error("Такой многоугольник уже существует.");
    return {draft:{...draft,polygons:[...draft.polygons,{points:[...chosen],label:"",measure:false,keepPointsOnDelete:true}]}};
  }
  const [a,b]=chosen;
  if(kind==="segment"||kind==="line"||kind==="ray"){
    if(draft.segments.length>=60)return error("На чертеже достигнут предел 60 линий.");
    if(draft.segments.some(seg=>seg.kind===kind&&
      (kind==="ray"?seg.a===a&&seg.b===b:samePair(seg.a,seg.b,a,b))))
      return error("Такая линия уже есть на чертеже.");
    return {draft:{...draft,segments:[...draft.segments,{a,b,kind,label:"",measure:false,keepPointsOnDelete:true}]}};
  }
  if(kind==="circle"){
    if(draft.circles.length>=30)return error("На чертеже достигнут предел 30 окружностей.");
    if(draft.circles.some(circle=>circle.center===a&&circle.edge===b))
      return error("Такая окружность уже существует.");
    return {draft:{...draft,circles:[...draft.circles,{center:a,edge:b,label:"",measure:false,keepPointsOnDelete:true}]}};
  }
  if(kind==="midpoint"){
    if(draft.midpoints.length>=40)return error("На чертеже достигнут предел 40 середин.");
    if(draft.midpoints.some(mid=>samePair(mid.a,mid.b,a,b)))
      return error("Середина этого отрезка уже отмечена.");
    const label=availableGeometryLabel([...draft.points,...draft.midpoints],"M");
    return {draft:{...draft,midpoints:[...draft.midpoints,{a,b,label,keepPointsOnDelete:true}]}};
  }
  if(draft.angles.length>=40)return error("На чертеже достигнут предел 40 углов.");
  const [first,vertex,last]=chosen;
  const left={x:p[0].x-p[1].x,y:p[0].y-p[1].y};
  const right={x:p[2].x-p[1].x,y:p[2].y-p[1].y};
  // A straight 180° angle is valid school geometry; only coincident rays
  // that create a zero angle should be rejected.
  if(Math.abs(cross(p[1],p[0],p[2]))<1e-6&&
    left.x*right.x+left.y*right.y>0)
    return error("Лучам с одинаковым направлением соответствует нулевой угол.");
  if(draft.angles.some(angle=>angle.vertex===vertex&&samePair(angle.a,angle.b,first,last)))
    return error("Этот угол уже построен.");
  return {draft:{...draft,angles:[...draft.angles,{a:first,vertex,b:last,label:"",keepPointsOnDelete:true}]}};
}
