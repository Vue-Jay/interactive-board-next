/** Original offline SVG anatomical sections for eight modeled specimens.
 * Drawings are educational schematics (no calibration or microphotographs).
 * Each plate is restricted to a real organ/tissue node and has documented
 * biological source via lektrusBioSpecimenPlates.ts.
 */
import type {ReactNode} from "react";
import LektrusBioAdditionalSpecimenArt from "./LektrusBioAdditionalSpecimenArt";
import {bioExtraSpecimenPlateFor} from "./lektrusBioAdditionalSpecimenPlates";
import type {BioOrganism,BioNode} from "./lektrusBioMicroscopeModel";
import {bioSpecimenPlateFor} from "./lektrusBioSpecimenPlates";

const ink="#335b52",water="#80b9ca";
function Callout({x,y,tx,ty,label,anchor="start"}:{x:number;y:number;tx:number;ty:number;label:string;anchor?:"start"|"middle"|"end"}){
 return <g className="lektrus-bio-specimen-callout" pointerEvents="none">
  <path d={`M${x} ${y-6}L${tx} ${ty}`} stroke="#6b8c80" strokeWidth="1.5" strokeDasharray="4 4" fill="none"/>
  <circle cx={tx} cy={ty} r="3.4" fill="#428d77" stroke="white" strokeWidth="1.5"/>
  <text x={x} y={y} textAnchor={anchor} fontSize="12" fontWeight="700" fill={ink}>{label}</text>
 </g>;
}
function BirdLung(){return <g>
 <rect x="39" y="131" width="399" height="75" rx="37" fill="#dae9de" stroke="#628d80" strokeWidth="8"/>
 <path d="M63 168H415" stroke={water} strokeWidth="11" strokeDasharray="15 9" strokeLinecap="round"/>
 {Array.from({length:9},(_,i)=>{const x=77+i*42;return <g key={i}>
  <path d={`M${x} 138Q${x-18} 112 ${x-12} 78M${x+16} 199Q${x+29} 230 ${x+11} 261`}
   stroke="#b4d8ce" strokeWidth="19" fill="none" strokeLinecap="round"/>
  <path d={`M${x} 139Q${x-17} 110 ${x-12} 80M${x+16} 196Q${x+29} 230 ${x+11} 261`}
   stroke="#f6fcf0" strokeWidth="8" fill="none" strokeLinecap="round"/>
  </g>})}
 <path d="M52 69Q180 28 320 68T427 63" fill="none" stroke="#c78585" strokeWidth="9" strokeLinecap="round"/>
 <path d="M50 269Q168 298 298 278T427 267" fill="none" stroke="#c78585" strokeWidth="9" strokeLinecap="round"/>
 <Callout x={25} y={29} tx={161} ty={110} label="Воздухоносные капилляры"/>
 <Callout x={470} y={314} tx={315} ty={273} label="Кровеносные капилляры" anchor="end"/>
 </g>}
function BirdTissue(){return <g>
 <rect x="32" y="59" width="416" height="107" rx="33" fill="#e5f5f3" stroke="#a4cfc5" strokeWidth="6"/>
 <path d="M45 162Q111 142 175 164T304 165T436 156" fill="none" stroke="#f1d2b4" strokeWidth="16"/>
 <path d="M45 186Q111 165 175 188T304 188T436 181" fill="none" stroke="#bd9293" strokeWidth="8"/>
 <path d="M57 212Q157 202 235 224T421 217" fill="none" stroke="#bb7881" strokeWidth="35" strokeLinecap="round"/>
 {Array.from({length:8},(_,i)=><ellipse key={i} cx={75+i*46} cy={218+i%2*4}
  rx="15" ry="8" fill="#d66d73" stroke="#a75e6a" strokeWidth="2"/>)}
 <Callout x={25} y={33} tx={252} ty={104} label="Воздух"/>
 <Callout x={473} y={303} tx={269} ty={188} label="Тонкий барьер газообмена" anchor="end"/>
 <Callout x={17} y={285} tx={154} ty={224} label="Кровь"/>
 </g>}
