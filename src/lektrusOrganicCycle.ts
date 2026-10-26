/** Regularise a simple open atom chain into a chemically conventional ring.
 * Only reshapes a connected path with no branches so existing substituents
 * and fused rings are never dragged or distorted.
 */
export function regularizeOrganicCycle<T extends {x:number;y:number}>(
 points:T[],edges:ReadonlyArray<{a:number;b:number}>,from:number,to:number
):T[]|null{
 if(from===to||points.length<3||points.length>24||edges.length!==points.length-1)return null;
 const adjacency=points.map(()=>[] as number[]);
 for(const edge of edges){
  if(!adjacency[edge.a]||!adjacency[edge.b]||edge.a===edge.b)return null;
  adjacency[edge.a].push(edge.b);adjacency[edge.b].push(edge.a);
 }
 if(adjacency.some(n=>n.length<1||n.length>2)||adjacency[from].length!==1||adjacency[to].length!==1)return null;
 const order:number[]=[from],seen=new Set([from]);
 while(order.at(-1)!==to){
  const next=adjacency[order.at(-1)!].find(i=>!seen.has(i));
  if(next===undefined)return null;
  seen.add(next);order.push(next);
 }
 if(order.length!==points.length)return null;
 // Use the existing centroid and orientation, with an even bond length.
 const cx=points.reduce((v,p)=>v+p.x,0)/points.length;
 const cy=points.reduce((v,p)=>v+p.y,0)/points.length;
 const edgeLength=2.15;
 const radius=edgeLength/(2*Math.sin(Math.PI/order.length));
 const phase=Math.atan2(points[from].y-cy,points[from].x-cx);
 const winding=(()=>{
  let sum=0;
  for(let i=0;i<points.length;i++){
   const a=points[order[i]],b=points[order[(i+1)%points.length]];
   sum+=(a.x-cx)*(b.y-cy)-(b.x-cx)*(a.y-cy);
  }
  return sum>=0?1:-1;
 })();
 const output=points.map(p=>({...p}));
 order.forEach((index,i)=>{const angle=phase+winding*2*Math.PI*i/order.length;
  output[index]={...output[index],x:cx+radius*Math.cos(angle),y:cy+radius*Math.sin(angle)};
 });
 return output;
}
