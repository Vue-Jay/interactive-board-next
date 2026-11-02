/** Eleven individual, offline SVG teaching plates for selected biological
 * structures. Shapes are schematics; no invented microscope magnification.
 * Landmarks are supplied by lektrusBioHistologyModel and drawn on the true
 * illustrated substructure. */
import type {ReactNode} from "react";
import {bioHistologyFor,type BioHistologyPlateId} from "./lektrusBioHistologyModel";
type LabelProps={x:number;y:number;toX:number;toY:number;label:string;align?:"start"|"end"};
const aqua="#74b9bb",dark="#315a52",plum="#a487b0";
function Callout({x,y,toX,toY,label,align="start"}:LabelProps){
 return <g className="lektrus-bio-histology-label" pointerEvents="none">
  <path d={`M${toX} ${toY}L${x} ${y-5}`} fill="none" stroke="#517a72" strokeWidth="1.8" strokeDasharray="3 3"/>
  <circle cx={toX} cy={toY} r="3.2" fill="#518a72" stroke="#fff" strokeWidth="1"/>
  <text x={x} y={y} fill={dark} textAnchor={align} fontSize="12" fontWeight="700">{label}</text>
 </g>;
}
function Choanocyte({x=240,y=211,scale=1}:{x?:number;y?:number;scale?:number}){
 return <g transform={`translate(${x} ${y}) scale(${scale})`}>
  <path d="M-38 12Q-59-14-33-53Q-7-76 27-55Q56-28 40 14Q28 60-1 63Q-36 52-38 12Z"
   fill="#e9cbaf" stroke="#9d806a" strokeWidth="6"/>
  <ellipse cx="-5" cy="20" rx="19" ry="16" fill={plum} stroke="#8d72a0" strokeWidth="2"/>
  <path d="M0-53Q-15-104 4-167" fill="none" stroke="#4d9aa3" strokeWidth="7" strokeLinecap="round"/>
  {Array.from({length:13},(_,i)=>{
   const xx=-39+i*6.5;
   return <path key={i} d={`M${xx} -48Q${xx-5} -83 ${xx-2} -101`} fill="none"
    stroke="#7fae8e" strokeWidth="3.4" strokeLinecap="round"/>;
  })}
  {Array.from({length:4},(_,i)=><ellipse key={i} cx={-19+i*12} cy={-14+i%2*16}
   rx="8" ry="4.4" fill="#d39a6f" opacity=".8"/>)}
 </g>;
}
function SpongeChamber(){return <g>
 <circle cx="240" cy="172" r="132" fill="#c8e0c2" stroke="#789c7b" strokeWidth="10"/>
 <circle cx="240" cy="172" r="90" fill="#e9f7ef" stroke="#8bb6a3" strokeWidth="6"/>
 {Array.from({length:10},(_,i)=>{
  const angle=i*Math.PI/5;
  const x=240+Math.cos(angle)*114,y=172+Math.sin(angle)*114;
  return <g key={i} transform={`translate(${x} ${y}) rotate(${angle*180/Math.PI+90})`}>
   <path d="M-23 0Q-22-29 0-26Q22-29 23 0Q18 31 0 31Q-18 31-23 0Z"
    fill="#dfb698" stroke="#9b7c70" strokeWidth="3"/>
   <ellipse cx="0" cy="4" rx="8" ry="6" fill="#b798b5"/>
   <path d="M0-24Q-11-52 5-73" stroke={aqua} fill="none" strokeWidth="4" strokeLinecap="round"/>
   {[-12,-6,0,6,12].map(v=><path key={v} d={`M${v} -20v-23`} stroke="#72a78d" strokeWidth="2.4"/>)}
  </g>;
 })}
 <path d="M239 260Q217 206 238 112" stroke="#80bdc6" fill="none" strokeWidth="3" strokeDasharray="6 7"/>
 <path d="M238 111l-10 17m10-17 9 17" stroke="#80bdc6" strokeWidth="4" fill="none"/>
 <Callout x={18} y={37} toX={167} toY={115} label="Хоаноциты"/>
 <Callout x={465} y={322} toX={236} toY={158} label="Просвет камеры" align="end"/>
 </g>}
function SingleChoanocyte(){return <g>
 <path d="M117 269Q128 231 175 226L304 227Q355 233 366 269Z" fill="#bbd7be" opacity=".65"/>
 <Choanocyte x={241} y={212} scale={1.44}/>
 <path d="M88 42Q111 75 135 83" stroke="#8cc9c4" fill="none" strokeWidth="4" strokeDasharray="4 8"/>
 {Array.from({length:6},(_,i)=><circle key={i} cx={106+i*37} cy={66+(i%3)*16}
  r={3+i%3} fill="#ae945f"/>)}
 <Callout x={15} y={296} toX={196} toY={210} label="Тело клетки"/>
 <Callout x={462} y={284} toX={239} toY={240} label="Ядро" align="end"/>
 <Callout x={18} y={65} toX={181} toY={151} label="Воротничок"/>
 </g>}
