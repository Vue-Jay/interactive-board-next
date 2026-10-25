import type {ReactNode} from "react";
import type {SubjectToolId} from "./lektrusSubjectToolRegistry";

/**
 * All available classroom workflows use purpose-specific, scalable SVG glyphs.
 * The icons are intentionally single-colour so they inherit the selected
 * palette, remain legible on 21px buttons and work with dark themes.
 */
const icons:Partial<Record<SubjectToolId,ReactNode>>={
 "math-formula":<><path d="M4 6h8l-5 6 5 6H4"/><path d="M15 8h6m-3-3v6M15 17h6" strokeWidth="1.9"/><circle cx="17.8" cy="13.7" r=".75" fill="currentColor" stroke="none"/></>,
 "math-geometry":<><path d="M4 19.5 11 4.5l9 15H4Z"/><path d="M11 4.5v15M4 19.5h16" strokeDasharray="2.1 2.4" opacity=".55"/><circle cx="11" cy="4.5" r="1.9" fill="var(--lektrus-tool-surface,#fff)"/><circle cx="4" cy="19.5" r="1.9" fill="var(--lektrus-tool-surface,#fff)"/><circle cx="20" cy="19.5" r="1.9" fill="var(--lektrus-tool-surface,#fff)"/></>,
 "math-coordinate":<><path d="M3.5 12H21m-3-2.5L21 12l-3 2.5M11 21V3m-2.5 3L11 3l2.5 3"/><path d="M7 10.5v3M15.5 10.5v3M9.5 7h3M9.5 17h3" strokeWidth="1.25" opacity=".6"/><circle cx="17" cy="6.5" r="2" fill="var(--lektrus-tool-surface,#fff)"/></>,
 "math-fractions":<><path d="M5 12h14" strokeWidth="2.1"/><path d="M9 8V4l-2 1.5M7 8h4M15 16.5a2.3 2.3 0 1 1 3.7 1.8l-3.5 2.2H19" strokeWidth="1.65"/></>,
 "chem-periodic-table":<><rect x="3" y="4" width="6" height="7" rx="1"/><rect x="11" y="4" width="10" height="7" rx="1"/><rect x="3" y="13" width="6" height="7" rx="1"/><rect x="11" y="13" width="10" height="7" rx="1"/><path d="M5 7h2M13 7h5M13 16h5" strokeWidth="1.3"/></>,
 "chem-molecules":<><path d="m8.5 9 7-2M9 11l6.5 6.5" strokeWidth="1.8"/><circle cx="6" cy="10" r="3.2"/><circle cx="18" cy="6" r="3.2"/><circle cx="18" cy="19" r="3.2"/><circle cx="6" cy="10" r=".85" fill="currentColor" stroke="none"/></>,
 "chem-organic":<><path d="m12 3.5 8 4.5v9L12 21.5 4 17V8Z"/><path d="m8 8.2 4-2.2m5 3.4v5.2M12 19l-4-2.2" strokeWidth="1.25"/><path d="M20 8l2-1.2M4 17l-2 1.2" strokeWidth="1.55"/></>,
 "chem-formulas":<><path d="M3.5 7.5h6M3.5 13h6M3.5 18.5h6M12 12h9m-3-3 3 3-3 3" strokeWidth="1.8"/><circle cx="15" cy="5.5" r="1.6"/><path d="m14 19 2-2 2 2" strokeWidth="1.7"/></>,
 "chem-experiments":<><path d="M9.5 3.5h5M10 3.5v7L5.3 19a2 2 0 0 0 1.7 3h10a2 2 0 0 0 1.7-3L14 10.5v-7"/><path d="M7.5 17.5c3-1.2 5 1.2 9 0"/><circle cx="13" cy="13.3" r="1.1" fill="currentColor" stroke="none"/></>,
 "physics-mechanics":<><path d="M2.5 20.5h19M4.5 18.5l-2 2M10 18.5l-2 2M15.5 18.5l-2 2M21 18.5l-2 2" opacity=".5" strokeWidth="1.2"/><rect x="5" y="11" width="9" height="7" rx="1"/><path d="M9.5 11V3.5m-3 3 3-3 3 3" strokeWidth="1.9"/><path d="M15.5 14h6m-2.5-2.5 2.5 2.5-2.5 2.5"/></>,
 "physics-optics":<><path d="M14 3 7.5 21h14Z" strokeLinejoin="round"/><path d="M2 11.5h8.6l5.4 3.2L22 11" strokeWidth="1.85"/><path d="m7.5 9 3 2.5-3 2.5m11.5-3 3 0-1 2.8" strokeWidth="1.45"/></>,
 "physics-graphs":<><path d="M3.5 3.5V20h17"/><path d="m6.5 17 4-8 4 4 5-7" strokeWidth="2"/><circle cx="10.5" cy="9" r="1.5" fill="var(--lektrus-tool-surface,#fff)"/><path d="M10.5 9V20M14.5 13v7" strokeDasharray="2 2" opacity=".45" strokeWidth="1.3"/></>,
 "physics-circuits":<><path d="M3 9V4.5h18v15H3v-5M5.5 9v5m3-7v9" strokeWidth="1.8"/><circle cx="16" cy="12" r="3.4"/><path d="m13.8 9.8 4.4 4.4m0-4.4-4.4 4.4" strokeWidth="1.5"/></>,
 "bio-dna":<><path d="M6 2.5c0 9 12 10 12 19M18 2.5c0 9-12 10-12 19"/><path d="M7.5 5.5h9M9 9.5h6M9 14.5h6M7.5 18.5h9" strokeWidth="1.55"/></>,
 "bio-taxonomy":<><rect x="8" y="2.5" width="8" height="5.5" rx="1.3"/><rect x="2.5" y="16" width="8" height="5.5" rx="1.3"/><rect x="13.5" y="16" width="8" height="5.5" rx="1.3"/><path d="M12 8v4H6.5v4M12 12h5.5v4"/></>,
 "bio-division":<><circle cx="9" cy="12" r="6.5"/><circle cx="15" cy="12" r="6.5"/><path d="m7 10 4 4m0-4-4 4m6-4 4 4m0-4-4 4" strokeWidth="1.6"/></>,
 "bio-genetics":<><path d="M4 4h16v16H4Z"/><path d="M12 4v16M4 12h16"/><path d="m7 7 2 2m0-2-2 2m8 6 2 2m0-2-2 2" strokeWidth="1.5"/></>,
 "bio-cell":<><path d="M12 3C6.8 3 3 6.8 3 12s3.8 9 9 9 9-3.8 9-9-3.8-9-9-9Z"/><path d="M10 9.5c1-2 4-2 5.5 0 2.1 2.6-.7 6.2-3.5 6.2-2.7 0-4.8-3.8-2-6.2Z"/><circle cx="6.7" cy="12" r="1.1" fill="currentColor" stroke="none"/><circle cx="17.5" cy="16.5" r=".9" fill="currentColor" stroke="none"/></>,
 "bio-food-chain":<><path d="M2.5 18h7.5m-3.7-3.5L10 18l-3.7 3.5M13 18h8m-3.5-3.5L21 18l-3.5 3.5"/><path d="M4 6c4 0 7-2 7-3 .5 5-1.5 8-6 9M4 6v6" strokeWidth="1.7"/><circle cx="18" cy="8" r="3"/><path d="M15.8 11c1.3 2 3.2 2 4.5 0" strokeWidth="1.5"/></>,
 "bio-organ-systems":<><path d="M12 3v8m-2 0C7 7 3.5 8.5 3.5 14v4c0 3 5.5 3.5 7.5-.8V11m3 0c3-4 6.5-2.5 6.5 3v4c0 3-5.5 3.5-7.5-.8V11"/><path d="M12 11v7" strokeWidth="1.3" opacity=".6"/></>,
 "info-encoding":<><rect x="3" y="4.5" width="18" height="15" rx="2"/><path d="M7 8v7m4-7v7m4-7v7m4-7v7" strokeWidth="1.7"/><path d="M5.5 17.5h13" strokeWidth="1.3"/></>,
 "info-programming":<><path d="m8 5-5 7 5 7m8-14 5 7-5 7M14.5 3l-5 18" strokeWidth="1.95"/></>,
 "info-circuit":<><path d="M3 6h5v12H3m5-9h4m-4 6h4"/><path d="M12 5.5h3a6.5 6.5 0 0 1 0 13h-3Z"/><path d="M21 12h2"/></>,
 "info-logic":<><rect x="3.5" y="4" width="17" height="16" rx="2"/><path d="M3.5 10h17M11 4v16M6 14h2m7-1 3 3m0-3-3 3" strokeWidth="1.6"/></>,
 "info-flowchart":<><rect x="9" y="2.5" width="6" height="5" rx="1.5"/><path d="M12 7.5v3m-5.5 4 5.5-4 5.5 4-5.5 6Z"/><path d="M12 20.5V22"/></>,
 "info-place-value":<><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16m6-16v16M3 10h18" strokeWidth="1.65"/><circle cx="6" cy="15" r="1.15" fill="currentColor" stroke="none"/><circle cx="12" cy="15" r="1.15" fill="currentColor" stroke="none"/></>,
 "maps-atlas":<><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c-5 5-5 13 0 18m0-18c5 5 5 13 0 18M5 7.5h14m-14 9h14" strokeWidth="1.45"/></>,
 "contour-atlas":<><path d="M3 5 9 3l6 2 6-2v16l-6 2-6-2-6 2V5Z" strokeLinejoin="round"/><path d="M9 3v16m6-14v16" strokeDasharray="2 2"/><path d="m10 11 2.5-2 2 2.5-1 3-3.5-1.5Z" strokeDasharray="2 2" strokeWidth="1.4"/></>,
 "geo-matching":<><rect x="2.5" y="3.5" width="7.5" height="7" rx="1.6"/><rect x="14" y="13.5" width="7.5" height="7" rx="1.6"/><path d="m10 7 4 10m-2.5-3 2.5 3-3 1" strokeWidth="1.7"/><path d="m17 6 2 2 3-3" strokeWidth="1.6"/></>,
 "geo-question-cards":<><rect x="4" y="3.5" width="16" height="17" rx="2.5"/><path d="M9.5 9a2.7 2.7 0 0 1 5.4 0c0 1.5-2.7 2.1-2.7 4"/><circle cx="12.2" cy="17" r=".95" fill="currentColor" stroke="none"/></>,
 "geo-climate":<><path d="M7 4v10.5a3.2 3.2 0 1 0 3 0V4a1.5 1.5 0 0 0-3 0Z"/><path d="M8.5 10v7" strokeWidth="1.5"/><path d="M14 8a4 4 0 0 1 7 2c0 2-2 3-3.5 3H14m1 3-1 2m5-2-1 2" strokeWidth="1.65"/></>,
 "history-atlas":<><path d="M3.5 5 9 3l6 2.5L20.5 4v15L15 21l-6-2.5L3.5 20Z"/><path d="M9 3v15.5M15 5.5V21" strokeWidth="1.4"/><path d="m10.7 11.5 3-2 1.7 2-1.3 3-3.4-1Z" strokeWidth="1.55"/></>,
 "history-timeline":<><path d="M2.5 12h19m-3.5-3.2 3.5 3.2-3.5 3.2"/><path d="M6 7v10M12 4v16M17 8.5v7"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/></>,
 "history-family-tree":<><circle cx="6" cy="5.5" r="2.5"/><circle cx="18" cy="5.5" r="2.5"/><circle cx="12" cy="18" r="3"/><path d="M6 8v3h12V8M12 11v4"/></>,
 "ru-syntax":<><path d="M3 5.5h18M3 11h11M3 16.5h18M3 21h9" strokeWidth="1.75"/><path d="M15 8.5v5M12 13.5h6" strokeWidth="1.45"/></>,
 "ru-morphemes":<><path d="M3 9h18M3 15h18M3 9v6m18-6v6"/><path d="m8 6 4-3 4 3m-7 11 3 4 3-4" strokeWidth="1.7"/></>,
 "ru-morphology":<><rect x="4" y="3.5" width="16" height="17" rx="2"/><path d="M8 8.5h8M8 12.5h5M8 16.5h8"/><circle cx="17" cy="12.5" r=".95" fill="currentColor" stroke="none"/></>,
 "ru-phonetics":<><path d="M4 9v6M8 5v14m4-16v18m4-14v10m4-8v6" strokeWidth="1.9"/><path d="M2 12h2m16 0h2" strokeWidth="1.35"/></>,
 "ru-orthography":<><path d="M4 5h16M4 10h16M4 15h12M4 20h16" strokeWidth="1.75"/><path d="m14 12 2.2 2.2 3.8-4.7" strokeWidth="1.75"/></>,
 "ru-sentence-builder":<><rect x="2.5" y="4" width="8" height="6.5" rx="1.2"/><rect x="13.5" y="4" width="8" height="6.5" rx="1.2"/><rect x="8" y="15" width="8" height="6.5" rx="1.2"/><path d="m11 7 2 0m-1-2 2 2-2 2M12 10.5V15" strokeWidth="1.5"/></>,
 "language-sentence-builder":<><path d="M4 5h16M4 10h12M4 16h11M4 21h16"/><path d="m17 11 3 2-3 2" strokeWidth="1.75"/></>,
 "language-flashcards":<><rect x="7.5" y="3" width="13.5" height="16" rx="2"/><path d="M4 7H3v14h14v-2"/><path d="M11 9h7m-7 4h5" strokeWidth="1.6"/></>,
 "literature-analysis":<><path d="M3 5c3-1 6-1 9 1 3-2 6-2 9-1v14c-3-1-6-1-9 1-3-2-6-2-9-1Z"/><path d="M12 6v14M6 9.5h3m6 0h3M6 13.5h3m6 0h3" strokeWidth="1.45"/></>,
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
