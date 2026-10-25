import LektrusPhysicsPointerGlyph from "./LektrusPhysicsPointerGlyph";

type Kind="select"|"hand"|"wire"|"junction"|"undo"|"redo"|"close"|"catalog";
/** Matching Lektrus vector controls throughout the electric-circuit workspace. */
export default function LektrusCircuitUiIcon({kind}:{kind:Kind}){
 if(kind==="select"||kind==="hand")return <LektrusPhysicsPointerGlyph kind={kind} size={18}/>;
 return <svg viewBox="0 0 24 24" width="18" height="18" fill="none"
   stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
   aria-hidden="true" focusable="false">
  {kind==="wire"&&<><path d="M2 16h7l3-8 3 8h7"/><circle cx="2.5" cy="16" r="1.3" fill="currentColor"/><circle cx="21.5" cy="16" r="1.3" fill="currentColor"/></>}
  {kind==="junction"&&<><path d="M12 2v20M2 12h20"/><circle cx="12" cy="12" r="3" fill="currentColor" stroke="white" strokeWidth="1.4"/></>}
  {kind==="undo"&&<><path d="m9 6-5 5 5 5M4 11h10a6 6 0 0 1 0 12"/></>}
  {kind==="redo"&&<><path d="m15 6 5 5-5 5m5-5H10a6 6 0 0 0 0 12"/></>}
  {kind==="close"&&<path d="M5 5 19 19M19 5 5 19"/>}
  {kind==="catalog"&&<><rect x="3.5" y="3.5" width="17" height="17" rx="2.6"/><path d="M8 8h8M8 12h8M8 16h5"/></>}
 </svg>;
}
