/** The user's approved semi-transparent biomodel, NOT an articulated robot.
 * Same anatomically illustrated human asset in both the world and the mini-map.
 * Focusing systems is a real visual mask, so the body does not disappear,
 * the camera stays continuous, and unselected anatomy remains as context.
 */
import {memo,useId} from "react";
import type {CSSProperties} from "react";
import biomodel from "./assets/bio-atlas/human-biomodel.webp";
import {humanSystemVisibility,type HumanBodySystem} from "./lektrusBioHumanBodySystems";

const highlightMasks:Record<Exclude<HumanBodySystem,"all">,string>={
 nervous:"radial-gradient(ellipse 34% 18% at 50% 8%, #000 43%, transparent 97%)",
 respiratory:"radial-gradient(ellipse 37% 23% at 50% 27%, #000 51%, transparent 98%)",
 circulatory:"radial-gradient(ellipse 23% 19% at 51% 33%, #000 34%, transparent 98%)",
 digestive:"radial-gradient(ellipse 38% 25% at 50% 44%, #000 57%, transparent 99%)",
 musculoskeletal:"linear-gradient(#000,#000)"
};
function LektrusBioMannequin({system="all"}:{system?:HumanBodySystem}){
 const unique=useId().replace(/:/g,"");
 const boneId="lektrus-human-bone-"+unique;
 const focusMask=system==="all"?undefined:highlightMasks[system];
 const focusStyle:CSSProperties={
  maskImage:focusMask,WebkitMaskImage:focusMask
 };
 return <div className={"lektrus-human-biomodel "+(system==="all"?"is-overview":"is-focused")}
  data-bio-active-system={system} aria-hidden="true">
  <img className="lektrus-human-biomodel-image lektrus-human-biomodel-image-base"
   alt="" src={biomodel} draggable={false}/>
  {system!=="all"&&<img
   className="lektrus-human-biomodel-image lektrus-human-biomodel-image-focus"
   alt="" src={biomodel} style={focusStyle} draggable={false}/>}
  {system==="musculoskeletal"&&<svg className="lektrus-human-biomodel-bones"
   viewBox="0 0 360 840" preserveAspectRatio="none" focusable="false"
   xmlns="http://www.w3.org/2000/svg">
   <defs>
    <linearGradient id={boneId} x1="0" y1="0" x2="1" y2=".5">
     <stop stopColor="#fbfcfc" stopOpacity=".88"/>
     <stop offset=".46" stopColor="#efe5d6" stopOpacity=".94"/>
     <stop offset="1" stopColor="#bcc3d4" stopOpacity=".78"/>
    </linearGradient>
   </defs>
   <g fill="none" stroke={"url(#"+boneId+")"} strokeLinecap="round"
    strokeLinejoin="round" opacity=".8">
    {/* Vertebrae and sternum, not metallic joints or robot seams. */}
    <path d="M180 140V443" strokeWidth="6" strokeDasharray="12 3"/>
    <path d="M180 194V290" strokeWidth="9" opacity=".8"/>
    {Array.from({length:7},(_,i)=>{
     const y=199+i*19;
     return <g key={i} strokeWidth="3.7">
      <path d={"M180 "+y+"Q"+(161-i*.4)+" "+(y-12)+" "+(124+i)+" "+(y+2)}/>
      <path d={"M180 "+y+"Q"+(199+i*.4)+" "+(y-12)+" "+(236-i)+" "+(y+2)}/>
     </g>;
    })}
    <path d="M167 189Q126 174 108 184M193 189Q234 174 252 184" strokeWidth="5"/>
    <path d="M174 441L154 502L148 598L141 742" strokeWidth="11"/>
    <path d="M186 441L206 502L212 598L219 742" strokeWidth="11"/>
    <path d="M116 193L86 286L52 422M244 193L274 286L308 422" strokeWidth="8"/>
    <path d="M163 421Q180 436 197 421" strokeWidth="8"/>
   </g>
  </svg>}
  {/* Read the system states from one typed source, so a selected system
      cannot accidentally show a differently named organism's structures. */}
  <span className="lektrus-human-biomodel-state" data-bio-system-opacity={
   system==="all"?"0.72":String(humanSystemVisibility(system,system))}/>
 </div>;
}
export default memo(LektrusBioMannequin);
