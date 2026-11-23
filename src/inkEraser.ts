import type { Item, Point } from "./boardModel";
export type EraserMode = "partial" | "stroke";

/** A freehand eraser: cut an ink polyline only where the brush passed. */
const distance2 = (p:Point,a:Point,b:Point) => {
  const dx=b.x-a.x,dy=b.y-a.y,den=dx*dx+dy*dy;
  const t=den>0?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/den)):0;
  return (p.x-a.x-dx*t)**2+(p.y-a.y-dy*t)**2;
};
const at=(a:Point,b:Point,t:number):Point=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
const equal=(a:Point,b:Point)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y)<.00001;
const push=(points:Point[],p:Point)=>{if(!points.length||!equal(points[points.length-1],p))points.push(p)};
// Exact intersection of a stroke segment with the capsule swept by the eraser.
// It handles very long straight lines without the precision loss of iterative
// ternary search, which previously missed narrow partial erasures.
function cutInterval(a:Point,b:Point,c:Point,d:Point,r:number):[number,number]|null {
  const vx=b.x-a.x,vy=b.y-a.y;
  const vv=vx*vx+vy*vy,rr=r*r;
  if(vv<1e-12)return distance2(a,c,d)<=rr?[0,1]:null;
  const intervals:[number,number][]=[];
  const circle=(center:Point)=>{
    const dx=a.x-center.x,dy=a.y-center.y;
    const qb=2*(dx*vx+dy*vy),qc=dx*dx+dy*dy-rr;
    const discriminant=qb*qb-4*vv*qc;
    if(discriminant<0)return;
    const root=Math.sqrt(Math.max(0,discriminant));
    const lo=Math.max(0,(-qb-root)/(2*vv));
    const hi=Math.min(1,(-qb+root)/(2*vv));
    if(lo<=hi)intervals.push([lo,hi]);
  };
  circle(c);
  const dx=d.x-c.x,dy=d.y-c.y;
  const length=Math.hypot(dx,dy);
  if(length>1e-12){
    circle(d);
    const ux=dx/length,uy=dy/length;
    const sx=(a.x-c.x)*ux+(a.y-c.y)*uy;
    const ds=vx*ux+vy*uy;
    const sy=-(a.x-c.x)*uy+(a.y-c.y)*ux;
    const dyPerT=-vx*uy+vy*ux;
    let low=0,high=1;
    const constrain=(initial:number,velocity:number,min:number,max:number)=>{
      if(Math.abs(velocity)<1e-12)return initial>=min&&initial<=max;
      const t0=(min-initial)/velocity,t1=(max-initial)/velocity;
      low=Math.max(low,Math.min(t0,t1));
      high=Math.min(high,Math.max(t0,t1));
      return low<=high;
    };
    if(constrain(sx,ds,0,length)&&constrain(sy,dyPerT,-r,r)){
      intervals.push([low,high]);
    }
  }
  if(!intervals.length)return null;
  let start=1,end=0;
  for(const [lo,hi] of intervals){
    start=Math.min(start,lo);
    end=Math.max(end,hi);
  }
  return [start,end];
}
function piece(source:Item,points:Point[]):Item {
  const weight=source.weight??3;
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for(const p of points){minX=Math.min(minX,p.x);maxX=Math.max(maxX,p.x);minY=Math.min(minY,p.y);maxY=Math.max(maxY,p.y)}
  const x=minX-weight/2,y=minY-weight/2;
  // An old imported ink lock must not be copied onto new erase fragments.
  const {locked:_legacyInkLock,...unlockedSource}=source;
  return {...unlockedSource,id:crypto.randomUUID(),x,y,width:Math.max(weight,maxX-minX+weight),
    height:Math.max(weight,maxY-minY+weight),points:points.map(p=>({x:p.x-x,y:p.y-y}))};
}
export function eraseInkAt(items:Item[],from:Point,to:Point,radius:number):Item[]{
  if(!(radius>0))return items;
  const output:Item[]=[];
  let changed=false;
  for(const item of items){
    if((item.kind!=="pen"&&item.kind!=="marker")||item.hidden||!item.points?.length){
      output.push(item);continue;
    }
    const r=radius+(item.weight??1)/2;
    const minX=Math.min(from.x,to.x)-r,maxX=Math.max(from.x,to.x)+r;
    const minY=Math.min(from.y,to.y)-r,maxY=Math.max(from.y,to.y)+r;
    if(item.x>maxX||item.x+item.width<minX||item.y>maxY||item.y+item.height<minY){output.push(item);continue;}
    // Avoid creating a second copy of every point on each pointer frame.
    // Dense teacher boards can contain tens of thousands of points.
    const points=item.points;
    const ox=item.x,oy=item.y;
    const localFrom={x:from.x-ox,y:from.y-oy};
    const localTo={x:to.x-ox,y:to.y-oy};
    const localMinX=minX-ox,localMaxX=maxX-ox,localMinY=minY-oy,localMaxY=maxY-oy;
    if(points.length===1){
      if(distance2(points[0],localFrom,localTo)<=r*r){changed=true;continue;}
      output.push(item);continue;
    }
    const runs:Point[][]=[];
    let run:Point[]=[];
    if(distance2(points[0],localFrom,localTo)>r*r)run=[points[0]];
    let hit=false;
    for(let i=1;i<points.length;i++){
      const a=points[i-1],b=points[i];
      if(Math.max(a.x,b.x)<localMinX||Math.min(a.x,b.x)>localMaxX||Math.max(a.y,b.y)<localMinY||Math.min(a.y,b.y)>localMaxY){
        push(run,b);continue;
      }
      const interval=cutInterval(a,b,localFrom,localTo,r);
      if(!interval){push(run,b);continue;}
      hit=true;
      const [entry,exit]=interval;
      if(entry>0)push(run,at(a,b,entry));
      if(run.length){runs.push(run);run=[];}
      if(exit<1){push(run,at(a,b,exit));push(run,b);}
    }
    if(run.length)runs.push(run);
    if(!hit){output.push(item);continue;}
    changed=true;
    for(const r of runs)if(r.length)output.push(piece(item,r.map(p=>({x:p.x+ox,y:p.y+oy}))));
  }
  return changed?output:items;
}

