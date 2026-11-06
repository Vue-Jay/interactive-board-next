/** Educational, deliberately VIRTUAL glabrous skin windows.
 * This is a FRONT-FACING featureless body plate: the camera cannot tell
 * whether the visible hand/foot edge is palmar, dorsal or plantar.
 * These two user-requested sites are world-anchored *representative*
 * cross sections, NOT diagnoses of the photographed surface.
 *
 * Morphology: OpenStax A&P 2e §5.1; Leeds Histology Guide Thick/Thin;
 * calibrated MH 091bhr human thumb and MHS 235 thick-skin micrographs.
 */
import type {SkinSectionContour,SkinSectionPoint} from "./lektrusSkinVectorSections";
import {SKIN_ILLUSTRATIVE_LAYERS} from "./lektrusSkinEvidenceModel";

export type ThickSkinKind="palm"|"sole";
export type ThickSkinSample={
 kind:ThickSkinKind;
 anchor:{x:number;y:number};
 contour:SkinSectionContour;
};
type LayerName="corneum"|"lucidum"|"granulosum"|"spinosum"|"basale";
export type ThickSkinBand={
 id:LayerName;start:number;end:number;color:string;
};
export const THICK_SKIN_EPIDERMIS_END=.18 as const;
export const THICK_SKIN_SITE_TARGETS={
 // Derived from the actual 360x600 neutral body preview at 100%.
 // These are body-region anchors, NOT evidence that the palms/soles
 // themselves are visible on the frontal illustration.
 palm:{x:312,y:342},
 sole:{x:241,y:581}
} as const;
export const THICK_SKIN_SPAN=10;
const clamp01=(x:number)=>Math.min(1,Math.max(0,x));
const lerp=(a:number,b:number,w:number)=>a+(b-a)*w;
const smooth=(x:number)=>{const t=clamp01(x);return t*t*(3-2*t);};
/** Read body contour at the exact same world Y as the skin viewport. */
function sectionAtY(c:SkinSectionContour,y:number):SkinSectionPoint|null{
 if(y<c.minY||y>c.maxY||c.points.length<2)return null;
 let lo=0,hi=c.points.length-1;
 while(hi-lo>1){const m=(lo+hi)>>1;
  if(c.points[m].y<y)lo=m;else hi=m;}
 const a=c.points[lo],b=c.points[hi];
 const t=clamp01((y-a.y)/Math.max(1e-7,b.y-a.y));
 return {x:lerp(a.x,b.x,t),y,depth:lerp(a.depth,b.depth,t)};
}
/** Associate only an actually existing outer contour with the hand/foot
 * landmark; no generalization to dorsal skin, all digits or all feet. */
export function resolveThickSkinSample(
 contours:readonly SkinSectionContour[],kind:ThickSkinKind
):ThickSkinSample|null{
 const target=THICK_SKIN_SITE_TARGETS[kind];
 let best:ThickSkinSample|null=null,score=Infinity;
 for(const c of contours){
  if(c.inward!==-1)continue;
  const p=sectionAtY(c,target.y);
  if(!p||p.depth<.15)continue;
  const distance=Math.abs(p.x-target.x);
  if(distance<score){best={kind,contour:c,anchor:{x:p.x,y:target.y}};
   score=distance;}
 }
 // Never teleport to a completely unrelated body region if a hand
 // or foot edge is missing from the supplied registered silhouette.
 return score<=21?best:null;
}
/** Quietly taper the educational window into ordinary thin-skin bands.
 * No square cutout or sudden six-centimetre "wall" in the whole body. */
export function thickSkinInfluence(
 c:SkinSectionContour,y:number,sample:ThickSkinSample|null
):number{
 if(!sample||c!==sample.contour)return 0;
 const d=Math.abs(y-sample.anchor.y);
 return 1-smooth((d-6)/4);
}
export function thickSkinBandsAt(
 c:SkinSectionContour,y:number,sample:ThickSkinSample|null
):readonly ThickSkinBand[]{
 const w=thickSkinInfluence(c,y,sample);
 const thin=SKIN_ILLUSTRATIVE_LAYERS;
 const corneumEnd=lerp(thin.granulosumStart,.075,w);
 const lucidumEnd=lerp(thin.granulosumStart,.088,w);
 const granulosumEnd=lerp(thin.spinosumStart,.105,w);
 const spinosumEnd=lerp(thin.basaleStart,.168,w);
 const epiEnd=lerp(thin.epidermisEnd,THICK_SKIN_EPIDERMIS_END,w);
 return [
  {id:"corneum",start:0,end:corneumEnd,color:"#eed0c5"},
  {id:"lucidum",start:corneumEnd,end:lucidumEnd,color:"#f8e5dc"},
  {id:"granulosum",start:lucidumEnd,end:granulosumEnd,color:"#a883a1"},
  {id:"spinosum",start:granulosumEnd,end:spinosumEnd,color:"#e9b8c7"},
  {id:"basale",start:spinosumEnd,end:epiEnd,color:"#98708e"}
 ] as const;
}
export function thickSkinBoundaryAt(
 y:number,f:number,epidermisEnd:number,weight:number
):number{
 if(f<=0)return f;
 const wave=(.00045+.0020*weight)*Math.sin(y*9.4+.4)+
  (.00022+.00055*weight)*Math.sin(y*15.1+1.7);
 return f+wave*(f/Math.max(.01,epidermisEnd))**4;
}
export function thickSkinLayerAt(
 c:SkinSectionContour,y:number,f:number,sample:ThickSkinSample|null
):LayerName|null{
 if(thickSkinInfluence(c,y,sample)<.15)return null;
 const l=thickSkinBandsAt(c,y,sample);
 const width=l[l.length-1].end;
 for(const item of l){
  if(item.end-item.start<.0007)continue;
  if(f>=thickSkinBoundaryAt(y,item.start,width,thickSkinInfluence(c,y,sample))&&
   f<thickSkinBoundaryAt(y,item.end,width,thickSkinInfluence(c,y,sample)))
   return item.id;
 }
 return null;
}
