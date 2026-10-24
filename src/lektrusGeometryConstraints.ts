/** Lightweight directed geometry links. A vertex can have one parent, but
 * may support any number of child vertices. Cycles and conflicting child links
 * are rejected rather than silently deforming the user's drawing. */
export type GeometryConstraint={kind:"horizontal"|"vertical"|"distance";a:number;b:number;value?:number};
type Pt={x:number;y:number};
type Model={points:Pt[];constraints?:GeometryConstraint[];xMin?:number;xMax?:number;yMin?:number;yMax?:number};
type Result<T>={draft:T;error?:string};
const finite=(n:number)=>Number.isFinite(n);
const dist=(a:Pt,b:Pt)=>Math.hypot(a.x-b.x,a.y-b.y);
const round=(n:number)=>Number(n.toFixed(6));
const validPair=(c:GeometryConstraint,n:number)=>Number.isInteger(c.a)&&Number.isInteger(c.b)&&
 c.a>=0&&c.b>=0&&c.a<n&&c.b<n&&c.a!==c.b&&
 (c.kind==="horizontal"||c.kind==="vertical"||c.kind==="distance")&&
 (c.kind!=="distance"||typeof c.value==="number"&&finite(c.value)&&c.value>0&&c.value<=1000);
const limits=(model:Model,p:Pt)=>finite(p.x)&&finite(p.y)&&
 (model.xMin===undefined||p.x>=model.xMin-1e-6)&&
 (model.xMax===undefined||p.x<=model.xMax+1e-6)&&
 (model.yMin===undefined||p.y>=model.yMin-1e-6)&&
 (model.yMax===undefined||p.y<=model.yMax+1e-6);
const byIndex=(constraints:readonly GeometryConstraint[],child:number)=>
 constraints.find(link=>link.b===child);
const applyToChild=(parentOld:Pt,parent:Pt,child:Pt,c:GeometryConstraint):Pt=>{
 if(c.kind==="horizontal")return {...child,y:parent.y};
 if(c.kind==="vertical")return {...child,x:parent.x};
 return {x:child.x+parent.x-parentOld.x,y:child.y+parent.y-parentOld.y};
};
/** New, only child constraint from parent to dependent vertex. */
export function lockGeometryConstraint<T extends Model>(
 draft:T,chosen:readonly number[],kind:GeometryConstraint["kind"],value?:number
):Result<T>{
 const fail=(error:string):Result<T>=>({draft,error});
 if(chosen.length!==2||chosen[0]===chosen[1]||
   !chosen.every(i=>Number.isInteger(i)&&i>=0&&i<draft.points.length))
  return fail("Выберите две разные точки.");
 const [a,b]=chosen,existing=(draft.constraints??[]).filter(c=>validPair(c,draft.points.length));
 if(existing.length>=30)return fail("Достигнут предел 30 связей.");
 if(byIndex(existing,b))return fail("Эта точка уже зависит от другой. Сначала снимите её связь.");
 if(existing.some(c=>c.a===a&&c.b===b))return fail("Такая связь уже существует.");
 let cursor=a;
 const seen=new Set<number>();
 while(true){
  if(cursor===b)return fail("Нельзя замкнуть зависимости в круг.");
  if(seen.has(cursor))return fail("В чертеже есть циклическая зависимость.");
  seen.add(cursor);
  const parent=byIndex(existing,cursor);
  if(!parent)break;
  cursor=parent.a;
 }
 const target=kind==="distance"?value===undefined?dist(draft.points[a],draft.points[b]):value:undefined;
 if(kind==="distance"&&(!finite(target!)||target!<=0||target!>1000))
  return fail("Задайте допустимую длину до 1000.");
 const link:GeometryConstraint={kind,a,b,...(kind==="distance"?{value:target}: {})};
 // Match the new relationship once, then preserve it on subsequent moves.
 const parent=draft.points[a],previous=draft.points[b];
 let x=previous.x,y=previous.y;
 if(kind==="horizontal")y=parent.y;
 if(kind==="vertical")x=parent.x;
 if(kind==="distance"){
  const length=dist(parent,previous);
  if(length<1e-7)return fail("Сначала разведите совпадающие точки.");
  x=parent.x+(previous.x-parent.x)*target!/length;
  y=parent.y+(previous.y-parent.y)*target!/length;
 }
 const prepared={...draft,constraints:[...existing,link]} as T;
 if(!limits(prepared,{x,y}))return fail("Новая связь выводит точку за границы рисунка.");
 const updated=moveGeometryVertex(prepared,b,x,y);
 if(updated===prepared&&(Math.abs(previous.x-x)>1e-6||Math.abs(previous.y-y)>1e-6))
  return fail("Эта связь конфликтует с положением других точек. Измените размер или снимите старую связь.");
 return {draft:updated};
}
/** Moving a parent moves dependent vertices, not vice versa. Editing a
 * dependent vertex projects it onto its active link. */