function PerchGills(){return <g>
 <path d="M101 41Q78 163 108 293" stroke="#bc9d8f" strokeWidth="31" fill="none" strokeLinecap="round"/>
 {Array.from({length:7},(_,i)=>{const y=69+i*32;return <g key={i}>
  <path d={`M115 ${y}Q242 ${y-15} 411 ${y+7}`} stroke="#cb9b9c" strokeWidth="14" fill="none" strokeLinecap="round"/>
  {Array.from({length:11},(_,j)=>{const x=137+j*24;return <path key={j}
   d={`M${x} ${y-2}q-9 -13 -3 -20M${x+4} ${y+2}q8 14 4 20`}
   stroke={j%2?"#e4bdad":"#e0a9a3"} strokeWidth="6" fill="none" strokeLinecap="round"/>})}
 </g>})}
 <path d="M420 62V280" stroke={water} strokeWidth="6" strokeDasharray="10 9"/>
 <Callout x={17} y={30} tx={112} ty={124} label="Жаберная дуга"/>
 <Callout x={465} y={314} tx={255} ty={175} label="Вторичные ламеллы" anchor="end"/>
 </g>}
function PerchTissue(){return <g>
 <path d="M43 172Q131 82 233 127Q332 90 437 180" stroke="#ebc6bc" strokeWidth="81" fill="none" strokeLinecap="round"/>
 <path d="M43 172Q131 82 233 127Q332 90 437 180" stroke="#aa7b8c" strokeWidth="41" fill="none" strokeLinecap="round"/>
 <path d="M43 172Q131 82 233 127Q332 90 437 180" stroke="#d69b9c" strokeWidth="25" fill="none" strokeLinecap="round" strokeDasharray="18 12"/>
 {Array.from({length:13},(_,i)=><ellipse key={i} cx={73+i*27} cy={170+Math.sin(i/1.9)*29}
  rx="8" ry="5.6" fill="#a85b72" opacity=".8"/>)}
 <path d="M85 50L396 50" stroke={water} strokeWidth="9" strokeDasharray="12 9" strokeLinecap="round"/>
 <Callout x={18} y={31} tx={188} ty={52} label="Поток воды"/>
 <Callout x={459} y={305} tx={248} ty={161} label="Кровеносный канал" anchor="end"/>
 <Callout x={19} y={289} tx={147} ty={105} label="Тонкий эпителий"/>
 </g>}
function FrogSkin(){return <g>
 <path d="M40 78Q130 64 228 80T440 75V111H40Z" fill="#a9cfaf" stroke="#709f7e" strokeWidth="7"/>
 <path d="M40 112H440V285H40Z" fill="#e6c9b3" stroke="#b19a84" strokeWidth="5"/>
 {Array.from({length:15},(_,i)=><rect key={i} x={44+i*26} y={100+i%2*4} width="23" height="32" rx="6"
  fill="#b6d2aa" stroke="#89a78a" strokeWidth="2"/>)}
 {[[125,177],[245,200],[361,175]].map(([x,y],i)=><g key={i}>
  <path d={`M${x} ${y-38}q-36 10-27 48q17 41 45 9q29-39-18-57`} fill="#d9b9c4" stroke="#ae829a" strokeWidth="5"/>
  <path d={`M${x} ${y-27}q-7-39 10-83`} stroke="#b9a8a9" strokeWidth="5" fill="none"/>
 </g>)}
 <path d="M65 254Q135 211 214 251T425 235" stroke="#c77881" strokeWidth="11" fill="none" strokeLinecap="round"/>
 <Callout x={16} y={36} tx={213} ty={101} label="Влажный эпидермис"/>
 <Callout x={471} y={314} tx={245} ty={197} label="Кожные железы" anchor="end"/>
 </g>}
function FrogTissue(){return <g>
 <rect x="39" y="89" width="402" height="176" rx="15" fill="#e2c3b5" stroke="#b38e83" strokeWidth="7"/>
 {Array.from({length:2},(_,r)=>Array.from({length:12},(_,i)=><g key={r+"-"+i}>
  <rect x={51+i*32} y={103+r*69} width="31" height="64" rx="9" fill={r?"#eed7c8":"#d2b6a8"} stroke="#b9958d" strokeWidth="2.5"/>
  <ellipse cx={66+i*32} cy={139+r*68} rx="7" ry="10" fill="#b89ab7"/>
 </g>))}
 <path d="M43 89Q190 77 441 88" fill="none" stroke="#b8d8cd" strokeWidth="12"/>
 <Callout x={17} y={42} tx={258} ty={88} label="Влажная поверхность"/>
 <Callout x={465} y={313} tx={246} ty={148} label="Клетки эпидермиса" anchor="end"/>
 </g>}
