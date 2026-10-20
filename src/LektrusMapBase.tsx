import {useMemo} from "react";
import {mapFeaturePath,type GeoCollection} from "./lektrusAtlasData";

/** A single world substrate for every school map. Geographic coordinates use
 * the same WGS84/equirectangular projection, land data and coastline geometry.
 * Subject-specific political borders, historical borders and water overlays
 * are drawn on top and never change the substrate. */
type Props={
 land:GeoCollection|null;
 coastline:GeoCollection|null;
 grid:boolean;
};
export default function LektrusMapBase({land,coastline,grid}:Props){
 const landPaths=useMemo(()=>land?.features.map((f,i)=>({id:i,d:mapFeaturePath(f)})).filter(f=>f.d)||[],[land]);
 const shorePaths=useMemo(()=>coastline?.features.map((f,i)=>({id:i,d:mapFeaturePath(f)})).filter(f=>f.d)||[],[coastline]);
 return <>
  <rect width="900" height="450" fill="#dfedf9"/>
  <g className="lektrus-atlas-base-land" pointerEvents="none">
   {landPaths.map(path=><path key={path.id} d={path.d} fill="#e4ebdf"
    stroke="none" fillRule="evenodd"/>)}
  </g>
  <g className="lektrus-atlas-base-coast" stroke="#91a9ad" strokeWidth=".8"
   fill="none" pointerEvents="none" strokeLinejoin="round">
   {shorePaths.map(path=><path key={path.id} d={path.d}/>)}
  </g>
  {grid&&<g stroke="#a9becd" strokeWidth=".65" opacity=".75" pointerEvents="none">
   {Array.from({length:13},(_,i)=><line key={"x"+i} x1={i*75} y1="0" x2={i*75} y2="450"/>)}
   {Array.from({length:7},(_,i)=><line key={"y"+i} x1="0" y1={i*75} x2="900" y2={i*75}/>)}
  </g>}
 </>;
}
