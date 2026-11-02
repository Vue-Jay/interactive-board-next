/** Eight distinct, offline, scientifically constrained cellular SVG plates.
 * Click targets refer to actual bioCellFeatures, not invented organelle nodes.
 * All views use explanatory geometry without a physical scale bar.
 */
import type {ReactNode} from "react";
import type {BioNode,BioOrganism} from "./lektrusBioMicroscopeModel";
import {bioCellPlateFor} from "./lektrusBioCellPlates";
const nucleus="#ae91b8",membrane="#a68180",teal="#66a6a6",leaf="#65a06d";
function SparrowCell(){return <g>
 <path d="M34 123Q123 102 178 117Q195 128 213 123Q272 90 310 122Q374 113 448 119L452 172Q393 162 332 175Q297 200 273 198Q223 221 192 191Q146 179 36 177Z"
  fill="#f5d8c7" stroke={membrane} strokeWidth="6"/>
 <path d="M35 184Q132 183 192 200Q232 222 272 211Q333 184 452 185" stroke="#9d9c8b" strokeWidth="8" fill="none"/>
 <ellipse cx="224" cy="164" rx="45" ry="26" fill={nucleus} stroke="#826b9a" strokeWidth="4"/>
 <path d="M35 229Q149 208 216 224Q296 251 452 225" stroke="#d18b8b" strokeWidth="25" fill="none" strokeLinecap="round"/>
 {Array.from({length:8},(_,i)=><ellipse key={i} cx={80+i*45} cy={225+(i%3)*3} rx="13" ry="7" fill="#b86673"/>)}
 <text x="36" y="67" fontSize="13" fill="#507e81" fontWeight="700">Воздух</text>
 <text x="35" y="274" fontSize="13" fill="#a26071" fontWeight="700">Кровь</text>
 </g>}
function PerchCell(){return <g>
 <path d="M50 116Q134 107 214 115T443 116L443 204Q336 195 283 218Q240 227 203 212Q128 198 50 203Z"
  fill="#eed5c6" stroke="#b78d85" strokeWidth="7"/>
 <path d="M51 124Q156 126 242 130T444 124" stroke={teal} strokeWidth="8" fill="none" strokeDasharray="13 10"/>
 <ellipse cx="241" cy="173" rx="43" ry="25" fill={nucleus} stroke="#866e99" strokeWidth="4"/>
 <path d="M51 211Q160 225 235 230T444 211" fill="none" stroke="#a58e93" strokeWidth="6"/>
 <path d="M62 241Q186 253 282 245T434 248" fill="none" stroke="#d58f94" strokeWidth="22"/>
 <text x="50" y="62" fontSize="13" fill="#498b93" fontWeight="700">Вода</text>
 <text x="53" y="292" fontSize="13" fill="#a55f71" fontWeight="700">Капилляр</text>
 </g>}
function FrogCell(){return <g>
 {[-1,0,1].map((i)=><g key={i}>
  <path d={`M${61+i*127} 103Q${108+i*127} 85 ${164+i*127} 110L${174+i*127} 227Q${118+i*127} 263 ${66+i*127} 226Z`}
   fill={i===0?"#efc7b8":"#e1b4aa"} stroke={membrane} strokeWidth="6"/>
  {i===0&&<><ellipse cx="234" cy="183" rx="43" ry="33" fill={nucleus}/>
   {Array.from({length:13},(_,j)=>{const x=192+(j%5)*20,y=119+Math.floor(j/5)*40;
    return <path key={j} d={`M${x} ${y}q22 11 7 24`} stroke="#bf968b" strokeWidth="3" fill="none"/>})}</>}
 </g>)}
 <path d="M178 141l13-9m-13 54 13-9m-13 43 13-9M302 141l-13-9m13 54-13-9m13 43-13-9" stroke="#9b7b86" strokeWidth="7" strokeLinecap="round"/>
 <path d="M74 95Q234 70 406 93" stroke="#75b3a4" strokeWidth="5" strokeDasharray="7 9" fill="none"/>
 <text x="49" y="59" fill="#527e72" fontWeight="700" fontSize="12">Поверхность эпидермиса</text>
 </g>}
