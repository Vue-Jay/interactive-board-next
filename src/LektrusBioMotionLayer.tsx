import type {CSSProperties} from "react";
import type {BioMotionInfo} from "./lektrusBioAtlasMotion";

/** Pure SVG annotation layer. It never captures clicks from anatomy hotspots.
 * No JS timers or canvas render loop: pausing stops motion via CSS only.
 */
export default function LektrusBioMotionLayer({
 motion,playing,replay
}:{motion:BioMotionInfo|null;playing:boolean;replay:number}){
 if(!motion)return null;
 const active=motion.mode==="loop"?playing:replay>0;
 const className="lektrus-bio-motion lektrus-bio-motion--"+motion.id+
  (active?" is-playing":" is-paused");
 const styleFor=(delay:number):CSSProperties=>({"--bio-motion-delay":delay+"s"} as CSSProperties);
 const oneShot=motion.mode==="once";
 return <g key={oneShot?motion.id+"-"+replay:motion.id} className={className}
  pointerEvents="none" aria-hidden="true" data-bio-motion={motion.id}>
  {motion.id==="water-current"&&<g>
   <path d="M48 216Q106 222 145 203M428 221Q383 219 338 203M239 180Q237 115 239 41"
    fill="none" stroke="#82bbcd" opacity=".6" strokeWidth="6" strokeLinecap="round" strokeDasharray="2 13"/>
   {Array.from({length:5},(_,i)=><g key={i} style={styleFor(-i*.63)}>
    <circle className="lektrus-bio-motion-inlet" cx={65+i*7} cy={214-i*5} r="5" fill="#5dc4d4" stroke="#f8ffff" strokeWidth="1.8"/>
    <circle className="lektrus-bio-motion-outlet" cx={236+i%3*3} cy={170+i*4} r="4.5" fill="#77c1dd" stroke="#f8ffff" strokeWidth="1.4"/>
   </g>)}
   <path d="M220 51l19-23 18 23" fill="none" stroke="#489ab6" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
   <path d="M129 193l19 10-14 18M365 196l-26 10 14 18" fill="none" stroke="#489ab6" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
  </g>}
  {motion.id==="choanocyte-beat"&&<g>
   <ellipse cx="238" cy="179" rx="36" ry="42" fill="#8ed5c9" fillOpacity=".18" stroke="#64b2a6" strokeWidth="2" strokeDasharray="4 8"/>
   <path className="lektrus-bio-motion-flagellum" d="M239 184Q210 156 240 119T239 57"
    fill="none" stroke="#2e91a1" strokeWidth="7" strokeLinecap="round"/>
   {Array.from({length:4},(_,i)=><circle key={i} cx={195+i*19} cy={194} r="4" fill="#c6a660"/>)}
  </g>}
  {motion.id==="tentacle-sway"&&<g>
   {[-2,-1,0,1,2].map((i)=><path className="lektrus-bio-motion-tentacle" key={i}
    style={styleFor(i*.24)} d={`M${236+i*7} 134Q${236+i*44} 80 ${237+i*42} 33`}
    fill="none" stroke="#4b947b" strokeWidth="4" strokeOpacity=".85" strokeLinecap="round"/>)}
   {Array.from({length:12},(_,i)=>{
    const x=90+i*26,y=43+(i%3)*12;
    return <circle key={i} cx={x} cy={y} r="2.4" fill="#d5c18c" opacity=".7"/>;
   })}
  </g>}
  {motion.id==="nematocyst-discharge"&&<g>
   <path className="lektrus-bio-motion-discharge" d="M237 97Q263 74 242 51Q219 28 247 13"
    fill="none" stroke="#ae5b8e" strokeWidth="7" strokeLinecap="round"/>
   <path className="lektrus-bio-motion-discharge" d="M246 15l-19 7m19-7 2 19"
    fill="none" stroke="#86456f" strokeWidth="3" strokeLinecap="round"/>
   <circle className="lektrus-bio-motion-flash" cx="238" cy="91" r="30" fill="#eb96bd" fillOpacity=".22"/>
  </g>}
  {motion.id==="moss-sway"&&<g>
   {Array.from({length:8},(_,i)=>{const y=77+i*23;
    return <g key={i} style={styleFor(i*.12)}>
     <path className="lektrus-bio-motion-leaf" d={`M239 ${y+8}q-45 -23 -80 -18`}
      stroke="#4c9867" strokeWidth="3.4" fill="none" strokeLinecap="round"/>
     <path className="lektrus-bio-motion-leaf" d={`M241 ${y+8}q44 -23 79 -18`}
      stroke="#4c9867" strokeWidth="3.4" fill="none" strokeLinecap="round"/>
    </g>;
   })}
  </g>}
  {motion.id==="spore-release"&&<g>
   {Array.from({length:13},(_,i)=>{
    const angle=-Math.PI*.98+i*Math.PI/12;
    const distance=70+i%3*24;
    const sporeStyle={"--bio-spore-x":Math.cos(angle)*distance+"px","--bio-spore-y":Math.sin(angle)*distance+"px",
     "--bio-motion-delay":i*.045+"s"} as CSSProperties;
    return <circle key={i} className="lektrus-bio-motion-spore" cx={239} cy={76}
     r={4+(i%3)} fill="#c7a567" stroke="#f8e7ba" strokeWidth="1.5" style={sporeStyle}/>;
   })}
   <path className="lektrus-bio-motion-capsule" d="M210 67Q239 42 272 67" stroke="#92754f" strokeWidth="7" fill="none"/>
  </g>}
  {motion.id==="flagellar-swim"&&<g>
   <path className="lektrus-bio-motion-cilium lektrus-bio-motion-cilium--left"
    d="M212 105Q172 67 192 23" stroke="#4d999a" strokeWidth="6" fill="none" strokeLinecap="round"/>
   <path className="lektrus-bio-motion-cilium lektrus-bio-motion-cilium--right"
    d="M259 106Q296 68 272 22" stroke="#4d999a" strokeWidth="6" fill="none" strokeLinecap="round"/>
   <path className="lektrus-bio-motion-trail" d="M200 302q35 20 74 0" stroke="#4e9bb0" strokeWidth="4" fill="none" strokeLinecap="round" strokeDasharray="6 10"/>
  </g>}
  {motion.id==="light-sensing"&&<g>
   <path className="lektrus-bio-motion-light" d="M406 40L299 155M423 73L312 170M393 15L301 149"
    stroke="#f5c975" strokeWidth="5" strokeLinecap="round" fill="none"/>
   <circle className="lektrus-bio-motion-sensor" cx="291" cy="171" r="22"
    fill="#ecaa55" fillOpacity=".12" stroke="#e8b264" strokeWidth="3"/>
  </g>}
  {motion.id==="spiral-chloroplast"&&<g>
   {Array.from({length:4},(_,i)=><path className="lektrus-bio-motion-spiral" key={i} style={styleFor(-i*.52)}
    d={`M${75+i*88} 134q33 -26 59 9q-28 14 -42 28q-27 15 9 29q21 10 43 -7`}
    fill="none" stroke="#3d9956" strokeWidth="7" strokeLinecap="round" strokeOpacity=".9"/>)}
  </g>}
  {motion.id==="conjugation"&&<g>
   <path className="lektrus-bio-motion-bridge" d="M239 164V232" stroke="#5eab7a" strokeWidth="16" strokeLinecap="round" fill="none"/>
   <circle className="lektrus-bio-motion-gamete" cx="239" cy="166" r="16"
    fill="#a888c1" stroke="#725998" strokeWidth="4"/>
   <circle className="lektrus-bio-motion-zygote" cx="239" cy="237" r="25"
    fill="#d3ad6e" stroke="#8e7547" strokeWidth="5"/>
  </g>}
 </g>;
}
