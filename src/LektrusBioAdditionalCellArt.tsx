/** Original offline SVG plates for all sixteen remaining cellular paths.
 * A microscopy learning diagram, NOT a captured microscope image. Each named
 * view is specific to the biology of the existing atlas cell node.
 */
import type {ReactNode} from "react";
import type {BioExtraCellKind} from "./lektrusBioAdditionalCellPlates";
const line="#a38683",nuclear="#aa91b9",green="#63986b",aqua="#8fc6c6";
function Core({cx=235,cy=180,rx=32,ry=22}:{cx?:number;cy?:number;rx?:number;ry?:number}){
 return <g><ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={nuclear} stroke="#8c769e" strokeWidth="4"/>
  <ellipse cx={cx-3} cy={cy} rx={rx*.23} ry={ry*.27} fill="#8967a1"/></g>;
}
function PlantWall({fill="#e2efc9",rough=false}:{fill?:string;rough?:boolean}){
 return <g>
  <path d={rough?"M66 93Q78 55 145 78L319 61Q407 80 415 128L407 254Q366 283 305 269L132 276Q66 252 66 211Z":"M72 74Q144 62 223 75Q307 61 398 77Q421 105 412 240Q388 275 311 263L130 266Q61 246 72 74Z"}
   fill={fill} stroke="#72996d" strokeWidth="13" strokeLinejoin="round"/>
  <path d="M91 96Q176 86 234 96Q328 87 388 101V234Q318 251 237 241L114 246Q92 215 91 96Z"
   fill="#edf8da" stroke="#9ebc88" strokeWidth="3"/>
 </g>;
}
function Chloroplasts({count=12,shift=0}:{count?:number;shift?:number}){
 return <g>{Array.from({length:count},(_,i)=>{const theta=i*2.4+shift;const x=239+Math.cos(theta)*133,y=169+Math.sin(theta)*68;
  return <g key={i} transform={`rotate(${theta*180/Math.PI} ${x} ${y})`}>
   <ellipse cx={x} cy={y} rx="19" ry="10" fill="#5c9c64" stroke="#3f8658" strokeWidth="2.5"/>
   <path d={`M${x-11} ${y}h22`} stroke="#b5dba0" strokeWidth="2.5"/>
  </g>;
 })}</g>;
}
function Vacuole(){return <ellipse cx="250" cy="182" rx="101" ry="65" fill="#c2e2dd" fillOpacity=".82" stroke="#a5cbbe" strokeWidth="3"/>;}
function SparrowKeratinocyte(){return <g>
 <path d="M117 72Q235 46 365 81Q419 150 360 244Q242 278 116 246Q49 152 117 72Z"
  fill="#f0d3c4" stroke="#b4858b" strokeWidth="8"/>
 <Core cx={229} cy={177} rx={52} ry={43}/>
 {Array.from({length:14},(_,i)=>{const theta=i*2.4,rx=70+i%3*11;
  return <path key={i} d={`M${226+Math.cos(theta)*48} ${177+Math.sin(theta)*36}Q${225+Math.cos(theta+.2)*75} ${169+Math.sin(theta+.2)*66} ${235+Math.cos(theta+.3)*rx*1.55} ${175+Math.sin(theta+.3)*rx}`}
   fill="none" stroke="#c69b8e" strokeWidth="3"/>;
 })}
 {[[110,161],[356,181],[267,79]].map(([x,y],i)=><g key={i}>
  <rect x={x-11} y={y-16} width="22" height="32" rx="5" fill="#a97580" opacity=".84"/>
  <path d={`M${x-4} ${y-13}v26m8-26v26`} stroke="#eed2b6" strokeWidth="2"/>
 </g>)}
 <text x="23" y="40" fontSize="12" fill="#855f69">Промежуточные кератиновые филаменты</text>
 </g>}
function SparrowCone(){return <g>
 <path d="M225 40L201 125Q213 142 245 137Q269 131 261 117L244 40Z" fill="#b3d8bb" stroke="#648f78" strokeWidth="7"/>
 {Array.from({length:8},(_,i)=><path key={i} d={`M${214-i*.25} ${58+i*9}L${252+i*.25} ${58+i*9}`} stroke="#79a893" strokeWidth="4"/>)}
 <ellipse cx="237" cy="160" rx="32" ry="34" fill="#d6c499" stroke="#9f957c" strokeWidth="5"/>
 <path d="M219 183Q201 223 217 256Q240 271 262 250Q277 223 254 184" fill="#efdbcd" stroke={line} strokeWidth="6"/>
 <Core cx={236} cy={220} rx={17} ry={14}/>
 <path d="M235 263v20m-10 0q-27-3-34 23m54-23q29 0 37 23" stroke="#b29b81" strokeWidth="8" fill="none" strokeLinecap="round"/>
 <path d="M199 306q38 16 77 0" stroke="#bd9499" strokeWidth="7" fill="none"/>
 </g>}
