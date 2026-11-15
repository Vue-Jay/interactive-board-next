/** A motion graph is a single-valued function of time. */
type MotionPoint={x:number;y:number};
export function motionTimeAvailable(points:readonly MotionPoint[],time:number,except=-1){
 return Number.isFinite(time)&&!points.some((p,i)=>i!==except&&p.x===time);
}
export function nextMotionPointTime(points:readonly MotionPoint[],max:number):number|null{
 const last=Math.max(0,...points.map(p=>p.x));
 const next=Math.min(max,last+max/8);
 if(motionTimeAvailable(points,next))return next;
 // Once the right edge is reached, use the largest unoccupied interval.
 const times=[0,...points.map(p=>p.x).filter(x=>x>=0&&x<=max),max].sort((a,b)=>a-b);
 let gap=0,best:number|null=null;
 for(let i=1;i<times.length;i++){
  const width=times[i]-times[i-1],middle=times[i-1]+width/2;
  if(width>gap&&motionTimeAvailable(points,middle)){gap=width;best=middle;}
 }
 return best;
}
export function measureMotionPoints(points:readonly MotionPoint[]){
 if(points.length<2)return null;
 const ordered=[...points].sort((a,b)=>a.x-b.x);
 if(ordered.some((p,i)=>i>0&&p.x===ordered[i-1].x))return null;
 const first=ordered[0],last=ordered[ordered.length-1],dt=last.x-first.x;
 const area=ordered.slice(1).reduce((sum,pt,i)=>sum+(pt.y+ordered[i].y)/2*(pt.x-ordered[i].x),0);
 return {dt,change:last.y-first.y,slope:(last.y-first.y)/dt,area};
}
