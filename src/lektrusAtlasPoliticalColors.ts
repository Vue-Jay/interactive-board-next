import type {GeoFeature} from "./lektrusAtlasData";
/** Muted school-atlas colors arranged by neighboring polygon borders, not by country-name hashes. */
export const politicalAtlasPalette=[
 "#f2d6ac","#b9d9ef","#d3e5ae","#efc3ca","#d5c8ef","#f4e3a1",
 "#bde3d6","#e6d0b4","#bdd1f4","#f0cbe8","#dce7bb","#f0ccae",
 "#c3e4e5","#ecd8ec","#c7d3a8","#f1d2bd"
] as const;
type Polygons=number[][][][];
/** Map geometries can contain multipart polygons and shared administrative edges. */
function polygonRings(f:GeoFeature):number[][][]{
 const g=f.geometry;if(!g)return [];
 if(g.type==="Polygon")return [g.coordinates as number[][][]];
 if(g.type==="MultiPolygon")return (g.coordinates as Polygons);
 return [];
}
function countryCode(f:GeoFeature,index:number):string{
 const p=f.properties??{};
 return String(p.ADM0_A3??p.ISO_A3??p.SOV_A3??p.ADMIN??p.NAME??index);
}
/** Approximate shared borders by quantised samples, with O(number of boundary vertices)
 * processing. False neighbours only add color constraints; no geometry is altered.
 */
export function colorPoliticalCountries(features:GeoFeature[]):string[]{
 const edges=new Map<string,Set<string>>();
 const codes=features.map((f,i)=>countryCode(f,i));
 const seen=new Map<string,string>();
 const touch=(a:string,b:string)=>{
  if(a===b)return;
  if(!edges.has(a))edges.set(a,new Set());
  if(!edges.has(b))edges.set(b,new Set());
  edges.get(a)!.add(b);edges.get(b)!.add(a);
 };
 const mark=(x:number,y:number,code:string)=>{
  const id=Math.round(x*5)+":"+Math.round(y*5);
  const prior=seen.get(id);
  if(prior)touch(code,prior);
  else seen.set(id,code);
 };
 for(let i=0;i<features.length;i++){
  const code=codes[i];
  for(const polygon of polygonRings(features[i])){
   for(const ring of polygon){
    for(let k=1;k<ring.length;k++){
     const from=ring[k-1],to=ring[k];
     if(!Array.isArray(from)||!Array.isArray(to))continue;
     const dx=Number(to[0])-Number(from[0]),dy=Number(to[1])-Number(from[1]);
     if(!Number.isFinite(dx)||!Number.isFinite(dy))continue;
     const steps=Math.max(1,Math.min(25,Math.ceil(Math.hypot(dx,dy)*5)));
     for(let n=0;n<=steps;n++){
      const t=n/steps;
      mark(Number(from[0])+dx*t,Number(from[1])+dy*t,code);
     }
    }
   }
  }
 }
 const nodes=[...new Set(codes)];
 const assigned=new Map<string,number>();
 while(assigned.size<nodes.length){
  const candidates=nodes.filter(code=>!assigned.has(code));
  candidates.sort((a,b)=>{
   const sat=(c:string)=>new Set([...(edges.get(c)??[])].map(v=>assigned.get(v)).filter(v=>v!==undefined)).size;
   return sat(b)-sat(a)||(edges.get(b)?.size??0)-(edges.get(a)?.size??0)||a.localeCompare(b);
  });
  const code=candidates[0],used=new Set([...(edges.get(code)??[])].map(c=>assigned.get(c)));
  let choice=0;
  while(used.has(choice)&&choice<politicalAtlasPalette.length-1)choice++;
  assigned.set(code,choice);
 }
 return codes.map(code=>politicalAtlasPalette[assigned.get(code)??0]);
}
