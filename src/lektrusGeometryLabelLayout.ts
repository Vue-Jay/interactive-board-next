type Point={x:number;y:number};
type LabelPoint=Point&{label?:string;fontSize?:number;preferredAngle?:number};
export type LabelRect={left:number;right:number;top:number;bottom:number};
type Rect=LabelRect;
export type LabelEdge=[Point,Point];
type Edge=LabelEdge;
export type GeometryLabel=Point&{leader:boolean};
const cross=(a:Point,b:Point,c:Point)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
const inside=(p:Point,r:Rect)=>p.x>=r.left&&p.x<=r.right&&p.y>=r.top&&p.y<=r.bottom;
const intersects=(r:Rect,s:Rect)=>r.left<s.right&&r.right>s.left&&r.top<s.bottom&&r.bottom>s.top;
function polygonContains(p:Point,poly:Point[]){
 let result=false;
 for(let i=0,j=poly.length-1;i<poly.length;j=i++){
  const a=poly[i],b=poly[j];
  if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)result=!result;
 }
 return result;
}
const corners=(r:Rect):Point[]=>[{x:r.left,y:r.top},{x:r.right,y:r.top},{x:r.right,y:r.bottom},{x:r.left,y:r.bottom}];
export function edgeHits(r:Rect,[a,b]:Edge){
 if(inside(a,r)||inside(b,r))return true;
 const c=corners(r);
 return c.some((x,i)=>{
  const y=c[(i+1)%4];
  return Math.max(a.x,b.x)>=Math.min(x.x,y.x)&&Math.min(a.x,b.x)<=Math.max(x.x,y.x)&&
   Math.max(a.y,b.y)>=Math.min(x.y,y.y)&&Math.min(a.y,b.y)<=Math.max(x.y,y.y)&&
   cross(a,b,x)*cross(a,b,y)<=0&&cross(x,y,a)*cross(x,y,b)<=0;
 });
}
/** Extend a construction to the actual SVG edge rather than just its handles. */
export function constructionLabelEdge(a:Point,b:Point,kind:string,width=600,height=360):Edge{
 const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy);
 if(len<.001||kind==="segment")return [a,b];
 const span=Math.hypot(width,height)+len+Math.hypot(a.x-width/2,a.y-height/2);
 const q={x:dx/len*span,y:dy/len*span};
 return [kind==="line"?{x:a.x-q.x,y:a.y-q.y}:a,{x:a.x+q.x,y:a.y+q.y}];
}
export function labelBox(p:Point,label:string,fontSize=13):Rect{
 const halfWidth=Math.max(8,Array.from(label).length*fontSize*.36+4),halfHeight=fontSize*.65+4;
 return {left:p.x-halfWidth,right:p.x+halfWidth,top:p.y-halfHeight,bottom:p.y+halfHeight};
}
/** Work in the SVG's own pixels, independent of canvas zoom or world units. */
export function geometryLabelLayout(points:LabelPoint[],polygons:Point[][],edges:Edge[],width=600,height=360,avoid:Rect[]=[]):(GeometryLabel|null)[]{
 const used:Rect[]=[...avoid];
 const polygonEdges=polygons.flatMap(poly=>poly.map((p,i):Edge=>[p,poly[(i+1)%poly.length]]));
 const lines=[...edges,...polygonEdges];
 const average={x:points.reduce((s,p)=>s+p.x,0)/Math.max(1,points.length),y:points.reduce((s,p)=>s+p.y,0)/Math.max(1,points.length)};
 return points.map(p=>{
  if(!p.label)return null;
  const direction=p.preferredAngle??Math.atan2(p.y-average.y,p.x-average.x);
  let best:{x:number;y:number;score:number;box:Rect;dist:number}|null=null;
  // Bound work for large free sketches; small solids can search farther to
  // place a projected interior vertex beyond their silhouette.
  const maxRadius=points.length<=12?Math.hypot(width,height):81;
  for(let radius=18;radius<=maxRadius;radius+=9){
   for(let step=0;step<16;step++){
    const angle=direction+((step%2?1:-1)*Math.ceil(step/2))*Math.PI/8;
    const x=p.x+Math.cos(angle)*radius,y=p.y+Math.sin(angle)*radius;
    const box=labelBox({x,y},p.label,p.fontSize);
    if(box.left<3||box.top<3||box.right>width-3||box.bottom>height-3)continue;
    const collision=used.filter(r=>intersects(r,box)).length+points.filter(v=>inside(v,box)).length+
     lines.filter(line=>edgeHits(box,line)).length+
     polygons.filter(poly=>corners(box).some(c=>polygonContains(c,poly))).length;
    const score=collision*10000+radius+step*.2;
    if(!best||score<best.score)best={x,y,score,box,dist:radius};
   }
   if(best&&best.score<10000)break;
  }
  if(!best){
   const box=labelBox({x:0,y:0},p.label,p.fontSize);
   const x=Math.max(-box.left+3,Math.min(width-box.right-3,p.x));
   const y=Math.max(-box.top+3,Math.min(height-box.bottom-3,p.y));
   used.push(labelBox({x,y},p.label,p.fontSize));
   return {x,y,leader:Math.hypot(x-p.x,y-p.y)>35};
  }
  used.push(best.box);
  return {x:best.x,y:best.y,leader:best.dist>35};
 });
}
