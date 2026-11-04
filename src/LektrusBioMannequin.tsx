/** Offline illustrated human atlas. The seven medical-style body plates
 * are pixel images from the same school-age neutral front-view figure family,
 * not SVG stroke renderings. One raster sprite prevents seven image downloads.
 *
 * The organism overview keeps the approved translucent biomodel; selecting
 * any system renders exactly ONE of the seven framed raster illustrations.
 */
import {memo} from "react";
import type {CSSProperties} from "react";
import biomodel from "./assets/bio-atlas/human-biomodel.webp";
import systemsImage from "./assets/bio-atlas/human-seven-systems.webp";
import {HUMAN_BODY_SYSTEMS,humanSystemById,humanSystemVisibility,
 type HumanBodySystem} from "./lektrusBioHumanBodySystems";

function LektrusBioMannequin({system="all"}:{system?:HumanBodySystem}){
 const index=HUMAN_BODY_SYSTEMS.findIndex(entry=>entry.id===system);
 const showSystem=system!=="all"&&index>=0;
 const plateStyle:CSSProperties=showSystem?{
  backgroundImage:"url("+systemsImage+")",
  backgroundSize:"700% 100%",
  backgroundPosition:(index/6*100)+"% 50%"
 }:{}; // Do not request the sprite while only the organism overview is shown.
 return <div className={"lektrus-human-biomodel "+
  (showSystem?"is-raster-focused":"is-overview")}
  data-bio-active-system={system} aria-hidden="true">
  {showSystem
   ?<div className="lektrus-human-raster-plate"
     style={plateStyle}
     data-anatomy={system}
     data-image-kind="medical-raster"
     title={humanSystemById(system).name}/>
   :<img className="lektrus-human-biomodel-image lektrus-human-biomodel-image-base"
     src={biomodel} alt="" draggable={false}/>}
  <span className="lektrus-human-biomodel-state"
   data-bio-system-opacity={system==="all"?"1":String(humanSystemVisibility(system,system))}/>
 </div>;
}
export default memo(LektrusBioMannequin);
