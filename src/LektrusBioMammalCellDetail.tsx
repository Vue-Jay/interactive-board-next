/** Mammalia final atlas depth 5/5: six specimen-specific CELL reconstructions.
 * All art is original offline SVG and is explicitly NOT an electron micrograph.
 * The exact three markers of each cell are reused from the legacy core plate:
 * existing diagrams, assignments and feature-focusing share one 480×330 field.
 */
import type {ReactNode} from "react";
import type {BioOrganism,BioNode,BioCellFeature} from "./lektrusBioMicroscopeModel";
import {bioCellFeatures} from "./lektrusBioMicroscopeModel";
import {bioCoreMicroscopySpot} from "./LektrusBioCoreMicroscopyArt";
import type {BioCoreMicroKind} from "./lektrusBioCoreMicroscopyPlates";

export type BioMammalCellKind="pneumocyte"|"cardiomyocyte"|"neuron"|"rod"|"myofiber"|"enterocyte";
export const BIO_MAMMAL_CELL_NODES:Readonly<Record<string,BioMammalCellKind>>={
 "human/дыхательная-система/лёгкие/эпителий-альвеол/пневмоцит-i-типа":"pneumocyte",
 "human/кровеносная-система/сердце/сердечная-мышечная-ткань/кардиомиоцит":"cardiomyocyte",
 "human/нервная-система/головной-мозг/нервная-ткань/нейрон":"neuron",
 "cat/сенсорная-система/глаз/сетчатка/палочка":"rod",
 "cat/опорно-двигательная-система/скелетная-мышца/поперечнополосатая-мышечная-ткань/мышечное-волокно":"myofiber",
 "cat/пищеварительная-система/тонкая-кишка/кишечный-эпителий/энтероцит":"enterocyte"
};
const coreKinds:Record<BioMammalCellKind,BioCoreMicroKind>={
 pneumocyte:"alveoli",cardiomyocyte:"cardiac",neuron:"neural",
 rod:"retina",myofiber:"skeletal",enterocyte:"intestinal"
};
const titles:Record<BioMammalCellKind,string>={
 pneumocyte:"ПНЕВМОЦИТ I ТИПА · ТОНКИЙ ДИФФУЗИОННЫЙ БАРЬЕР",
 cardiomyocyte:"КАРДИОМИОЦИТ · ВЕТВЛЕНИЕ И САРКОМЕРЫ",
 neuron:"НЕЙРОН · ДЕНДРИТЫ, АКСОН И СИНАПСЫ",
 rod:"ПАЛОЧКА · ФОТОРЕЦЕПТОР СЕТЧАТКИ",
 myofiber:"СКЕЛЕТНОЕ МЫШЕЧНОЕ ВОЛОКНО",
 enterocyte:"ЭНТЕРОЦИТ · ПОЛЯРИЗОВАННЫЙ ЭПИТЕЛИЙ"
};
const sublabels:Record<BioMammalCellKind,string>={
 pneumocyte:"Воздух сверху, эндотелий капилляра снизу · схема барьера",
 cardiomyocyte:"Обычно одно центральное ядро · обильные митохондрии",
 neuron:"Сигнал: дендриты → тело клетки → аксон → окончания",
 rod:"Наружные мембранные диски связаны с внутренним сегментом ресничкой",
 myofiber:"Одно длинное многоядерное волокно · ядра у сарколеммы",
 enterocyte:"Микроворсинки на апикальном полюсе · ядро базально"
};
export function bioMammalCellKind(organism:BioOrganism,node:BioNode):BioMammalCellKind|null{
 if(node.level!=="cell"||(organism!=="human"&&organism!=="cat")||
    !node.id.startsWith(organism+"/"))return null;
 return BIO_MAMMAL_CELL_NODES[node.id]??null;
}
export function bioMammalCellSpot(kind:BioMammalCellKind,index:number):{x:number;y:number}|null{
 return bioCoreMicroscopySpot(coreKinds[kind],index);
}
function Guide({d,color="#718d91"}:{d:string;color?:string}){
 return <path d={d} stroke={color} strokeWidth="1.5" fill="none" pointerEvents="none"/>;
}
function Caption({x,y,children}:{x:number;y:number;children:ReactNode}){
 return <text x={x} y={y} fontSize="11" fill="#53676b" fontWeight="650"
  pointerEvents="none">{children}</text>;
}
function Mito({x,y,rotation=0}:{x:number;y:number;rotation?:number}){
 return <g transform={"translate("+x+" "+y+") rotate("+rotation+")"}>
  <ellipse rx="13" ry="6.5" fill="#e9a578" stroke="#ae725e" strokeWidth="2"/>
  <path d="M-9-1q4 7 7 0t8 0t5 0" fill="none" stroke="#ba715b" strokeWidth="1.3"/>
 </g>;
}
function Nucleus({x,y,rx=24,ry=15}:{x:number;y:number;rx?:number;ry?:number}){
 return <g>
  <ellipse cx={x} cy={y} rx={rx} ry={ry} fill="#b9a0ca" stroke="#82719f" strokeWidth="2.8"/>
  <ellipse cx={x-3} cy={y+1} rx={rx*.27} ry={ry*.34} fill="#796b9c"/>
 </g>;
}
function Pneumocyte():ReactNode{
 return <g data-bio-mammal-cell-art="pneumocyte">
  <rect x="0" y="40" width="480" height="132" fill="#fff9ec"/>
  <rect x="0" y="174" width="480" height="156" fill="#f1dcdb"/>
  {/* Type I cell forms one continuous wafer-thin surface with a localized
      thicker perinuclear bulge; an RBC is OUTSIDE the pneumocyte. */}
  <path d="M23 168Q113 160 186 163Q209 151 217 145Q237 128 257 140
    Q273 149 286 161Q321 162 345 168L448 166L448 184
    Q327 181 289 177Q263 176 255 171Q233 166 219 175
    Q147 179 23 185Z"
   fill="#e9bdbe" stroke="#ae8490" strokeWidth="3.3"/>
  <path d="M25 177Q140 171 210 169Q245 167 278 172Q367 178 446 175"
   fill="none" stroke="#fff1e6" strokeWidth="2.2"/>
  <Nucleus x={242} y={151} rx={27} ry={14}/>
  {/* A tight junction appears where adjacent epithelial cells meet. */}
  <path d="M345 167q-3 7 2 15" stroke="#7f617b" strokeWidth="5" fill="none"/>
  <path d="M351 166q-3 7 2 15" stroke="#e5d4ca" strokeWidth="2.5" fill="none"/>
  <path d="M30 193Q236 185 449 194" fill="none" stroke="#9ca69d"
   strokeWidth="4" strokeDasharray="5 3"/>
  {/* Basal lamina, capillary endothelium and erythrocytes in separate layers. */}
  <path d="M28 211Q230 195 450 212" stroke="#9db2b1" strokeWidth="8" fill="none"/>
  <path d="M28 225Q231 214 450 231" stroke="#698d9e" strokeWidth="5" fill="none"/>
  {Array.from({length:7},(_,i)=>{
   const x=73+i*57,y=253+(i%2)*12;
   return <g key={i}><ellipse cx={x} cy={y} rx="18" ry="10"
    fill="#c95e6a" stroke="#a34d5a" strokeWidth="2"/>
    <ellipse cx={x} cy={y} rx="8" ry="4" fill="#e98c89"/></g>;
  })}
  <Caption x={25} y={65}>Просвет альвеолы · воздух</Caption>
  <Caption x={27} y={317}>Капилляр, эритроциты · отдельные клетки</Caption>
  <Guide d="M127 74L105 161"/>
  <Caption x={327} y={113}>Плотный контакт</Caption>
  <Guide d="M368 119L347 167"/>
 </g>;
}
function Cardiomyocyte():ReactNode{
 return <g data-bio-mammal-cell-art="cardiomyocyte">
  <rect width="480" height="330" fill="#fae9df"/>
  {/* A single branching cardiomyocyte, NOT an elongated skeletal syncytium. */}
  <path d="M27 127Q86 113 131 129Q177 133 201 120L231 90Q250 82 276 97
   L304 124Q331 128 373 114L431 120L455 154L440 198L366 209
   Q324 203 292 219L267 246Q241 256 221 236L196 208
   Q125 213 65 208L26 191Z"
   fill="#d99c9b" stroke="#a86e7a" strokeWidth="6"/>
  <path d="M196 131Q220 126 234 103M262 230Q284 212 298 195"
   stroke="#efc0b4" strokeWidth="8" fill="none" opacity=".84"/>
  {Array.from({length:19},(_,i)=>{
   const x=64+i*19.2;
   return <g key={i}><path d={"M"+x+" 143v52"} stroke={i%2?"#b67483":"#edb7ad"}
    strokeWidth={i%2?5:3.2} opacity=".82"/>
    <path d={"M"+(x+5)+" 143v52"} stroke="#f1d2bc" strokeWidth="1.4"/></g>;
  })}
  <Nucleus x={258} y={167} rx={25} ry={18}/>
  {/* Intercalated disc only at an end-to-end cell boundary. */}
  <path d="M354 117l8 12-8 10 8 12-8 11 8 11-8 13 8 12-8 10"
   stroke="#755267" strokeWidth="6" fill="none"/>
  {[ [212,200,-18],[237,202,24],[276,204,-6],[304,146,40],
     [148,178,-22],[300,186,15] ].map(([x,y,r],i)=>
   <Mito key={i} x={x} y={y} rotation={r}/>)}
  <path d="M366 127Q403 114 440 126L453 148V192L433 200Q392 208 367 198"
   fill="none" stroke="#d9aaac" strokeWidth="3" strokeDasharray="7 5"/>
  <Caption x={25} y={73}>Ветвление</Caption><Guide d="M138 82L233 101"/>
  <Caption x={297} y={82}>Вставочный диск</Caption><Guide d="M370 89L358 126"/>
  <Caption x={28} y={285}>Поперечная исчерченность · повторяющиеся саркомеры</Caption>
  <Caption x={26} y={305}>Митохондрии между миофибриллами · центральное ядро</Caption>
 </g>;
}
function Neuron():ReactNode{
 return <g data-bio-mammal-cell-art="neuron">
  <rect width="480" height="330" fill="#f3eef1"/>
  {/* Branched dendrites on one side, soma, one axon with terminal boutons.
      Ion conduction is illustrated by a directional overlay, not rendered
      as a moving organelle or a literal microscopy recording. */}
  <g fill="none" stroke="#b28ca5" strokeLinecap="round">
   <path d="M191 144Q157 123 142 111Q112 102 89 87" strokeWidth="11"/>
   <path d="M186 157Q148 146 123 167L77 178" strokeWidth="9"/>
   <path d="M196 125Q169 95 175 68L159 49" strokeWidth="9"/>
   <path d="M212 133Q223 100 213 83" strokeWidth="7"/>
   <path d="M197 190Q164 208 141 231L101 254" strokeWidth="8"/>
   <path d="M89 87L57 71M89 87L72 110M142 111L129 84M77 178L48 160M77 178L48 196M159 49L139 28M175 68L185 38M101 254L71 249M101 254L79 279"
    strokeWidth="4.5"/>
  </g>
  <path d="M211 118Q251 112 275 139Q289 166 272 191Q256 214 215 210
   Q183 203 181 172Q179 139 211 118Z"
   fill="#dcbad5" stroke="#a47eac" strokeWidth="5"/>
  <Nucleus x={230} y={164} rx={28} ry={24}/>
  {Array.from({length:6},(_,i)=>{
   const a=i*1.18,x=229+41*Math.cos(a),y=168+29*Math.sin(a);
   return <circle key={i} cx={x} cy={y} r="3.4" fill="#bc93b1"/>;
  })}
  {/* Axon hillock, process and the branched terminals at right. */}
  <path d="M272 166Q302 165 323 174L357 185Q381 192 399 211
   L419 229" stroke="#a47c9e" strokeWidth="10"
   fill="none" strokeLinecap="round"/>
  <path className="lektrus-bio-mammal-neuron-signal"
   d="M274 166Q302 165 323 174L357 185Q381 192 399 211L419 229"
   stroke="#f9e9b3" strokeWidth="3" strokeDasharray="7 23" fill="none"
   strokeLinecap="round" pointerEvents="none" aria-hidden="true"/>
  <path d="M402 214L422 207L435 189M412 224L439 236L455 249
   M418 231L412 253L404 273"
   fill="none" stroke="#a47c9e" strokeWidth="5.8" strokeLinecap="round"/>
  {[ [435,189],[418,239],[455,249],[404,273] ].map(([x,y],i)=>
   <g key={i}><ellipse cx={x} cy={y} rx="10" ry="7"
    fill="#d29ebf" stroke="#9679a4" strokeWidth="2.3"/>
    <circle cx={x-3} cy={y} r="2.1" fill="#f7e7bd"/></g>)}
  <Caption x={35} y={66}>Ветвистые дендриты</Caption><Guide d="M138 73L146 110"/>
  <Caption x={308} y={144}>Аксон</Caption><Guide d="M327 151L350 181"/>
  <Caption x={307} y={313}>Синаптические окончания</Caption>
  <Guide d="M403 303L416 248"/>
 </g>;
}
function Rod():ReactNode{
 return <g data-bio-mammal-cell-art="rod">
  <rect width="480" height="330" fill="#f0f5f1"/>
  {/* Distinct outer segment, connecting cilium, inner segment with
      mitochondria, a nucleated cell body and a synaptic spherule.
      NO nucleus in the outer segment. */}
  <rect x="209" y="41" width="62" height="100" rx="12"
   fill="#9ab3cb" stroke="#6c91ad" strokeWidth="5"/>
  {Array.from({length:18},(_,i)=>
   <path key={i} d={"M214 "+(47+i*5)+"h51"} stroke={i%2?"#587d9c":"#cfdee7"}
    strokeWidth={i%2?3.6:2.8} strokeLinecap="round"/>)}
  <path d="M240 140v10" stroke="#bcaa84" strokeWidth="8" strokeLinecap="round"/>
  <circle cx="240" cy="145" r="3.4" fill="#8c7b8f"/>
  <path d="M218 151Q208 169 216 194Q228 207 241 207Q258 207 266 191
   Q273 164 260 151Z"
   fill="#e8c9b1" stroke="#aa9b90" strokeWidth="4"/>
  {[[226,170,18],[244,164,-15],[255,178,45],[231,189,14],[251,194,0]].map(([x,y,r],i)=>
   <Mito key={i} x={x} y={y} rotation={r}/>)}
  <path d="M231 205Q223 219 228 246L249 247Q256 221 249 205"
   fill="#e8c8bb" stroke="#b59a94" strokeWidth="3.2"/>
  <Nucleus x={240} y={228} rx={13} ry={17}/>
  <path d="M238 245v19" stroke="#a887a0" strokeWidth="7" strokeLinecap="round"/>
  <path d="M235 262Q215 259 211 271Q214 288 239 290Q264 286 270 274Q266 259 245 264Z"
   fill="#d7a6c5" stroke="#a47e9d" strokeWidth="3.5"/>
  {Array.from({length:8},(_,i)=>{
   const x=222+(i%4)*11,y=269+Math.floor(i/4)*10;
   return <circle key={i} cx={x} cy={y} r="3" fill="#e9d9ad"
    stroke="#bc9d9a" strokeWidth=".7"/>;
  })}
  <Caption x={24} y={66}>Наружный сегмент</Caption><Guide d="M162 70L208 86"/>
  <Caption x={286} y={130}>Ресничка</Caption><Guide d="M288 134L244 145"/>
  <Caption x={300} y={183}>Митохондрии</Caption><Guide d="M295 187L258 185"/>
  <Caption x={299} y={290}>Синаптическая сфера</Caption><Guide d="M293 288L261 279"/>
  <Caption x={24} y={314}>Фотоны поглощаются пигментом мембранных дисков</Caption>
 </g>;
}
function Myofiber():ReactNode{
 return <g data-bio-mammal-cell-art="myofiber">
  <rect width="480" height="330" fill="#fbefe5"/>
  {/* One giant syncytial fibre is surrounded by sarcolemma. Multiple nuclei
      remain PERIPHERAL, not central like cardiac myocyte nuclei. */}
  <rect x="33" y="105" width="416" height="147" rx="28"
   fill="#e8b6aa" stroke="#ad7980" strokeWidth="7"/>
  <rect x="43" y="115" width="396" height="126" rx="23"
   fill="#d99497" stroke="#f6d1bc" strokeWidth="3"/>
  {Array.from({length:23},(_,i)=>{
   const x=55+i*16.3;
   return <g key={i}>
    <rect x={x} y="123" width="8" height="108"
     fill={i%2?"#b96e7e":"#f0b5ab"} opacity=".94"/>
    <path d={"M"+(x+8)+" 124v107"} stroke="#f9d3c1" strokeWidth="1"/>
   </g>;
  })}
  {/* Parallel myofibrils span length; Z-discs repeat in register. */}
  {Array.from({length:7},(_,i)=>{
   const y=130+i*16;
   return <path key={i} d={"M51 "+y+"H430"} stroke="#a66d77"
    strokeWidth="1.6" strokeDasharray="15 2" opacity=".7"/>;
  })}
  <Nucleus x={93} y={120} rx={17} ry={7}/>
  <Nucleus x={371} y={216} rx={19} ry={7}/>
  <Nucleus x={290} y={123} rx={16} ry={6.5}/>
  <Caption x={26} y={78}>Сарколемма</Caption><Guide d="M108 85L110 105"/>
  <Caption x={298} y={77}>Периферические ядра</Caption><Guide d="M375 84L371 210"/>
  <Caption x={38} y={287}>Миофибриллы · светлые и тёмные поперечные полосы</Caption>
  <Caption x={38} y={306}>Одно мышечное волокно, а не цепочка отдельных клеток</Caption>
 </g>;
}
function Enterocyte():ReactNode{
 return <g data-bio-mammal-cell-art="enterocyte">
  <rect width="480" height="330" fill="#f8efe5"/>
  <rect x="31" y="43" width="418" height="62" rx="12" fill="#fff9eb"/>
  {/* Polarized columnar enterocyte, with an adjacent epithelial neighbour
      linked by an apical tight junction. Brush border is NOT a whole villus. */}
  <path d="M166 108Q190 104 235 109H351V275Q241 290 166 274Z"
   fill="#e8baa1" stroke="#b38578" strokeWidth="5"/>
  <path d="M352 109Q382 104 421 112V269Q388 284 352 272Z"
   fill="#e0bdac" stroke="#b78d80" strokeWidth="4"/>
  <path d="M166 111L352 111" stroke="#a1a580" strokeWidth="6"/>
  {Array.from({length:39},(_,i)=>{
   const x=170+i*4.62;
   return <path key={i} d={"M"+x+" 111v-31"} stroke={i%2?"#cda97e":"#e9cc9f"}
    strokeWidth="2.4" strokeLinecap="round"/>;
  })}
  {/* Tight junction and adherens contact at the apicolateral neighbour. */}
  <path d="M346 118h16m-16 5h16m-16 5h16"
   stroke="#815f73" strokeWidth="4" strokeLinecap="round"/>
  <path d="M352 130v131" stroke="#a97785" strokeWidth="3" strokeDasharray="8 4"/>
  {/* Basally placed nucleus and mitochondria for active transport. */}
  <Nucleus x={258} y={241} rx={28} ry={22}/>
  {[[210,218,40],[215,234,-12],[293,190,12],[283,215,45],[206,170,-28],[303,253,10]]
   .map(([x,y,a],i)=><Mito key={i} x={x} y={y} rotation={a}/>)}
  {Array.from({length:5},(_,i)=><path key={i}
   d={"M181 "+(147+i*11)+"q23 8 40 0t40 0"}
   fill="none" stroke="#c79285" strokeWidth="1.6" opacity=".6"/>)}
  {/* Adjacent goblet cell is outside the enterocyte: mucus vesicles at
      the top, narrow nucleus below. */}
  <path d="M365 141Q342 153 348 177Q351 192 364 204Q390 199 396 179Q403 156 382 141Z"
   fill="#bedbe0" stroke="#8aafb6" strokeWidth="3"/>
  <ellipse cx="377" cy="243" rx="11" ry="12" fill="#ae98b8" stroke="#8a789f" strokeWidth="2"/>
  <path d="M163 277Q241 291 415 279" stroke="#ab8a82" strokeWidth="6" fill="none"/>
  <Caption x={26} y={63}>Просвет кишки</Caption>
  <Caption x={24} y={141}>Щёточная</Caption><Caption x={24} y={154}>каёмка</Caption>
  <Guide d="M121 150L205 80"/>
  <Caption x={346} y={68}>Микроворсинки</Caption><Guide d="M350 72L278 89"/>
  <Caption x={337} y={317}>Базальная поверхность</Caption>
 </g>;
}
const art:Record<BioMammalCellKind,()=>ReactNode>={
 pneumocyte:Pneumocyte,cardiomyocyte:Cardiomyocyte,neuron:Neuron,
 rod:Rod,myofiber:Myofiber,enterocyte:Enterocyte
};
export default function LektrusBioMammalCellDetail({organism,node,selectedFeature,onFeatureSelect}:{
 organism:BioOrganism;node:BioNode;selectedFeature?:string|null;
 onFeatureSelect?:(name:string)=>void
}):ReactNode{
 const kind=bioMammalCellKind(organism,node);
 if(!kind)return null;
 const Drawing=art[kind];
 const features:BioCellFeature[]=bioCellFeatures(node);
 return <g data-bio-mammal-cell={kind} data-bio-mammal-organism={organism}
  data-bio-mammal-level="cell">
  <Drawing/>
  <rect x="9" y="9" width="462" height="29" rx="8"
   fill="#fffcf5" fillOpacity=".94" stroke="#c9d7cf" pointerEvents="none"/>
  <text x="19" y="29" fontSize="12" fontWeight="800" fill="#3b6158"
   pointerEvents="none">{titles[kind]}</text>
  <text x="468" y="324" textAnchor="end" fontSize="9.3" fill="#657e79"
   pointerEvents="none">{sublabels[kind]}</text>
  {onFeatureSelect&&features.map((feature,i)=>{
   const pos=bioMammalCellSpot(kind,i);
   if(!pos)return null;
   const active=selectedFeature===feature.name;
   return <g key={feature.name} role="button" tabIndex={0}
    aria-label={"Рассмотреть: "+feature.name} aria-pressed={active}
    data-bio-mammal-cell-feature={feature.name}
    data-bio-mammal-feature-number={i+1}
    className={"lektrus-bio-cell-hotspot"+(active?" is-selected":"")}
    transform={"translate("+pos.x+" "+pos.y+")"}
    onClick={()=>onFeatureSelect(feature.name)}
    onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){
     e.preventDefault();e.stopPropagation();onFeatureSelect(feature.name);
    }}}>
    <circle r="19" fill={active?"#ffedc8":"#f4fff9"}
     fillOpacity=".97" stroke={active?"#bd783f":"#33896d"} strokeWidth="3.2"/>
    <circle r="11" fill="#fffdf7" stroke="#b0c4b7" strokeWidth="1.6"/>
    <text textAnchor="middle" dominantBaseline="central" fontSize="12"
     fontWeight="850" fill="#316956" pointerEvents="none">{i+1}</text>
    <title>{feature.name}</title>
   </g>;
  })}
 </g>;
}