export function moveGeometryVertex<T extends Model>(draft:T,index:number,x:number,y:number):T{
 if(!Number.isInteger(index)||index<0||index>=draft.points.length||!finite(x)||!finite(y))return draft;
 const constraints=(draft.constraints??[]).filter(c=>validPair(c,draft.points.length));
 const points=draft.points.map(p=>({...p}));
 const original=points[index];
 const parent=byIndex(constraints,index);
 if(parent){
  const anchor=points[parent.a];
  if(parent.kind==="horizontal")y=anchor.y;
  if(parent.kind==="vertical")x=anchor.x;
  if(parent.kind==="distance"){
   let dx=x-anchor.x,dy=y-anchor.y,length=Math.hypot(dx,dy);
   if(length<1e-7){dx=original.x-anchor.x;dy=original.y-anchor.y;length=Math.hypot(dx,dy)}
   if(length<1e-7){dx=1;dy=0;length=1}
   x=anchor.x+dx/length*parent.value!;
   y=anchor.y+dy/length*parent.value!;
  }
 }
 points[index]={...original,x:round(x),y:round(y)};
 const seen=new Set<number>([index]),queue=[index];
 while(queue.length){
  const id=queue.shift()!;
  for(const constraint of constraints){
   if(constraint.a!==id||seen.has(constraint.b))continue;
   const child=constraint.b;
   const next=applyToChild(draft.points[id],points[id],points[child],constraint);
   points[child]={...points[child],x:round(next.x),y:round(next.y)};
   seen.add(child);queue.push(child);
  }
 }
 if(points.some((p,i)=>!limits(draft,p)&&
   (i===index||seen.has(i))))return draft;
 if(points.every((p,i)=>p.x===draft.points[i].x&&p.y===draft.points[i].y))return draft;
 return {...draft,points} as T;
}
export function forgetGeometryConstraint<T extends Model>(draft:T,index:number):T{
 if(!Number.isInteger(index)||index<0||index>=(draft.constraints??[]).length)return draft;
 return {...draft,constraints:draft.constraints!.filter((_,i)=>i!==index)} as T;
}
export function removeVertexConstraints(constraints:readonly GeometryConstraint[]|undefined,index:number):GeometryConstraint[]{
 return (constraints??[]).filter(c=>c.a!==index&&c.b!==index)
  .map(c=>({...c,a:c.a>index?c.a-1:c.a,b:c.b>index?c.b-1:c.b}));
}
/** Magnetic *axis* guides only. Deliberately avoid snapping both coordinates
 * onto another point, which would create coincident, unusable vertices. */
export function magneticGeometrySnap(points:readonly Pt[],index:number,x:number,y:number,
 threshold:number):{x:number;y:number;axis:"x"|"y"|null}{
 if(!finite(x)||!finite(y)||!finite(threshold)||threshold<=0)return {x,y,axis:null};
 let xx:{v:number;d:number}|null=null,yy:{v:number;d:number}|null=null;
 for(let i=0;i<points.length;i++){
  const p=points[i];
  if(i===index||!finite(p.x)||!finite(p.y))continue;
  const dx=Math.abs(p.x-x),dy=Math.abs(p.y-y);
  if(dx<=threshold&&(!xx||dx<xx.d))xx={v:p.x,d:dx};
  if(dy<=threshold&&(!yy||dy<yy.d))yy={v:p.y,d:dy};
 }
 // A single axis gives a helpful visual guide without collapsing vertices.
 if(xx&&(!yy||xx.d<=yy.d))return {x:xx.v,y,axis:"x"};
 if(yy)return {x,y:yy.v,axis:"y"};
 return {x,y,axis:null};
}