function PerchHair(){return <g>
 <path d="M177 130Q238 109 300 130L291 248Q252 282 191 256Z" fill="#e5c2bb" stroke="#ae8585" strokeWidth="7"/>
 {Array.from({length:9},(_,i)=>{const x=189+i*11,h=34+i*5;
  return <path key={i} d={`M${x} 130q${i%2?3:-3} -${h*.5} 0 -${h}`} stroke="#83ada0" strokeWidth="6" fill="none" strokeLinecap="round"/>;
 })}
 <path d="M299 129Q289 70 299 26" stroke="#5a9e9b" strokeWidth="7" fill="none" strokeLinecap="round"/>
 <Core cx={236} cy={206} rx={24} ry={20}/>
 <path d="M227 258Q209 278 218 309m38-53q33 28 21 51" fill="none" stroke="#be9ba3" strokeWidth="10" strokeLinecap="round"/>
 <circle cx="242" cy="271" r="8" fill="#9472a6"/>
 </g>}
function PerchCardiomyocyte(){return <g>
 <path d="M45 125Q118 94 180 116Q257 103 311 121Q365 105 438 132V215Q358 242 300 214Q229 231 170 220Q94 251 43 211Z"
  fill="#dfaaa9" stroke="#b17e82" strokeWidth="7"/>
 {Array.from({length:15},(_,i)=>{const x=57+i*25;return <path key={i} d={`M${x} 126v91`} stroke={i%2?"#bf898c":"#f4ceba"} strokeWidth="8"/>;})}
 <path d="M364 120v98" stroke="#6c6877" strokeWidth="13" strokeDasharray="13 3"/>
 <Core cx={235} cy={170} rx={38} ry={21}/>
 {[[266,216],[299,159],[169,204]].map(([x,y],i)=><ellipse key={i} cx={x} cy={y} rx="15" ry="8" fill="#bd8b77" stroke="#956b69" strokeWidth="2"/>)}
 </g>}
function FrogLungEpithelium(){return <g>
 <path d="M44 111Q127 95 197 113Q239 121 286 107Q381 97 441 114L441 209Q347 195 296 223Q251 238 209 213Q138 200 44 204Z"
  fill="#f2d7ca" stroke="#bd9794" strokeWidth="8"/>
 <path d="M45 116Q187 122 250 118T440 115" stroke="#8bbebc" strokeWidth="10" fill="none"/>
 <path d="M374 128v72M106 118v83" stroke="#b98e92" strokeWidth="5" strokeDasharray="7 6"/>
 <Core cx={220} cy={185} rx={39} ry={26}/>
 <path d="M45 236Q191 218 280 242T441 225" stroke="#bb7b87" strokeWidth="16" fill="none" strokeLinecap="round"/>
 </g>}
function FrogRod(){return <g>
 <rect x="215" y="42" width="53" height="123" rx="21" fill="#b0d9d7" stroke="#739da5" strokeWidth="6"/>
 {Array.from({length:11},(_,i)=><path key={i} d={`M222 ${57+i*9}h39`} stroke="#7aa9ad" strokeWidth="4"/>)}
 <path d="M216 175Q196 195 209 250Q236 276 263 248Q273 208 265 177Z" fill="#f0d9c8" stroke="#bb9c8f" strokeWidth="6"/>
 <Core cx={239} cy={218} rx={23} ry={17}/>
 <path d="M238 260v26m-19-2q-27 3-23 25m46-25q26 8 29 25" stroke="#bc9e9b" strokeWidth="9" fill="none"/>
 <ellipse cx="237" cy="301" rx="35" ry="12" fill="#c1a4ad"/>
 </g>}
function BeeTrachea(){return <g>
 <rect x="67" y="101" width="343" height="162" rx="26" fill="#edd8c2" stroke="#a89884" strokeWidth="8"/>
 <rect x="67" y="64" width="343" height="53" rx="12" fill="#d6b98c" stroke="#9d875e" strokeWidth="7"/>
 {Array.from({length:10},(_,i)=><path key={i} d={`M${83+i*33} 67v47`} stroke="#ab9867" strokeWidth="9"/>)}
 <path d="M80 120Q185 132 295 119T397 121" stroke="#ba8589" strokeWidth="6" fill="none"/>
 <Core cx={230} cy={189} rx={42} ry={29}/>
 <path d="M400 137v105" stroke="#987b84" strokeWidth="6" strokeDasharray="7 5"/>
 <text x="24" y="35" fontSize="12" fill="#9a8364">Просвет трахеи</text>
 </g>}
