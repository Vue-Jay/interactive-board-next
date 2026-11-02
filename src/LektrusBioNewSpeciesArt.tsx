/** Original offline teaching atlas artwork for Annelida, Asteroidea,
 * Malacostraca and Equisetidae. Species and anatomy are NEVER substituted
 * from unrelated clades. 480×330 is an illustration frame, not optical scale.
 */
import type {ReactNode} from "react";
import type {BioNewOrganism} from "./lektrusBioNewLineages";
import type {BioNode} from "./lektrusBioMicroscopeModel";

const ink="#456e66",warm="#ca9385",sea="#78aeb3",leaf="#5b9871",nuc="#aa91b8";
function KeyLabel({title,detail}:{title:string;detail:string}){
 return <g aria-hidden="true" pointerEvents="none">
  <rect x="18" y="14" width="444" height="48" rx="10" fill="#fffff4" fillOpacity=".82" stroke="#d5e5d4"/>
  <text x="30" y="32" fill="#315e53" fontSize="13" fontWeight="800">{title}</text>
  <text x="30" y="49" fill="#597c6e" fontSize="10.5">{detail}</text>
 </g>;
}
function CellNucleus({x,y}:{x:number;y:number}){
 return <g><ellipse cx={x} cy={y} rx="28" ry="21" fill={nuc} stroke="#886d9e" strokeWidth="4"/>
  <circle cx={x-3} cy={y} r="7" fill="#86669e"/></g>;
}
function Earthworm(){
 return <g>
  <path d="M51 213Q89 149 181 174Q250 198 315 138Q392 77 436 145Q448 195 405 211Q344 230 278 241Q170 275 88 238Q50 234 51 213Z"
   fill="#c28c80" stroke="#976c6c" strokeWidth="8"/>
  {Array.from({length:26},(_,i)=>{
   const x=64+i*14.1,y=207+22*Math.sin(i*.31)-20*Math.sin(i*.14);
   return <path key={i} d={`M${x} ${y-24}q-8 18-1 49`} fill="none" stroke="#a97770" strokeWidth="4" opacity=".85"/>;
  })}
  <path d="M183 177Q212 184 228 192L212 247Q193 252 174 245Z" fill="#d9aca0" stroke="#a77877" strokeWidth="4"/>
  <path d="M74 224Q190 270 302 202" stroke="#e6b9a3" strokeWidth="3" fill="none" strokeDasharray="7 12"/>
  <circle cx="423" cy="155" r="3.8" fill="#7c5b59"/>
 </g>;
}
function Seastar(){
 const points=Array.from({length:10},(_,i)=>{const angle=-Math.PI/2+i*Math.PI/5;const r=i%2===0?154:67;return `${240+Math.cos(angle)*r},${172+Math.sin(angle)*r}`;}).join(" ");
 return <g>
  <polygon points={points} fill="#d7ab8a" stroke="#b88279" strokeWidth="9" strokeLinejoin="round"/>
  <polygon points={Array.from({length:10},(_,i)=>{const a=-Math.PI/2+i*Math.PI/5,r=i%2===0?119:53;return `${240+Math.cos(a)*r},${172+Math.sin(a)*r}`;}).join(" ")}
   fill="#eec7a1" opacity=".68"/>
  <circle cx="240" cy="172" r="45" fill="#e0b28d" stroke="#bc8979" strokeWidth="5"/>
  {Array.from({length:5},(_,i)=>{const a=-Math.PI/2+i*2*Math.PI/5;return <g key={i}>
   <path d={`M${240+Math.cos(a)*45} ${172+Math.sin(a)*45}L${240+Math.cos(a)*125} ${172+Math.sin(a)*125}`}
    stroke="#a9766d" strokeWidth="6" strokeDasharray="3 11" strokeLinecap="round"/>
   {Array.from({length:3},(_,j)=>{const rr=71+j*19;return <circle key={j}
    cx={240+Math.cos(a+.12)*rr} cy={172+Math.sin(a+.12)*rr} r={3+j%2*2} fill="#fff1d0" stroke="#b68c71" strokeWidth="1.5"/>;})}
  </g>;})}
  <circle cx="239" cy="168" r="11" fill="#ae8272" opacity=".8"/>
 </g>;
}
function Crayfish(){
 return <g>
  <g stroke="#6a7772" strokeWidth="10" strokeLinecap="round" fill="none">
   {Array.from({length:4},(_,i)=><g key={i}>
    <path d={`M${239+i*15} ${191+i*7}Q${182-i*20} ${226+i*8} ${126-i*13} ${249+i*12}`}/>
    <path d={`M${257+i*12} ${193+i*9}Q${319+i*17} ${222+i*5} ${365+i*18} ${253+i*11}`}/>
   </g>)}
  </g>
  <path d="M185 146Q134 110 163 71Q205 42 239 87Q279 48 311 71Q337 112 291 152Z"
   fill="#a68b75" stroke="#6b8177" strokeWidth="7"/>
  <path d="M166 74Q144 45 111 67Q78 90 101 127Q144 118 167 97M306 72Q331 44 364 65Q397 89 373 123Q331 115 305 98"
   fill="#a6a17f" stroke="#6d8173" strokeWidth="6"/>
  <ellipse cx="240" cy="159" rx="64" ry="73" fill="#9da98b" stroke="#677f74" strokeWidth="7"/>
  {Array.from({length:5},(_,i)=><g key={i}>
   <path d={`M${196+i*17} 216L${190+i*17} ${244+i*9}Q241 ${273+i*11} ${293+i*9} ${244+i*9}L${286+i*10} 214`}
    fill="#ad9e7d" stroke="#70877a" strokeWidth="4"/>
  </g>)}
  <path d="M223 101Q214 45 195 21M255 101Q279 48 302 24" fill="none" stroke="#6d7e72" strokeWidth="4" strokeLinecap="round"/>
  <circle cx="207" cy="105" r="7" fill="#293b37"/><circle cx="269" cy="105" r="7" fill="#293b37"/>
 </g>;
}
function Horsetail(){
 return <g>
  <path d="M198 298V75" stroke="#699a72" strokeWidth="21" strokeLinecap="round"/>
  {Array.from({length:6},(_,i)=>{
   const y=266-i*31;return <g key={i}>
    <path d={`M198 ${y}L${108-i*4} ${y-30}M198 ${y}L${293+i*7} ${y-34}`}
     stroke="#6c9f78" strokeWidth="7" fill="none" strokeLinecap="round"/>
    <circle cx="198" cy={y} r="9" fill="#9cc08b"/>
    {[-1,1].map(s=><path key={s} d={`M${198+s*50} ${y-17}l${s*19} -19`} stroke="#7dab7d" strokeWidth="3.5"/>)}
   </g>;
  })}
  <path d="M198 77V37" stroke="#678c69" strokeWidth="15" strokeLinecap="round"/>
  <path d="M185 35Q197 2 209 35Z" fill="#a99169" stroke="#8a855e" strokeWidth="4"/>
  <path d="M345 304V117" stroke="#bea37d" strokeWidth="17" strokeLinecap="round"/>
  {Array.from({length:6},(_,i)=><g key={i}>
   <path d={`M${329+(i%2)*5} ${104-i*16}q16-15 32 0l-3 18q-13 12-30 0Z`}
    fill="#bfa77d" stroke="#907c62" strokeWidth="3"/>
  </g>)}
  <path d="M344 22L360 54L352 116H333L327 55Z" fill="#c4ad7b" stroke="#95805f" strokeWidth="4"/>
  {Array.from({length:4},(_,i)=><path key={i} d={`M${330+i*7} 53v45`} stroke="#a38a64" strokeWidth="2"/> )}
  <path d="M135 298Q193 281 259 298" fill="none" stroke="#9fba90" strokeWidth="8"/>
 </g>;
}
function RootOrganism({organism}:{organism:BioNewOrganism}):ReactNode{
 switch(organism){
  case "earthworm":return <Earthworm/>;
  case "seastar":return <Seastar/>;
  case "crayfish":return <Crayfish/>;
  case "horsetail":return <Horsetail/>;
 }
}
function SectionView({organism,branch,level}:{organism:BioNewOrganism;branch:number;level:BioNode["level"]}):ReactNode{
 const deep=level==="cell",tissue=level==="tissue";
 // Each group has its own anatomical section. Complexity increases at each
 // depth, never depicting plant spores as animal cells or vice versa.
 if(organism==="earthworm"){
  if(branch===0)return <g>
   <ellipse cx="240" cy="187" rx="153" ry="109" fill="#e0b4a3" stroke="#ad827e" strokeWidth="9"/>
   <ellipse cx="240" cy="187" rx="130" ry="86" fill="#e6c1ac" stroke="#bc9386" strokeWidth="11"/>
   <ellipse cx="240" cy="187" rx="103" ry="68" fill="#dc9692" stroke="#b8747e" strokeWidth="17"/>
   <ellipse cx="240" cy="187" rx="65" ry="42" fill="#f2e5d1" stroke="#bb9991" strokeWidth="6"/>
   {Array.from({length:tissue||deep?12:6},(_,i)=>{const a=i*2.4;return <ellipse key={i} cx={240+Math.cos(a)*130} cy={187+Math.sin(a)*83} rx={8} ry={12} fill="#bd8885" transform={`rotate(${a*180/Math.PI} ${240+Math.cos(a)*130} ${187+Math.sin(a)*83})`}/>})}
   {deep&&<g><CellNucleus x={240} y={186}/>{Array.from({length:5},(_,i)=><circle key={i} cx={189+i*23} cy={148+i%2*12} r="6" fill="#b28e69"/>)}</g>}
   <KeyLabel title={deep?"Слизистая клетка":tissue?"Эпидермис сегмента":"Срез кожно-мускульного мешка"} detail="Кутикула · эпидермис · круговые и продольные мышцы"/>
  </g>;
  if(branch===1)return <g>
   <path d="M100 104Q180 56 237 98Q282 128 241 175Q197 220 259 255Q326 291 366 235"
    fill="none" stroke="#caa8a2" strokeWidth={tissue?36:51} strokeLinecap="round"/>
   <path d="M100 104Q180 56 237 98Q282 128 241 175Q197 220 259 255Q326 291 366 235"
    fill="none" stroke="#f0e6d6" strokeWidth={tissue?18:28} strokeLinecap="round"/>
   <path d="M96 105Q116 51 140 65L181 108Q137 144 96 105" fill="#ddb8ae" stroke="#b68a8a" strokeWidth="5"/>
   {Array.from({length:11},(_,i)=><path key={i} d={`M${99+i*7} ${80+i%3*10}v29`} stroke={sea} strokeWidth="3.5" strokeLinecap="round"/>)}
   {deep&&<CellNucleus x={267} y={190}/>}
   <KeyLabel title={deep?"Ресничная клетка":tissue?"Нефростома · ресничный эпителий":"Метанефридий"} detail="Ресничная воронка → каналец → наружное отверстие"/>
  </g>;
  return <g>
   <ellipse cx="240" cy="185" rx="170" ry="105" fill="#c79d91" stroke="#9d7677" strokeWidth="9"/>
   <ellipse cx="240" cy="185" rx="130" ry="75" fill="#f1d4ae" stroke="#b58d84" strokeWidth="10"/>
   <path d="M204 115Q235 192 250 256Q276 191 297 117" stroke="#bc8a88" strokeWidth="25" fill="none"/>
   <path d="M205 125Q239 190 249 251Q265 204 293 125" stroke="#e9c9af" strokeWidth="10" fill="none"/>
   {Array.from({length:9},(_,i)=><path key={i} d={`M${135+i*25} 134v-13`} stroke="#9f7b71" strokeWidth="3.5"/>)}
   {deep&&<CellNucleus x={229} y={179}/>}
   <KeyLabel title={deep?"Всасывающий эпителиоцит":tissue?"Кишечный эпителий":"Средняя кишка · тифлозоль"} detail="Тифлозоль увеличивает всасывающую поверхность"/>
  </g>;
 }
 if(organism==="seastar"){
  if(branch===0)return <g>
   <ellipse cx="244" cy="122" rx="73" ry="42" fill="#dcafa0" stroke="#aa817f" strokeWidth="8"/>
   <path d="M222 147Q203 221 220 278Q248 298 270 269Q288 204 266 146" fill="#d8d9bc" stroke="#93a6a1" strokeWidth="8"/>
   <path d="M244 161V270" stroke={sea} strokeWidth="25" strokeLinecap="round"/>
   <path d="M244 167V266" stroke="#e1f3e7" strokeWidth="11" strokeLinecap="round"/>
   <ellipse cx="244" cy="280" rx="47" ry="18" fill="#b1c4a9" stroke="#7eaaa0" strokeWidth="6"/>
   {Array.from({length:9},(_,i)=><path key={i} d={`M${222+i*5} 204v21`} stroke="#8fa98d" strokeWidth="2"/>)}
   {deep&&<CellNucleus x={245} y={219}/>}
   <KeyLabel title={deep?"Эпителиоцит подия":tissue?"Покров ножки":"Амбулакральная ножка"} detail="Ампула → полость подия → прикрепительный диск"/>
  </g>;
  if(branch===1)return <g>
   <path d="M141 115Q225 72 293 113Q365 165 319 243Q245 290 161 253Q106 207 141 115" fill="#e5bd9d" stroke="#b58a7c" strokeWidth="8"/>
   {Array.from({length:9},(_,i)=>{
    const y=125+i*15;return <path key={i} d={`M150 ${y}Q210 ${y-34} 247 ${y}Q291 ${y+17} 320 ${y-6}`} fill="none" stroke={i%2?"#ad767a":"#f2dfbe"} strokeWidth="7"/>;
   })}
   {deep&&<g><CellNucleus x={239} y={191}/>{Array.from({length:8},(_,i)=><circle key={i} cx={193+i*13} cy={144+i%3*8} r="5" fill="#b79969"/>)}</g>}
   <KeyLabel title={deep?"Секреторная клетка":tissue?"Железистый эпителий":"Пилорический вырост луча"} detail="Пищеварение и всасывание внутри выростов"/>
  </g>;
  return <g>
   <path d="M74 143Q153 84 237 103Q313 76 409 143L387 244Q244 276 99 244Z" fill="#e5bba3" stroke="#ac817a" strokeWidth="9"/>
   {Array.from({length:10},(_,i)=>{const x=103+i*29;return <polygon key={i}
    points={`${x},163 ${x+23},153 ${x+27},180 ${x+8},198`} fill="#f2d6b5" stroke="#bd9b81" strokeWidth="3"/>;})}
   <path d="M91 231Q240 247 392 228" stroke="#b3a69c" strokeWidth="12" fill="none"/>
   {deep&&<CellNucleus x={243} y={205}/>}
   <KeyLabel title={deep?"Клетка дермы":tissue?"Коллагеновый матрикс":"Стенка луча"} detail="Эпидермис · дерма с оссикулами · целомический эпителий"/>
  </g>;
 }
 if(organism==="crayfish"){
  if(branch===0)return <g>
   <path d="M120 103Q218 64 328 105Q363 148 327 247Q241 281 141 240Q106 186 120 103" fill="#d6e1d4" stroke="#8ba99c" strokeWidth="8"/>
   {Array.from({length:13},(_,i)=>{
    const y=105+i*11;return <g key={i}>
     <path d={`M144 ${y}Q239 ${y-37} 322 ${y}`} fill="none" stroke={i%2?"#a5c3b4":"#8caaa8"} strokeWidth="7"/>
     <path d={`M164 ${y-5}q-14 -10 -19 -22M294 ${y-4}q15 -8 19 -23`} stroke="#c9dccc" strokeWidth="4" fill="none"/>
    </g>;
   })}
   {deep&&<CellNucleus x={235} y={188}/>}
   <KeyLabel title={deep?"Жаберная эпителиальная клетка":tissue?"Эпителий жаберных нитей":"Жабры рака · жаберные нити"} detail="Тонкая кутикула · эпителий · гемолимфа"/>
  </g>;
  if(branch===1)return <g>
   <path d="M150 112Q174 73 235 84Q318 68 337 125Q348 176 296 201Q257 223 269 251Q240 281 207 245Q224 201 180 199Q124 163 150 112"
    fill="#e8cbb4" stroke="#b89985" strokeWidth="9"/>
   <path d="M158 139Q236 103 302 148Q265 179 213 165Q178 152 158 139" fill="#f7e9d3" stroke="#cda793" strokeWidth="4"/>
   <path d="M239 173Q229 210 270 241Q301 265 338 233" fill="none" stroke="#bd9891" strokeWidth="20"/>
   <path d="M242 171Q231 211 269 241Q301 265 338 233" fill="none" stroke="#fff6dc" strokeWidth="7"/>
   {deep&&<CellNucleus x={269} y={224}/>}
   <KeyLabel title={deep?"Канальцевая клетка":tissue?"Канальцевый эпителий":"Антеннальная железа"} detail="Первичная жидкость → канальцы → выделение"/>
  </g>;
  return <g>
   <path d="M86 110Q228 79 392 113L401 245Q247 276 84 240Z" fill="#d7a8a0" stroke="#a97681" strokeWidth="9"/>
   {Array.from({length:16},(_,i)=><g key={i}>
    <path d={`M${96+i*19} 117v125`} stroke={i%2?"#eac7b8":"#b77e87"} strokeWidth={i%2?6:10}/>
    <path d={`M${93+i*19} 167h18m-18 40h18`} stroke="#f2d7ba" strokeWidth="3"/>
   </g>)}
   {deep&&<CellNucleus x={238} y={182}/>}
   <KeyLabel title={deep?"Мышечное волокно":tissue?"Миофибриллы и саркомеры":"Мышцы брюшка"} detail="Поперечнополосатая мускулатура плеона"/>
  </g>;
 }
 // Horsetail: do not display flowers, seeds or anthers. Reproductive organs
 // have spores attached to sporangia on peltate sporangiophores.
 if(branch===0)return <g>
  <circle cx="240" cy="181" r="124" fill="#add39f" stroke="#6e9975" strokeWidth="10"/>
  {Array.from({length:10},(_,i)=>{const a=i*2*Math.PI/10;return <g key={i}>
   <path d={`M${240+Math.cos(a)*48} ${181+Math.sin(a)*48}L${240+Math.cos(a)*112} ${181+Math.sin(a)*112}`} stroke="#d5e9b8" strokeWidth="18"/>
   <circle cx={240+Math.cos(a)*84} cy={181+Math.sin(a)*84} r="10" fill="#7eb27c"/>
  </g>;})}
  <circle cx="240" cy="181" r="55" fill="#f5f3c9" stroke="#9bb992" strokeWidth="7"/>
  {Array.from({length:5},(_,i)=><circle key={i} cx={223+i*10} cy={170+i%3*10} r="7" fill="#b79b8f"/>)}
  {deep&&<CellNucleus x={240} y={182}/>}
  <KeyLabel title={deep?"Клетка хлоренхимы":tissue?"Хлоренхима стебля":"Поперечный срез зелёного стебля"} detail="Рёбра · хлоренхима · центральная полость"/>
 </g>;
 if(branch===1)return <g>
  <rect x="89" y="100" width="302" height="177" rx="22" fill="#c6dfa9" stroke="#709971" strokeWidth="9"/>
  {Array.from({length:8},(_,i)=>{const x=104+i*37;return <g key={i}>
   <rect x={x} y="113" width="33" height="148" rx="12" fill="#e2efba" stroke="#91ba80" strokeWidth="3"/>
   <ellipse cx={x+17} cy="181" rx="7" ry="15" fill="#74ad75"/>
  </g>;})}
  <g><ellipse cx="222" cy="183" rx="35" ry="50" fill="#8ab980" stroke="#64966d" strokeWidth="6"/>
   <ellipse cx="282" cy="183" rx="35" ry="50" fill="#8ab980" stroke="#64966d" strokeWidth="6"/>
   <path d="M252 141V224" stroke="#f8fcdf" strokeWidth="12" strokeLinecap="round"/>
   <path d="M252 142V224" stroke="#698a77" strokeWidth="2" strokeDasharray="5 5"/></g>
  {deep&&<CellNucleus x={223} y={181}/>}
  <KeyLabel title={deep?"Замыкающая клетка":tissue?"Устьичный аппарат":"Эпидермис стебля"} detail="Кремнезём покрова · устьице в борозде"/>
 </g>;
 return <g>
  <path d="M174 116Q231 80 307 117L327 242Q247 288 160 237Z" fill="#dfcb9e" stroke="#ac986d" strokeWidth="9"/>
  <path d="M185 143Q238 111 294 139L299 222Q238 257 190 218Z" fill="#f3e8c6" stroke="#bea97b" strokeWidth="5"/>
  {Array.from({length:13},(_,i)=>{const a=i*2.4;const rr=Math.sqrt(i)*22;return <g key={i}>
   <circle cx={240+Math.cos(a)*rr} cy={179+Math.sin(a)*rr} r={tissue||deep?12:8} fill="#d2b997" stroke="#ab9278" strokeWidth="2"/>
   {(tissue||deep)&&<circle cx={240+Math.cos(a)*rr} cy={179+Math.sin(a)*rr} r="4" fill={nuc}/>}
  </g>;})}
  {deep&&<CellNucleus x={240} y={181}/>}
  <KeyLabel title={deep?"Спороцит (2n)":tissue?"Спорогенная ткань":"Спорангий хвоща"} detail="После мейоза формируются гаплоидные споры (n)"/>
 </g>;
}
export default function LektrusBioNewSpeciesArt({organism,node}:{
 organism:BioNewOrganism;node:BioNode
}):ReactNode{
 const chainIndex=node.level==="organism"?-1:(node.id.split("/")[1]?
  // Chain names are explicitly encoded in the reviewed model, so the
  // stable prefix is matched here rather than a generic word such as 'leaf'.
  ({
   earthworm:["покровно-мускульная-система","выделительная-система","пищеварительная-система"],
   seastar:["амбулакральная-система","пищеварительная-система","покровно-скелетная-система"],
   crayfish:["дыхательная-система","выделительная-система","покровно-двигательная-система"],
   horsetail:["вегетативный-побег","покровная-ткань-побега","спороносный-побег"]
  } as Record<BioNewOrganism,string[]>)[organism].indexOf(node.id.split("/")[1]):-1);
 if(node.level==="organism")return <RootOrganism organism={organism}/>;
 if(chainIndex<0)return null;
 if(node.level==="system")return <g>
  <g opacity=".2"><RootOrganism organism={organism}/></g>
  <g transform="translate(142 56) scale(.45)"><SectionView organism={organism} branch={chainIndex} level="organ"/></g>
 </g>;
 return <SectionView organism={organism} branch={chainIndex} level={node.level}/>;
}
