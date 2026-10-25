import LektrusPhysicsPointerGlyph from "./LektrusPhysicsPointerGlyph";

/** Unified school-diagram glyphs: restrained outlines, actual geometry, no clip art. */
export type MechanicsGlyph="select"|"block"|"circle"|"floor"|"incline"|"pivot"|"force";
export default function LektrusMechanicsToolIcon({type}:{type:MechanicsGlyph}){
 if(type==="select")return <LektrusPhysicsPointerGlyph kind="select" size={32}/>;
 return <svg className={"lektrus-physics-tool-glyph mechanics-"+type}
   viewBox="0 0 32 32" width="32" height="32" fill="none"
   stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
   aria-hidden="true" focusable="false">
  {type==="block"&&<>
   <rect x="6" y="8" width="20" height="18" rx="2" fill="currentColor" fillOpacity=".07"/>
   <path d="M6 13h20M10 8v5"/><circle cx="16" cy="19.5" r="1.8" fill="currentColor" stroke="none"/>
  </>}
  {type==="circle"&&<>
   <circle cx="16" cy="14.5" r="10" fill="currentColor" fillOpacity=".07"/>
   <circle cx="16" cy="14.5" r="1.8" fill="currentColor" stroke="none"/>
   <path d="M3 27h26M7 27l-2 2m8-2-2 2m8-2-2 2m8-2-2 2" opacity=".55"/>
  </>}
  {type==="floor"&&<>
   <path d="M4 12.5h24" strokeWidth="2.4"/>
   <path d="m7 15-4 5m10-5-4 5m10-5-4 5m10-5-4 5M4 24h24" opacity=".65"/>
  </>}
  {type==="incline"&&<>
   <path d="M4 27 27 7v20H4Z" fill="currentColor" fillOpacity=".06"/>
   <path d="M4 27h23" strokeWidth="2.1"/>
   <path d="m10 27-3 3m9-3-3 3m9-3-3 3" opacity=".5"/>
   <rect x="12.2" y="11.5" width="9" height="7.2" rx="1.2" transform="rotate(-41 16.7 15.1)" fill="#fff"/>
  </>}
  {type==="pivot"&&<>
   <circle cx="16" cy="7" r="2.3" fill="#fff"/>
   <path d="M16 10 6 25h20L16 10Z" fill="currentColor" fillOpacity=".07"/>
   <path d="M3 27h26M6 27l-2 2m9-2-2 2m9-2-2 2m9-2-2 2" opacity=".65"/>
  </>}
  {type==="force"&&<>
   <path d="M5 26 25 6" strokeWidth="2.5"/>
   <path d="M14.5 6H25v10.5" strokeWidth="2.5"/>
   <circle cx="5" cy="26" r="2.4" fill="#fff"/>
   <path d="M5.5 7H12m-6.5 0v9m0-4h5" strokeWidth="1.8"/>
  </>}
 </svg>;
}