function BeeCell(){return <g>
 <path d="M139 47Q195 29 233 77L263 224Q295 258 286 294H190Q171 252 185 222L124 80Z"
  fill="#e7d8c0" stroke="#a89087" strokeWidth="7"/>
 <path d="M192 84Q228 100 246 132L265 228" fill="none" stroke="#896e9e" strokeWidth="32" strokeLinecap="round"/>
 {Array.from({length:19},(_,i)=>{const y=87+i*7;return <path key={i}
  d={`M${189+i*.8} ${y}l30 4`} stroke={i%2?"#d7b78e":"#c8979a"} strokeWidth="4" strokeLinecap="round"/>})}
 <ellipse cx="184" cy="196" rx="22" ry="29" fill={nucleus}/>
 <path d="M224 282Q231 303 250 320" fill="none" stroke="#a08ab3" strokeWidth="12" strokeLinecap="round"/>
 <path d="M299 81Q333 100 356 126" stroke="#d2ba6b" strokeWidth="8" fill="none" strokeDasharray="8 7"/>
 <text x="304" y="67" fontSize="12" fill="#9b7d4f" fontWeight="700">Свет</text>
 </g>}
function SnailCell(){return <g>
 <path d="M38 167Q112 122 185 136Q236 143 279 141Q363 122 438 159Q368 201 288 197Q237 191 188 202Q96 210 38 167Z"
  fill="#e8b2ae" stroke="#b07c83" strokeWidth="7"/>
 {Array.from({length:10},(_,i)=><path key={i} d={`M${66+i*32} ${159+i%3*7}q52 -10 83 4`}
  stroke={i%2?"#c68c90":"#f4d2c6"} strokeWidth="4" strokeLinecap="round" fill="none"/>)}
 <ellipse cx="242" cy="170" rx="41" ry="20" fill={nucleus} stroke="#866b9b" strokeWidth="4"/>
 <circle cx="244" cy="167" r="8" fill="#81669e"/>
 <path d="M79 233h323" stroke="#cdabb0" strokeWidth="4" strokeDasharray="11 7"/>
 <text x="88" y="268" fontSize="12" fill="#8f6f73" fontWeight="700">Нет поперечной исчерченности</text>
 </g>}
function PineCell(){return <g>
 <path d="M65 74Q119 52 196 72Q246 49 301 68Q385 59 413 96L425 240Q347 280 289 267Q201 286 118 264Q62 238 65 74Z"
  fill="#d6e9b4" stroke="#72996c" strokeWidth="14" strokeLinejoin="round"/>
 <path d="M88 95Q169 79 197 96Q253 78 305 93Q374 87 392 109L399 221Q351 252 296 244Q227 264 135 242Q90 226 88 95Z"
  fill="#edf6d4" stroke="#97bb86" strokeWidth="4"/>
 <path d="M146 129Q212 109 298 129Q343 156 335 212Q282 253 177 223Q133 194 146 129Z"
  fill="#bddeda" stroke="#8dbaba" strokeWidth="3" opacity=".85"/>
 {Array.from({length:11},(_,i)=>{const a=i*2.399;const x=243+Math.cos(a)*134,y=166+Math.sin(a)*66;
  return <g key={i} transform={`rotate(${a*180/Math.PI} ${x} ${y})`}>
   <ellipse cx={x} cy={y} rx="22" ry="10" fill={leaf} stroke="#477f59" strokeWidth="3"/>
   <path d={`M${x-13} ${y}h27`} stroke="#b8da9e" strokeWidth="3"/>
  </g>;
 })}
 <circle cx="119" cy="185" r="17" fill="#b39cc4" stroke="#997ab3" strokeWidth="3"/>
 </g>}
