/** Small textbook-style illustrations for the mechanics tool palette. */
export type MechanicsGlyph="select"|"block"|"circle"|"floor"|"incline"|"pivot"|"force";
export default function LektrusMechanicsToolIcon({type}:{type:MechanicsGlyph}){
 const blue="#4779b9",ink="#31547e",surface="#9baec4";
 return <svg viewBox="0 0 48 48" width="32" height="32" fill="none"
   aria-hidden="true" focusable="false" strokeLinecap="round" strokeLinejoin="round">
  {type==="select"&&<path d="M11 5 38 24l-13 2-4 14L11 5Z" fill="#dceaff" stroke={blue} strokeWidth="2.8"/>}
  {type==="block"&&<>
   <rect x="8" y="11" width="32" height="26" rx="4" fill="#e1ecfb" stroke={blue} strokeWidth="2.6"/>
   <path d="M8 17h32" stroke="#b2c7e5" strokeWidth="2"/>
   <circle cx="24" cy="24" r="2.6" fill={ink}/>
  </>}
  {type==="circle"&&<>
   <circle cx="24" cy="23" r="15" fill="#e1ecfb" stroke={blue} strokeWidth="2.6"/>
   <circle cx="24" cy="23" r="3" fill={ink}/>
   <path d="M6 41h36" stroke={surface} strokeWidth="2"/>
  </>}
  {type==="floor"&&<>
   <path d="M5 24h38" stroke={ink} strokeWidth="3.5"/>
   {Array.from({length:7},(_,i)=><path key={i} d={`M${8+i*5} 27l-5 7`} stroke={surface} strokeWidth="1.8"/>)}
  </>}
  {type==="incline"&&<>
   <path d="M6 39 40 13v26Z" fill="#e1ecfb" stroke={blue} strokeWidth="2.6"/>
   <rect x="20" y="16" width="13" height="11" rx="2" fill="#fff" stroke={ink} strokeWidth="2"
     transform="rotate(-37 26.5 21.5)"/>
  </>}
  {type==="pivot"&&<>
   <path d="M24 11 11 36h26Z" fill="#dfebf7" stroke={blue} strokeWidth="2.5"/>
   <path d="M7 39h34" stroke={ink} strokeWidth="2.6"/>
   <circle cx="24" cy="10" r="3" fill="#fff" stroke={blue} strokeWidth="2"/>
  </>}
  {type==="force"&&<>
    <path d="M8 37 37 9" stroke="#316acc" strokeWidth="4" />
    <path d="m23 9 14 0 0 14" stroke="#316acc" strokeWidth="3.5"/>
    <circle cx="8" cy="37" r="4" fill="#fff" stroke={blue} strokeWidth="2.4"/>
    <text x="10" y="17" fontSize="14" fontWeight="800" fill={ink}>F</text>
  </>}
 </svg>;
}
