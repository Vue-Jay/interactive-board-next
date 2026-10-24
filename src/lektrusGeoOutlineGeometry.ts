/** Shape-only geography exercises.
 * Contours are computed from the same Natural Earth GeoJSON polygons as the atlas.
 * Never draw a fabricated silhouette when no polygon exists in the source. */
import type {GeoFeature} from "./lektrusAtlasData";

type Ring=number[][];
type Polygon=Ring[];
export type GeoOutline={path:string;viewBox:string};
const WIDTH=240,HEIGHT=140,PADDING=10;

function polygonRings(feature:GeoFeature):Polygon[]{
 const geometry=feature.geometry;
 if(!geometry)return [];
 if(geometry.type==="Polygon")return [geometry.coordinates as Polygon];
 if(geometry.type==="MultiPolygon")return geometry.coordinates as Polygon[];
 return [];
}
const mod360=(lon:number)=>((lon%360)+360)%360;
/** Select the smallest longitude arc containing the geometry.
 * This prevents countries crossing ±180° from spanning the entire thumbnail. */
export function outlineLongitudeOrigin(longitudes:readonly number[]):number{
 if(!longitudes.length)return 0;
 const sorted=longitudes.map(mod360).sort((a,b)=>a-b);
 let largest=-1,after=0;
 for(let i=0;i<sorted.length;i++){
  const next=i===sorted.length-1?sorted[0]+360:sorted[i+1];
  const gap=next-sorted[i];
  if(gap>largest){largest=gap;after=(i+1)%sorted.length}
 }
 return sorted[after];
}
type OutlineBounds={west:number;east:number;south:number;north:number};
const goodPoint=(point:number[])=>Array.isArray(point)&&Number.isFinite(point[0])&&Number.isFinite(point[1]);
function ringArea(ring:Ring):number{
 const valid=ring.filter(goodPoint);
 if(valid.length<3)return 0;
 // Longitude unwrapping matters around the antimeridian; this is only
 // a land-area ranking, not a cartographic projection.
 const origin=outlineLongitudeOrigin(valid.map(p=>p[0]));
 const lon=(value:number)=>(mod360(value)-origin+360)%360;
 let twiceArea=0,low=Infinity,high=-Infinity;
 for(let i=0;i<valid.length;i++){
  const a=valid[i],b=valid[(i+1)%valid.length];
  twiceArea+=lon(a[0])*b[1]-lon(b[0])*a[1];
  low=Math.min(low,a[1]);high=Math.max(high,a[1]);
 }
 return Math.abs(twiceArea)*.5*Math.max(.08,Math.cos((low+high)*Math.PI/360));
}
function silhouetteBounds(polygon:Polygon,project:(lon:number)=>number):OutlineBounds|null{
 let west=Infinity,east=-Infinity,south=Infinity,north=-Infinity;
 for(const ring of polygon)for(const point of ring){
  if(!goodPoint(point))continue;
  const x=project(point[0]),y=point[1];
  west=Math.min(west,x);east=Math.max(east,x);
  south=Math.min(south,y);north=Math.max(north,y);
 }
 return Number.isFinite(west)?{west,east,south,north}:null;
}
function unionBounds(boxes:readonly OutlineBounds[]):OutlineBounds{
 return {
  west:Math.min(...boxes.map(b=>b.west)),east:Math.max(...boxes.map(b=>b.east)),
  south:Math.min(...boxes.map(b=>b.south)),north:Math.max(...boxes.map(b=>b.north))
 };
}
function boundsZoom(b:OutlineBounds):number{
 return Math.min((WIDTH-2*PADDING)/Math.max(b.east-b.west,.00001),
  (HEIGHT-2*PADDING)/Math.max(b.north-b.south,.00001));
}
/** Crop ONLY highly dominant continental countries when distant dependencies
 * make their mainland unreadable. Never crop spread-out archipelagos merely
 * because they have many islands: Japan, Indonesia, Fiji, etc. stay intact.
 * A nearby island (Corsica, Sardinia, Northern Ireland) is kept, as are holes. */
