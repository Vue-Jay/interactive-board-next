/** Canonical, explicitly illustrative cross-section proportions.
 * NOT a scale measurement of skin thickness. Ordinary hairy skin has
 * a relatively thin epidermis above a substantially thicker dermis.
 * Hypodermis belongs beneath, not inside the skin proper.
 *
 * Sources: Leeds Histology Guide skin layers and OpenStax A&P 2e §5.1.
 */
export const SKIN_ILLUSTRATIVE_LAYERS={
 epidermisEnd:.065,
 dermisEnd:.67,
 granulosumStart:.014,
 spinosumStart:.023,
 basaleStart:.057
} as const;

/** Evidence status of a registered *representative* thin-skin sample.
 * Coordinates are anchors in the existing 360×600 body model.
 * Other silhouette points do not inherit a false regional diagnosis.
 */
export type SkinEvidenceRegion="thin-skin-reference"|"unverified-region";
export type SkinWorldPoint={x:number;y:number};
export const SKIN_REFERENCE_UPPER_ARM={
 cx:254,cy:182,rx:28,ry:34
} as const;
export function skinEvidenceRegionAt(point:SkinWorldPoint):SkinEvidenceRegion{
 if(!Number.isFinite(point.x)||!Number.isFinite(point.y))
  return "unverified-region";
 const r=SKIN_REFERENCE_UPPER_ARM;
 const dx=(point.x-r.cx)/r.rx,dy=(point.y-r.cy)/r.ry;
 return dx*dx+dy*dy<=1?"thin-skin-reference":"unverified-region";
}
export function skinIllustrativeLayerAt(fraction:number):
 "epidermis"|"dermis"|"hypodermis"|null{
 if(!Number.isFinite(fraction)||fraction<0||fraction>1)return null;
 if(fraction<SKIN_ILLUSTRATIVE_LAYERS.epidermisEnd)return "epidermis";
 if(fraction<SKIN_ILLUSTRATIVE_LAYERS.dermisEnd)return "dermis";
 return "hypodermis";
}
/** This width is expressed in body-world coordinates for display ONLY.
 * It cannot be interpreted as measured body skin thickness.
 */
export const SKIN_SECTION_SCALE_IS_PHYSICAL=false as const;