function FernCell(){return <g>
 <circle cx="186" cy="168" r="107" fill="#f2e1b4" stroke="#a69a76" strokeWidth="12"/>
 <circle cx="186" cy="166" r="70" fill="#ecd0cb" stroke="#b996ab" strokeWidth="5"/>
 <ellipse cx="183" cy="166" rx="37" ry="32" fill={nucleus} stroke="#8f72ac" strokeWidth="4"/>
 <path d="M279 157H315" stroke="#7b9e86" strokeWidth="5" strokeLinecap="round" strokeDasharray="7 6"/>
 <path d="M310 149l13 8-13 8" stroke="#7b9e86" strokeWidth="4" fill="none"/>
 {[[353,104],[406,104],[353,207],[406,207]].map(([x,y],i)=><g key={i}>
  <circle cx={x} cy={y} r="26" fill="#f6e6bf" stroke="#a3a07f" strokeWidth="5"/>
  <circle cx={x} cy={y} r="12" fill="#c2a8c2"/>
 </g>)}
 <text x="164" y="54" fontSize="14" fill="#8e6c76" fontWeight="700">2n</text>
 <text x="366" y="163" fontSize="14" fill="#658a6a" fontWeight="700">n</text>
 <text x="310" y="288" fontSize="11" fill="#627a66" fontWeight="700">Условная схема мейоза</text>
 </g>}
function WheatCell(){return <g>
 <rect x="72" y="70" width="284" height="204" rx="33" fill="#d8deac" stroke="#98a47a" strokeWidth="10"/>
 <rect x="92" y="90" width="244" height="161" rx="23" fill="#f1d5c6" stroke="#b6958e" strokeWidth="5"/>
 <ellipse cx="195" cy="173" rx="37" ry="31" fill={nucleus} stroke="#8e77a4" strokeWidth="4"/>
 {Array.from({length:12},(_,i)=>{const x=117+(i%5)*41,y=110+Math.floor(i/5)*56;
  return <g key={i}><ellipse cx={x} cy={y} rx="11" ry="6" fill="#d8a77e" stroke="#a78075" strokeWidth="2"/>
   <path d={`M${x-9} ${y}h18`} stroke="#f6ddbc" strokeWidth="2"/></g>;
 })}
 {Array.from({length:5},(_,i)=><g key={i}>
  <circle cx={365+i*15} cy={116+i%2*19} r="7" fill="#daa86e" stroke="#b18d67" strokeWidth="2"/>
 </g>)}
 <path d="M382 233v45" stroke="#a0a29b" strokeWidth="5" strokeDasharray="6 7" fill="none"/>
 <path d="M367 278l15 13 15-13" stroke="#a0a29b" strokeWidth="4" fill="none"/>
 <text x="297" y="307" fontSize="10.5" fill="#7e7774" fontWeight="700">Поздняя деградация</text>
 </g>}
const pictures:Record<string,()=>ReactNode>={
 sparrow:SparrowCell,perch:PerchCell,frog:FrogCell,bee:BeeCell,
 snail:SnailCell,pine:PineCell,fern:FernCell,wheat:WheatCell
};
export default function LektrusBioCellDetail({
 organism,node,selectedFeature,onFeatureSelect
}:{organism:BioOrganism;node:BioNode;selectedFeature?:string|null;
 onFeatureSelect?:(name:string)=>void}):ReactNode{
 const plate=bioCellPlateFor(organism,node);
 if(!plate)return null;
 const Picture=pictures[organism];
 if(!Picture)return null;
 return <g data-bio-cell-plate={organism}>
  <Picture/>
  {Object.entries(plate.landmarks).map(([name,pos],i)=>
   <g key={name} role={onFeatureSelect?"button":undefined}
    tabIndex={onFeatureSelect?0:undefined}
    className={"lektrus-bio-cell-hotspot"+(selectedFeature===name?" is-selected":"")}
    data-bio-cell-feature={name} aria-label={"Изучить: "+name}
    aria-pressed={onFeatureSelect?selectedFeature===name:undefined}
    onClick={onFeatureSelect?()=>onFeatureSelect(name):undefined}
    onKeyDown={onFeatureSelect?e=>{
     if(e.key==="Enter"||e.key===" "){e.preventDefault();onFeatureSelect(name);}
    }:undefined}
    transform={`translate(${pos.x} ${pos.y})`}>
    <circle r="20" fill="#dff4e6" fillOpacity=".85" stroke="#41866a" strokeWidth="3"/>
    <circle r="13" fill="#fffefa" stroke="#378260" strokeWidth="2"/>
    <text textAnchor="middle" dominantBaseline="central" fontSize="13" fontWeight="800" fill="#306b56">{i+1}</text>
    <title>{name}</title>
   </g>)}
 </g>;
}