function SpongeMesohyl(){return <g>
 <rect x="46" y="51" width="391" height="239" rx="31" fill="#dce4c9" stroke="#a0b28e" strokeWidth="7"/>
 {Array.from({length:30},(_,i)=>{
  const x=67+(i*79)%345,y=75+(i*53)%185;
  return <path key={i} d={`M${x} ${y}q17-14 35 3`} stroke="#b6a67f" strokeWidth="3" opacity=".67" fill="none"/>;
 })}
 {[[-100,-61],[90,-76],[-125,68],[122,55]].map(([x,y],i)=>
  <g key={i} transform={`translate(${240+x} ${171+y})`}>
   <path d="M-25-3Q-14-24 0-18Q25-27 28-2Q21 26-7 19Q-28 10-25-3Z" fill="#c5ac9c" stroke="#8d887e" strokeWidth="4"/>
   <circle r="9" fill="#b699b9"/>
  </g>)}
 <path d="M174 169Q163 127 201 125Q226 105 243 139Q278 122 304 145Q322 165 297 191Q300 229 266 225Q233 246 214 218Q173 225 168 199Z"
  fill="#d49e91" stroke="#a27677" strokeWidth="6"/>
 <ellipse cx="244" cy="177" rx="35" ry="25" fill={plum} stroke="#816c9c" strokeWidth="4"/>
 <path d="M62 287L120 263" stroke="#b19c79" strokeWidth="8" strokeLinecap="round"/>
 <Callout x={19} y={36} toX={198} toY={89} label="Мезохил"/>
 <Callout x={466} y={305} toX={244} toY={181} label="Амёбоцит" align="end"/>
 </g>}
function HydraCnidocyte(){return <g>
 <path d="M151 286Q103 190 152 104Q206 35 277 69Q363 94 346 204Q326 290 254 294Z"
  fill="#e8c1b8" stroke="#aa8183" strokeWidth="8"/>
 <ellipse cx="263" cy="161" rx="85" ry="92" fill="#f8e6cc" stroke="#be9a9c" strokeWidth="6"/>
 <ellipse cx="254" cy="162" rx="57" ry="68" fill="#ebd0be" stroke="#aa8291" strokeWidth="5"/>
 <path d="M254 112Q207 127 256 152Q308 175 244 196Q211 217 256 227"
  stroke="#946c98" strokeWidth="10" strokeLinecap="round" fill="none"/>
 <path d="M255 71V28" stroke="#7a829c" strokeWidth="8" strokeLinecap="round"/>
 <circle cx="255" cy="72" r="11" fill="#8e79a9" stroke="#654f83" strokeWidth="3"/>
 <ellipse cx="196" cy="243" rx="25" ry="20" fill="#bd9ab6" stroke="#947b98" strokeWidth="3"/>
 <Callout x={19} y={40} toX={249} toY={72} label="Чувствительный отросток"/>
 <Callout x={466} y={307} toX={256} toY={175} label="Капсула нематоцисты" align="end"/>
 </g>}
function HydraGastrodermis(){return <g>
 <rect x="45" y="58" width="390" height="252" rx="22" fill="#e5d0b5" stroke="#a8937e" strokeWidth="7"/>
 <path d="M66 68H413V117Q380 137 347 116Q305 143 267 119Q218 143 180 114Q121 140 66 118Z"
  fill="#f7eaca" stroke="#b39388" strokeWidth="6"/>
 {Array.from({length:6},(_,i)=>{const x=74+i*56;return <g key={i}>
  <path d={`M${x} 126Q${x-19} 183 ${x} 275Q${x+31} 288 ${x+45} 268V128Z`}
   fill={i%2?"#e5b2a2":"#f0beaa"} stroke="#ba8e80" strokeWidth="3"/>
  <ellipse cx={x+19} cy="190" rx="13" ry="18" fill="#b39ab7" />
  {Array.from({length:4},(_,j)=><path key={j} d={`M${x+5+j*9} 129v-20`}
   stroke="#c79185" strokeWidth="3"/>)}
 </g>})}
 {Array.from({length:12},(_,i)=><circle key={i} cx={98+(i*67)%290} cy={89+i%3*8} r="4" fill="#c2a16b"/>)}
 <Callout x={18} y={33} toX={230} toY={103} label="Пищеварительная полость"/>
 <Callout x={460} y={320} toX={240} toY={175} label="Клетки гастродермы" align="end"/>
 </g>}
