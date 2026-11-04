/** Mutually exclusive anatomy overlays for the translucent human atlas.
 * The base portrait carries NO baked-in internal anatomy while any system
 * is selected. Each SVG is a separate educational anatomical map.
 *
 * The 360×840 coordinate system matches the school human silhouette; this
 * is an explanatory image, NOT a patient-specific radiograph or CT scan.
 */
import {memo,useId} from "react";
import type {ReactNode} from "react";
import type {HumanFocusedSystem} from "./lektrusBioHumanBodySystems";
import {HUMAN_ADDITIONAL_DRAWINGS} from "./LektrusBioHumanAdditionalSystems";

type Props={system:HumanFocusedSystem};
const artery="#d36c70",vein="#6595b0";
function Nerves(){
 return <g data-anatomy="nervous" fill="none" strokeLinecap="round" strokeLinejoin="round">
  <g fill="#c1a3d7" stroke="#7b619f" strokeWidth="3.2">
   <path d="M155 79Q148 59 162 50Q170 37 183 46Q202 37 211 51Q225 58 218 76
    Q232 88 220 102Q221 115 202 118Q190 126 178 116Q161 123 154 110
    Q138 104 147 90Z"/>
   <path d="M168 122Q180 130 192 122Q209 126 205 142Q193 149 179 146
    Q165 146 165 134Z" fill="#d8bbdf"/>
  </g>
  <path d="M180 138V453" stroke="#f3d8a7" strokeWidth="9"/>
  <path d="M180 146V454" stroke="#ac8aaf" strokeWidth="3"/>
  <g stroke="#dec39f" strokeWidth="3.2">
   {Array.from({length:17},(_,i)=>{
    const y=160+i*16,arm=i<5,leg=i>13;
    const dx=arm?63:leg?34:39;
    return <g key={i}>
     <path d={`M180 ${y}Q${180-dx*.45} ${y+8} ${180-dx} ${y+8}`}/>
     <path d={`M180 ${y}Q${180+dx*.45} ${y+8} ${180+dx} ${y+8}`}/>
    </g>;
   })}
   <path d="M126 181Q109 221 90 270L66 367L49 428"/>
   <path d="M234 181Q251 221 270 270L294 367L311 428"/>
   <path d="M156 443Q134 515 142 595L132 735"/>
   <path d="M204 443Q226 515 218 595L228 735"/>
  </g>
  <g stroke="#8d75aa" strokeWidth="2.2">
   <path d="M169 64q16 7 8 19t10 18M205 63q-20 9-10 23t-6 24"/>
   <path d="M153 83q12 5 17 11m42-12q-16 7-20 17"/>
  </g>
  <circle cx="180" cy="83" r="13" fill="#9d7db5" opacity=".32"/>
 </g>;
}
function Respiration(){
 /* Place bronchi and lungs in the chest of the 360 x 840 source figure,
  not down over the abdominal organs. The airway starts near the nose. */
 return <g data-anatomy="respiratory" transform="translate(0 -30) scale(1 .9)"
  strokeLinejoin="round" strokeLinecap="round">
  <path d="M180 142V215" stroke="#d6d5c3" strokeWidth="17"/>
  {Array.from({length:9},(_,i)=><path key={i} d={`M172 ${151+i*7}h16`}
   stroke="#83a0a8" strokeWidth="2.5"/>)}
  <path d="M169 217Q149 208 134 223Q109 242 108 292Q103 335 120 363
   Q148 373 173 345Q180 314 175 273Z"
   fill="#d69da8" fillOpacity=".88" stroke="#a66f85" strokeWidth="3.4"/>
  <path d="M191 217Q211 206 230 224Q249 243 252 288Q260 331 242 360
   Q221 375 196 340Q204 311 189 291Z"
   fill="#d69da8" fillOpacity=".88" stroke="#a66f85" strokeWidth="3.4"/>
  {/* Anatomical right (viewer left) has three lobes; anatomical left has two. */}
  <path d="M110 272Q140 285 175 278M113 320Q140 309 173 317M194 303Q220 302 253 297"
   fill="none" stroke="#b6788e" strokeWidth="2.6"/>
  <path d="M180 211Q168 232 144 244M180 211Q194 231 218 243"
   fill="none" stroke="#e8d7ba" strokeWidth="9"/>
  <g fill="none" stroke="#f5e2c9" strokeWidth="3.5">
   <path d="M145 244q-17 19-15 51m15-50q18 23 18 57M218 244q-20 23-19 57m19-55q14 20 17 51"/>
   <path d="M130 293l-11 26m12-14l15 28M163 300l-15 29M201 301l15 27m19-32l10 24"/>
  </g>
  <path d="M117 372Q177 351 246 369" stroke="#b9899b" strokeWidth="5" fill="none"/>
 </g>;
}
function Circulation(){
 return <g data-anatomy="circulatory" fill="none" strokeLinecap="round" strokeLinejoin="round">
  {/* Cardiovascular heart must sit between lungs, not at navel height. */}
  <path d="M190 257Q218 231 232 255Q246 283 224 318Q204 339 187 336
    Q168 315 157 282Q154 258 174 252Q182 250 190 257Z"
   fill="#d67f8a" stroke="#a75264" strokeWidth="3.2" transform="translate(0 -32)"/>
  <path d="M193 269Q201 286 196 320" stroke="#a94e64" strokeWidth="3" fill="none" transform="translate(0 -32)"/>
  <path d="M197 268Q184 239 194 212Q200 199 217 205" stroke={artery} strokeWidth="11"/>
  <path d="M184 270Q170 243 168 213Q160 202 149 204" stroke={vein} strokeWidth="9"/>
  <path d="M205 211Q226 220 256 229L286 263L308 345" stroke={artery} strokeWidth="6"/>
  <path d="M168 212Q144 219 116 234L77 292L53 373" stroke={vein} strokeWidth="5"/>
  <path d="M203 326Q204 376 191 422L209 493L231 612L236 738" stroke={artery} strokeWidth="7"/>
  <path d="M176 325Q166 375 173 426L152 493L131 613L126 742" stroke={vein} strokeWidth="6"/>
  <path d="M198 209V151L186 128M199 172L222 162M199 180L170 164"
   stroke={artery} strokeWidth="5"/>
  <path d="M168 213L166 156L174 132" stroke={vein} strokeWidth="5"/>
  {Array.from({length:7},(_,i)=>{
   const y=350+i*37;
   return <g key={i} strokeWidth="2.5">
    <path d={`M199 ${y}Q170 ${y+3} 145 ${y+18}`} stroke={artery}/>
    <path d={`M175 ${y}Q196 ${y+4} 222 ${y+17}`} stroke={vein}/>
   </g>;
  })}
  <path d="M165 260Q179 251 192 258" stroke="#efb1ab" strokeWidth="2"/>
 </g>;
}
function Digestion(){
 /* Keep the liver/stomach above the intestines and the intestine
  inside the lower abdomen of the same approved silhouette. */
 return <g data-anatomy="digestive" transform="translate(0 6) scale(1 .9)"
  strokeLinecap="round" strokeLinejoin="round">
  <path d="M178 142Q185 191 181 247L188 295" stroke="#d8af94" strokeWidth="10"
   fill="none"/>
  {/* The liver is on anatomical right, viewer-left. */}
  <path d="M113 305Q143 285 183 295Q203 309 193 342Q160 358 118 347Z"
   fill="#a96a66" stroke="#875455" strokeWidth="3"/>
  {/* The stomach is on anatomical left, viewer-right. */}
  <path d="M200 293Q218 286 223 307Q224 331 237 339Q255 351 240 367
   Q215 383 201 360Q189 343 201 322Z"
   fill="#dfa996" stroke="#a87974" strokeWidth="3.5"/>
  <path d="M194 352Q220 352 236 367" fill="none" stroke="#deb796" strokeWidth="6"/>
  <path d="M142 386Q126 397 128 427Q130 455 152 465L219 462
   Q251 448 256 425Q255 395 236 385" fill="none" stroke="#bd8d82" strokeWidth="10"/>
  <path d="M147 393Q178 376 202 395Q230 409 218 425Q202 439 169 423
   Q151 414 180 403Q218 399 227 415Q243 443 212 451Q179 460 156 445"
   stroke="#e3b7a0" strokeWidth="9" fill="none"/>
  <path d="M252 412Q262 453 233 470L216 481" stroke="#b67b7b" strokeWidth="8" fill="none"/>
  <path d="M128 395Q115 430 132 469" stroke="#b67b7b" strokeWidth="7" fill="none"/>
 </g>;
}
function Movement(){
 return <g data-anatomy="musculoskeletal" strokeLinecap="round" strokeLinejoin="round">
  <g fill="none" stroke="#ddd4c5" strokeWidth="8" opacity=".88">
   <path d="M178 151V451" strokeWidth="7" strokeDasharray="13 2"/>
   <path d="M161 184Q180 174 199 184" strokeWidth="5"/>
   {Array.from({length:7},(_,i)=>{
    const y=211+i*19,w=60-i*2;
    return <g key={i} strokeWidth="3.8">
     <path d={`M178 ${y}Q${178-w*.45} ${y-9} ${178-w} ${y+4}`}/>
     <path d={`M178 ${y}Q${178+w*.45} ${y-9} ${178+w} ${y+4}`}/>
    </g>;
   })}
   <path d="M129 184L84 264L61 374L47 426" strokeWidth="9"/>
   <path d="M227 184L276 264L303 374L315 426" strokeWidth="9"/>
   <path d="M178 430Q144 415 126 437L156 478L178 461L200 478L231 437Q209 415 178 430Z"
    strokeWidth="7"/>
   <path d="M158 466L134 588L127 740M202 466L226 588L233 740"
    strokeWidth="11"/>
  </g>
  <g fill="#d69ca2" fillOpacity=".65" stroke="#bd7e8d" strokeWidth="1.8">
   <path d="M156 190Q127 192 119 231L134 299Q152 302 163 276L173 211Z"/>
   <path d="M202 190Q229 192 237 231L221 299Q207 302 195 276L187 211Z"/>
   <path d="M123 199Q95 210 90 247L74 336Q92 348 106 319L141 237Z"/>
   <path d="M234 199Q262 210 270 247L286 336Q268 348 254 319L219 237Z"/>
   <path d="M146 473Q120 494 125 543L129 582Q146 584 155 563L169 479Z"/>
   <path d="M211 473Q237 494 232 543L227 582Q210 584 201 563L187 479Z"/>
  </g>
 </g>;
}
const drawings:Record<HumanFocusedSystem,()=>ReactNode>={
 nervous:Nerves,respiratory:Respiration,circulatory:Circulation,
 digestive:Digestion,musculoskeletal:Movement,
 ...HUMAN_ADDITIONAL_DRAWINGS
};
function LektrusBioHumanSystemOverlay({system}:Props){
 const id=useId().replace(/:/g,""),clip="lektrus-bio-system-"+id;
 const Drawing=drawings[system];
 return <svg className="lektrus-human-system-overlay" viewBox="0 0 360 840"
  preserveAspectRatio="none" role="presentation" aria-hidden="true"
  data-bio-only-system={system} focusable="false">
  <defs>
   <linearGradient id={clip} x1="0" y1="0" x2="1" y2="1">
    <stop stopColor="#fff9f8" stopOpacity=".1"/>
    <stop offset="1" stopColor="#fff9f8" stopOpacity=".24"/>
   </linearGradient>
  </defs>
  <Drawing/>
 </svg>;
}
export default memo(LektrusBioHumanSystemOverlay);
