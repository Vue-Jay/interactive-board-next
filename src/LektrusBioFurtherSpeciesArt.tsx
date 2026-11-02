/** Original, offline species-specific anatomy for four further lineages.
 * Schematic 480x330 anatomical views: no micrograph, no fabricated scale.
 */
import type {ReactNode} from "react";
import type {BioFurtherOrganism,BioNode} from "./lektrusBioMicroscopeModel";
import {bioFurtherCellFeatures} from "./lektrusBioMicroscopeModel";
const ink="#315b50",gold="#c59d72",jade="#70a283",pink="#d8a5a2",violet="#9f8db1";
function Nucleus({x=241,y=182}:{x?:number;y?:number}){return <g>
 <ellipse cx={x} cy={y} rx="27" ry="20" fill={violet} stroke="#81729e" strokeWidth="3"/>
 <circle cx={x-5} cy={y+1} r="6" fill="#785f98"/>
 </g>}
function Title({name,detail}:{name:string;detail:string}){return <g aria-hidden="true" pointerEvents="none">
 <rect x="17" y="12" width="446" height="49" rx="10" fill="#f9fff4" fillOpacity=".94" stroke="#cbd9c5"/>
 <text x="29" y="32" fontSize="13" fontWeight="800" fill={ink}>{name}</text>
 <text x="29" y="49" fontSize="10.5" fill="#54786a">{detail}</text>
 </g>}
