import LektrusPhysicsPointerGlyph from "./LektrusPhysicsPointerGlyph";

/** Diagram-faithful optics symbols drawn with the same stroke as Lektrus tools.
 * Shapes are recognizable at 24px; no tiny labels or decorative clutter. */
export type OpticsIconKind="select"|"source"|"mirror"|"converging-lens"|"diverging-lens"|"interface"|"screen"|"prism";
export default function LektrusOpticsToolIcon({type}:{type:OpticsIconKind}){
 if(type==="select")return <LektrusPhysicsPointerGlyph kind="select" size={32} className="lektrus-optics-tool-picture"/>;
 return <svg className={"lektrus-optics-tool-picture symbol-"+type}
   viewBox="0 0 32 32" width="32" height="32" fill="none"
   stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
   aria-hidden="true" focusable="false">
  {type==="source"&&<>
   <circle cx="13" cy="16" r="6.5" fill="currentColor" fillOpacity=".08"/>
   <circle cx="13" cy="16" r="2.2" fill="currentColor" stroke="none"/>
   <path d="M13 3v4m0 18v4M1 16h4m16 0h7M4.5 7.5l3 3m11 11 3 3m0-17-3 3M7.5 21.5l-3 3"/>
   <path d="m24 13 4 3-4 3" strokeWidth="1.6"/>
  </>}
  {type==="mirror"&&<>
   <path d="M18 5v22" strokeWidth="3"/>
   <path d="m21 6 5 5m-5 1 5 5m-5 1 5 5m-5 1 3 3" opacity=".55"/>
   <path d="M4 24 16 12 5 5" strokeWidth="1.9"/>
   <path d="m7 12-2-7 7 1M9 19l-5 5 7-.8" opacity=".75"/>
  </>}
  {type==="converging-lens"&&<>
   <path d="M16 3C8 11 8 21 16 29c8-8 8-18 0-26Z" fill="currentColor" fillOpacity=".10" strokeWidth="2"/>
   <path d="M2 12h8l6 4 6-4h8" opacity=".85"/>
   <path d="M2 20h8l6-4 6 4h8" opacity=".85"/>
   <path d="m26 9 4 3-4 3m-4 2 4 3-4 3" strokeWidth="1.4"/>
  </>}
  {type==="diverging-lens"&&<>
   <path d="M11 3c6 8 6 18 0 26h10c-6-8-6-18 0-26Z" fill="currentColor" fillOpacity=".10" strokeWidth="2"/>
   <path d="M2 12h9l5-3 7-5h7M2 20h9l5 3 7 5h7" opacity=".83"/>
   <path d="m25 1 5 3-4 3m-1 18 5 3-4 3" strokeWidth="1.4"/>
  </>}
  {type==="interface"&&<>
   <path d="M16 3v26" strokeWidth="2.6"/>
   <path d="M17 3h12v26H17Z" fill="currentColor" fillOpacity=".07" stroke="none"/>
   <path d="M4 5 16 16l12 6" strokeWidth="2.1"/>
   <path d="m8 11-4-6 7 1m11 11 6 5-7 1" strokeWidth="1.6"/>
   <path d="M6 16h20" strokeDasharray="2 3" opacity=".45"/>
  </>}
  {type==="screen"&&<>
   <rect x="19" y="4" width="7" height="24" rx="1.4" fill="currentColor" fillOpacity=".10"/>
   <path d="M3 16h16" strokeWidth="2.2"/>
   <path d="m14 12 5 4-5 4" strokeWidth="1.6"/>
   <path d="M26 7h3m-3 5h3m-3 5h3m-3 5h3" opacity=".5"/>
  </>}
  {type==="prism"&&<>
   <path d="M16 4 3 27h26L16 4Z" fill="currentColor" fillOpacity=".10" strokeWidth="2"/>
   <path d="M1 18h8l8 5 13-8" strokeWidth="1.9"/>
   <path d="m26 13 4 2-3 4" strokeWidth="1.5"/>
   <path d="M13 23h9" strokeDasharray="2 3" opacity=".5"/>
  </>}
 </svg>;
}
