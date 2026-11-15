/** Sample a function without joining branches across a pole. Clip the resulting
 * SVG path at rendering time, retaining a short offscreen continuation. */
export function graphCurvePath(evaluate:(x:number)=>number,xMin:number,xMax:number,yMin:number,yMax:number,sx:(x:number)=>number,sy:(y:number)=>number){
 const span=yMax-yMin;
 if(!(xMax>xMin&&span>0))return "";
 let path="",previous:{x:number;y:number}|null=null;
 for(let i=0;i<=400;i++){
  const x=xMin+(xMax-xMin)*i/400,y=evaluate(x);
  if(!Number.isFinite(y)||y<yMin-span*2||y>yMax+span*2){previous=null;continue;}
  if(previous){
   const mid=evaluate((previous.x+x)/2),jump=Math.abs(y-previous.y);
   // A steep straight line has an accurate midpoint; a vertical asymptote does not.
   if(!Number.isFinite(mid)||jump>span*.4&&Math.abs(mid-(y+previous.y)/2)>Math.max(span*.25,jump*.3))previous=null;
  }
  path+=`${previous?"L":"M"}${sx(x).toFixed(1)} ${sy(y).toFixed(1)} `;
  previous={x,y};
 }
 return path;
}
