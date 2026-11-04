/** Small consistent outline icons for the human atlas system controls.
 * Uses the current system accent, no emoji, remote icon font or assets.
 */
import {memo} from "react";
import type {HumanBodySystem} from "./lektrusBioHumanBodySystems";
function LektrusBioHumanSystemIcon({system}:{system:HumanBodySystem}){
 const common={fill:"none",stroke:"currentColor",strokeWidth:1.9,
  strokeLinecap:"round" as const,strokeLinejoin:"round" as const};
 return <svg className="lektrus-human-system-icon" viewBox="0 0 32 32"
  focusable="false" aria-hidden="true" {...common}>
  {system==="all"&&<g>
   <circle cx="12" cy="12" r="6"/><circle cx="20" cy="12" r="6"/>
   <circle cx="16" cy="20" r="6"/>
   <path d="M16 6v20M6 16h20" strokeWidth="1" opacity=".35"/>
  </g>}
  {system==="nervous"&&<g>
   <path d="M16 7c-3-5-10-1-9 4-5 2-3 10 1 10-1 4 5 7 8 4
    3 3 9 0 8-4 4-1 6-8 1-10 1-5-6-9-9-4Z"/>
   <path d="M16 7v18M9 12l4 2-2 5M23 12l-4 2 2 5M10 22l4-2M22 22l-4-2"/>
   <path d="M16 25v4" strokeWidth="2.3"/>
  </g>}
  {system==="respiratory"&&<g>
   <path d="M16 4v12M13 6h6M16 16l-4 3M16 16l4 3"/>
   <path d="M13 12C9 10 6 13 5 17c-2 6-1 10 4 10 4 0 6-2 6-5V14
    M19 12c4-2 7 1 8 5 2 6 1 10-4 10-4 0-6-2-6-5V14"/>
   <path d="M10 19l4 3M22 19l-4 3" strokeWidth="1.3"/>
  </g>}
  {system==="circulatory"&&<g>
   <path d="M16 27 5.8 17C-.2 11 6 3 12 7c2 1 3 3 4 4 1-1 2-3 4-4
    6-4 12.2 4 6.2 10L16 27Z"/>
   <path d="M6 16h5l2-4 4 8 2-4h7" strokeWidth="1.65"/>
  </g>}
  {system==="digestive"&&<g>
   <path d="M15 4v9c-2 0-3 2-2 4 2 2 4-1 6 1 3 3 1 9-5 9-5 0-8-4-6-8
    1-3 3-6 4-8V4"/>
   <path d="M17 6h4M18 10h4M18 23c3 0 4-3 2-5"/>
   <path d="M8 26c-2 2 0 4 2 4h12c3 0 4-3 2-4" strokeWidth="1.4"/>
  </g>}
  {system==="musculoskeletal"&&<g>
   <path d="M11 9c-1-3-5-3-6-1-2 2-1 5 1 6l10 10c1 2 4 3 6 1
    3-2 2-5 0-7L12 8Z"/>
   <path d="M17 7c1-3 5-3 6-1 2 2 1 5-1 6l-10 10c-1 2-4 3-6 1
    -3-2-2-5 0-7L16 6Z" opacity=".53"/>
   <circle cx="7" cy="9" r="2.4"/><circle cx="24" cy="21" r="2.4"/>
  </g>}


  {system==="urinary"&&<g>
   <path d="M10 6Q3 6 4 15q0 9 7 8 6-3 3-9Q10 11 10 6Z
    M22 6q7 0 6 9 0 9-7 8-6-3-3-9Q22 11 22 6Z"/>
   <path d="M13 19q1 8 3 9m3-9q-1 8-3 9"/>
   <ellipse cx="16" cy="28" rx="4" ry="2"/>
  </g>}


  {system==="integumentary"&&<g>
   <path d="M4 10q6-4 12 0t12 0v15H4Z"/>
   <path d="M4 15q6-4 12 0t12 0M4 20q6-4 12 0t12 0"/>
   <path d="M14 11V6q1-4 5-4" strokeWidth="2.5"/>
   <path d="M22 11v10q-4 1-4 5" strokeWidth="1.5"/>
  </g>}

 </svg>;
}
export default memo(LektrusBioHumanSystemIcon);