function BeeEye(){return <g>
 {Array.from({length:7},(_,row)=>Array.from({length:9},(_,col)=>{
  const x=74+col*39+(row%2?19:0),y=50+row*37;
  return <path key={row+"-"+col} d={`M${x} ${y-19}l19 10v20l-19 10-19-10v-20Z`}
   fill={row===3&&col===4?"#b9d3cf":col%3===0?"#8dbaab":"#c0d9bd"} stroke="#5f9186" strokeWidth="3"/>;
 }))}
 <circle cx="250" cy="167" r="43" fill="#ecdfac" fillOpacity=".35" stroke="#c19b5e" strokeWidth="4" strokeDasharray="6 5"/>
 <Callout x={17} y={31} tx={118} ty={105} label="Фасетки глаза"/>
 <Callout x={461} y={313} tx={250} ty={167} label="Омматидий" anchor="end"/>
 </g>}
function BeeTissue(){return <g>
 <path d="M167 51Q240 21 315 51L294 89H185Z" fill="#d7e5d0" stroke="#7da799" strokeWidth="7"/>
 <path d="M185 94L218 149H262L294 94Z" fill="#f1e1ab" stroke="#bdaa74" strokeWidth="6"/>
 <path d="M223 151L216 267M256 151L265 267" stroke="#987d9f" strokeWidth="31" fill="none" strokeLinecap="round"/>
 <path d="M240 148V273" stroke="#d2c17c" strokeWidth="16" strokeLinecap="round"/>
 {Array.from({length:8},(_,i)=>{const a=i*Math.PI/4;return <path key={i}
  d={`M${240+Math.cos(a)*15} 202L${240+Math.cos(a)*45} 252`}
  stroke="#c6a7ba" strokeWidth="6" fill="none"/>})}
 <path d="M243 271v35" stroke="#8e7a9d" strokeWidth="8" strokeLinecap="round"/>
 <Callout x={20} y={34} tx={241} ty={59} label="Роговичная линза"/>
 <Callout x={465} y={313} tx={240} ty={208} label="Рабдом" anchor="end"/>
 </g>}
function SnailFoot(){return <g>
 <path d="M38 246Q73 102 240 95Q401 113 440 247Z" fill="#e6c0a8" stroke="#b28a79" strokeWidth="9"/>
 <path d="M52 251Q232 274 427 252" stroke="#9c9f83" strokeWidth="14" fill="none" strokeLinecap="round"/>
 {Array.from({length:13},(_,i)=>{
  const x=94+i*25;
  return <g key={i}>
   <path d={`M${x} 146q-38 52 18 91`} stroke={i%2?"#b88181":"#d09c91"} strokeWidth="10" fill="none" strokeLinecap="round"/>
   <path d={`M${x-3} 229q33-37 37-70`} stroke="#c18d87" strokeWidth="5" fill="none" strokeLinecap="round"/>
  </g>;
 })}
 <path d="M72 258Q159 265 242 257T410 256" stroke="#bdd1c4" strokeWidth="6" strokeDasharray="9 8" fill="none"/>
 <Callout x={18} y={38} tx={151} ty={143} label="Пучки мышц"/>
 <Callout x={465} y={310} tx={242} ty={256} label="Подошва ноги" anchor="end"/>
 </g>}
function SnailTissue(){return <g>
 {Array.from({length:7},(_,i)=>{
  const x=83+i*48;
  return <g key={i} transform={`translate(${x} ${160+(i%2)*8}) rotate(${i%2?29:-24})`}>
   <path d="M-12-112Q18-78 16 0Q15 75-12 112Q-41 48-26-22Q-26-75-12-112Z"
    fill="#e1aeaa" stroke="#ad8083" strokeWidth="5"/>
   <ellipse cx="-6" cy="5" rx="11" ry="27" fill="#9e82ad"/>
  </g>;
 })}
 <Callout x={18} y={37} tx={210} ty={153} label="Гладкие миоциты"/>
 <Callout x={466} y={313} tx={279} ty={171} label="Удлинённое ядро" anchor="end"/>
 </g>}
