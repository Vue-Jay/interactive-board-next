/** Gender-neutral anatomy reference mannequin for the school atlas.
 * Fully local, sharp at any zoom and deliberately free of hair, face,
 * clothes, sexual characteristics or realistic skin photography.
 * Coordinates match the 960×640 human world used by the atlas camera.
 */
import {memo,useId} from "react";

function LektrusBioMannequin(){
 const suffix=useId().replace(/:/g,"");
 const shell="lektrus-mannequin-shell-"+suffix;
 const torso="lektrus-mannequin-torso-"+suffix;
 const joint="lektrus-mannequin-joint-"+suffix;
 return <svg className="lektrus-human-mannequin" viewBox="0 0 240 640"
  preserveAspectRatio="none" aria-hidden="true" focusable="false">
  <defs>
   <linearGradient id={shell} x1="0" y1="0" x2="1" y2=".27">
    <stop offset="0" stopColor="#aabecb"/>
    <stop offset=".18" stopColor="#d9e4eb"/>
    <stop offset=".51" stopColor="#f4f6f5"/>
    <stop offset=".76" stopColor="#e2eaf0"/>
    <stop offset="1" stopColor="#9eafbe"/>
   </linearGradient>
   <linearGradient id={torso} x1="0" y1="0" x2=".9" y2=".35">
    <stop stopColor="#b5c7d1"/>
    <stop offset=".25" stopColor="#e5edf1"/>
    <stop offset=".54" stopColor="#f7f9f7"/>
    <stop offset="1" stopColor="#bed0da"/>
   </linearGradient>
   <radialGradient id={joint}>
    <stop stopColor="#f7f9f8"/>
    <stop offset=".65" stopColor="#ccd9e1"/>
    <stop offset="1" stopColor="#9bb0bf"/>
   </radialGradient>
  </defs>
  <ellipse cx="120" cy="631" rx="71" ry="7" fill="#869ab8" opacity=".17"/>
  {/* Limbs sit behind the torso so the silhouette reads as a single body. */}
  {[false,true].map(right=><g key={right?"right":"left"}
   transform={right?"translate(240 0) scale(-1 1)":undefined}
   fill={"url(#"+shell+")"} stroke="#94a7b7" strokeWidth="2.5"
   strokeLinejoin="round">
   <path d="M80 337Q95 334 113 354L110 459Q108 474 93 476
    Q76 477 75 461L71 393Q72 359 80 337Z"/>
   <circle cx="93" cy="468" r="17" fill={"url(#"+joint+")"}/>
   <path d="M77 481Q90 478 108 481L105 573Q106 595 94 600
    Q77 601 76 587L70 507Q69 487 77 481Z"/>
   <circle cx="94" cy="593" r="12" fill={"url(#"+joint+")"}/>
   <path d="M81 598Q94 603 104 595L106 612Q107 620 95 624
    L57 626Q49 622 59 614L77 601Z"/>
   <path d="M66 136Q45 132 37 156L27 237Q25 253 39 259
    Q55 265 60 245L78 178Q85 147 66 136Z"/>
   <circle cx="42" cy="250" r="15" fill={"url(#"+joint+")"}/>
   <path d="M37 264Q52 259 58 271L53 347Q52 366 41 369
    Q28 367 29 354L24 291Q23 273 37 264Z"/>
   <circle cx="41" cy="362" r="11" fill={"url(#"+joint+")"}/>
   <path d="M32 374Q43 368 50 378L48 401
    Q46 414 40 413L31 405Q20 396 22 387Z"/>
  </g>)}
  {/* Neutral mannequin pelvis, abdomen and upper thorax without anatomy of
      breasts, genitals, clothing, hair or a photographed person. */}
  <path d="M82 124Q119 117 157 124Q180 129 183 154
   Q177 203 161 264Q156 288 163 326L168 347
   Q148 358 120 356Q92 358 72 347L77 326
   Q84 287 78 264Q62 202 56 154Q59 132 82 124Z"
   fill={"url(#"+torso+")"} stroke="#93a8b9" strokeWidth="3.3"
   strokeLinejoin="round"/>
  <path d="M68 157Q98 145 120 145Q141 145 172 157"
   fill="none" stroke="#fff" strokeOpacity=".79" strokeWidth="3"/>
  <path d="M120 148V339" stroke="#9aafbd" strokeOpacity=".42"
   strokeWidth="1.7" strokeDasharray="3 5"/>
  <path d="M87 186Q102 201 120 198Q138 201 153 186
   M84 220Q100 232 120 229Q140 232 156 220
   M84 265Q102 272 120 270Q138 272 156 265"
   fill="none" stroke="#9bb0bd" strokeOpacity=".38" strokeWidth="1.8"/>
  <path d="M78 318Q100 332 120 327Q140 332 162 318"
   fill="none" stroke="#a5b8c3" strokeWidth="2.3" strokeOpacity=".6"/>
  <path d="M75 347Q119 363 165 347"
   stroke="#819cab" strokeWidth="3" fill="none" strokeOpacity=".65"/>
  {/* Shoulders are jointed, like a biology laboratory mannequin. */}
  <circle cx="62" cy="152" r="10" fill={"url(#"+joint+")"}
   stroke="#98abb7" strokeWidth="2"/>
  <circle cx="178" cy="152" r="10" fill={"url(#"+joint+")"}
   stroke="#98abb7" strokeWidth="2"/>
  {/* Cervical joint and a smooth, featureless head. */}
  <path d="M107 111V127Q118 137 132 127V111"
   fill={"url(#"+shell+")"} stroke="#98acba" strokeWidth="2.4"/>
  <ellipse cx="120" cy="69" rx="35" ry="47" fill={"url(#"+shell+")"}
   stroke="#91a6b6" strokeWidth="3"/>
  <path d="M101 34Q94 60 99 84" stroke="#fff"
   strokeWidth="3.2" fill="none" strokeLinecap="round" opacity=".72"/>
  <path d="M106 103Q120 110 134 103" stroke="#a5b7c1"
   strokeWidth="2" fill="none" opacity=".63"/>
  {/* Small reference seams visually distinguish an anatomical model
      from a photograph or realistic human skin. */}
  <g fill="none" stroke="#8ca3b4" strokeWidth="1.3" opacity=".55">
   <path d="M78 467Q92 473 108 467"/>
   <path d="M132 467Q147 472 162 467"/>
   <path d="M29 251Q42 257 56 250"/>
   <path d="M184 250Q198 257 211 251"/>
  </g>
 </svg>;
}
export default memo(LektrusBioMannequin);