function Lizard(){return <g>
 <path d="M305 197Q355 209 431 274Q444 288 423 289Q361 276 282 250Z" fill="#8ca66d" stroke="#5c7d61" strokeWidth="8"/>
 <path d="M174 218L123 287L92 295M302 214L337 288L370 298M187 173L132 139L96 157M310 166L352 132L388 147"
  fill="none" stroke="#6c8d63" strokeWidth="23" strokeLinecap="round" strokeLinejoin="round"/>
 <path d="M99 155Q64 141 52 119L77 96Q125 85 160 121Q187 106 250 112Q327 122 343 172Q325 235 246 248Q185 249 151 197Z"
  fill="#88a76e" stroke="#537e64" strokeWidth="7"/>
 <path d="M88 112Q120 114 141 139" stroke="#c7cc8a" strokeWidth="10" fill="none"/>
 {Array.from({length:32},(_,i)=>{const x=164+(i%8)*21,y=130+Math.floor(i/8)*25;
  return <path key={i} d={\`M\${x-7} \${y}q9-8 18 0q-9 9-18 0\`} fill="#9bbb78" stroke="#7a9d68" strokeWidth="1.5"/>;
 })}
 <circle cx="83" cy="116" r="10" fill="#eedcab" stroke="#5f8265" strokeWidth="3"/><circle cx="86" cy="115" r="5" fill="#283b36"/>
 <path d="M57 148l55 2" stroke="#607e64" strokeWidth="4"/>
 </g>}
function Spider(){return <g>
 {Array.from({length:4},(_,i)=>{const y=154+i*25;return <g key={i} stroke="#776e62" strokeWidth="9" strokeLinecap="round" fill="none">
  <path d={\`M212 \${y}Q153 \${y-28} \${112-i*5} \${y-78}L\${68-i*5} \${y-57}\`}/>
  <path d={\`M270 \${y}Q333 \${y-26} \${370+i*4} \${y-76}L\${414+i*5} \${y-55}\`}/>
 </g>})}
 <ellipse cx="279" cy="198" rx="79" ry="97" fill="#bba088" stroke="#7c7369" strokeWidth="8"/>
 <ellipse cx="178" cy="181" rx="52" ry="49" fill="#a3917a" stroke="#746f65" strokeWidth="7"/>
 <path d="M277 117l-20 47 18 30-23 49M296 120l21 51-24 29 21 37" stroke="#e6d2b2" strokeWidth="14" fill="none" strokeLinecap="round"/>
 <path d="M245 151q35 21 68 0M247 219q38-22 69 0" stroke="#e5d1b7" strokeWidth="8" fill="none"/>
 {Array.from({length:8},(_,i)=><circle key={i} cx={151+i%4*16} cy={160+Math.floor(i/4)*17} r="3.8" fill="#f4dcc2"/>)}
 </g>}
function Clubmoss(){return <g>
 <path d="M49 272Q151 248 240 272T420 269" stroke="#628b65" strokeWidth="16" fill="none" strokeLinecap="round"/>
 {Array.from({length:5},(_,i)=>{const x=90+i*75;return <g key={i}>
  <path d={\`M\${x} 266Q\${x+9} 186 \${x+10} \${127+i%2*19}\`} stroke="#5e9267" strokeWidth="13" fill="none" strokeLinecap="round"/>
  {Array.from({length:8},(_,j)=>{const y=150+j*13+i%2*19;return <g key={j} stroke="#64936b" strokeWidth="4" strokeLinecap="round">
   <path d={\`M\${x+6} \${y}l-24-20M\${x+13} \${y+4}l23-18\`}/>
  </g>})}
  {i%2===0&&<g>
   <path d={\`M\${x+10} \${127+i%2*19}v-60\`} stroke="#a5a36c" strokeWidth="7"/>
   {Array.from({length:7},(_,j)=><path key={j} d={\`M\${x-3} \${68+j*9}q14-10 25 0l-12 9Z\`} fill="#c2bd82" stroke="#8f9b68" strokeWidth="2"/>)}
  </g>}
 </g>})}
 {Array.from({length:6},(_,i)=><path key={i} d={\`M\${80+i*58} 274q-12 20-12 38\`} stroke="#b49b76" strokeWidth="4" fill="none"/>)}
 </g>}
function Magnolia(){return <g>
 <path d="M233 320Q250 210 237 84" stroke="#827554" strokeWidth="14" fill="none"/>
 {[[125,178,-20],[343,226,23],[343,110,19]].map(([x,y,a],i)=><g key={i}>
  <path d={\`M237 \${y+17}Q\${x} \${y-30} \${x} \${y}\`} stroke="#7a9465" strokeWidth="8" fill="none"/>
  <ellipse cx={x} cy={y} rx="69" ry="26" fill="#4c9068" stroke="#397b5d" strokeWidth="5" transform={\`rotate(\${a} \${x} \${y})\`}/>
  <path d={\`M\${x-47} \${y}L\${x+48} \${y}\`} stroke="#c2ddb2" strokeWidth="4" transform={\`rotate(\${a} \${x} \${y})\`}/>
 </g>)}
 <circle cx="227" cy="106" r="73" fill="#f7f0dc" opacity=".55"/>
 {Array.from({length:9},(_,i)=>{const a=i*2*Math.PI/9;return <ellipse key={i}
  cx={225+Math.cos(a)*36} cy={106+Math.sin(a)*35} rx="35" ry="20"
  fill="#fff9ee" stroke="#d8d0b5" strokeWidth="3" transform={\`rotate(\${a*180/Math.PI+90} \${225+Math.cos(a)*36} \${106+Math.sin(a)*35})\`}/>})}
 <ellipse cx="225" cy="108" rx="17" ry="34" fill="#c4b87f" stroke="#94895e" strokeWidth="4"/>
 {Array.from({length:13},(_,i)=>{const a=i*2.4;return <circle key={i} cx={225+Math.cos(a)*24} cy={112+Math.sin(a)*23} r="3.5" fill={gold}/>})}
 </g>}
function Specimen({organism}:{organism:BioFurtherOrganism}):ReactNode{
 switch(organism){case "lizard":return <Lizard/>;case "spider":return <Spider/>;
 case "clubmoss":return <Clubmoss/>;case "magnolia":return <Magnolia/>;}
}
function AnimalBranch({organism,branch,level}:{organism:"lizard"|"spider";branch:number;level:BioNode["level"]}){
 const deep=level==="cell",tissue=level==="tissue",color=organism==="lizard"?"#d8bdae":"#c9b19e";
 if(organism==="lizard"){
  if(branch===0)return <g>
   <rect x="64" y="97" width="356" height="189" rx="20" fill="#e6cfc1" stroke="#b99a8e" strokeWidth="8"/>
   {Array.from({length:12},(_,i)=><g key={i}>
    <path d={\`M\${73+i*29} 97q13-25 28 0v55q-13 18-28 0Z\`} fill="#ceb395" stroke="#9e9481" strokeWidth="2"/>
    <path d={\`M\${74+i*29} 157v60\`} stroke="#b39189" strokeWidth="4"/>
   </g>)}
   <path d="M74 229Q235 215 408 228" stroke="#d3a39c" strokeWidth="8" fill="none"/>
   {deep&&<Nucleus/>}
   <Title name={deep?"Базальный кератиноцит":tissue?"Живой эпидермис":"Чешуйчатая кожа"} detail="Кератинизированный покров · базальный слой"/>
  </g>;
  if(branch===1)return <g>
   <ellipse cx="240" cy="190" rx="145" ry="109" fill="#e7c2b7" stroke="#ac8887" strokeWidth="9"/>
   <ellipse cx="240" cy="190" rx="117" ry="82" fill="#fff6db" stroke="#cda19d" strokeWidth="6"/>
   {Array.from({length:12},(_,i)=>{const a=i*2*Math.PI/12;return <path key={i} d={\`M\${240+Math.cos(a)*105} \${190+Math.sin(a)*72}Q\${240+Math.cos(a+.25)*71} \${190+Math.sin(a+.25)*54} 240 190\`} stroke="#dca6a2" strokeWidth={tissue||deep?8:13} fill="none"/>})}
   <path d="M109 256Q218 294 372 250" stroke="#bd8088" strokeWidth="8" strokeDasharray="8 6" fill="none"/>
   {deep&&<Nucleus/>}
   <Title name={deep?"Газообменный эпителиоцит":tissue?"Эпителий фовеолы":"Лёгкое ящерицы"} detail="Ячеистые камеры · капилляры · газообмен"/>
  </g>;
  return <g>
   <rect x="67" y="87" width="345" height="216" rx="20" fill="#e2decc" stroke="#aaa58d" strokeWidth="7"/>
   <rect x="77" y="103" width="325" height="40" fill="#8e9c8a"/>
   {Array.from({length:17},(_,i)=><g key={i}>
    <path d={\`M\${88+i*18} 147v54\`} stroke="#a0bd9c" strokeWidth="10" strokeLinecap="round"/>
    <circle cx={88+i*18} cy="218" r="7" fill={pink}/>
   </g>)}
   <rect x="78" y="229" width="324" height="42" fill="#c8b7cf"/>
   {deep&&<Nucleus/>}
   <Title name={deep?"Колбочка сетчатки":tissue?"Фоторецепторный слой":"Сетчатка ящерицы"} detail="Пигментный эпителий · фоторецепторы · нейроны"/>
  </g>;
 }
 if(branch===0)return <g>
  <path d="M112 102Q239 67 365 105V275H112Z" fill="#d5d0c5" stroke="#9a9b8e" strokeWidth="8"/>
  {Array.from({length:12},(_,i)=>{const y=106+i*12;return <g key={i}>
   <path d={\`M128 \${y}Q244 \${y-15} 350 \${y}\`} stroke="#f1e6d7" strokeWidth="6" fill="none"/>
   <path d={\`M128 \${y+4}Q240 \${y+19} 350 \${y+4}\`} stroke="#bb8f88" strokeWidth="6" fill="none"/>
  </g>})}
  {deep&&<Nucleus/>}
  <Title name={deep?"Опорная клетка ламеллы":tissue?"Ламеллы книжного лёгкого":"Книжное лёгкое"} detail="Воздушные щели · ламеллы с гемолимфой"/>
 </g>;
 if(branch===1)return <g>
  <path d="M123 167Q112 104 184 100Q235 74 284 125Q324 175 268 212Q234 225 239 255L270 289"
   stroke="#ba998f" strokeWidth="52" fill="none" strokeLinecap="round"/>
  <path d="M123 167Q112 104 184 100Q235 74 284 125Q324 175 268 212Q234 225 239 255L270 289"
   stroke="#f5e6c8" strokeWidth="27" fill="none" strokeLinecap="round"/>
  {Array.from({length:10},(_,i)=><circle key={i} cx={148+i%5*28} cy={126+Math.floor(i/5)*33} r="6" fill="#d1af8b"/>)}
  {deep&&<Nucleus/>}
  <Title name={deep?"Секреторная клетка":tissue?"Железистый эпителий":"Большая ампуловидная железа"} detail="Синтез белков шёлка · секреторный проток"/>
 </g>;
 return <g>
  <ellipse cx="237" cy="181" rx="138" ry="106" fill="#dbba9e" stroke="#a5897b" strokeWidth="8"/>
  <ellipse cx="237" cy="181" rx="90" ry="75" fill="#eff2d9" stroke="#a8b59d" strokeWidth="7"/>
  <ellipse cx="239" cy="186" rx="51" ry="57" fill="#a9baa8" stroke="#829e8c" strokeWidth="5"/>
  {Array.from({length:14},(_,i)=>{const a=i*2.4;return <path key={i} d={\`M\${240+Math.cos(a)*40} \${186+Math.sin(a)*42}l\${Math.cos(a)*25} \${Math.sin(a)*23}\`} stroke="#8b7497" strokeWidth="5"/>})}
  {deep&&<Nucleus/>}
  <Title name={deep?"Рабдомерный фоторецептор":tissue?"Фоторецепторный эпителий":"Простой глаз паука"} detail="Простой глаз · рабдомерные микроворсинки"/>
 </g>;
}
function PlantBranch({organism,branch,level}:{organism:"clubmoss"|"magnolia";branch:number;level:BioNode["level"]}){
 const deep=level==="cell",tissue=level==="tissue",club=organism==="clubmoss";
 if((club&&branch===0)||(!club&&branch===0))return <g>
  <path d="M91 197Q144 95 287 98Q385 126 402 222Q284 280 165 250Z" fill="#c8e0a5" stroke="#6c9c6d" strokeWidth="10"/>
  <path d="M115 195Q241 165 380 221" fill="none" stroke="#f0f4c8" strokeWidth={club?7:11}/>
  {Array.from({length:13},(_,i)=>{const x=133+i*18;return <g key={i}>
   <ellipse cx={x} cy={173+(i%3)*21} rx="12" ry="17" fill="#8fc184" stroke="#6a9c6d" strokeWidth="2"/>
   <ellipse cx={x} cy={173+(i%3)*21} rx="5" ry="9" fill="#4e9365"/>
  </g>})}
  {deep&&<g><rect x="165" y="126" width="160" height="132" rx="18" fill="#ddedb9" stroke="#78a476" strokeWidth="8"/><Nucleus x={198} y={209}/></g>}
  <Title name={club?(deep?"Клетка мезофилла микрофилла":tissue?"Мезофилл микрофилла":"Микрофилл плауна"):(deep?"Клетка мезофилла магнолии":tissue?"Мезофилл листа":"Лист магнолии")}
   detail={club?"Единственная неветвящаяся жилка · хлоропласты":"Кожистый лист · сетчатое жилкование · фотосинтез"}/>
 </g>;
 if(club&&branch===1)return <g>
  <path d="M235 290V91" stroke="#819b6e" strokeWidth="13" strokeLinecap="round"/>
  {Array.from({length:9},(_,i)=>{const y=112+i*18;return <g key={i}>
   <path d={\`M235 \${y}l-55-25 21 37Z\`} fill="#c9ce9c" stroke="#899d7d" strokeWidth="4"/>
   <path d={\`M238 \${y}l49-22 -16 33Z\`} fill="#c9ce9c" stroke="#899d7d" strokeWidth="4"/>
   <ellipse cx={211} cy={y-4} rx="13" ry="10" fill="#d7ad7d" stroke="#b68e71" strokeWidth="2"/>
  </g>})}
  {deep&&<g><ellipse cx="240" cy="187" rx="70" ry="57" fill="#eed6b7" stroke="#bc997f" strokeWidth="6"/><Nucleus/></g>}
  <Title name={deep?"Диплоидный спороцит (2n)":tissue?"Спорогенная ткань":"Спорангий плауна"} detail="Спорангий на спорофилле · одинаковые споры (n)"/>
 </g>;
 if(club)return <g>
  <path d="M237 65Q217 172 229 285" stroke="#c2a585" strokeWidth="42" strokeLinecap="round"/>
  {Array.from({length:14},(_,i)=>{const x=223+(i%2)*22,y=77+i*13;return <path key={i} d={\`M\${x} \${y}q\${i%2?44:-45} -18 \${i%2?58:-55} -25\`} stroke="#cdb69a" strokeWidth="4" fill="none"/>})}
  {deep&&<g><rect x="137" y="112" width="220" height="133" rx="24" fill="#e5edc4" stroke="#8aa779" strokeWidth="9"/><Nucleus/></g>}
  <Title name={deep?"Клетка ризодермы":tissue?"Ризодерма корня":"Придаточный корень"} detail="Молодой корень · водопоглощающие ткани"/>
 </g>;
 if(branch===1)return <g>
  {[[164,129],[302,129],[164,241],[302,241]].map(([x,y],i)=><g key={i}>
   <ellipse cx={x} cy={y} rx="67" ry="46" fill="#e6d7b3" stroke="#af9a80" strokeWidth="6"/>
   <ellipse cx={x} cy={y} rx="44" ry="29" fill="#f6e8cd" stroke="#c39983" strokeWidth="4"/>
   {Array.from({length:5},(_,j)=>{const a=j*2*Math.PI/5;return <circle key={j} cx={x+Math.cos(a)*22} cy={y+Math.sin(a)*15} r="7" fill={gold}/>})}
  </g>)}
  {deep&&<Nucleus/>}
  <Title name={deep?"Клетка тапетума":tissue?"Питательный тапетум":"Пыльник магнолии"} detail="Пыльцевые мешки · созревание микроспор"/>
 </g>;
 return <g>
  <path d="M245 290L227 119" stroke="#88a376" strokeWidth="13" strokeLinecap="round"/>
  <path d="M232 120Q168 85 184 161Q215 207 241 232Q278 185 299 160Q328 96 242 124Z"
   fill="#b3cf99" stroke="#72956c" strokeWidth="9"/>
  <ellipse cx="240" cy="135" rx="30" ry="46" fill="#e2c18e" stroke="#b69b76" strokeWidth="6"/>
  {Array.from({length:9},(_,i)=><circle key={i} cx={232+i%3*11} cy={113+Math.floor(i/3)*14} r="5" fill="#f1dcaa" stroke="#c19e76" strokeWidth="2"/>)}
  {deep&&<Nucleus x={239} y={173}/>}
  <Title name={deep?"Клетка рыльца":tissue?"Эпидермис рыльца":"Плодолистик магнолии"} detail="Рыльце · семязачатки · спиральное расположение плодолистиков"/>
 </g>;
}
const branches:Record<BioFurtherOrganism,readonly [string,string,string]>={
 lizard:["покровная-система","дыхательная-система","зрительная-система"],
 spider:["дыхательная-система","шёлкообразующая-система","зрительная-система"],
 clubmoss:["зелёный-побег","спороносные-структуры","корневая-система"],
 magnolia:["листовой-побег","тычинки-цветка","плодолистики-цветка"]
};
export default function LektrusBioFurtherSpeciesArt({organism,node,selectedFeature,onFeatureSelect}:{
 organism:BioFurtherOrganism;node:BioNode;selectedFeature?:string|null;onFeatureSelect?:(name:string)=>void
}):ReactNode{
 if(node.level==="organism")return <g data-bio-further-species={organism}><Specimen organism={organism}/></g>;
 const which=branches[organism].indexOf(node.id.split("/")[1]);
 if(which<0)return null;
 const section=(organism==="lizard"||organism==="spider")
  ?<AnimalBranch organism={organism} branch={which} level={node.level}/>
  :<PlantBranch organism={organism} branch={which} level={node.level}/>;
 if(node.level==="system")return <g data-bio-further-species={organism}>
  <g opacity=".16"><Specimen organism={organism}/></g>
  <g transform="translate(125 58) scale(.50)">{section}</g>
 </g>;
 const items=node.level==="cell"&&onFeatureSelect?bioFurtherCellFeatures(organism,node.name):[];
 const points=[{x:190,y:157},{x:290,y:195},{x:244,y:251}];
 return <g data-bio-further-species={organism} data-bio-further-level={node.level}>
  {section}
  {items.map((feature,i)=>{const pt=points[i];return <g key={feature.name} transform={\`translate(\${pt.x} \${pt.y})\`}
   role="button" tabIndex={0} aria-pressed={selectedFeature===feature.name}
   aria-label={"Изучить: "+feature.name} data-bio-further-feature={feature.name}
   className={"lektrus-bio-cell-hotspot"+(selectedFeature===feature.name?" is-selected":"")}
   onClick={()=>onFeatureSelect?.(feature.name)}
   onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();onFeatureSelect?.(feature.name);}}}>
    <circle r="20" fill="#e4f5e9" fillOpacity=".94" stroke="#3c8466" strokeWidth="3"/>
    <circle r="13" fill="#ffffff" stroke="#3c8466" strokeWidth="2"/>
    <text textAnchor="middle" dominantBaseline="central" fontSize="13" fontWeight="800" fill={ink}>{i+1}</text>
    <title>{feature.name}</title>
   </g>})}
 </g>;
}