function BeeFiber(){return <g>
 <path d="M45 111Q171 92 266 108T437 111V242Q309 250 254 237Q145 250 45 234Z"
  fill="#e8b5b4" stroke="#aa787f" strokeWidth="8"/>
 {Array.from({length:18},(_,i)=>{const x=54+i*21;return <g key={i}>
  <path d={`M${x} 111v123`} stroke={i%2?"#c78e91":"#f5d3c2"} strokeWidth={i%2?8:5}/>
  <path d={`M${x+9} 113v122`} stroke="#b77d83" strokeWidth="2" opacity=".8"/>
 </g>;})}
 {[[116,124],[347,217]].map(([x,y],i)=><ellipse key={i} cx={x} cy={y} rx="19" ry="11"
  fill={nuclear} stroke="#997cad" strokeWidth="3"/>)}
 <path d="M45 108Q237 86 438 109" stroke="#9a777c" strokeWidth="6" fill="none"/>
 </g>}
function SnailPhotoreceptor(){return <g>
 <path d="M174 121Q240 104 309 128L293 238Q242 271 191 234Z" fill="#edd6c4" stroke="#b58e83" strokeWidth="7"/>
 {Array.from({length:18},(_,i)=>{const x=183+i*7;
  return <path key={i} d={`M${x} 122q-12 -24 ${i%2?0:9} -52`} stroke="#77a795" strokeWidth="3.6" fill="none" strokeLinecap="round"/>;
 })}
 <Core cx={239} cy={186} rx={37} ry={30}/>
 <path d="M236 251Q219 281 244 308" stroke="#b69bae" strokeWidth="13" fill="none" strokeLinecap="round"/>
 <path d="M244 307q16-4 23 12m-22-9q-22 2-31 11" stroke="#b69bae" strokeWidth="6" fill="none"/>
 <path d="M163 57q64-33 139 0" stroke="#d3b16d" strokeWidth="8" fill="none" strokeDasharray="8 8"/>
 </g>}
function SnailMantle(){return <g>
 {Array.from({length:5},(_,i)=>{const x=62+i*74;return <g key={i}>
  <path d={`M${x} 101Q${x+34} 91 ${x+70} 101V263Q${x+37} 275 ${x} 261Z`}
   fill={i%2?"#e8c8b4":"#efdbbf"} stroke="#b68d86" strokeWidth="5"/>
  <ellipse cx={x+34} cy={184} rx="18" ry="22" fill={nuclear}/>
  <path d={`M${x+5} 109q33-13 59 0`} fill="none" stroke="#77b3b0" strokeWidth="5"/>
 </g>;})}
 {Array.from({length:4},(_,i)=>{const x=134+i*74;return <path key={i} d={`M${x} 150v52`}
  stroke="#96717e" strokeWidth="5" strokeDasharray="7 6"/>;})}
 <path d="M52 90h380" stroke={aqua} strokeWidth="9" strokeLinecap="round"/>
 </g>}
function PineRootHair(){return <g>
 <PlantWall rough/>
 <Vacuole/>
 <path d="M403 125Q437 80 456 77Q477 90 456 113Q447 144 410 159" fill="#e2efc9" stroke="#72996d" strokeWidth="10"/>
 <path d="M406 127Q437 96 456 96" fill="none" stroke="#b5d5bb" strokeWidth="4"/>
 <Core cx={126} cy={200} rx={22} ry={16}/>
 <path d="M409 122q14-6 27-13" stroke="#9ec5a0" strokeWidth="4" fill="none"/>
 </g>}