function PineNeedle(){return <g>
 <path d="M62 225Q43 157 119 103Q180 57 244 61Q348 62 415 166Q437 220 386 269Q235 288 99 266Z"
  fill="#b7d5a0" stroke="#739a71" strokeWidth="13" strokeLinejoin="round"/>
 <path d="M95 228Q75 167 132 120Q242 64 353 137Q409 192 372 242Q244 263 113 241Z"
  fill="#d8e8b4" stroke="#a9bd8c" strokeWidth="8"/>
 {Array.from({length:26},(_,i)=>{
  const a=i*Math.PI*2/26;const x=239+Math.cos(a)*123,y=176+Math.sin(a)*70;
  return <ellipse key={i} cx={x} cy={y} rx="13" ry="8"
   transform={`rotate(${a*180/Math.PI} ${x} ${y})`} fill="#79b272" stroke="#57946b" strokeWidth="3"/>;
 })}
 <ellipse cx="247" cy="179" rx="75" ry="55" fill="#f0e2b7" stroke="#9ca46d" strokeWidth="7"/>
 {[215,270].map(x=><g key={x}><ellipse cx={x} cy="175" rx="22" ry="36" fill="#a8b9b0" stroke="#6e998d" strokeWidth="4"/>
  <path d={`M${x-10} 171v21m8-40v41m10-32v29`} stroke="#b78383" strokeWidth="4"/></g>)}
 {[130,353].map(x=><g key={x}><circle cx={x} cy="189" r="20" fill="#d2a86d" stroke="#957e5c" strokeWidth="5"/>
  <circle cx={x} cy="189" r="10" fill="#f3d9a5"/></g>)}
 <path d="M201 68l12 24" stroke="#f7fae4" strokeWidth="9" strokeLinecap="round"/>
 <Callout x={19} y={38} tx={136} ty={188} label="Смоляной ход"/>
 <Callout x={467} y={316} tx={245} ty={180} label="Два проводящих пучка" anchor="end"/>
 </g>}
function PineTissue(){return <g>
 <rect x="37" y="51" width="406" height="235" rx="30" fill="#e4efc9" stroke="#86a778" strokeWidth="9"/>
 {Array.from({length:3},(_,row)=>Array.from({length:6},(_,i)=>{
  const x=61+i*61,y=69+row*67;
  return <g key={row+"-"+i}>
   <path d={`M${x+5} ${y+4}q15-9 27 0q23-10 26 15q-11 9-2 25q0 20-25 15q-23 9-25-14q9-13 2-23Z`}
    fill="#b1d697" stroke="#75aa75" strokeWidth="3"/>
   {Array.from({length:4},(_,j)=><ellipse key={j} cx={x+13+(j%2)*23} cy={y+17+Math.floor(j/2)*17}
    rx="7" ry="4" fill="#518e5c"/>)}
   <circle cx={x+32} cy={y+29} r="7" fill="#beacc4"/>
  </g>;
 }))}
 <Callout x={18} y={33} tx={162} ty={165} label="Складчатые стенки клеток"/>
 <Callout x={460} y={315} tx={299} ty={157} label="Хлоропласты" anchor="end"/>
 </g>}
function FernSporangium(){return <g>
 <path d="M242 264v54" stroke="#a08560" strokeWidth="20" strokeLinecap="round"/>
 <ellipse cx="245" cy="158" rx="119" ry="116" fill="#f1dfab" stroke="#b19670" strokeWidth="11"/>
 {Array.from({length:11},(_,i)=>{
  const angle=-2.3+i*.46;const x=245+Math.cos(angle)*119,y=158+Math.sin(angle)*115;
  return <rect key={i} x={x-14} y={y-17} width="28" height="32" rx="4"
   fill="#ca986c" stroke="#947359" strokeWidth="3"
   transform={`rotate(${angle*180/Math.PI+90} ${x} ${y})`}/>;
 })}
 {Array.from({length:17},(_,i)=>{
  const theta=i*2.399,r=Math.sqrt(i)*18;
  return <circle key={i} cx={245+Math.cos(theta)*r} cy={161+Math.sin(theta)*r}
   r="9" fill="#d4bb86" stroke="#a88b68" strokeWidth="2"/>;
 })}
 <Callout x={19} y={35} tx={148} ty={111} label="Кольцо (аннулюс)"/>
 <Callout x={465} y={310} tx={239} ty={163} label="Споры внутри" anchor="end"/>
 </g>}
