/** Schematic, offline SVG plates for eight additional biological specimens.
 * All coordinates are explanatory, not optical scale or anatomical measurements.
 * The specimen silhouette and the organ/tissue/cell scenes are deliberately
 * different for fish, insects, birds, molluscs, ferns and seed plants.
 */
import type {ReactNode} from "react";
import LektrusBioDetailedExtraSpecies from "./LektrusBioDetailedExtraSpecies";
import type {BioNode,BioOrganism,BioVisualKey} from "./lektrusBioMicroscopeModel";
import {bioVisualKey} from "./lektrusBioMicroscopeModel";
const green="#4a8066",dark="#385c50",gold="#d1aa56",pink="#b87079";
const extraSpecies=new Set<BioOrganism>(["sparrow","perch","frog","bee","snail","pine","fern","wheat"]);
function Shell({organism}:{organism:BioOrganism}):ReactNode{
 return <LektrusBioDetailedExtraSpecies organism={organism}/>;
}
function Structure({organism,keyName}:{organism:BioOrganism;keyName:BioVisualKey}):ReactNode{
 if(keyName==="gills")return <g>
  <path d="M127 61Q95 154 136 268" stroke="#ba717f" strokeWidth="29" fill="none" strokeLinecap="round"/>
  {Array.from({length:10},(_,i)=>{const y=76+i*18;return <g key={i}>
   <path d={`M133 ${y}Q250 ${y-24} 360 ${y-4}`} stroke="#d68b91" strokeWidth="11" fill="none" strokeLinecap="round"/>
   {Array.from({length:7},(_,j)=><path key={j} d={`M${167+j*27} ${y-9}v15`} stroke="#a65f7a" strokeWidth="3"/>)}
  </g>})}
 </g>;
 if(keyName==="lateral-line")return <g>
  <path d="M61 143Q220 102 420 157" stroke="#79aaa1" strokeWidth="23" fill="none" strokeLinecap="round"/>
  {Array.from({length:8},(_,i)=><g key={i} transform={`translate(${89+i*43} ${138+17*Math.sin(i*.4)})`}>
   <circle r="18" fill="#d7eee3" stroke="#598c7e" strokeWidth="4"/>
   <path d="M-7 5q-6-28 -11-28m18 28v-37M7 5q9-27 18-27" stroke="#638e9f" strokeWidth="3" fill="none"/>
  </g>)}
 </g>;
 if(keyName==="trachea")return <g>
  <path d="M91 161H382M200 161Q163 100 204 53M273 161Q316 100 315 61M200 163Q165 229 186 285M295 162Q328 233 359 275" stroke="#c3a16e" strokeWidth="28" strokeLinecap="round" fill="none"/>
  {Array.from({length:8},(_,i)=><path key={i} d={`M${115+i*33} 144v34`} stroke="#9e7c53" strokeWidth="4"/>)}
 </g>;
 if(keyName==="compound-eye")return <g>
  <ellipse cx="239" cy="162" rx="139" ry="118" fill="#c6d4b0" stroke="#608674" strokeWidth="7"/>
  {Array.from({length:7},(_,r)=>Array.from({length:8},(_,i)=>{const xx=128+i*31+r%2*15,yy=60+r*33;
   return <path key={r+"-"+i} d={`M${xx} ${yy-13}l14 8v16l-14 8-14-8v-16Z`} fill={r%2?"#7aa5a0":"#90bbb0"} stroke="#507e7e" strokeWidth="2"/>;
  }))}
 </g>;
 if(keyName==="foot")return <g>
  <path d="M42 224Q164 105 294 153Q378 171 432 239Q266 302 43 255Z" fill="#d9b392" stroke="#a78170" strokeWidth="7"/>
  {Array.from({length:8},(_,i)=><path key={i} d={`M${72+i*40} 211q38-18 86 28`} stroke="#c18f83" strokeWidth="5" fill="none"/>)}
 </g>;
 if(keyName==="mantle")return <g>
  <path d="M73 263Q90 64 235 47Q373 52 417 263" stroke="#ad9077" strokeWidth="30" fill="none"/>
  <path d="M95 259Q128 109 243 95Q350 110 396 259" stroke="#dbb9a7" strokeWidth="14" fill="none"/>
  {Array.from({length:8},(_,i)=><circle key={i} cx={137+i*27} cy={206+18*Math.sin(i*.75)} r="7" fill="#b65e76"/>)}
 </g>;
 if(keyName==="needle")return <g>
  <path d="M85 260Q157 159 291 62Q271 182 107 274Z" fill="#72a578" stroke={green} strokeWidth="8"/>
  <path d="M100 263L286 67" stroke="#bed7a2" strokeWidth="6"/>
  {Array.from({length:8},(_,i)=><path key={i} d={`M${128+i*18} ${224-i*18}l-30 -16`} stroke="#4c8264" strokeWidth="3"/>)}
  <ellipse cx="350" cy="214" rx="69" ry="48" fill="#d4e6ac" stroke="#729c79" strokeWidth="5"/>
  <ellipse cx="351" cy="216" rx="27" ry="22" fill="#88b68c" stroke="#508b6c" strokeWidth="4"/>
 </g>;
 if(keyName==="microsporangium"||keyName==="sporangium")return <g>
  <path d="M164 70Q237 24 317 73Q365 188 242 278Q125 214 164 70Z" fill="#d8bb81" stroke="#977952" strokeWidth="8"/>
  <path d="M167 91Q240 60 310 93" fill="none" stroke="#aa8852" strokeWidth="12"/>
  {Array.from({length:18},(_,i)=>{const ang=i*2.399,r=17+11*Math.sqrt(i),xx=241+Math.cos(ang)*r,yy=164+Math.sin(ang)*r;
   return <circle key={i} cx={xx} cy={yy} r="10" fill={keyName==="sporangium"?"#be9669":"#e0cd82"} stroke="#9c7b5a" strokeWidth="2"/>;
  })}
 </g>;
 if(keyName==="frond")return <g transform="translate(18 0)"><path d="M230 297Q228 170 244 37" stroke={green} strokeWidth="10" fill="none"/>
  {Array.from({length:9},(_,i)=>{const y=55+i*24,s=52+i*8;return <g key={i}>
   <path d={`M240 ${y}Q${240-s} ${y-52} ${240-s} ${y-17}Q${240-s*.7} ${y+8} 240 ${y}`} fill="#79af7e" stroke="#4e8a64" strokeWidth="3"/>
   <path d={`M240 ${y}Q${240+s} ${y-52} ${240+s} ${y-17}Q${240+s*.7} ${y+8} 240 ${y}`} fill="#79af7e" stroke="#4e8a64" strokeWidth="3"/>
  </g>})}</g>;
 if(keyName==="anther")return <g>
  <path d="M240 270V82" stroke={green} strokeWidth="9"/>
  <ellipse cx="191" cy="139" rx="42" ry="89" fill="#dab76f" stroke="#9f8145" strokeWidth="6"/>
  <ellipse cx="286" cy="139" rx="42" ry="89" fill="#dab76f" stroke="#9f8145" strokeWidth="6"/>
  {Array.from({length:10},(_,i)=><circle key={i} cx={173+(i%3)*18} cy={86+Math.floor(i/3)*29} r="5" fill="#f4dfab"/>)}
 </g>;
 if(keyName==="skin")return <g>
  <rect x="72" y="72" width="337" height="103" rx="13" fill="#d5bb9b" stroke="#a17f75" strokeWidth="5"/>
  <rect x="72" y="175" width="337" height="92" rx="13" fill="#edbaaa" stroke="#c18c83" strokeWidth="5"/>
  {Array.from({length:11},(_,i)=><ellipse key={i} cx={93+i*29} cy={139-i%2*13} rx="13" ry="21" fill="#ead9c4" stroke="#c69f8b" strokeWidth="2"/>)}
 </g>;
 if(keyName==="lungs"&&organism==="sparrow")return <g>
  {Array.from({length:5},(_,i)=><path key={i} d={`M95 ${91+i*36}H380`} stroke="#c98b94" strokeWidth="22" fill="none" strokeLinecap="round"/>)}
  {Array.from({length:11},(_,i)=><path key={i} d={`M${115+i*25} 71v198`} stroke="#ecc7bf" strokeWidth="5" fill="none" strokeDasharray="8 9"/>)}
 </g>;
 if(keyName==="lungs"&&organism==="frog")return <g>
  <ellipse cx="164" cy="161" rx="80" ry="107" fill="#e5b2aa" stroke="#b97b7f" strokeWidth="6"/>
  <ellipse cx="318" cy="161" rx="80" ry="107" fill="#e5b2aa" stroke="#b97b7f" strokeWidth="6"/>
  {Array.from({length:5},(_,i)=><path key={i} d={`M${98+i*20} 83q-19 81 9 157M${270+i*20} 83q-19 81 9 157`} stroke="#be8780" fill="none" strokeWidth="3"/>)}
 </g>;
 if(keyName==="heart")return <g>
  <ellipse cx="234" cy="171" rx="92" ry="107" fill="#d48e97" stroke="#925a66" strokeWidth="7"/>
  <path d="M235 69V273M145 156H319" stroke="#a8646a" strokeWidth="8"/>
 </g>;
 if(keyName==="eye")return <g>
  <ellipse cx="240" cy="167" rx="135" ry="104" fill="#eae9c4" stroke="#a2a07b" strokeWidth="8"/>
  <circle cx="244" cy="166" r="76" fill="#a8bea5" stroke="#69877c" strokeWidth="8"/>
  <circle cx="245" cy="166" r="31" fill="#304d46"/><circle cx="261" cy="146" r="9" fill="#fff"/>
 </g>;
 if(keyName==="muscle")return <g>
  <path d="M65 94H416V248H65Z" fill="#dba09a" stroke="#a87872" strokeWidth="7"/>
  {Array.from({length:14},(_,i)=><path key={i} d={`M${81+i*24} 95v152`} stroke={i%2?"#b4777a":"#efc0b1"} strokeWidth="9"/>)}
 </g>;
 if(keyName==="root")return <g stroke="#ab9166" fill="none" strokeLinecap="round">
  <path d="M239 44Q237 194 243 290" strokeWidth="16"/>
  <path d="M239 154L152 236M246 194L336 258M238 226L191 305" strokeWidth="8"/>
 </g>;
 return <g>
  <ellipse cx="240" cy="166" rx="140" ry="100" fill="#a4c69c" stroke="#59856d" strokeWidth="7"/>
  <path d="M112 173Q250 71 365 170" stroke="#629477" strokeWidth="9" fill="none"/>
 </g>;
}
function Tissue({keyName}:{keyName:BioVisualKey}):ReactNode{
 const plant=["needle","frond","sporangium","microsporangium","anther","leaf","root"].includes(keyName);
 const cellFill=plant?"#d9ebbb":"#f2d6cd",stroke=plant?"#85a572":"#c59693";
 return <g>
  <rect x="48" y="46" width="384" height="240" rx="23" fill={plant?"#f3f9e4":"#fbf3e8"} stroke={stroke} strokeWidth="6"/>
  {Array.from({length:4},(_,r)=>Array.from({length:7},(_,i)=>{
   const xx=64+i*51,yy=61+r*55;
   return <g key={r+"-"+i}>
    {plant?<rect x={xx} y={yy} width="45" height="47" rx="8" fill={cellFill} stroke={stroke} strokeWidth="2"/>:
     <ellipse cx={xx+23} cy={yy+23} rx="22" ry="20" fill={cellFill} stroke={stroke} strokeWidth="2"/>}
    {["needle","frond","leaf"].includes(keyName)?<><circle cx={xx+12} cy={yy+17} r="5" fill="#68a06a"/><circle cx={xx+35} cy={yy+29} r="5" fill="#68a06a"/></>:
     <ellipse cx={xx+23} cy={yy+23} rx="7" ry="9" fill={plant?"#baa6bf":"#c0a2bb"}/>}
    {["gills","lungs","trachea","skin"].includes(keyName)&&<path d={`M${xx+2} ${yy+5}h41`} stroke={keyName==="trachea"?"#b99a6d":"#b97683"} strokeWidth="4"/>}
   </g>;
  }))}
  {keyName==="lateral-line"&&<path d="M84 86Q115 22 148 88M189 86Q224 23 253 88M300 86Q338 22 376 88" stroke="#6c9e95" strokeWidth="6" fill="none"/>}
 </g>;
}
function Cell({keyName}:{keyName:BioVisualKey}):ReactNode{
 const plant=["needle","frond","sporangium","microsporangium","anther","leaf","root"].includes(keyName);
 const gamete=keyName==="sporangium"||keyName==="microsporangium"||keyName==="anther";
 const photoreceptor=keyName==="eye"||keyName==="compound-eye";
 const nerve=keyName==="lateral-line";
 if(photoreceptor)return <g>
  <rect x="179" y="45" width="122" height="147" rx="32" fill="#a8d3d8" stroke="#709ca6" strokeWidth="7"/>
  {Array.from({length:8},(_,i)=><path key={i} d={`M191 ${61+i*16}H286`} stroke="#74a2ad" strokeWidth="5"/>)}
  <ellipse cx="238" cy="211" rx="63" ry="42" fill="#eedfc5" stroke="#c4ad9c" strokeWidth="6"/>
  <ellipse cx="238" cy="210" rx="24" ry="17" fill="#b79ac0"/>
  <path d="M238 253V298" stroke="#b8a38b" strokeWidth="14"/>
 </g>;
 if(nerve)return <g>
  <rect x="180" y="123" width="121" height="141" rx="38" fill="#d8c6cb" stroke="#ae96a8" strokeWidth="6"/>
  <ellipse cx="243" cy="212" rx="26" ry="20" fill="#ba9fbd"/>
  {Array.from({length:8},(_,i)=><path key={i} d={`M${208+i*10} 126q${i%2?8:-8} -49 ${i%2?8:-8} -89`} stroke="#78a8a5" strokeWidth="5" fill="none" strokeLinecap="round"/>)}
 </g>;
 if(keyName==="gills"||keyName==="lungs"||keyName==="trachea"||keyName==="mantle")return <g>
  <path d="M41 181Q138 93 231 171Q334 237 441 120" stroke="#e0b0b1" strokeWidth="40" strokeLinecap="round" fill="none"/>
  <path d="M42 181Q138 93 231 171Q334 237 441 120" stroke="#fff4ea" strokeWidth="15" strokeLinecap="round" fill="none"/>
  <ellipse cx="233" cy="176" rx="28" ry="16" transform="rotate(37 233 176)" fill="#b99ac0" stroke="#9f7fa5" strokeWidth="3"/>
  <path d="M42 268Q181 236 254 281Q359 314 441 250" stroke={pink} strokeWidth="11" fill="none" strokeLinecap="round"/>
  {keyName==="trachea"&&<path d="M56 155Q138 80 231 148Q334 215 429 98" stroke={gold} strokeWidth="5" fill="none" strokeDasharray="8 7"/>}
 </g>;
 if(keyName==="foot"||keyName==="muscle")return <g>
  <path d="M58 115Q196 63 420 112V231Q212 288 58 226Z" fill="#e4aeac" stroke="#ad7b79" strokeWidth="7"/>
  {Array.from({length:12},(_,i)=><path key={i} d={`M${76+i*29} 111V231`} stroke={keyName==="muscle"?"#bb797a":"#d39f9d"} strokeWidth={keyName==="muscle"?7:4}/>)}
  <ellipse cx="253" cy="188" rx="37" ry="13" fill="#ad93b0"/>
 </g>;
 if(gamete)return <g>
  <circle cx="239" cy="166" r="113" fill="#e8d4ab" stroke="#bc9968" strokeWidth="13"/>
  <ellipse cx="239" cy="162" rx="64" ry="59" fill="#edd5d0" stroke="#b58da3" strokeWidth="6"/>
  <circle cx="238" cy="158" r="30" fill="#b79ab7"/>
  <circle cx="227" cy="155" r="8" fill="#8b759f"/>
  <text x="240" y="304" textAnchor="middle" fontSize="15" fill={dark}>Материнская клетка спор</text>
 </g>;
 if(plant)return <g>
  <rect x="79" y="47" width="322" height="250" rx="34" fill="#e1eec9" stroke="#7fa06e" strokeWidth="14"/>
  <rect x="96" y="65" width="289" height="211" rx="29" fill="#eef7db" stroke="#a2bf89" strokeWidth="3"/>
  <ellipse cx="258" cy="171" rx="85" ry="73" fill="#cce2e9" stroke="#9cbfc4" strokeWidth="3"/>
  <circle cx="144" cy="171" r="29" fill="#d3b2cf" stroke="#9d85a7" strokeWidth="4"/>
  {Array.from({length:11},(_,i)=><ellipse key={i} cx={116+(i%4)*79} cy={99+Math.floor(i/4)*73} rx="14" ry="8" fill="#74a96d" stroke="#4d865b" strokeWidth="2"/>)}
  {keyName==="root"&&<path d="M80 187Q39 179 19 226" stroke="#a9b57a" strokeWidth="11" fill="none"/>}
 </g>;
 return <g>
  <path d="M66 175Q56 58 234 66Q424 51 418 181Q424 295 233 279Q70 298 66 175Z" fill="#f4dccd" stroke="#bd9a92" strokeWidth="7"/>
  <ellipse cx="244" cy="172" rx="71" ry="61" fill="#c5b0d1" stroke="#9b85b2" strokeWidth="5"/>
  <circle cx="242" cy="171" r="24" fill="#9b7fb0"/>
  {Array.from({length:5},(_,i)=><ellipse key={i} cx={118+i*62} cy={i%2?246:98} rx="19" ry="10" fill="#d8b59f"/>)}
 </g>;
}
export default function LektrusBioSpeciesArt({organism,node}:{organism:BioOrganism;node:BioNode}):ReactNode{
 if(!extraSpecies.has(organism))return null;
 const keyName=bioVisualKey(node);
 if(node.level==="organism")return <Shell organism={organism}/>;
 if(node.level==="system")return <g>
  <g opacity=".22"><Shell organism={organism}/></g>
  <g transform="translate(145 70) scale(.40)"><Structure organism={organism} keyName={keyName}/></g>
 </g>;
 if(node.level==="organ")return <Structure organism={organism} keyName={keyName}/>;
 if(node.level==="tissue")return <Tissue keyName={keyName}/>;
 return <Cell keyName={keyName}/>;
}