function MossLamella(){return <g>
 <path d="M48 269Q236 303 431 269L431 294Q240 317 48 294Z"
  fill="#9cad6f" stroke="#709065" strokeWidth="7"/>
 {Array.from({length:11},(_,i)=>{const x=71+i*33;return <g key={i}>
  {Array.from({length:5},(_,j)=>{const y=94+j*36;
   return <g key={j}><rect x={x} y={y} width="28" height="34" rx="5"
    fill={j%2?"#b1d99a":"#c8e4ab"} stroke="#6c986b" strokeWidth="2.5"/>
   <ellipse cx={x+8} cy={y+12} rx="5" ry="3.5" fill="#438854"/>
   <ellipse cx={x+20} cy={y+24} rx="5.5" ry="3.5" fill="#438854"/>
   </g>})}
  <rect x={x-1} y="77" width="30" height="24" rx="12" fill="#d4e5ae" stroke="#64916e" strokeWidth="3"/>
 </g>})}
 <Callout x={17} y={40} toX={105} toY={90} label="Верхушки ламелл"/>
 <Callout x={460} y={316} toX={241} toY={278} label="Основание листовидного органа" align="end"/>
 </g>}
function MossCapsule(){return <g>
 <path d="M238 318V275" stroke="#9b8661" strokeWidth="16" strokeLinecap="round"/>
 <path d="M162 66Q192 31 242 33Q295 27 325 74Q359 157 306 259Q263 296 209 271Q125 227 154 113Z"
  fill="#ceba8b" stroke="#987f60" strokeWidth="9"/>
 <path d="M188 91Q242 65 294 91L297 227Q238 259 184 221Z"
  fill="#f1dca8" stroke="#ad9b72" strokeWidth="5"/>
 <path d="M230 85Q221 152 230 232M254 85Q262 161 257 231" stroke="#bc9b75" strokeWidth="7" fill="none"/>
 {Array.from({length:19},(_,i)=>{const angle=i*2.399,r=Math.sqrt(i)*13;return <circle key={i}
   cx={245+Math.cos(angle)*r} cy={171+Math.sin(angle)*r} r={6+i%3}
   fill={i%3?"#bfaa74":"#d6b995"} stroke="#a48b67" strokeWidth="1.8"/>;
 })}
 <path d="M169 61Q246 5 316 60" stroke="#a18956" strokeWidth="11" fill="none" strokeLinecap="round"/>
 <Callout x={17} y={36} toX={238} toY={55} label="Крышечка"/>
 <Callout x={468} y={311} toX={244} toY={178} label="Спорогенная область" align="end"/>
 </g>}
function ChlamyChloroplast(){return <g>
 <ellipse cx="241" cy="172" rx="143" ry="126" fill="#cae5b1" stroke="#72956d" strokeWidth="10"/>
 <path d="M130 123Q117 248 242 271Q362 250 354 127Q322 197 240 216Q166 201 130 123"
  fill="#73b37a" stroke="#458d62" strokeWidth="6"/>
 {Array.from({length:11},(_,i)=>{
  const x=157+i%4*55,y=166+Math.floor(i/4)*32;
  return <g key={i} transform={`rotate(${i%2?-15:20} ${x} ${y})`}>
   <rect x={x-18} y={y-7} width="39" height="16" rx="8" fill="#4b965c" stroke="#2b7551" strokeWidth="2"/>
   <path d={`M${x-14} ${y-2}h29m-29 7h29`} stroke="#b0d597" strokeWidth="2"/>
  </g>;
 })}
 <ellipse cx="257" cy="185" rx="34" ry="29" fill="#d6dfad" stroke="#698e67" strokeWidth="6"/>
 <circle cx="258" cy="184" r="13" fill="#bca69a" stroke="#8c8981" strokeWidth="2"/>
 <path d="M196 188l20 13m64-14 22-14" stroke="#bcd897" strokeWidth="4"/>
 <Callout x={21} y={30} toX={164} toY={217} label="Тилакоиды"/>
 <Callout x={462} y={317} toX={255} toY={188} label="Пиреноид" align="end"/>
 </g>}
function ChlamyEyespot(){return <g>
 <path d="M65 251Q131 68 248 81Q370 93 415 252"
  stroke="#8bc18b" strokeWidth="65" fill="none" strokeLinecap="round"/>
 <path d="M66 253Q135 94 247 112Q355 126 411 250" stroke="#cfe6ae" strokeWidth="33" fill="none"/>
 {Array.from({length:3},(_,row)=>Array.from({length:9},(_,i)=>{
  const x=118+i*30,y=154+row*30+(i%2)*7;
  return <g key={row+"-"+i}>
   <ellipse cx={x} cy={y} rx="13" ry="9" fill={row%2?"#da8a3f":"#e8a45b"} stroke="#ae6d3a" strokeWidth="2.5"/>
   <path d={`M${x-8} ${y-2}h15`} stroke="#f4c789" strokeWidth="2"/>
  </g>;
 }))}
 <path d="M92 257Q241 272 391 250" stroke="#609487" strokeWidth="6" fill="none"/>
 <Callout x={17} y={32} toX={194} toY={159} label="Пигментные гранулы"/>
 <Callout x={462} y={312} toX={302} toY={251} label="Мембранные структуры" align="end"/>
 </g>}