function FernTissue(){return <g>
 <ellipse cx="240" cy="172" rx="159" ry="129" fill="#e8dab5" stroke="#bca57f" strokeWidth="10"/>
 {Array.from({length:7},(_,i)=>{
  const theta=i*Math.PI*2/7;const x=240+Math.cos(theta)*78,y=172+Math.sin(theta)*73;
  return <g key={i}><circle cx={x} cy={y} r="33" fill="#e5cfac" stroke="#b3917d" strokeWidth="5"/>
   <circle cx={x} cy={y} r="16" fill="#af92b2" stroke="#9c7ba6" strokeWidth="3"/></g>;
 })}
 <circle cx="240" cy="172" r="36" fill="#e0c8a0" stroke="#aa8b83" strokeWidth="5"/>
 <circle cx="240" cy="172" r="19" fill="#af92b2"/>
 <Callout x={16} y={34} tx={235} ty={106} label="Материнские клетки спор"/>
 <Callout x={464} y={308} tx={240} ty={172} label="Ядро (2n)" anchor="end"/>
 </g>}
function WheatAnther(){return <g>
 <path d="M241 315V253" stroke="#88a26e" strokeWidth="15" strokeLinecap="round"/>
 {[[147,116],[336,116],[147,236],[336,236]].map(([x,y],i)=><g key={i}>
  <ellipse cx={x} cy={y} rx="87" ry="63" fill="#d9e0b2" stroke="#879771" strokeWidth="7"/>
  <ellipse cx={x} cy={y} rx="62" ry="43" fill="#e9cbac" stroke="#c98f88" strokeWidth="8"/>
  <ellipse cx={x} cy={y} rx="43" ry="28" fill="#f6e5cf"/>
  {Array.from({length:6},(_,j)=>{
   const theta=j*2*Math.PI/6;
   return <circle key={j} cx={x+Math.cos(theta)*24} cy={y+Math.sin(theta)*18}
    r="8" fill="#d9b582" stroke="#a48967" strokeWidth="2"/>;
  })}
 </g>)}
 <path d="M237 55v215" stroke="#9cae83" strokeWidth="17" strokeLinecap="round"/>
 <Callout x={18} y={33} tx={118} ty={115} label="Пыльцевые мешки"/>
 <Callout x={464} y={319} tx={333} ty={230} label="Слой тапетума" anchor="end"/>
 </g>}
function WheatTissue(){return <g>
 <rect x="38" y="53" width="403" height="237" rx="26" fill="#dce7bf" stroke="#97ae80" strokeWidth="7"/>
 <rect x="62" y="86" width="355" height="178" rx="19" fill="#f5e6d6" stroke="#bf9b8b" strokeWidth="5"/>
 {Array.from({length:12},(_,i)=>{
  const x=68+i*29;
  return <g key={i}><rect x={x} y="94" width="26" height="57" rx="8" fill="#e3bbac" stroke="#b88f8f" strokeWidth="2"/>
   <ellipse cx={x+13} cy="127" rx="7" ry="12" fill="#aa8ab0"/></g>;
 })}
 {Array.from({length:11},(_,i)=>{
  const theta=i*2.399,r=Math.sqrt(i)*25;
  return <g key={i}><circle cx={235+Math.cos(theta)*r} cy={197+Math.sin(theta)*r}
   r="14" fill="#d8b58b" stroke="#b58f7c" strokeWidth="3"/>
   <circle cx={235+Math.cos(theta)*r} cy={197+Math.sin(theta)*r} r="5" fill="#ae94b1"/></g>;
 })}
 <Callout x={17} y={35} tx={230} ty={119} label="Клетки тапетума"/>
 <Callout x={465} y={315} tx={252} ty={206} label="Спорогенные клетки" anchor="end"/>
 </g>}

const organPictures:Record<string,()=>ReactNode>={
 sparrow:BirdLung,perch:PerchGills,frog:FrogSkin,bee:BeeEye,
 snail:SnailFoot,pine:PineNeedle,fern:FernSporangium,wheat:WheatAnther
};
const tissuePictures:Record<string,()=>ReactNode>={
 sparrow:BirdTissue,perch:PerchTissue,frog:FrogTissue,bee:BeeTissue,
 snail:SnailTissue,pine:PineTissue,fern:FernTissue,wheat:WheatTissue
};
export default function LektrusBioOrganDetail({organism,node}:{organism:BioOrganism;node:BioNode}):ReactNode{
 const plate=bioSpecimenPlateFor(organism,node);
 if(!plate)return null;
 const extra=bioExtraSpecimenPlateFor(organism,node);
 const Picture=extra?null:(plate.level==="organ"?organPictures:tissuePictures)[organism];
 return <g className="lektrus-bio-specimen-plate" data-bio-specimen-plate={plate.id}>
  {extra?<LektrusBioAdditionalSpecimenArt kind={extra.kind} tissue={node.level==="tissue"}/>:
   Picture?<Picture/>:null}
 </g>;
}
