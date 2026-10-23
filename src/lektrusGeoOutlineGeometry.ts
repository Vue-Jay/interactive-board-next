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
export function buildCountryOutline(features:readonly GeoFeature[]):GeoOutline|null{
 const polys=features.flatMap(polygonRings).filter(poly=>poly.length>0);
 if(!polys.length)return null;
 const longitudes:number[]=[],latitudes:number[]=[];
 for(const poly of polys)for(const ring of poly)for(const p of ring){
  if(Array.isArray(p)&&Number.isFinite(p[0])&&Number.isFinite(p[1])){
   longitudes.push(p[0]);latitudes.push(p[1]);
  }
 }
 if(longitudes.length<3)return null;
 const origin=outlineLongitudeOrigin(longitudes);
 const north=Math.max(...latitudes),south=Math.min(...latitudes);
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
  let firstRing=true;
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
   const xs=kept.map(p=>p[0]),ys=kept.map(p=>p[1]);
   const boundsArea=(Math.max(...xs)-Math.min(...xs))*(Math.max(...ys)-Math.min(...ys));
   if(boundsArea<.16)continue;
   const format=(v:number)=>v.toFixed(2);
   const path="M"+kept.map(p=>format(p[0])+" "+format(p[1])).join("L")+"Z";
   paths.push(path);
   firstRing=false;
  }
  void firstRing;
 }
 if(!paths.length)return null;
 return {path:paths.join(" "),viewBox:`0 0 ${WIDTH} ${HEIGHT}`};
}
