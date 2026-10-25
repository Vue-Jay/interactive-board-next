import type {ReactNode} from "react";
import type {SubjectToolId} from "./lektrusSubjectToolRegistry";

/**
 * All available classroom workflows use purpose-specific, scalable SVG glyphs.
 * The icons are intentionally single-colour so they inherit the selected
 * palette, remain legible on 21px buttons and work with dark themes.
 */
const icons:Partial<Record<SubjectToolId,ReactNode>>={
 "math-formula":<><path d="m3 12 3.2 6 4.2-13H21"/><text x="13.2" y="18.6" fontFamily="Georgia,serif" fontSize="14" fontStyle="italic" stroke="none" fill="currentColor">x</text></>,
 "math-geometry":<><path d="M11.5 6.5 5.4 20M13.5 6.5 19.5 20M5.4 20l-1.1 1.2M19.5 20l1.1 1.2"/><path d="M9.7 9 8.2 12.5M15.3 9l1.5 3.5" strokeWidth="2.7"/><circle cx="12.5" cy="5.1" r="3.1" fill="var(--lektrus-tool-surface,#fff)"/><circle cx="12.5" cy="5.1" r=".65" fill="currentColor" stroke="none"/></>,
 "math-coordinate":<><path d="M3 12H21m-3-2.5L21 12l-3 2.5M12 21V3m-2.5 3L12 3l2.5 3"/><text x="19" y="19.5" fontSize="6.5" fontStyle="italic" stroke="none" fill="currentColor">x</text><text x="15.2" y="5.2" fontSize="6.5" fontStyle="italic" stroke="none" fill="currentColor">y</text></>,
 "math-fractions":<><text x="7" y="10" fontFamily="Georgia,serif" fontSize="10" stroke="none" fill="currentColor">1</text><path d="M5 12h14" strokeWidth="2.3"/><text x="12.5" y="21.5" fontFamily="Georgia,serif" fontSize="10" stroke="none" fill="currentColor">2</text></>,
 "chem-periodic-table":<><rect x="4.4" y="3.3" width="15.2" height="17.4" rx="1.7"/><path d="M7 6h4" strokeWidth="1.2"/><text x="12" y="16.5" fontSize="11" textAnchor="middle" fontWeight="700" stroke="none" fill="currentColor">C</text><text x="12" y="19" fontSize="3.8" textAnchor="middle" stroke="none" fill="currentColor">12.011</text></>,
 "chem-molecules":<><path d="m11 11-6 7m7-7 6 8M12 11l6-7" strokeWidth="2.3"/><circle cx="12" cy="10.5" r="3.6" fill="currentColor" fillOpacity=".36"/><circle cx="4.3" cy="19" r="2.65" fill="currentColor" fillOpacity=".13"/><circle cx="19.7" cy="19" r="2.65" fill="currentColor" fillOpacity=".13"/><circle cx="19" cy="4" r="2.35" fill="currentColor" fillOpacity=".13"/></>,
 "chem-organic":<><path d="m12 3.7 7.2 4.1v8.4L12 20.3l-7.2-4.1V7.8Z"/><path d="m12 6.6 4.5 2.6m0 5.4L12 17.4m-4.5-2.8V9.3" strokeWidth="1.25"/><path d="m19.2 7.8 2.5-1.5" strokeWidth="1.6"/></>,
 "chem-formulas":<><text x="2" y="9.2" fontSize="7.7" fontWeight="600" fill="currentColor" stroke="none">H₂+O₂</text><path d="M4 13h16m-3.1-2.6L20 13l-3.1 2.6" strokeWidth="1.65"/><text x="6.4" y="22" fontSize="8.4" fontWeight="600" fill="currentColor" stroke="none">H₂O</text></>,
 "chem-experiments":<><path d="M9 2.5h6M10 2.5v8L5.2 19a2 2 0 0 0 1.8 3h10a2 2 0 0 0 1.8-3L14 10.5v-8"/><path d="M6.7 17.5h10.6L19 20c.4.9-.2 2-2 2H7c-1.8 0-2.4-1.1-2-2Z" fill="currentColor" fillOpacity=".24" stroke="none"/><circle cx="10.5" cy="16" r="1" fill="currentColor" stroke="none"/><circle cx="14" cy="13.5" r=".85" fill="currentColor" stroke="none"/></>,
 "physics-mechanics":<><path d="M2.5 20h19"/><rect x="5" y="11" width="9" height="7" rx="1.1" fill="currentColor" fillOpacity=".13"/><path d="M15 13h7m-3-3 3 3-3 3" strokeWidth="2"/><path d="M5 18v2m9-2v2" opacity=".5"/></>,
 "physics-optics":<><path d="M11 3c-2.8 4.6-2.8 13.4 0 18 3-4.6 3-13.4 0-18Z" fill="currentColor" fillOpacity=".1"/><path d="M2 7h7m-7 5h7m-7 5h7" strokeWidth="1.8"/><path d="m14 7 7 5-7 5m7-5h1" strokeWidth="1.55"/></>,
 "physics-graphs":<><path d="M4 3v17h17"/><path d="M7 17 18 6" strokeWidth="2.2"/><path d="m18 6-3 0m3 0v3" strokeWidth="1.35"/><text x="2.6" y="4.8" fontSize="6" stroke="none" fill="currentColor">s</text><text x="18.8" y="23" fontSize="6" stroke="none" fill="currentColor">t</text></>,
 "physics-circuits":<><path d="M3 8V4h18v16H3V14M5 8v6m3-8v10" strokeWidth="1.9"/><circle cx="16" cy="12" r="3.6" fill="var(--lektrus-tool-surface,#fff)"/><path d="m13.5 9.5 5 5m0-5-5 5" strokeWidth="1.7"/></>,
 "bio-dna":<><path d="M6 3c0 7 12 11 12 18M18 3C18 10 6 14 6 21"/><path d="M8 6h8M9.3 9.7h5.4M9.3 14.1h5.4M8 18h8" strokeWidth="1.5"/><circle cx="6.2" cy="3.5" r="1.1" fill="currentColor"/><circle cx="17.8" cy="20.5" r="1.1" fill="currentColor"/></>,
 "bio-taxonomy":<><rect x="9" y="2.5" width="6" height="5" rx="1" fill="currentColor" fillOpacity=".15"/><path d="M12 7.5V12H5v4m7-4v4m0-4h7v4"/><rect x="2.5" y="16" width="5" height="5" rx=".8"/><rect x="9.5" y="16" width="5" height="5" rx=".8"/><rect x="16.5" y="16" width="5" height="5" rx=".8"/></>,
 "bio-division":<><path d="M12 4c-5.2-2-8.5 1.8-8.5 8s3.3 10 8.5 8c5.2 2 8.5-1.8 8.5-8S17.2 2 12 4Z"/><path d="M12 4c-2.2 2.3-2.2 13.7 0 16" strokeDasharray="2 2" opacity=".55"/><circle cx="8.5" cy="12" r="2.2"/><circle cx="15.5" cy="12" r="2.2"/><path d="m6 8 1.3 1.5m9.4 5 1.3 1.5" strokeWidth="1.3"/></>,
 "bio-genetics":<><path d="M4.5 4c2 0 2.5 3 3.5 6 1.2 3 2 7 3 10m0-16c-2.2 0-2.8 3-3.8 6.4C6.1 13 5.5 17 4.5 20" strokeWidth="3.2"/><path d="M15.5 4c2 0 2.5 3 3.5 6 1.2 3 2 7 3 10m0-16c-2.2 0-2.8 3-3.8 6.4-1.1 2.6-1.7 6.6-2.7 9.6" strokeWidth="3.2"/><path d="M11.5 11h1.2m-.6-.6v1.2" strokeWidth="1.5"/></>,
 "bio-cell":<><path d="M6 3 18 3 22 12 18 21H6L2 12Z"/><path d="M7 5 17 5 20 12 17 19H7L4 12Z" strokeWidth="1.1" opacity=".55"/><circle cx="12" cy="12" r="4" fill="currentColor" fillOpacity=".14"/><circle cx="13" cy="11" r="1.5" fill="currentColor" stroke="none"/><ellipse cx="7" cy="9" rx="1.2" ry="2" transform="rotate(-30 7 9)"/><ellipse cx="17" cy="16" rx="1.2" ry="2" transform="rotate(30 17 16)"/></>,
 "bio-food-chain":<><path d="M3.5 18V8m0 6C2 12 2 10 1.5 9m2 5 3-5m-3 9h4" strokeWidth="1.75"/><path d="M9.5 13h4m-2.2-2.2L13.5 13l-2.2 2.2"/><path d="M16 11.5V8.5m2 3V8m-2 0c-.2-4 2-4.2 2.2 0M15 14c2-2 6-1 6 2v2h-6z" fill="currentColor" fillOpacity=".15"/><circle cx="19.3" cy="14.7" r=".55" fill="currentColor" stroke="none"/></>,
 "bio-organ-systems":<><path d="M9 3 7 6 4 8v12h5M15 3l2 3 3 2v12h-5M9 3h6M12 4v5" strokeWidth="1.8"/><path d="M12 9c-3 0-3 4-1.2 5 2.3 1.4 4.8-.1 4.2-2.4" strokeWidth="2.1"/><path d="M9 15h6v4H9v-4Zm2 1v2m2-2v2" fill="currentColor" fillOpacity=".16" strokeWidth="1.35"/></>,
 "info-encoding":<><text x="4" y="10.5" fontSize="10" fontWeight="600" stroke="none" fill="currentColor">A</text><path d="M12 8h9m-3-2.4L21 8l-3 2.4M12 16h9m-6-2.4L12 16l3 2.4"/><text x="3" y="20.5" fontSize="7.6" stroke="none" fill="currentColor" fontFamily="monospace">0101</text></>,
 "info-programming":<><rect x="2.5" y="3.5" width="19" height="17" rx="2"/><path d="M2.5 8h19" strokeWidth="1.3"/><circle cx="5" cy="6" r=".75" fill="currentColor" stroke="none"/><circle cx="7.7" cy="6" r=".75" fill="currentColor" stroke="none"/><path d="m6.5 12 3.3 2.5-3.3 2.5M12 17h5" strokeWidth="2"/></>,
 "info-circuit":<><path d="M2 7h4m-4 9h4M6 4h4a8 8 0 0 1 0 16H6Z" fill="currentColor" fillOpacity=".10"/><path d="M18 12h4"/><circle cx="18.5" cy="12" r="1.3" fill="var(--lektrus-tool-surface,#fff)"/></>,
 "info-logic":<><rect x="3" y="3" width="18" height="18" rx="1.7"/><path d="M3 9h18M10 3v18M3 15h18" strokeWidth="1.5"/><text x="6.5" y="7.6" fontSize="4.1" fontWeight="700" textAnchor="middle" stroke="none" fill="currentColor">A</text><text x="15" y="7.6" fontSize="4.1" fontWeight="700" textAnchor="middle" stroke="none" fill="currentColor">A∧B</text><text x="6.5" y="13.8" fontSize="4.3" textAnchor="middle" stroke="none" fill="currentColor">0</text><text x="15" y="13.8" fontSize="4.3" textAnchor="middle" stroke="none" fill="currentColor">0</text><text x="6.5" y="19.5" fontSize="4.3" textAnchor="middle" stroke="none" fill="currentColor">1</text><text x="15" y="19.5" fontSize="4.3" textAnchor="middle" stroke="none" fill="currentColor">1</text></>,
 "info-flowchart":<><rect x="8" y="2.5" width="8" height="4.5" rx="2.25" fill="currentColor" fillOpacity=".14"/><path d="M12 7v3m-2-2 2 2 2-2"/><path d="m12 10 6.8 5-6.8 5-6.8-5Z"/><path d="M5.2 15H2M18.8 15H22" opacity=".7"/></>,
 "info-place-value":<><text x="2.7" y="9.8" fontFamily="monospace" fontSize="9.1" fontWeight="600" stroke="none" fill="currentColor">1010</text><path d="M3 12h18m-2.5-2.5L21 12l-2.5 2.5"/><text x="6.3" y="20.5" fontFamily="monospace" fontSize="7" fontWeight="600" stroke="none" fill="currentColor">10</text><text x="17" y="20.5" fontFamily="monospace" fontSize="7" fontWeight="600" stroke="none" fill="currentColor">2</text></>,
 "maps-atlas":<><circle cx="12" cy="11.5" r="8.5"/><path d="M9 3.5 6 7l1 3 3 1 1.5 4L14 12l2-1 1-3 2.5-.5M4 14l4 1 1 4" fill="currentColor" fillOpacity=".30" strokeWidth="1.55"/><path d="M8 22h8M12 20v2" strokeWidth="1.4"/></>,
 "contour-atlas":<><path d="M3 3h18v18H3Z"/><path d="M7 7 11 4.5l4.5 3L19 13l-4 5-5-1.5-3.5-4.5Z" strokeDasharray="2.4 1.7" strokeWidth="1.7"/></>,
 "geo-matching":<><rect x="2.5" y="4" width="7.5" height="7" rx="1.3"/><rect x="14" y="13" width="7.5" height="7" rx="1.3"/><path d="M10 7.5h7v5.5m-3-2.7 3 2.7 3-2.7M14 16.5H7v-5.5m-3 2.7 3-2.7 3 2.7" strokeWidth="1.6"/><path d="M5 8h2m9 9h3" strokeWidth="1.2"/></>,
 "geo-question-cards":<><rect x="5.5" y="3.5" width="14" height="17" rx="2.2"/><path d="M5.5 7H4.5A2 2 0 0 0 2.5 9v11A1.5 1.5 0 0 0 4 21.5H16"/><path d="M10 9a2.5 2.5 0 0 1 5 0c0 1.5-2.5 1.9-2.5 3.8"/><circle cx="12.5" cy="16.5" r=".9" fill="currentColor" stroke="none"/></>,
 "geo-climate":<><path d="M7 4v10.5a3.2 3.2 0 1 0 3 0V4a1.5 1.5 0 0 0-3 0Z"/><path d="M8.5 10v7" strokeWidth="1.5"/><path d="M14 8a4 4 0 0 1 7 2c0 2-2 3-3.5 3H14m1 3-1 2m5-2-1 2" strokeWidth="1.65"/></>,
 "history-atlas":<><path d="M3 4.5 9 3l6 2 6-2v16l-6 2-6-2-6 2Z"/><path d="M9 3v16M15 5v16" strokeWidth="1.3"/><path d="M15.6 9.5a3.3 3.3 0 1 0 5 4.3M18.3 10v3l1.7 1" strokeWidth="1.5"/><path d="m4 9 3-2 2 2m-5 6 3-2 2 2" strokeWidth="1.3" opacity=".7"/></>,
 "history-timeline":<><path d="M2 17h20m-3-2.5 3 2.5-3 2.5"/><circle cx="5" cy="17" r="2" fill="var(--lektrus-tool-surface,#fff)"/><circle cx="12" cy="17" r="2" fill="var(--lektrus-tool-surface,#fff)"/><path d="M12 15V4l4 2.3L12 9"/><circle cx="19" cy="17" r="2" fill="var(--lektrus-tool-surface,#fff)"/></>,
 "history-family-tree":<><path d="M12 18V9m0 5-5-4m5 0 5-4M9 19H6m9 0h3"/><circle cx="12" cy="6" r="2.7" fill="currentColor" fillOpacity=".16"/><circle cx="6" cy="9" r="2.4" fill="currentColor" fillOpacity=".16"/><circle cx="18" cy="9" r="2.4" fill="currentColor" fillOpacity=".16"/><path d="M5 22h14" strokeWidth="2"/></>,
 "ru-syntax":<><path d="M3 6h18M3 11h7m4 0h7M3 16h8m4 0h7" strokeWidth="1.8"/><path d="M3 20h8m-8 2h8M14 21l2-2 2 2 2-2" strokeWidth="1.4"/></>,
 "ru-morphemes":<><path d="M2.5 12h19" strokeWidth="2.1"/><path d="m3.5 9 4.1-4.3L11.7 9M12 9q4-7 9 0"/><path d="M9 15h6m-4 0v4m-2 0h6"/><path d="M17 15h4v5h-4Z" fill="currentColor" fillOpacity=".12"/></>,
 "ru-morphology":<><rect x="3.5" y="3.5" width="17" height="17" rx="1.8"/><path d="M3.5 9h17M10 9v11M3.5 15h17" strokeWidth="1.55"/><path d="M7 6.5h10M13 12h5M13 18h5" strokeWidth="1.25"/></>,
 "ru-phonetics":<><path d="M11.5 3C7.4 3 5 6 5 9c0 1.5 1.4 3 3 3.8l-1.6 2.1 1.4 1.8-1 3.4" strokeWidth="1.85"/><path d="M14 9c1.8 1.4 1.8 4.6 0 6M17 6.6c3.6 3.5 3.6 8.3 0 11.8" strokeWidth="1.75"/></>,
 "ru-orthography":<><rect x="3.5" y="3" width="17" height="18" rx="2"/><path d="M7 8h10M7 12h7" strokeWidth="1.45"/><path d="m8 16 3 2.5 5.7-6" strokeWidth="2.1"/></>,
 "ru-sentence-builder":<><rect x="2.5" y="4" width="6" height="7" rx="1.2"/><rect x="9.5" y="4" width="6" height="7" rx="1.2"/><rect x="16.5" y="4" width="5" height="7" rx="1.2"/><path d="M4.5 7.5h2M11 7.5h3m4 0h2"/><path d="M4 17h16m-3-2.5 3 2.5-3 2.5"/></>,
 "language-sentence-builder":<><rect x="3" y="4" width="5" height="7" rx="1"/><rect x="9.5" y="4" width="5" height="7" rx="1"/><rect x="16" y="4" width="5" height="7" rx="1"/><text x="5.5" y="9" fontSize="4.6" textAnchor="middle" fontWeight="600" stroke="none" fill="currentColor">I</text><text x="12" y="9" fontSize="4.6" textAnchor="middle" fontWeight="600" stroke="none" fill="currentColor">am</text><text x="18.5" y="9" fontSize="4.6" textAnchor="middle" fontWeight="600" stroke="none" fill="currentColor">...</text><path d="M5 16h14m-3-3 3 3-3 3"/></>,
 "language-flashcards":<><rect x="7" y="4" width="14" height="16" rx="2" transform="rotate(10 14 12)" fill="var(--lektrus-tool-surface,#fff)"/><rect x="3" y="4" width="14" height="16" rx="2" transform="rotate(-8 10 12)" fill="var(--lektrus-tool-surface,#fff)"/><text x="10" y="15.6" fontFamily="Georgia,serif" fontSize="12" textAnchor="middle" fontWeight="700" stroke="none" fill="currentColor">A</text></>,
 "literature-analysis":<><path d="M3 4.5c3-1 6-1 9 1 3-2 6-2 9-1V18c-3-1-6-1-9 1-3-2-6-2-9-1Z"/><path d="M12 5.5v13.5" strokeWidth="1.3"/><circle cx="17.5" cy="16.5" r="3.5" fill="var(--lektrus-tool-surface,#fff)"/><path d="m20.1 19.1 2.1 2.1"/></>,
 "civics-structure":<><path d="M12 3l9 5H3Z" fill="currentColor" fillOpacity=".12"/><path d="M5 10v8m5-8v8m4-8v8m5-8v8M3 19h18M2 21h20"/><path d="M12 11.5v5" strokeWidth="1.3"/></>,
};

