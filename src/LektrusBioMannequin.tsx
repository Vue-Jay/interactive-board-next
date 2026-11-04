/** School atlas biomodel.
 * Overview: approved translucent human illustration with all systems.
 * Selected system: ONLY the neutral transparent body shell plus one
 * anatomically positioned SVG overlay. The flattened source illustration
 * must never leak hidden organs through a dimmed or masked duplicate.
 */
import {memo} from "react";
import type {CSSProperties} from "react";
import biomodel from "./assets/bio-atlas/human-biomodel.webp";
import LektrusBioHumanSystemOverlay from "./LektrusBioHumanSystemOverlay";
import {humanSystemVisibility,type HumanBodySystem} from "./lektrusBioHumanBodySystems";

function LektrusBioMannequin({system="all"}:{system?:HumanBodySystem}){
 // The approved bitmap contains several systems flattened into the SAME
 // image. Reusing it under a regional mask displays parts of other systems.
 // A CSS ALPHA mask keeps only its external silhouette, not its pixels.
 const shellStyle:CSSProperties={
  maskImage:"url("+biomodel+")",WebkitMaskImage:"url("+biomodel+")",
  maskSize:"100% 100%",WebkitMaskSize:"100% 100%",
  maskRepeat:"no-repeat",WebkitMaskRepeat:"no-repeat",
  maskMode:"alpha"
 };
 return <div className={"lektrus-human-biomodel "+(system==="all"?"is-overview":"is-focused")+
  (system==="integumentary"?" is-skin-system":"")}
  data-bio-active-system={system} aria-hidden="true">
  {system==="all"
   ?<img className="lektrus-human-biomodel-image lektrus-human-biomodel-image-base"
     src={biomodel} alt="" draggable={false}/>
   :<>
     <div className="lektrus-human-biomodel-shell" style={shellStyle}/>
     {/* Clip selected organs to the SAME transparent external body outline.
         This remains a spatial mask only: the flattened all-systems pixels
         never appear beneath a selected system. */}
     <div className="lektrus-human-biomodel-anatomy-mask" style={shellStyle}>
      <LektrusBioHumanSystemOverlay system={system}/>
     </div>
    </>}
  <span className="lektrus-human-biomodel-state"
   data-bio-system-opacity={system==="all"?"1":String(humanSystemVisibility(system,system))}/>
 </div>;
}
export default memo(LektrusBioMannequin);