function PineMicrosporocyte(){return <g>
 <circle cx="182" cy="166" r="106" fill="#ead6b1" stroke="#ae9974" strokeWidth="10"/>
 <circle cx="182" cy="166" r="70" fill="#f0d8d2" stroke="#bb98ab" strokeWidth="5"/>
 <Core cx={182} cy={166} rx={36} ry={33}/>
 <path d="M291 165h37m-10-11 11 11-11 11" stroke="#8aa892" strokeWidth="6" strokeLinecap="round" fill="none"/>
 {[[367,107],[412,107],[367,212],[412,212]].map(([x,y],i)=><g key={i}>
  <circle cx={x} cy={y} r="22" fill="#e2d6ae" stroke="#a69e7b" strokeWidth="5"/>
  <circle cx={x} cy={y} r="10" fill={nuclear}/>
 </g>)}
 <text x="166" y="43" fill="#866a7d" fontSize="14" fontWeight="800">2n</text>
 <text x="384" y="167" fill="#5c9274" fontSize="14" fontWeight="800">n</text>
 <text x="335" y="282" fill="#7c8875" fontSize="11">Следующий этап</text>
 </g>}
function FernMesophyll(){return <g><PlantWall rough/><Vacuole/><Chloroplasts count={13} shift={.8}/>
 <Core cx={121} cy={185} rx={21} ry={15}/>
 <path d="M116 82q124 15 267 7" fill="none" stroke="#aac98b" strokeWidth="3" strokeDasharray="6 11"/>
 </g>}
function FernRootCortex(){return <g>
 <PlantWall fill="#f1e5c7" rough/>
 <ellipse cx="248" cy="176" rx="109" ry="74" fill="#c7e0d9" stroke="#abcfc0" strokeWidth="4"/>
 <path d="M99 102Q113 161 99 231" stroke="#d7cba7" strokeWidth="5" fill="none"/>
 <Core cx={127} cy={201} rx={24} ry={17}/>
 {Array.from({length:7},(_,i)=><circle key={i} cx={155+i*28} cy={113+i%2*7} r="4" fill="#c4a87f"/>)}
 </g>}
function WheatMesophyll(){return <g>
 <path d="M82 79Q161 60 202 76Q315 52 408 81Q430 132 407 239Q349 264 288 252Q180 277 93 238Q74 165 82 79Z"
  fill="#d9ebb5" stroke="#739767" strokeWidth="13"/>
 <path d="M104 102Q163 85 214 102Q320 86 387 103Q408 151 386 225Q309 246 238 229Q178 252 114 222Z"
  fill="#edf5d6" stroke="#a0be83" strokeWidth="4"/>
 <ellipse cx="247" cy="174" rx="93" ry="66" fill="#c0ded7" stroke="#8ebbb0" strokeWidth="4"/>
 {Array.from({length:15},(_,i)=>{const theta=i*2.399+.2;const x=248+Math.cos(theta)*124,y=174+Math.sin(theta)*61;
  return <ellipse key={i} cx={x} cy={y} rx="17" ry="9" fill={green} stroke="#4d8c59" strokeWidth="3"
   transform={`rotate(${theta*180/Math.PI} ${x} ${y})`}/>;
 })}
 <Core cx={120} cy={207} rx={19} ry={13}/>
 </g>}
function WheatRootHair(){return <g>
 <PlantWall fill="#dbe8c6"/>
 <Vacuole/><Core cx={131} cy={190} rx={23} ry={16}/>
 <path d="M405 101Q435 53 457 46Q478 56 458 81Q437 127 414 148"
  fill="#e4f2c8" stroke="#71996b" strokeWidth="11"/>
 <path d="M413 112Q438 67 457 63" stroke="#a4c8ae" strokeWidth="3.5" fill="none"/>
 <path d="M68 255q40 16 80 0" stroke="#b6cda3" strokeWidth="5" fill="none"/>
 </g>}
const drawings:Record<BioExtraCellKind,()=>ReactNode>={
 "sparrow-keratinocyte":SparrowKeratinocyte,"sparrow-cone":SparrowCone,
 "perch-hair":PerchHair,"perch-cardiomyocyte":PerchCardiomyocyte,
 "frog-lung-epithelium":FrogLungEpithelium,"frog-rod":FrogRod,
 "bee-tracheal-epithelium":BeeTrachea,"bee-fiber":BeeFiber,
 "snail-photoreceptor":SnailPhotoreceptor,"snail-mantle-epithelium":SnailMantle,
 "pine-root-hair":PineRootHair,"pine-microsporocyte":PineMicrosporocyte,
 "fern-mesophyll":FernMesophyll,"fern-root-cortex":FernRootCortex,
 "wheat-mesophyll":WheatMesophyll,"wheat-root-hair":WheatRootHair
};
export default function LektrusBioAdditionalCellArt({kind}:{kind:BioExtraCellKind}):ReactNode{
 const Picture=drawings[kind];
 return <g className="lektrus-bio-extra-cell-art" data-bio-extra-cell-art={kind}>
  <Picture/>
 </g>;
}
