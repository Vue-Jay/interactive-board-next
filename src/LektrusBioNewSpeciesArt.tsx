/** Original offline teaching atlas artwork for Annelida, Asteroidea,
 * Malacostraca and Equisetidae. Species and anatomy are NEVER substituted
 * from unrelated clades. 480×330 is an illustration frame, not optical scale.
 */
import type {ReactNode} from "react";
import LektrusBioDetailedLineageSpecimens from "./LektrusBioDetailedLineageSpecimens";
import LektrusBioLineageMicroscopy,{lineageMicroSpots} from "./LektrusBioLineageMicroscopy";
import {bioNewCellFeatures,type BioNewOrganism} from "./lektrusBioNewLineages";
import type {BioNode} from "./lektrusBioMicroscopeModel";

const sea="#78aeb3",nuc="#aa91b8";
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
function Earthworm(){return <LektrusBioDetailedLineageSpecimens organism="earthworm"/>;}
function Seastar(){return <LektrusBioDetailedLineageSpecimens organism="seastar"/>;}
function Crayfish(){return <LektrusBioDetailedLineageSpecimens organism="crayfish"/>;}
function Horsetail(){return <LektrusBioDetailedLineageSpecimens organism="horsetail"/>;}
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
export default function LektrusBioNewSpeciesArt({organism,node,selectedFeature,onFeatureSelect}:{
 organism:BioNewOrganism;node:BioNode;selectedFeature?:string|null;
 onFeatureSelect?:(name:string)=>void
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
 const cellFeatures=node.level==="cell"&&onFeatureSelect?bioNewCellFeatures(organism,node.name):[];
 const spots=lineageMicroSpots(organism,chainIndex);
 return <g data-bio-new-species={organism} data-bio-new-level={node.level}>
  {(node.level==="tissue"||node.level==="cell")
   ?<LektrusBioLineageMicroscopy organism={organism} branch={chainIndex} level={node.level} name={node.name}/>
   :<SectionView organism={organism} branch={chainIndex} level={node.level}/>}
  {cellFeatures.map((item,i)=>{
   const pt=spots[i];
   return <g key={item.name} transform={`translate(${pt.x} ${pt.y})`}
    role="button" tabIndex={0} data-bio-new-cell-feature={item.name}
    aria-label={"Изучить: "+item.name} aria-pressed={selectedFeature===item.name}
    className={"lektrus-bio-cell-hotspot"+(selectedFeature===item.name?" is-selected":"")}
    onClick={()=>onFeatureSelect?.(item.name)}
    onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();onFeatureSelect?.(item.name);}}}>
    <circle r="20" fill="#e8f7ed" fillOpacity=".92" stroke="#3c8366" strokeWidth="3"/>
    <circle r="13" fill="#fffefa" stroke="#3c8366" strokeWidth="2"/>
    <text textAnchor="middle" dominantBaseline="central" fontWeight="800" fontSize="13" fill="#326a52">{i+1}</text>
    <title>{item.name}</title>
   </g>;
  })}
 </g>;
}
