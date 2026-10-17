/** Conservative label placement for editable school science drawings.
 * Uses screen-space collision scoring to keep captions clear of strokes,
 * symbols, vertices and one another. Manual positions always win. */
export type SciencePointLabel={
 x:number;y:number;label:string;labelDx?:number;labelDy?:number;
};
export type ScienceLineLabel={
 a:number;b:number;label:string;labelDx?:number;labelDy?:number;
};
type V={x:number;y:number};
type Rect={left:number;top:number;right:number;bottom:number};
const intersect=(a:Rect,b:Rect)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
const rectangle=(x:number,y:number,label:string):Rect=>{
 const width=Math.min(195,Math.max(19,Array.from(label).length*6.3+11));
 return {left:x-width/2,top:y-14,right:x+width/2,bottom:y+5};
};
const nearLine=(box:Rect,start:V,end:V)=>{
 const distance=Math.hypot(end.x-start.x,end.y-start.y);
 const count=Math.max(2,Math.ceil(distance/5));
 for(let i=0;i<=count;i++){
  const t=i/count,x=start.x+(end.x-start.x)*t,y=start.y+(end.y-start.y)*t;
  if(x>=box.left-2&&x<=box.right+2&&y>=box.top-2&&y<=box.bottom+2)return true;
 }
 return false;
};
export function layoutScienceLabels(
 points:SciencePointLabel[],lines:ScienceLineLabel[],
 project:(p:V)=>V,width:number,height:number
):{points:V[];lines:V[]}{
 const locations=points.map(p=>project(p));
 const segments=lines.map(s=>({start:locations[s.a],end:locations[s.b]}))
   .filter((v):v is {start:V;end:V}=>Boolean(v.start&&v.end));
 const reserved:Rect[]=[];
 const rating=(place:V,label:string)=>{
  const box=rectangle(place.x,place.y,label);
  let score=0;
  if(box.left<10||box.top<24||box.right>width-10||box.bottom>height-9)
   score+=5000;
  for(const existing of reserved)if(intersect(box,existing))score+=2200;
  for(const p of locations)if(p.x>box.left-5&&p.x<box.right+5&&
    p.y>box.top-5&&p.y<box.bottom+5)score+=400;
  for(const seg of segments)if(nearLine(box,seg.start,seg.end))score+=260;
  return score;
 };
 const best=(choices:V[],label:string)=>{
  let selected=choices[0],minimum=Infinity;
  for(let i=0;i<choices.length;i++){
   const score=rating(choices[i],label)+i*.07;
   if(score<minimum){minimum=score;selected=choices[i]}
  }
  reserved.push(rectangle(selected.x,selected.y,label));
  return selected;
 };
 const pointLabels=points.map((p,i)=>{
  const at=locations[i];
  if(!p.label)return {x:at.x,y:at.y};
  if(p.labelDx!=null||p.labelDy!=null)
   return best([project({x:p.x+(p.labelDx??0),y:p.y+(p.labelDy??0)})],p.label);
  const shifts:readonly [number,number][]=[
   [20,-16],[20,23],[-20,-16],[-20,23],
   [0,-24],[0,27],[32,-8],[-32,-8],
   [35,20],[-35,20],[42,-21],[-42,-21],
   [55,-4],[-55,-4]
  ];
  return best(shifts.map(([dx,dy])=>({x:at.x+dx,y:at.y+dy})),p.label);
 });
 const lineLabels=lines.map(s=>{
  const first=points[s.a],second=points[s.b];
  if(!first||!second)return {x:0,y:0};
  const pa=locations[s.a],pb=locations[s.b];
  const mid={x:(pa.x+pb.x)/2,y:(pa.y+pb.y)/2};
  if(!s.label)return mid;
  if(s.labelDx!=null||s.labelDy!=null)
   return best([project({x:(first.x+second.x)/2+(s.labelDx??0),
     y:(first.y+second.y)/2+(s.labelDy??0)})],s.label);
  const dx=pb.x-pa.x,dy=pb.y-pa.y,length=Math.hypot(dx,dy)||1;
  const normal={x:-dy/length,y:dx/length};
  const choices:V[]=[];
  for(const fraction of [.42,.58,.28,.72,.5]){
   for(const offset of [-21,21,-34,34,-48,48]){
    choices.push({x:pa.x+dx*fraction+normal.x*offset,
      y:pa.y+dy*fraction+normal.y*offset});
   }
  }
  return best(choices,s.label);
 });
 return {points:pointLabels,lines:lineLabels};
}
