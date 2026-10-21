/** Viewport-oriented groups of real mineral records, never artificial deposits. */
export type MineralMapPoint<T=unknown>={id:number;point:number[];commodity:{name:string;color:string};feature:T};
export type MineralMapCluster<T=unknown>={
 id:string;point:[number,number];count:number;dominant:string;
 representative:MineralMapPoint<T>;members:MineralMapPoint<T>[]
};
export function clusterMineralMapPoints<T>(points:MineralMapPoint<T>[],scale:number,filter:string,
 limit=170):MineralMapCluster<T>[]{
 const cell=scale<2?24:scale<4?29:36;
 const bins=new Map<string,{sumX:number;sumY:number;members:MineralMapPoint<T>[];names:Map<string,number>}>();
 for(const p of points){
  if(filter!=="Все виды"&&p.commodity.name!==filter)continue;
  if(!Number.isFinite(p.point[0])||!Number.isFinite(p.point[1]))continue;
  const x=p.point[0]*scale,y=p.point[1]*scale;
  const key=Math.floor(x/cell)+":"+Math.floor(y/cell);
  let bin=bins.get(key);
  if(!bin){bin={sumX:0,sumY:0,members:[],names:new Map()};bins.set(key,bin)}
  bin.sumX+=p.point[0];bin.sumY+=p.point[1];bin.members.push(p);
  bin.names.set(p.commodity.name,(bin.names.get(p.commodity.name)??0)+1);
 }
 return [...bins.entries()].map(([id,b]):MineralMapCluster<T>=>{
  const n=b.members.length;
  const ranked=[...b.names.entries()].sort((a,c)=>c[1]-a[1]||a[0].localeCompare(c[0],"ru"));
  return {id,point:[b.sumX/n,b.sumY/n],count:n,dominant:ranked[0][0],
   representative:b.members[0],members:b.members};
 }).sort((a,b)=>b.count-a.count||a.id.localeCompare(b.id)).slice(0,limit);
}
