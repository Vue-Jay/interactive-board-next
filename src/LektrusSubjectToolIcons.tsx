import type {ReactNode} from "react";
import type {SubjectToolId} from "./lektrusSubjectToolRegistry";

/**
 * All available classroom workflows use purpose-specific, scalable SVG glyphs.
 * The icons are intentionally single-colour so they inherit the selected
 * palette, remain legible on 21px buttons and work with dark themes.
 */
const icons:Partial<Record<SubjectToolId,ReactNode>>={
 "math-formula":<><path d="M10 5H4l4.5 7L4 19h6"/><path d="M14 9h7m-3.5-3.5v7M14 18h7" strokeWidth="1.85"/></>,
 "math-geometry":<><path d="M5 20 11 4M19 20 13 4M8 13h8"/><circle cx="12" cy="5" r="2"/><path d="M3 20h5m8 0h5" strokeWidth="1.6"/></>,
 "math-coordinate":<><path d="M4 3v17h17M4 8h17M9 3v17" opacity=".5"/><path d="m7 16 5-6 3 3 5-7"/><circle cx="12" cy="10" r="1.35" fill="currentColor" stroke="none"/></>,
 "math-fractions":<><rect x="3.5" y="3" width="17" height="18" rx="3"/><path d="M6.5 17.5 17.5 6.5"/><circle cx="8.5" cy="8" r="1.4"/><circle cx="15.5" cy="16" r="1.4"/></>,
 "chem-periodic-table":<><rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/><path d="M5.5 8h3M15.5 8h3M5.5 18h3M15.5 18h3" strokeWidth="1.3"/></>,
 "chem-molecules":<><path d="m8 8 7-1m-6 4 5 6m3-8 2 8"/><circle cx="6" cy="9" r="3"/><circle cx="17" cy="6" r="3"/><circle cx="16" cy="19" r="3"/><circle cx="21" cy="19" r="1.3" fill="currentColor" stroke="none"/></>,
 "chem-organic":<><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9Z"/><path d="m8 7.8 4-2.2m5.8 3.2v5.6M12 18.5l-4-2.2" strokeWidth="1.4"/></>,
 "chem-formulas":<><path d="M4 6h7M4 12h7M4 18h7M14 12h7m-3.5-3.5V15.5"/><circle cx="14.5" cy="6" r="2"/><path d="m15 19 2-2 2 2" strokeWidth="1.6"/></>,
 "chem-experiments":<><path d="M9 3h6m-5 0v7l-6 9a2 2 0 0 0 2 3h12a2 2 0 0 0 2-3l-6-9V3"/><path d="M6.5 17.5c2.5-2 7.5 2 11 0" strokeWidth="1.7"/><circle cx="10.5" cy="18" r="1" fill="currentColor" stroke="none"/><circle cx="15" cy="14" r=".9" fill="currentColor" stroke="none"/></>,
 "physics-mechanics":<><rect x="4" y="11" width="9" height="7" rx="1.3"/><path d="M2.5 19h19M8.5 11V4m-3 3 3-3 3 3M14 14h8m-3-3 3 3-3 3" strokeWidth="1.8"/></>,
 "physics-optics":<><path d="M14 3 7.5 21h14Z"/><path d="M2 12h8.5l6 3L22 10" strokeWidth="1.85"/><path d="m7.5 9 3 3-3 3m12-5 2.5 0-1 2.5" strokeWidth="1.5"/></>,
 "physics-graphs":<><path d="M3.5 3.5v17h17"/><path d="M6.5 16 10 10l4 3.5 5-7.5" strokeWidth="1.85"/><circle cx="10" cy="10" r="1.35" fill="currentColor" stroke="none"/><circle cx="14" cy="13.5" r="1.35" fill="currentColor" stroke="none"/></>,
 "physics-circuits":<><path d="M3 9V4h18v16H3v-5M6 8v7m3-9v11" strokeWidth="1.8"/><circle cx="16" cy="12" r="3.2"/><path d="m14 10 4 4m0-4-4 4" strokeWidth="1.4"/></>,
 "bio-dna":<><path d="M6 3c0 8 12 10 12 18M18 3C18 11 6 13 6 21"/><path d="M7.7 6h8.6M7.2 10h9.6M7.2 14h9.6M7.7 18h8.6" strokeWidth="1.5"/></>,
 "bio-taxonomy":<><rect x="8" y="2.5" width="8" height="5" rx="1.2"/><rect x="2" y="16" width="7" height="5" rx="1.2"/><rect x="15" y="16" width="7" height="5" rx="1.2"/><path d="M12 7.5v4H5.5V16m6.5-4.5h6.5V16"/></>,
 "bio-division":<><path d="M12 4c-5-4-9 0-9 8s4 12 9 8c5 4 9 0 9-8S17 0 12 4Z"/><path d="M12 4v16M6 9l3 6m0-6-3 6m9-6 3 6m0-6-3 6" strokeWidth="1.6"/></>,
 "bio-genetics":<><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M12 4v16M3 12h18M7 7l2 2m0-2-2 2m8 6 2 2m0-2-2 2" strokeWidth="1.6"/></>,
 "bio-cell":<><path d="M12 3c5.5 0 9 4 9 9s-3.5 9-9 9-9-4-9-9 3.5-9 9-9Z"/><circle cx="12" cy="12" r="3.2"/><path d="M6 9c.9-1.8 1.7-2.3 3-2.5M16 16c1.6-.5 2.2-1.3 2.4-3" strokeWidth="1.4"/></>,
 "bio-food-chain":<><path d="M5 19c0-3 1-4 4-5-2-4 1-7 5-8 1 3 1 6-2 8v7"/><path d="M15 16h7m-3-3 3 3-3 3"/><circle cx="19" cy="7" r="2.6"/></>,
 "bio-organ-systems":<><path d="M12 3v9m-2 0C6 6 3 8 3 14v4c0 4 6 4 8 0v-6m3 0c4-6 7-4 7 2v4c0 4-6 4-8 0v-6"/></>,
 "info-encoding":<><rect x="3" y="3.5" width="18" height="17" rx="2"/><path d="M7 8v6m4-6v6m4-6v6m4-6v6M5 17.5h14" strokeWidth="1.5"/><circle cx="7" cy="8" r=".8" fill="currentColor" stroke="none"/></>,
 "info-programming":<><path d="m8.5 5-5.5 7 5.5 7m7-14 5.5 7-5.5 7M14 3l-4 18" strokeWidth="1.8"/></>,
 "info-circuit":<><path d="M3 7h6v10H3m6-8h3m-3 6h3"/><path d="M12 6h3a6 6 0 0 1 0 12h-3Z"/><path d="M21 12h2"/></>,
 "info-logic":<><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M11 4v16m4-7 3 3m0-3-3 3M6 14h2" strokeWidth="1.55"/></>,
 "info-flowchart":<><rect x="9" y="2.5" width="6" height="5" rx="2"/><path d="M12 7.5v3M12 10.5 6.5 16 12 21.5l5.5-5.5Z"/></>,
 "info-place-value":<><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16m6-16v16M3 10h18"/><circle cx="6" cy="15" r="1.1" fill="currentColor"/><circle cx="12" cy="15" r="1.1" fill="currentColor"/></>,
 "maps-atlas":<><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c-4.6 5.5-4.6 12.5 0 18m0-18c4.6 5.5 4.6 12.5 0 18M5.5 7.5h13M5.5 16.5h13" strokeWidth="1.4"/></>,
 "contour-atlas":<><path d="M3.5 5 9 3l5 3 6.5-2v15L14 21l-5-3-5.5 2Z" strokeDasharray="2 2"/><path d="M9 3v15M14 6v15" strokeWidth="1.65"/></>,
 "geo-matching":<><rect x="2.5" y="4" width="7.5" height="7" rx="1.5"/><rect x="14" y="13" width="7.5" height="7" rx="1.5"/><path d="m10.5 8 3.5 8m-2-2 2 2-1-4M15 6h5m-2.5-2.5L20 6l-2.5 2.5" strokeWidth="1.65"/></>,
 "geo-question-cards":<><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M10 9a2.5 2.5 0 1 1 4 2c-1 .8-2 1.3-2 2.5"/><circle cx="12" cy="17" r="1" fill="currentColor" stroke="none"/></>,
 "geo-climate":<><path d="M7 5v10m0 0a3 3 0 1 0 3 3c0-1.5-.8-2.4-1.5-3V5a1.5 1.5 0 0 0-3 0v10"/><path d="M13 10c0-2 2-4 4-4s4 2 4 4-1.5 3-3 3h-5m2 3-1 3m5-3-1 3"/></>,
 "history-atlas":<><path d="M4 4 9 2l5 3 6-2v17l-6 2-5-3-5 2Z"/><path d="M9 2v17M14 5v17m-2-12 2-2 2 2-2 4-2-4Z"/></>,
 "history-timeline":<><path d="M2.5 12h19m-3-3 3 3-3 3"/><path d="M6 7v10M12 4v16M17 8v8" strokeWidth="1.7"/><circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none"/></>,
 "history-family-tree":<><circle cx="6" cy="5.5" r="2.5"/><circle cx="18" cy="5.5" r="2.5"/><circle cx="12" cy="18" r="3"/><path d="M6 8v3h12V8M12 11v4"/></>,
 "ru-syntax":<><path d="M3 5.5h18M3 11h13M3 16.5h8m4 0h6M3 21h18" strokeWidth="1.7"/><path d="M12 14v5" strokeWidth="1.3"/></>,
 "ru-morphemes":<><path d="M3 9h18M3 15h18"/><path d="m8 6 4-3 4 3m-7 11 3 4 3-4M3 8v8m18-8v8" strokeWidth="1.7"/></>,
 "ru-morphology":<><rect x="4" y="3.5" width="16" height="17" rx="2"/><path d="M8 8.5h8M8 12.5h5M8 16.5h8" strokeWidth="1.6"/><circle cx="17" cy="12.5" r="1" fill="currentColor" stroke="none"/></>,
 "ru-phonetics":<><path d="M4 9v6M8 5v14m4-16v18m4-14v10m4-8v6" strokeWidth="1.85"/><path d="M2 12h2m16 0h2"/></>,
 "ru-orthography":<><path d="M4 4.5h16M4 9.5h12M4 14.5h16M6 19.5h13" strokeWidth="1.7"/><path d="m15 15 5 5m0-6-5 6" strokeWidth="1.5"/></>,
 "ru-sentence-builder":<><rect x="2" y="4" width="8" height="7" rx="1.5"/><rect x="13" y="4" width="9" height="7" rx="1.5"/><rect x="6" y="15" width="13" height="7" rx="1.5"/><path d="m11 8 2 0m-1-2 2 2-2 2"/></>,
 "language-sentence-builder":<><path d="M4 5h16M4 10h12M4 16h10M16 16h4M4 20h16"/><path d="m18 11 3 2-3 2"/></>,
 "language-flashcards":<><rect x="7" y="2.5" width="15" height="17" rx="2"/><path d="M4 7h-1v14h15v-2"/><path d="M11 9h7m-7 4h5"/></>,
 "literature-analysis":<><path d="M3 5c3-1 6-1 9 1 3-2 6-2 9-1v14c-3-1-6-1-9 1-3-2-6-2-9-1Z"/><path d="M12 6v14M6 9h3m6 0h3M6 13h3m6 0h3" strokeWidth="1.5"/></>,
 "civics-structure":<><circle cx="12" cy="5" r="2.5"/><circle cx="5" cy="17" r="2.5"/><circle cx="19" cy="17" r="2.5"/><path d="M12 7.5v4H5v3m7-3h7v3"/></>,
};

export const subjectToolIconIds=Object.keys(icons);

export function hasDedicatedSubjectToolIcon(id:string):boolean{
 return Object.prototype.hasOwnProperty.call(icons,id);
}

export default function LektrusSubjectToolIcon({id,size=23,className}:{id:string;size?:number;className?:string}){
 const glyph=icons[id as SubjectToolId];
 if(!glyph){
  // A distinct, consistent fallback for newly registered tools. The regression
  // test ensures every currently listed tool has a real, purpose-specific icon.
  return <svg width={size} height={size} viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M12 8v8M8 12h8"/></svg>;
 }
 return <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{glyph}</svg>;
}