/** Illustrated artwork atlas. Ordering is identical to the 7-column PNG grid.
 * Unlike the simplified path glyphs, these silhouettes are lifted from the
 * actual image option sheets reviewed for the subject-tool catalogue.
 * Original SVG glyphs stay below as a resilient offline fallback.
 */
const illustrationIds:SubjectToolId[]=[
 "math-formula","math-geometry","math-coordinate","math-fractions",
 "physics-mechanics","physics-optics","physics-graphs","physics-circuits",
 "chem-periodic-table","chem-molecules","chem-organic","chem-formulas","chem-experiments",
 "bio-dna","bio-taxonomy","bio-division","bio-genetics","bio-cell","bio-food-chain",
 "bio-organ-systems","info-encoding","info-programming","info-circuit","info-logic",
 "info-flowchart","info-place-value","maps-atlas","contour-atlas","geo-matching",
 "geo-question-cards","history-atlas","history-timeline","history-family-tree",
 "ru-syntax","ru-morphemes","ru-morphology","ru-phonetics","ru-orthography",
 "ru-sentence-builder","language-sentence-builder","language-flashcards",
 "literature-analysis","civics-structure"
];
const illustrationIndexes=new Map<string,number>(illustrationIds.map((id,i)=>[id,i]));
const illustrationHref=`${import.meta.env.BASE_URL}lektrus-subject-illustrations.png`;
const illustratedTileSize=40;
const illustratedAtlasSize=illustratedTileSize*7;

