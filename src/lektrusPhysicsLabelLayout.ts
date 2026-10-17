import type {Item} from "./boardModel";
type P={x:number;y:number;label:string;labelDx?:number;labelDy?:number};
type S={a:number;b:number;label:string;labelDx?:number;labelDy?:number};
type Box={x:number;y:number;rx:number;ry:number};
const overlaps=(a:Box,b:Box)=>Math.abs(a.x-b.x)<a.rx+b.rx&&Math.abs(a.y-b.y)<a.ry+b.ry;
const nearLine=(box:Box,a:P,b:P)=>{
 const dx=b.x-a.x,dy=b.y-a.y;
 for(let k=0;k<=16;k++){
   const t=k/16;const x=a.x+t*dx,y=a.y+t*dy;
   if(Math.abs(box.x-x)<box.rx+.12&&Math.abs(box.y-y)<box.ry+.12)return true;
 }
 return false;
};
const boxFor=(x:number,y:number,label:string):Box=>({
 x,y,rx:Math.max(.18,Math.min(2.8,label.length*.125+.16)),ry:.26
});
/** Place default school-physics annotations separately from lines and nodes.
 * Explicit label offsets remain editable in each constructor. */
export function arrangeScienceLabels<T extends Item>(item:T):T{
 if(!item.graphFigureId?.startsWith("physics-")||item.graphFigureId.startsWith("physics-circuit-"))return item;
 const pts: P[]=(item.graphPoints??[]).map(p=>({...p}));
 const lines:S[]=(item.graphSegments??[]).map(s=>({...s}));
 const occupied:Box[]=[];
 const lineCollision=(rect:Box)=>{
   let conflicts=0;
   for(const edge of lines){
    const a=pts[edge.a],b=pts[edge.b];if(a&&b&&nearLine(rect,a,b))conflicts++;
   }
   return conflicts;
 };
 const penalty=(r:Box,ownPoint:number|undefined)=>{
   let cost=0;
   if(r.x-r.rx< -6.8||r.x+r.rx>6.8||
      r.y-r.ry< -4.75||r.y+r.ry>4.75)cost+=250;
   for(let i=0;i<pts.length;i++){
     if(i===ownPoint)continue;
     if(overlaps(r,{x:pts[i].x,y:pts[i].y,rx:.16,ry:.17}))cost+=35;
   }
   for(const old of occupied)if(overlaps(r,old))cost+=125;
   cost+=lineCollision(r)*40;
   return cost;
 };
 // Points first: short names are anchored to their corresponding vertices.
 pts.forEach((p,index)=>{
  if(!p.label||p.labelDx!=null||p.labelDy!=null)return;
  const options:[[number,number],...[number,number][]]=[
    [.5,.65],[-.5,.65],[.5,-.68],[-.5,-.68],
    [1,.4],[-1,.4],[1,-.45],[-1,-.45],
    [.15,1.05],[-.15,-1.05],
    [1.4,.9],[-1.4,.9],[1.4,-.9],[-1.4,-.9]
  ];
  let chosen=options[0],best=Infinity;
  for(const [dx,dy] of options){
   const r=boxFor(p.x+dx,p.y+dy,p.label);
   const score=penalty(r,index)+Math.hypot(dx,dy)*1.5;
   if(score<best){best=score;chosen=[dx,dy]}
  }
  p.labelDx=chosen[0];p.labelDy=chosen[1];
  occupied.push(boxFor(p.x+chosen[0],p.y+chosen[1],p.label));
 });
 // Long optical labels must never sit directly on a ray or surface.
 lines.forEach(s=>{
  if(!s.label||s.labelDx!=null||s.labelDy!=null)return;
  const a=pts[s.a],b=pts[s.b];if(!a||!b)return;
  const mx=(a.x+b.x)/2,my=(a.y+b.y)/2;
  const len=Math.hypot(b.x-a.x,b.y-a.y)||1;
  const nx=-(b.y-a.y)/len,ny=(b.x-a.x)/len;
  const choices:[number,number][]=[];
  for(const dist of [.55,.9,1.3,1.75,2.2]){
   for(const sign of [1,-1]){
    for(const along of [0,.7,-.7,1.4,-1.4]){
     choices.push([nx*dist*sign+(b.x-a.x)/len*along,
       ny*dist*sign+(b.y-a.y)/len*along]);
    }
   }
  }
  let chosen=choices[0],best=Infinity;
  for(const [dx,dy] of choices){
   const r=boxFor(mx+dx,my+dy,s.label);
   const score=penalty(r,undefined)+Math.hypot(dx,dy)*.4;
   if(score<best){chosen=[dx,dy];best=score}
  }
  s.labelDx=+chosen[0].toFixed(2);s.labelDy=+chosen[1].toFixed(2);
  occupied.push(boxFor(mx+chosen[0],my+chosen[1],s.label));
 });
 return {...item,graphPoints:pts,graphSegments:lines} as T;
}