/**
 * Apply a complete eraser gesture only once, after the immediate canvas preview.
 * Process candidate strokes independently so unrelated items on large teacher
 * boards are never scanned once per pointer movement.
 */
export function eraseInkAlongPath(items: Item[], path: Point[], radius: number,
  canErase:(item:Item)=>boolean=()=>true, mode:EraserMode="partial"): Item[] {
  if (!path.length || radius <= 0) return items;
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for(const p of path){
    minX=Math.min(minX,p.x);minY=Math.min(minY,p.y);
    maxX=Math.max(maxX,p.x);maxY=Math.max(maxY,p.y);
  }
  if(mode==="stroke"){
    const remaining=items.filter(item=>{
      if((item.kind!=="pen"&&item.kind!=="marker")||item.hidden||!canErase(item))return true;
      const pad=radius+(item.weight??3)/2;
      // Rotated items need their expanded world bounds; never discard a
      // long vertical stroke merely because its stored bounds are horizontal.
      if(!item.rotation&&(item.x>maxX+pad||item.x+item.width<minX-pad||item.y>maxY+pad||item.y+item.height<minY-pad))return true;
      return !inkTouchesEraser(item,path,radius);
    });
    return remaining.length===items.length?items:remaining;
  }
  const output:Item[]=[];
  let changed=false;
  for(const item of items){
    if((item.kind!=="pen"&&item.kind!=="marker") || item.hidden || !canErase(item) || !item.points?.length ||
      item.x>maxX+radius+50 || item.x+item.width<minX-radius-50 ||
      item.y>maxY+radius+50 || item.y+item.height<minY-radius-50){
      output.push(item);
      continue;
    }
    let fragments:Item[]=[item];
    for(let i=0;i<path.length && fragments.length;i++){
      fragments=eraseInkAt(fragments,path[Math.max(0,i-1)],path[i],radius);
    }
    if(fragments.length!==1 || fragments[0]!==item)changed=true;
    output.push(...fragments);
  }
  return changed?output:items;
}

/** A stroke eraser removes the original ID as soon as ANY ink is touched.
 * Use the swept brush capsule, including round caps and rotated strokes. */
export function inkTouchesEraser(item:Item,path:Point[],radius:number):boolean {
  if((item.kind!=="pen"&&item.kind!=="marker")||item.hidden||!item.points?.length||!path.length||radius<=0)return false;
  const r=radius+(item.weight??3)/2;
  const angle=-(item.rotation??0)*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle);
  const cx=item.x+item.width/2,cy=item.y+item.height/2;
  const local=path.map(p=>({x:(p.x-cx)*c-(p.y-cy)*s+item.width/2,y:(p.x-cx)*s+(p.y-cy)*c+item.height/2}));
  for(let i=0;i<local.length;i++){
    const a=local[Math.max(0,i-1)],b=local[i];
    const minX=Math.min(a.x,b.x)-r,maxX=Math.max(a.x,b.x)+r;
    const minY=Math.min(a.y,b.y)-r,maxY=Math.max(a.y,b.y)+r;
    if(minX>item.width||maxX<0||minY>item.height||maxY<0)continue;
    if(item.points.length===1&&distance2(item.points[0],a,b)<=r*r)return true;
    for(let j=1;j<item.points.length;j++){
      const p=item.points[j-1],q=item.points[j];
      if(Math.max(p.x,q.x)<minX||Math.min(p.x,q.x)>maxX||Math.max(p.y,q.y)<minY||Math.min(p.y,q.y)>maxY)continue;
      if(cutInterval(p,q,a,b,r))return true;
    }
  }
  return false;
}