export const subjectToolIconIds=Object.keys(icons);

export function hasDedicatedSubjectToolIcon(id:string):boolean{
 return Object.prototype.hasOwnProperty.call(icons,id);
}

export default function LektrusSubjectToolIcon({id,size=23,className}:{id:string;size?:number;className?:string}){
 const illustrationIndex=illustrationIndexes.get(id);
 if(illustrationIndex!==undefined){
  // A self-clipping SVG viewport keeps every original square illustration
  // centred in its tile without showing neighbouring atlas entries.
  const col=illustrationIndex%7,row=Math.floor(illustrationIndex/7);
  return <svg className={className} width={size} height={size}
   viewBox={`0 0 ${illustratedTileSize} ${illustratedTileSize}`}
   style={{overflow:"hidden"}} aria-hidden="true" data-lektrus-subject-illustration={id}>
   <image href={illustrationHref} width={illustratedAtlasSize} height={illustratedAtlasSize}
    x={-col*illustratedTileSize} y={-row*illustratedTileSize}
    preserveAspectRatio="xMinYMin meet" pointerEvents="none"/>
  </svg>;
 }
 const glyph=icons[id as SubjectToolId];
 if(!glyph){
  // A distinct, consistent fallback for newly registered tools. The regression
  // test ensures every currently listed tool has a real, purpose-specific icon.
  return <svg width={size} height={size} viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M12 8v8M8 12h8"/></svg>;
 }
 return <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{glyph}</svg>;
}