function SpirogyraCell(){return <g>
 <rect x="80" y="60" width="321" height="236" rx="18" fill="#cce8b0" stroke="#6d956c" strokeWidth="11"/>
 <rect x="99" y="80" width="283" height="197" rx="13" fill="#e5f3c8" stroke="#b0d299" strokeWidth="4"/>
 <ellipse cx="238" cy="174" rx="102" ry="75" fill="#c6e0d3" opacity=".48"/>
 <path d="M108 138Q178 77 260 117Q370 172 281 236Q196 276 129 209Q99 164 171 134Q244 103 306 151Q349 197 282 212Q215 237 171 190"
  stroke="#4e9d68" strokeWidth="21" strokeLinecap="round" fill="none"/>
 <path d="M108 138Q178 77 260 117Q370 172 281 236Q196 276 129 209Q99 164 171 134Q244 103 306 151Q349 197 282 212Q215 237 171 190"
  stroke="#b4dd9a" strokeWidth="4" fill="none" strokeDasharray="9 12"/>
 {Array.from({length:7},(_,i)=><circle key={i} cx={144+(i*31)%185} cy={129+(i%3)*29}
  r="6" fill="#3a814f" stroke="#d2e9af" strokeWidth="2"/>)}
 <path d="M235 173L168 107M235 173L311 233M235 173L242 89" stroke="#a7bbb0" strokeWidth="4" fill="none"/>
 <ellipse cx="234" cy="159" rx="34" ry="28" fill="#c4aeca" stroke="#9b87aa" strokeWidth="5"/>
 <circle cx="233" cy="158" r="12" fill="#9478a6"/>
 <Callout x={17} y={32} toX={117} toY={159} label="Клеточная стенка"/>
 <Callout x={465} y={318} toX={313} toY={199} label="Спиральный хлоропласт" align="end"/>
 </g>}
function SpirogyraConjugation(){return <g>
 {Array.from({length:2},(_,i)=>{
  const y=i?200:66;
  return <g key={i}><rect x="52" y={y} width="378" height="68" rx="12"
   fill="#d7ecc1" stroke="#7d9a70" strokeWidth="7"/>
   {Array.from({length:4},(_,j)=><g key={j}>
    {j!==0&&<path d={`M${52+j*94} ${y+4}v61`} stroke="#77a478" strokeWidth="5"/>}
    <path d={`M${61+j*94} ${y+22}q28 -30 60 4q-30 22 -6 31`}
     stroke="#69ad6c" strokeWidth="11" fill="none"/>
    <circle cx={94+j*94} cy={y+36} r="9" fill="#b79cba"/>
   </g>)}
  </g>;
 })}
 <path d="M239 133V201" stroke="#89b38a" strokeWidth="30" strokeLinecap="round" />
 <path d="M239 136V201" stroke="#dfedd0" strokeWidth="12" strokeLinecap="round" />
 <path d="M239 142v42" stroke="#618f7e" strokeDasharray="5 5" strokeWidth="3"/>
 <Callout x={16} y={33} toX={111} toY={96} label="Гаплоидная нить"/>
 <Callout x={465} y={318} toX={246} toY={174} label="Конъюгационная трубка" align="end"/>
 </g>}
export default function LektrusBioHistologyPlate({nodeId}:{nodeId:string}):ReactNode{
 const info=bioHistologyFor(nodeId);
 if(!info)return null;
 const pictures:Record<BioHistologyPlateId,()=>ReactNode>={
  "sponge-chamber":SpongeChamber,
  "sponge-choanocyte":SingleChoanocyte,
  "sponge-mesohyl":SpongeMesohyl,
  "hydra-cnidocyte":HydraCnidocyte,
  "hydra-gastrodermis":HydraGastrodermis,
  "moss-lamella":MossLamella,
  "moss-capsule":MossCapsule,
  "chlamydomonas-chloroplast":ChlamyChloroplast,
  "chlamydomonas-eyespot":ChlamyEyespot,
  "spirogyra-cell":SpirogyraCell,
  "spirogyra-conjugation":SpirogyraConjugation
 };
 const Picture=pictures[info.id];
 return <g data-bio-histology-plate={info.id} className="lektrus-bio-histology-art">
  <Picture/>
 </g>;
}
