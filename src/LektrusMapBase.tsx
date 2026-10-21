import {memo,useMemo,type ReactNode} from "react";
import {mapFeaturePath,projectGeography,type MapWindow,type GeoCollection} from "./lektrusAtlasData";
type Props={land:GeoCollection|null;coastline:GeoCollection|null;scale?:number;viewport?:MapWindow;terrain?:ReactNode;theme?:"default"|"minerals"};
const clamp=(x:number,a:number,b:number)=>Math.max(a,Math.min(b,x));
export function atlasGraticuleStep(scale:number){
 const target=30/Math.max(1,scale),power=Math.pow(10,Math.floor(Math.log10(target)));
 return ([1,2,5,10].find(v=>v*power>=target-1e-12)??10)*power;
}
const label=(v:number,lat:boolean)=>Math.abs(v).toLocaleString("ru-RU",{maximumFractionDigits:4})+
 "°"+(Math.abs(v)<1e-9?"":lat?(v>0?" с. ш.":" ю. ш."):(v>0?" в. д.":" з. д."));
// The physical terrain image moves with the camera; land and coast geometry do
// not. Memoize these vector layers independently to avoid hundreds of SVG diffs
// on every pan animation frame.
const LandGeometry=memo(function LandGeometry({land,minDist,viewport,theme}:{
 land:GeoCollection|null;minDist:number;viewport?:MapWindow;theme:"default"|"minerals"
}){
 const paths=useMemo(()=>land?.features.map((f,id)=>({id,d:mapFeaturePath(f,minDist,viewport)}))
  .filter(f=>f.d)??[],[land,minDist,viewport]);
 return <g className="lektrus-atlas-base-land" pointerEvents="none">
  {paths.map(f=><path key={f.id} d={f.d} fill={theme==="minerals"?"#f4ecd6":"#e4ebdf"}
   fillRule="evenodd" stroke="none"/>)}
 </g>;
});
const CoastGeometry=memo(function CoastGeometry({coastline,minDist,viewport,theme}:{
 coastline:GeoCollection|null;minDist:number;viewport?:MapWindow;theme:"default"|"minerals"
}){
 const paths=useMemo(()=>coastline?.features.map((f,id)=>({id,d:mapFeaturePath(f,minDist,viewport)}))
  .filter(f=>f.d)??[],[coastline,minDist,viewport]);
 return <g className="lektrus-atlas-base-coast" pointerEvents="none"
  stroke={theme==="minerals"?"#a2aaa0":"#9bb6bc"} strokeWidth=".48"
  vectorEffect="non-scaling-stroke" fill="none" strokeLinejoin="round">
  {paths.map(f=><path key={f.id} d={f.d} vectorEffect="non-scaling-stroke"/>)}
 </g>;
});
/** Grid is an independent, topmost overlay. Pointer events pass through it. */
export function LektrusAtlasGraticule({scale=1,viewport}:{scale?:number;viewport?:MapWindow}){
 const step=atlasGraticuleStep(scale);
 const lonW=clamp((viewport?.left??0)/2.5-180,-180,180),lonE=clamp((viewport?.right??900)/2.5-180,-180,180);
 const latS=clamp(90-(viewport?.bottom??450)/2.5,-90,90),latN=clamp(90-(viewport?.top??0)/2.5,-90,90);
 const meridians:number[]=[],parallels:number[]=[];
 for(let v=Math.ceil(lonW/step)*step;v<=lonE+1e-8&&meridians.length<80;v+=step)meridians.push(Number(v.toFixed(6)));
 for(let v=Math.ceil(latS/step)*step;v<=latN+1e-8&&parallels.length<80;v+=step)parallels.push(Number(v.toFixed(6)));
 const top=clamp((viewport?.top??0)+10/scale,5/scale,450-5/scale);
 const left=clamp((viewport?.left??0)+5/scale,4/scale,900-4/scale);
 return <g className="lektrus-atlas-graticule" pointerEvents="none" aria-hidden="true">
  <g stroke="#6292ba" strokeWidth=".72" vectorEffect="non-scaling-stroke" opacity=".88">
   {meridians.map(v=><line key={"lon"+v} x1={projectGeography(v,0)[0]} y1="0"
    x2={projectGeography(v,0)[0]} y2="450" vectorEffect="non-scaling-stroke"/>)}
   {parallels.map(v=><line key={"lat"+v} x1="0" y1={projectGeography(0,v)[1]}
    x2="900" y2={projectGeography(0,v)[1]} vectorEffect="non-scaling-stroke"/>)}
  </g>
  <g fill="#245e91" fontSize={8/scale} stroke="#fff" strokeWidth={1.8/scale}
   paintOrder="stroke" fontWeight="700">
   {meridians.map(v=><text key={"lon-label"+v} x={projectGeography(v,0)[0]+2/scale}
    y={top}>{label(v,false)}</text>)}
   {parallels.map(v=><text key={"lat-label"+v} x={left}
    y={projectGeography(0,v)[1]-2/scale}>{label(v,true)}</text>)}
  </g>
 </g>;
}
export default function LektrusMapBase({land,coastline,scale=1,viewport,terrain,theme="default"}:Props){
 const minDist=scale>=16?.004:scale>=5?.03:scale>=2?.16:.62;
 return <>
  <rect width="900" height="450" fill={theme==="minerals"?"#e6eef0":"#dfedf9"}/>
  <LandGeometry land={land} minDist={minDist} viewport={viewport} theme={theme}/>
  {terrain}
  <CoastGeometry coastline={coastline} minDist={minDist} viewport={viewport} theme={theme}/>

 </>;
}
