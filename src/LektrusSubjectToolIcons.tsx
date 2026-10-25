import type {ReactNode} from "react";
import type {SubjectToolId} from "./lektrusSubjectToolRegistry";

/**
 * All available classroom workflows use purpose-specific, scalable SVG glyphs.
 * The icons are intentionally single-colour so they inherit the selected
 * palette, remain legible on 21px buttons and work with dark themes.
 */
const icons:Partial<Record<SubjectToolId,ReactNode>>={
 "math-formula":<><path d="M4 4h7l-4 8 4 8H4"/><path d="M13 9h8m-4-4v8M14 19h7"/></>,
 "math-geometry":<><circle cx="12" cy="4.5" r="2.1"/><path d="m10.6 6.4-5.7 13.2m8.5-13.2 5.7 13.2M7.9 12.7h8.2"/><path d="M3.5 20.3h4.4m8.2 0h4.4" strokeWidth="2.1"/><path d="M13.8 15.3a6 6 0 0 1 4 4.1" strokeDasharray="2 2" opacity=".7"/></>,
 "math-coordinate":<><path d="M4 3v17h17"/><path d="M6 17c3-1 3-9 7-9s4 7 8 2"/><circle cx="13" cy="8" r="1.2" fill="currentColor"/></>,
 "math-fractions":<><circle cx="12" cy="12" r="9"/><path d="M12 3v9h9"/><path d="M12 12 5.6 18.4" strokeDasharray="2 2"/></>,
 "chem-periodic-table":<><rect x="3" y="3.5" width="7" height="8" rx="1"/><rect x="12" y="3.5" width="9" height="8" rx="1"/><path d="M5 8h3M15 8h3"/><rect x="3" y="13.5" width="7" height="7" rx="1"/><rect x="12" y="13.5" width="9" height="7" rx="1"/></>,
 "chem-molecules":<><circle cx="12" cy="12" r="4"/><circle cx="4.5" cy="5" r="2.2"/><circle cx="19.5" cy="5" r="2.2"/><circle cx="4.5" cy="19" r="2.2"/><circle cx="19.5" cy="19" r="2.2"/><path d="m9 9-3-3m9 3 3-3M9 15l-3 3m9-3 3 3"/></>,
 "chem-organic":<><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9Z"/><path d="m8 7 4-2m6 4v5m-6 4-4-2"/></>,
 "chem-formulas":<><path d="M3 7h5m-5 9h5m3-5h10m-4-4 4 4-4 4"/><path d="M11 5h4m-2-2v4"/></>,
 "chem-experiments":<><path d="M9 3h6m-5 0v7l-6 9a2 2 0 0 0 2 3h12a2 2 0 0 0 2-3l-6-9V3"/><path d="M7 17c3-2 7 2 10 0"/><circle cx="12" cy="18.7" r=".9" fill="currentColor"/></>,
 "physics-mechanics":<><rect x="9" y="10" width="7" height="7" rx="1"/><path d="M3 17h18M12.5 10V3m-3 3.5 3-3.5 3 3.5M16 13.5h5m-2.5-2.5 2.5 2.5-2.5 2.5"/></>,
 "physics-optics":<><path d="M12 3v18" strokeDasharray="3 3"/><path d="m3 7 9 6 9-6m-18 0 4 1-.3-4M21 7l-4 1 .3-4"/></>,
 "physics-graphs":<><path d="M4 3v17h17"/><path d="m6 17 4-7 4 4 6-9"/><circle cx="10" cy="10" r="1.2"/><circle cx="14" cy="14" r="1.2"/></>,
 "physics-circuits":<><path d="M3 10v-5h18v14H3v-5M6 8v4M9 6v8"/><circle cx="16" cy="12" r="3"/><path d="m14 10 4 4m0-4-4 4"/></>,
 "bio-dna":<><path d="M5 2c0 9 14 11 14 20M19 2C19 11 5 13 5 22"/><path d="M7 5h10M7 10h10M7 15h10M7 20h10"/></>,
 "bio-taxonomy":<><rect x="8" y="2.5" width="8" height="5" rx="1.2"/><rect x="2" y="16" width="7" height="5" rx="1.2"/><rect x="15" y="16" width="7" height="5" rx="1.2"/><path d="M12 7.5v4H5.5V16m6.5-4.5h6.5V16"/></>,
 "bio-division":<><circle cx="7.3" cy="12" r="5.2"/><circle cx="16.7" cy="12" r="5.2"/><path d="m5.5 9 3.5 6m0-6-3.5 6m9.5-6 3.5 6m0-6-3.5 6"/></>,
 "bio-genetics":<><path d="M7 3v18M14 3v18M3 8h18M3 15h18"/><path d="m9.5 10.5 2 2m0-2-2 2M16 18h2"/></>,
 "bio-cell":<><path d="M12 3c5.5 0 9 4 9 9s-3.5 9-9 9-9-4-9-9 3.5-9 9-9Z"/><circle cx="12" cy="12" r="3.1"/><path d="M6.5 9c1-2 2-2.7 3-2.6M16 16c1.4-.4 1.9-1.2 2-2.4"/></>,
 "bio-food-chain":<><path d="M3 17c0-3 2-5 5-5-1-3 1-6 5-7 2.5 4 1 7-2 9v7"/><path d="M15 15h6m-3-3 3 3-3 3"/><circle cx="18" cy="7" r="2.5"/></>,
 "bio-organ-systems":<><path d="M12 3v8m-2 0c-3-5-7-4-7 2v6c0 2.5 5 3 8-1V11m3 0c3-5 7-4 7 2v6c0 2.5-5 3-8-1V11"/></>,
 "info-encoding":<><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 10V7l-2 1m6-1v5m3-5v5m4-5v5M5 16h14"/></>,
 "info-programming":<><path d="m8 5-5 7 5 7m8-14 5 7-5 7M14 3l-4 18"/></>,
 "info-circuit":<><path d="M3 7h6v10H3m6-8h3m-3 6h3"/><path d="M12 6h3a6 6 0 0 1 0 12h-3Z"/><path d="M21 12h2"/></>,
 "info-logic":<><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M11 4v16M6 14h2m7 0 3 3m0-3-3 3"/></>,
 "info-flowchart":<><rect x="8" y="2.5" width="8" height="5" rx="2.5"/><path d="m12 7.5 0 4m0 0-4 4 4 4 4-4-4-4Z"/><path d="M12 19.5V22"/></>,
 "info-place-value":<><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16m6-16v16M3 10h18"/><circle cx="6" cy="15" r="1.1" fill="currentColor"/><circle cx="12" cy="15" r="1.1" fill="currentColor"/></>,
 "maps-atlas":<><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c-5 6-5 12 0 18m0-18c5 6 5 12 0 18M5.5 7h13m-13 10h13" strokeWidth="1.35"/></>,
 "contour-atlas":<><path d="M3.5 5 9 3l5 3 6.5-2v15L14 21l-5-3-5.5 2Z" strokeDasharray="2 2"/><path d="M9 3v15M14 6v15" strokeDasharray="2 2"/></>,
 "geo-matching":<><rect x="2.5" y="4" width="7" height="6" rx="1.2"/><rect x="14.5" y="14" width="7" height="6" rx="1.2"/><path d="m10 7 4 10m-3-2 3 2-1-4"/><path d="M15 6h6m-3-2 3 2-3 2"/></>,
 "geo-question-cards":<><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M10 9a2.6 2.6 0 1 1 4 2c-1 .8-2 1.4-2 2.5"/><circle cx="12" cy="17" r="1" fill="currentColor"/></>,
 "geo-climate":<><path d="M7 5v10m0 0a3 3 0 1 0 3 3c0-1.5-.8-2.4-1.5-3V5a1.5 1.5 0 0 0-3 0v10"/><path d="M13 10c0-2 2-4 4-4s4 2 4 4-1.5 3-3 3h-5m2 3-1 3m5-3-1 3"/></>,
 "history-atlas":<><path d="M4 4 9 2l5 3 6-2v17l-6 2-5-3-5 2Z"/><path d="M9 2v17M14 5v17m-2-12 2-2 2 2-2 4-2-4Z"/></>,
 "history-timeline":<><path d="M2 12h20m-4-3 4 3-4 3"/><path d="M6 7v10M12 5v14M17 9v6"/><circle cx="6" cy="12" r="1" fill="currentColor"/></>,
 "history-family-tree":<><circle cx="6" cy="5.5" r="2.5"/><circle cx="18" cy="5.5" r="2.5"/><circle cx="12" cy="18" r="3"/><path d="M6 8v3h12V8M12 11v4"/></>,
 "ru-syntax":<><path d="M3 6h18M3 11h14M3 17h8m3 0h7"/><path d="M3 21h9m2 0h8" strokeWidth="2.3"/></>,
 "ru-morphemes":<><path d="M3 9h18M3 15h18"/><path d="M8 6 12 3l4 3M9 17l3 4 3-4"/><path d="M3 8v8m18-8v8"/></>,
 "ru-morphology":<><rect x="4" y="3.5" width="16" height="17" rx="2"/><path d="M8 9h8M8 13h5M8 17h8"/><circle cx="17" cy="13" r="1" fill="currentColor"/></>,
 "ru-phonetics":<><path d="M4 9v6M8 5v14m4-16v18m4-14v10m4-8v6" strokeWidth="2.4"/><path d="M2 12h2m16 0h2"/></>,
 "ru-orthography":<><path d="M4 4h16M4 9h11M4 14h16"/><path d="M6 19h13M15 15l5 5M19 14l2 2" strokeWidth="2.2"/></>,
 "ru-sentence-builder":<><rect x="2" y="4" width="8" height="7" rx="1.5"/><rect x="13" y="4" width="9" height="7" rx="1.5"/><rect x="6" y="15" width="13" height="7" rx="1.5"/><path d="m11 8 2 0m-1-2 2 2-2 2"/></>,
 "language-sentence-builder":<><path d="M4 5h16M4 10h12M4 16h10M16 16h4M4 20h16"/><path d="m18 11 3 2-3 2"/></>,
 "language-flashcards":<><rect x="7" y="2.5" width="15" height="17" rx="2"/><path d="M4 7h-1v14h15v-2"/><path d="M11 9h7m-7 4h5"/></>,
 "literature-analysis":<><path d="M3 5c3-1 6-1 9 1 3-2 6-2 9-1v14c-3-1-6-1-9 1-3-2-6-2-9-1Z"/><path d="M12 6v14M6 9h3m6 0h3m-12 4h3"/></>,
 "civics-structure":<><circle cx="12" cy="5" r="2.5"/><circle cx="5" cy="17" r="2.5"/><circle cx="19" cy="17" r="2.5"/><path d="M12 7.5v4H5v3m7-3h7v3"/></>
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
 return <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{glyph}</svg>;
}
