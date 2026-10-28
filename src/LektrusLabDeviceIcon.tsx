import type {LabDevice} from "./lektrusChemistryBenchModel";

/** Original vector drawings using a common laboratory visual language.
 * Shapes indicate the actual instrument rather than arbitrary font symbols. */
export default function LektrusLabDeviceIcon({kind,size=42,active=false}:{
 kind:LabDevice;size?:number;active?:boolean}){
 const steel="#527f78",edge="#305c58",light="#d7ece3",glass="#89bcc0";
 return <svg className={"lektrus-lab-device-icon is-"+kind+(active?" is-active":"")}
  viewBox="0 0 88 86" width={size} height={size} aria-hidden="true"
  fill="none" strokeLinecap="round" strokeLinejoin="round">
  <ellipse cx="44" cy="76" rx="32" ry="5" fill="#255747" opacity=".12"/>
  {kind==="hotplate"&&<>
   <path d="M14 39h60v22l-7 9H21l-7-9Z" fill={light} stroke={steel} strokeWidth="3"/>
   <path d="M14 40l10-22h40l10 22Z" fill="#d6e5df" stroke={edge} strokeWidth="3"/>
   <ellipse cx="44" cy="35" rx="21" ry="9" fill="#829c92" stroke={edge} strokeWidth="2.5"/>
   <ellipse cx="44" cy="35" rx="15" ry="6" stroke={active?"#e97f4f":"#a3b1a5"} strokeWidth="2.5"/>
   <path d="M31 35q12-8 25 0q-12 8-25 0Z" stroke={active?"#d9683d":"#839b90"} strokeWidth="2"/>
   <circle cx="25" cy="60" r="4" fill="#428f77" stroke={edge} strokeWidth="2"/>
   <circle cx="60" cy="60" r="4" fill="#f4b477" stroke={edge} strokeWidth="2"/>
  </>}
  {kind==="burner"&&<>
   <path d="M30 70h28l7 5H23Z" fill="#829f94" stroke={edge} strokeWidth="2.5"/>
   <path d="M38 36h12v32H38z" fill={light} stroke={steel} strokeWidth="3"/>
   <path d="M34 52h20v8H34z" fill="#6f9e99" stroke={edge} strokeWidth="2"/>
   <path d="M50 57h15l5 5" stroke={edge} strokeWidth="3"/>
   {active&&<g className="lektrus-lab-device-flame">
    <path d="M39 34q-9-11 4-28q0 12 7 17q5-7 3-12q14 21-1 27Z"
     fill="#f4a34c" stroke="#cd7844" strokeWidth="2"/>
    <path d="M42 35q-2-8 4-16q-1 9 5 15Z" fill="#78c7e1"/>
   </g>}
  </>}
  {kind==="stirrer"&&<>
   <rect x="14" y="37" width="60" height="30" rx="7"
    fill={light} stroke={steel} strokeWidth="3"/>
   <path d="M18 39Q44 48 70 39" stroke="#91b9ae" strokeWidth="3"/>
   <path d="M26 36v-9q0-13 18-13q18 0 18 13v9" stroke={glass} strokeWidth="3"/>
   <path d="M29 29q15 6 30 0" stroke="#9ccfce" strokeWidth="5"/>
   <rect x="37" y="29" width="14" height="4" rx="2" fill="#457f7b"/>
   <circle cx="26" cy="56" r="5" fill="#8cafa1" stroke={edge} strokeWidth="2"/>
   <circle cx="60" cy="56" r="5" fill="#d89c68" stroke={edge} strokeWidth="2"/>
   {active&&<path className="lektrus-lab-stir-ring" d="M34 19q10-7 20 0"
    stroke="#64a7a1" strokeDasharray="3 4" strokeWidth="2"/>}
  </>}
  {kind==="tripod"&&<>
   <ellipse cx="44" cy="25" rx="29" ry="11" stroke={edge} strokeWidth="4"/>
   <path d="M17 25v7q26 15 54 0v-7" stroke={steel} strokeWidth="3"/>
   <path d="M24 38L12 75M44 40v35M64 38l12 37" stroke={steel} strokeWidth="5"/>
   <path d="M7 76h13M37 76h14M69 76h13" stroke={edge} strokeWidth="3"/>
   <path d="M27 23h34M27 29h34" stroke="#9dbbad" strokeWidth="2"/>
  </>}
  {kind==="thermometer"&&<>
   <path d="M39 13a5 5 0 0 1 10 0v41a15 15 0 1 1-10 0Z"
    fill={light} stroke={steel} strokeWidth="3"/>
   <path d="M44 34v29" stroke="#d77768" strokeWidth="5"/>
   <circle cx="44" cy="65" r="9" fill="#d77768" stroke="#b65a50" strokeWidth="2"/>
   <path d="M51 19h9m-9 9h6m-6 9h9m-9 9h6" stroke={edge} strokeWidth="2.3"/>
   <path d="M32 16v26" stroke="#fff" strokeWidth="2" opacity=".65"/>
  </>}
 </svg>;
}
