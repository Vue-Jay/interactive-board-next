/** Small location-aware context map for the continuous biology microscope.
 * Only the immediate parent is shown. Its highlighted point is grounded in
 * the real graph's anatomical coordinates, never extrapolated across slides.
 */
import {memo,useState} from "react";
import type {BioOrganism} from "./lektrusBioMicroscopeModel";
import LektrusBioAnatomyScene from "./LektrusBioAnatomyScene";
import {bioZoomImageFor,bioZoomVisibleField,
 type BioZoomCamera,type BioZoomContext} from "./lektrusBioUnifiedZoomModel";

type Props={organism:BioOrganism;context:BioZoomContext;parentCamera:BioZoomCamera;onBack:()=>void};
function ParentOverview({organism,context,parentCamera,onBack}:Props){
 const {parent,child,spot}=context;
 const [broken,setBroken]=useState(false);
 const photo=bioZoomImageFor(organism,parent);
 const image=photo&&!broken?photo:null;
 const field=bioZoomVisibleField(parentCamera);
 return <div className="lektrus-bio-location" data-bio-parent-id={parent.id}
  data-bio-current-id={child.id}>
  <div className="lektrus-bio-location-title">
   <span>ГДЕ МЫ</span><span>{context.parentLevel} / 5</span>
  </div>
  <button type="button" className="lektrus-bio-location-return"
   aria-label={"Вернуться к "+parent.name}
   title={"Вернуться к "+parent.name}
   onPointerDown={e=>e.stopPropagation()}
   onClick={onBack}>
   <span className="lektrus-bio-location-preview" aria-hidden="true">
    {image?<img alt="" src={image.file} loading="lazy" draggable={false}
      onError={()=>setBroken(true)}/>:
     <LektrusBioAnatomyScene organism={organism} node={parent}
      children={[]} interactive={false} onSelect={()=>{}}/>}
    <svg className="lektrus-bio-location-overlay" viewBox="0 0 480 330"
     preserveAspectRatio="none">
     {parentCamera.scale>1.08&&<rect data-bio-context-field="true"
       x={field.x} y={field.y} width={field.width} height={field.height}
       rx="6" fill="#e3fff1" fillOpacity=".12" stroke="#e8fff4"
       strokeWidth="5" strokeDasharray="8 5"/>}
     <circle cx={spot.x} cy={spot.y} r="48"
      fill="#ffe4a4" fillOpacity=".21" stroke="#fff3c1" strokeWidth="6"
      strokeDasharray="9 6"/>
     <circle data-bio-context-spot="true" cx={spot.x} cy={spot.y} r="13"
      fill="#ffe2a1" stroke="#5d4227" strokeWidth="6"/>
     <circle cx={spot.x} cy={spot.y} r="4.5" fill="#ffffff"/>
    </svg>
   </span>
   <span className="lektrus-bio-location-caption">
    <small>Внутри: {parent.name}</small>
    <strong title={child.name}>{child.name}</strong>
    <span>Вернуться к области ↑</span>
   </span>
  </button>
 </div>;
}
export default memo(ParentOverview,(a,b)=>
 a.organism===b.organism&&a.context.parent.id===b.context.parent.id&&
 a.context.child.id===b.context.child.id&&
 a.context.spot.x===b.context.spot.x&&a.context.spot.y===b.context.spot.y&&
 a.parentCamera.x===b.parentCamera.x&&a.parentCamera.y===b.parentCamera.y&&
 a.parentCamera.scale===b.parentCamera.scale&&a.onBack===b.onBack
);
