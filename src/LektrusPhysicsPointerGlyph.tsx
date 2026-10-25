/** Consistent Lektrus pointer symbols for the physics workspaces.
 * Line art inherits the same active and hover colour as other school tools. */
export type PhysicsPointerKind="select"|"hand";
export default function LektrusPhysicsPointerGlyph({kind,size=24}:{kind:PhysicsPointerKind;size?:number}){
 return <svg viewBox="0 0 24 24" width={size} height={size} fill="none"
   stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
   aria-hidden="true" focusable="false">
  {kind==="select"?<>
   <path d="M4.3 2.6 4.8 20l4.6-4.9 3.4 6.2 3.2-1.7-3.3-6.1 6.8-.9L4.3 2.6Z" fill="currentColor" fillOpacity=".09"/>
   <path d="m17.3 4.3 2.1-2.1m-1.3 6 3 .3M12.4 2.9l.4-2"/>
  </>:<>
   <path d="M8.3 11.4V6.7a1.65 1.65 0 0 1 3.3 0v3.8-6a1.65 1.65 0 0 1 3.3 0v5.8-4.6a1.65 1.65 0 0 1 3.3 0v5.6-2.9a1.65 1.65 0 0 1 3.3 0v6.1c0 4.7-3.1 7.6-7.6 7.6h-2c-2.5 0-4.5-1.1-6-3.3L3.5 15a1.9 1.9 0 0 1 3-2.3l2.1 2.1"/>
   <path d="M8.3 11.4v3.3" opacity=".55"/>
  </>}
 </svg>;
}
