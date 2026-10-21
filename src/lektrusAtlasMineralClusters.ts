/** School-atlas glyphs represent verified commodity classes, not colour blobs.
 * Group only same-commodity records; choose symbols across all continents
 * before filling in densely documented countries such as the USA.
 */
export type MineralMapPoint<T=unknown>={id:number;point:number[];commodity:{name:string;color:string};feature:T};
export type MineralMapCluster<T=unknown>={
 id:string;point:[number,number];count:number;dominant:string;
 representative:MineralMapPoint<T>;members:MineralMapPoint<T>[]
};
export function clusterMineralMapPoints<T>(points:MineralMapPoint<T>[],scale:number,filter:string,
 limit=420):MineralMapCluster<T>[]{
 const cell=scale<2?17:scale<4?22:28;
 const bins=new Map<string,{sumX:number;sumY:number;members:MineralMapPoint<T>[];name:string}>();
 for(const p of points){
  if(filter!=="Все виды"&&p.commodity.name!==filter)continue;
  if(!Number.isFinite(p.point[0])||!Number.isFinite(p.point[1]))continue;
  const x=p.point[0]*scale,y=p.point[1]*scale;
  // Critical: use the mineral type in the key. An oil/gold mixture must
  // never be displayed as a single "gold" deposit at any scale.
  const key=Math.floor(x/cell)+":"+Math.floor(y/cell)+":"+p.commodity.name;
  let bin=bins.get(key);
  if(!bin){bin={sumX:0,sumY:0,members:[],name:p.commodity.name};bins.set(key,bin)}
  bin.sumX+=p.point[0];bin.sumY+=p.point[1];bin.members.push(p);
 }
 const groups=[...bins.entries()].map(([id,b]):MineralMapCluster<T>=>({
  id,point:[b.sumX/b.members.length,b.sumY/b.members.length],count:b.members.length,
  dominant:b.name,representative:b.members[0],members:b.members
 })).sort((a,b)=>b.count-a.count||a.id.localeCompare(b.id));
 if(groups.length<=limit)return groups;
 // One region must not consume all glyph slots simply because its database
 // contains more records. Spread the overview over coarse world sectors.
 const sectors=new Map<string,MineralMapCluster<T>[]>();
 for(const group of groups){
  const region=Math.floor(group.point[0]/90)+":"+Math.floor(group.point[1]/75);
  const row=sectors.get(region);
  if(row)row.push(group);else sectors.set(region,[group]);
 }
 const keys=[...sectors.keys()].sort();
 const selected:MineralMapCluster<T>[]=[];
 let pass=0;
 while(selected.length<limit){
  let any=false;
  for(const key of keys){
   const candidate=sectors.get(key)![pass];
   if(!candidate)continue;
   selected.push(candidate);any=true;
   if(selected.length>=limit)break;
  }
  if(!any)break;
  pass++;
 }
 return selected;
}