export function selectReadableCountryPolygons(polygons:readonly Polygon[]):Polygon[]{
 if(polygons.length<2)return [...polygons];
 const areas=polygons.map(p=>ringArea(p[0]??[]));
 const total=areas.reduce((sum,area)=>sum+area,0);
 if(total<=0)return [...polygons];
 let main=0;
 for(let i=1;i<areas.length;i++)if(areas[i]>areas[main])main=i;
 if(areas[main]/total<.72)return [...polygons];
 const mainland=polygons[main][0]?.filter(goodPoint)??[];
 if(mainland.length<3)return [...polygons];
 const origin=outlineLongitudeOrigin(mainland.map(p=>p[0]));
 const rawLongitude=(lon:number)=>(mod360(lon)-origin+360)%360;
 const rawXs=mainland.map(p=>rawLongitude(p[0]));
 const anchor=(Math.min(...rawXs)+Math.max(...rawXs))/2;
 const latMin=Math.min(...mainland.map(p=>p[1])),latMax=Math.max(...mainland.map(p=>p[1]));
 const correction=Math.max(.16,Math.cos((latMin+latMax)*Math.PI/360));
 const projectedLongitude=(lon:number)=>{
  let x=rawLongitude(lon);
  if(x-anchor>180)x-=360;
  if(x-anchor< -180)x+=360;
  return x*correction;
 };
 const boxes=polygons.map(p=>silhouetteBounds(p,projectedLongitude));
 if(boxes.some(b=>b===null))return [...polygons];
 const bounds=boxes as OutlineBounds[];
 const primary=bounds[main],combined=unionBounds(bounds);
 // Do nothing when including outlying islands does not spoil legibility.
 if(boundsZoom(combined)>=boundsZoom(primary)*.62)return [...polygons];
 const diameter=Math.max(primary.east-primary.west,primary.north-primary.south);
 const margin=Math.max(1.6,Math.min(12,diameter*.7));
 const selected=polygons.filter((_,index)=>{
  if(index===main)return true;
  const b=bounds[index];
  const gapX=Math.max(0,primary.west-b.east,b.west-primary.east);
  const gapY=Math.max(0,primary.south-b.north,b.south-primary.north);
  return Math.hypot(gapX,gapY)<=margin;
 });
 if(selected.length===polygons.length)return [...polygons];
 // Don't remove legitimate territory without a meaningful gain in scale.
 const filteredBoxes=selected.map(p=>silhouetteBounds(p,projectedLongitude)!).filter(Boolean);
 if(boundsZoom(unionBounds(filteredBoxes))<boundsZoom(combined)*1.2)return [...polygons];
 return selected;
}

export function buildCountryOutline(features:readonly GeoFeature[]):GeoOutline|null{
 const sourcePolys=features.flatMap(polygonRings).filter(poly=>poly.length>0);
 const polys=selectReadableCountryPolygons(sourcePolys);
 if(!polys.length)return null;
 const longitudes:number[]=[],latitudes:number[]=[];
 for(const poly of polys)for(const ring of poly)for(const p of ring){
  if(Array.isArray(p)&&Number.isFinite(p[0])&&Number.isFinite(p[1])){
   longitudes.push(p[0]);latitudes.push(p[1]);
  }
 }
 if(longitudes.length<3)return null;
 const origin=outlineLongitudeOrigin(longitudes);
 let north=-Infinity,south=Infinity;
 for(const lat of latitudes){if(lat>north)north=lat;if(lat<south)south=lat}
 // Correct the exaggerated longitude scale of a cylindrical atlas at high latitudes.
 const latMid=Math.max(-80,Math.min(80,(north+south)/2));
 const latitudeCorrection=Math.max(.16,Math.cos(latMid*Math.PI/180));
 const longitude=(lon:number)=>((mod360(lon)-origin+360)%360)*latitudeCorrection;
 let west=Infinity,east=-Infinity;
 for(const lon of longitudes){const x=longitude(lon);west=Math.min(west,x);east=Math.max(east,x)}
 const dx=east-west,dy=north-south;
 if(dx<=0&&dy<=0)return null;
 const zoom=Math.min((WIDTH-2*PADDING)/Math.max(dx,.00001),
  (HEIGHT-2*PADDING)/Math.max(dy,.00001));
 const offsetX=(WIDTH-dx*zoom)/2,offsetY=(HEIGHT-dy*zoom)/2;
 const convert=(point:number[]):[number,number]=>[
  (longitude(point[0])-west)*zoom+offsetX,
  (north-point[1])*zoom+offsetY
 ];
 const paths:string[]=[];
 // Keep the island outlines and interior holes. Pixel-level simplification
 // makes even 1:10m borders responsive in a classroom with many cards.
 for(const polygon of polys){
  for(const ring of polygon){
   const valid=ring.filter(p=>Array.isArray(p)&&Number.isFinite(p[0])&&Number.isFinite(p[1]));
   if(valid.length<3)continue;
   const points=valid.map(convert);
   const kept:[number,number][]=[points[0]];
   for(let i=1;i<points.length;i++){
    const p=points[i],prev=kept[kept.length-1];
    if(Math.hypot(p[0]-prev[0],p[1]-prev[1])>=.36)kept.push(p);
   }
   if(kept.length<3)continue;
   // Extremely small polygons cannot create readable silhouettes at this scale.
   // Do not make up proxy shapes for them.
   let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
   for(const [x,y] of kept){minX=Math.min(minX,x);maxX=Math.max(maxX,x);
    minY=Math.min(minY,y);maxY=Math.max(maxY,y)}
   const boundsArea=(maxX-minX)*(maxY-minY);
   if(boundsArea<.16)continue;
   const format=(v:number)=>v.toFixed(2);
   const path="M"+kept.map(p=>format(p[0])+" "+format(p[1])).join("L")+"Z";
   paths.push(path);
  }
 }
 if(!paths.length)return null;
 return {path:paths.join(" "),viewBox:`0 0 ${WIDTH} ${HEIGHT}`};
}
