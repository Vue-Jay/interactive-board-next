/** Focused Mammalia atlas: stage 4/5, six tissue-scale reconstructions.
 * Each preparation is deliberately a teaching diagram, NOT a calibration or
 * a real photomicrograph. The single cell hotspot is provided by the same
 * reviewed anatomy model used for parent/child zoom and classroom tasks.
 */
import type {ReactNode} from "react";
import type {BioNode,BioOrganism,BioImageSpot} from "./lektrusBioMicroscopeModel";
import {bioMammalTissueCellSpot} from "./lektrusBioMicroscopeModel";
export type BioMammalTissueKind="alveolar"|"cardiac"|"nervous"|"retina"|"skeletal"|"intestinal";
export const BIO_MAMMAL_TISSUE_KINDS:Readonly<Record<string,BioMammalTissueKind>>={
 "human/дыхательная-система/лёгкие/эпителий-альвеол":"alveolar",
 "human/кровеносная-система/сердце/сердечная-мышечная-ткань":"cardiac",
 "human/нервная-система/головной-мозг/нервная-ткань":"nervous",
 "cat/сенсорная-система/глаз/сетчатка":"retina",
 "cat/опорно-двигательная-система/скелетная-мышца/поперечнополосатая-мышечная-ткань":"skeletal",
 "cat/пищеварительная-система/тонкая-кишка/кишечный-эпителий":"intestinal"
};
export function bioMammalTissueKind(
 organism:BioOrganism,node:BioNode
):BioMammalTissueKind|null{
 if(node.level!=="tissue"||(organism!=="human"&&organism!=="cat")||
    !node.id.startsWith(organism+"/"))return null;
 return BIO_MAMMAL_TISSUE_KINDS[node.id]??null;
}
const ink="#3e5c58",pink="#bb7d88",blue="#668fa5";
const name:Record<BioMammalTissueKind,string>={
 alveolar:"АЛЬВЕОЛЯРНЫЙ ЭПИТЕЛИЙ",
 cardiac:"МИОКАРД · СЕРДЕЧНАЯ МЫШЦА",
 nervous:"НЕРВНАЯ ТКАНЬ МОЗГА",
 retina:"СЕТЧАТКА КОШКИ · СЛОИ",
 skeletal:"СКЕЛЕТНАЯ ПОПЕРЕЧНОПОЛОСАТАЯ",
 intestinal:"КИШЕЧНЫЙ ЭПИТЕЛИЙ"
};
function Label({x,y,children,color=ink}:{x:number;y:number;children:ReactNode;color?:string}){
 return <text x={x} y={y} fontSize="11" fontWeight="680" fill={color} pointerEvents="none">{children}</text>;
}
function Line({d,color="#668480"}:{d:string;color?:string}){
 return <path d={d} fill="none" stroke={color} strokeWidth="1.7" pointerEvents="none"/>;
}
/** Three alveolar lumens surrounded by single squamous epithelial linings,
 * thin alveolar septa with capillary red cells, and a separate surfactant-
 * producing type II cell. An alveolar macrophage is NOT a pneumocyte.
 */
function Alveolar():ReactNode{
 const bubbles=[[123,155,80],[342,136,84],[232,269,73]] as const;
 return <g data-bio-mammal-tissue-art="alveolar">
  <rect width="480" height="330" fill="#f3dfe0"/>
  <path d="M43 78Q112 29 185 72Q246 39 323 56Q411 46 457 120V314H29Z"
   fill="#e5bdc0" opacity=".48"/>
  {bubbles.map(([x,y,r],i)=><g key={i}>
   <circle cx={x} cy={y} r={r+9} fill="#c48c95" opacity=".3"/>
   <circle cx={x} cy={y} r={r} fill="#fffaf0" stroke="#d5a3ab" strokeWidth="8"/>
   <circle cx={x} cy={y} r={r-5} fill="none" stroke="#f2d1cd" strokeWidth="2"/>
  </g>)}
  {/* Shared thin septum: the elongated type I pneumocyte wraps the lumen;
      the adjacent capillary is in the septum, not floating inside air. */}
  <path d="M204 168Q225 156 252 168Q274 178 289 167" stroke="#c67e8b"
   strokeWidth="7" fill="none" strokeLinecap="round"/>
  <ellipse cx="246" cy="182" rx="19" ry="5.4" fill="#e9b3bd"
   stroke="#a8677b" strokeWidth="1.8"/>
  <ellipse cx="246" cy="182" rx="7" ry="3.3" fill="#876d91"/>
  <path d="M211 197Q245 207 280 193" stroke={blue} strokeWidth="11" fill="none" opacity=".85"/>
  {[[231,201],[252,204],[270,198]].map(([x,y],i)=><ellipse key={i} cx={x} cy={y}
   rx="9" ry="5.2" fill="#b54d63" stroke="#f0a5a0" strokeWidth="1.2"/>)}
  <g transform="translate(181 201)">
   <path d="M-13 4Q-18-7-6-14Q5-22 14-11Q18 0 8 9L0 15Z"
    fill="#efbdba" stroke="#b37b83" strokeWidth="2"/>
   <ellipse rx="6" ry="5" fill="#987f9e"/>
  </g>
  <path d="M365 162q-19-11-29 5q-8 13 8 22q16 6 21-6" fill="#c0a1b8"
   stroke="#8b8198" strokeWidth="3"/>
  <circle cx="349" cy="175" r="5" fill="#8f7b98"/>
  <Label x={30} y={49}>Воздушное пространство</Label>
  <Line d="M138 54L119 85"/>
  <Label x={300} y={65}>Альвеола</Label>
  <Line d="M337 72L354 96"/>
  <Label x={25} y={243}>Пневмоцит II</Label>
  <Line d="M118 238L169 210" color={pink}/>
  <Label x={286} y={236}>Капилляр</Label>
  <Line d="M286 227L262 204" color={blue}/>
  <Label x={304} y={306}>Макрофаг в просвете</Label>
  <Line d="M359 296L355 188" color={pink}/>
 </g>;
}
/** Branched, striated cardiomyocytes with CENTRAL nuclei, dark transverse
 * intercalated discs and loose interstitium with capillaries. Unlike
 * skeletal muscle these are short branched interconnected cells. */
function Cardiac():ReactNode{
 return <g data-bio-mammal-tissue-art="cardiac">
  <rect width="480" height="330" fill="#faebe3"/>
  {[
   "M20 84Q92 71 165 84Q226 72 277 82L314 62Q377 53 469 77L469 127Q360 105 319 125Q244 137 185 122L20 137Z",
   "M13 153Q92 133 163 151Q234 135 310 152L463 139L474 208Q371 217 312 204L194 217Q98 210 16 226Z",
   "M14 242Q103 220 171 236Q240 219 306 245L471 228L473 294Q365 314 300 295L184 303Q89 294 18 309Z"
  ].map((d,i)=><path key={i} d={d} fill={i===1?"#d79a9a":"#d9a4a5"}
   stroke="#ad777f" strokeWidth="3.6"/>)}
  {Array.from({length:23},(_,i)=>{
   const x=28+i*19;
   return <g key={i} opacity=".68" stroke="#b06d78" strokeWidth="2">
    <path d={"M"+x+" 86v36"}/><path d={"M"+x+" 156v48"}/><path d={"M"+x+" 244v49"}/>
   </g>;
  })}
  {/* Cross-fiber intercalated discs rather than generic longitudinal stripes. */}
  {[128,333].map((x,i)=><g key={i} fill="none" stroke="#7d505c" strokeWidth="5">
   <path d={"M"+x+" 78l5 8-5 9 5 10-5 8"}/>
   <path d={"M"+(x+17)+" 151l5 9-5 9 5 9-5 8"}/>
   <path d={"M"+(x+29)+" 241l5 9-5 9 5 9-5 8"}/>
  </g>)}
  {[[212,106],[210,159],[276,269],[405,175]].map(([x,y],i)=><g key={i}>
   <ellipse cx={x} cy={y} rx="20" ry="11" fill="#bb878f" stroke="#915d73" strokeWidth="2"/>
   <ellipse cx={x} cy={y} rx="11" ry="7" fill="#856789"/>
  </g>)}
  <path d="M15 139Q235 129 470 134M15 230Q245 221 470 227"
   stroke="#f8e6d3" strokeWidth="7" fill="none" opacity=".95"/>
  <path d="M87 142Q116 145 147 137" stroke={blue} strokeWidth="8" fill="none"/>
  <ellipse cx="122" cy="140" rx="8" ry="4" fill="#be5464"/>
  <Label x={22} y={51}>Центральное ядро</Label><Line d="M129 55L203 148"/>
  <Label x={318} y={44}>Вставочный диск</Label><Line d="M373 52L336 154"/>
  <Label x={23} y={323}>Капилляр в межклеточной ткани</Label>
  <Line d="M130 311L119 147" color={blue}/>
 </g>;
}
/** Neuron bodies, dendrites, axon, a smaller supporting glial cell and
 * neuropil are not conflated with one giant generic 'brain cell'. */
function Nervous():ReactNode{
 return <g data-bio-mammal-tissue-art="nervous">
  <rect width="480" height="330" fill="#f6edeb"/>
  {Array.from({length:18},(_,i)=>{
   const x=28+(i*67)%441,y=69+(i*53)%239;
   return <path key={i} d={"M"+x+" "+y+"q18 -21 43 2t26 17"}
    fill="none" stroke="#d5c1c6" strokeWidth="2.4" opacity=".55"/>;
  })}
  {/* Dendrites branch toward multiple synaptic inputs. */}
  <g stroke="#ae818c" strokeWidth="6" fill="none" strokeLinecap="round">
   <path d="M187 142Q146 106 113 113Q89 115 71 89"/>
   <path d="M183 179Q151 196 112 185Q87 179 64 213"/>
   <path d="M207 120Q205 84 194 66L174 43"/>
   <path d="M249 137Q287 101 310 106"/>
   <path d="M226 207Q229 243 209 259"/>
  </g>
  <g stroke="#bd929b" strokeWidth="3" fill="none">
   <path d="M112 113L88 131L63 128M112 113L100 84L79 62M71 89L56 73L35 72"/>
   <path d="M115 184L83 162L61 170M65 212L43 216L31 239"/>
   <path d="M194 66L211 49L209 29M309 106L335 89L353 96M309 106L329 121L352 118"/>
  </g>
  <path d="M220 123Q249 119 259 150Q270 181 242 202Q222 219 193 199Q169 186 177 157Q184 130 220 123Z"
   fill="#e7b5ba" stroke="#a47688" strokeWidth="5"/>
  <ellipse cx="211" cy="161" rx="26" ry="20" fill="#cb9cb3" stroke="#9e7798" strokeWidth="2.5"/>
  <circle cx="214" cy="160" r="8" fill="#886f97"/>
  {/* Axon leaves the soma; myelin segments belong to a separate process. */}
  <path d="M258 171Q299 180 322 207L431 239" stroke="#b28b96" strokeWidth="5"
   fill="none" strokeLinecap="round"/>
  {[324,352,380,408].map((x,i)=><path key={i}
   d={"M"+x+" "+(207+(i*8))+"q7 -8 16 0"}
   stroke="#e6d0b1" strokeWidth="9" strokeLinecap="round" fill="none"/>)}
  {[["#c1b6d4",355,118],["#b7c1c8",315,270],["#c1b6d4",100,267]].map(([color,x,y],i)=><g key={i}>
   <ellipse cx={Number(x)} cy={Number(y)} rx="18" ry="14" fill={String(color)} stroke="#9b9ead" strokeWidth="2"/>
   <ellipse cx={Number(x)} cy={Number(y)} rx="9" ry="8" fill="#947ea8"/>
  </g>)}
  <Label x={25} y={56}>Дендриты</Label><Line d="M101 62L133 118"/>
  <Label x={302} y={75}>Глия</Label><Line d="M330 80L352 109"/>
  <Label x={324} y={305}>Аксон и миелин</Label><Line d="M358 288L381 233"/>
 </g>;
}
/** Retina is inverted: vitreous -> ganglion cells -> inner plexiform/nuclear
 * layers -> photoreceptor nuclei -> outer segments -> pigment epithelium ->
 * CHOROID WITH TAPETUM. Tapetum is NOT part of the retina.
 */
function Retina():ReactNode{
 return <g data-bio-mammal-tissue-art="retina">
  <rect width="480" height="330" fill="#faf6f0"/>
  <rect x="101" y="52" width="277" height="29" fill="#eaf6f1"/>
  <rect x="101" y="81" width="277" height="33" fill="#e3d3d9"/>
  <rect x="101" y="114" width="277" height="23" fill="#e9d8e1"/>
  <rect x="101" y="137" width="277" height="26" fill="#d9c1d2"/>
  <rect x="101" y="163" width="277" height="22" fill="#f0dbe5"/>
  <rect x="101" y="185" width="277" height="31" fill="#dac0d0"/>
  <rect x="101" y="216" width="277" height="39" fill="#e1cfc1"/>
  <rect x="101" y="255" width="277" height="13" fill="#9e8186"/>
  <rect x="101" y="268" width="277" height="21" fill="#9fc9be"/>
  <rect x="101" y="289" width="277" height="16" fill="#c7aeb0"/>
  <path d="M101 53V305M378 53V305" stroke="#ac9994" strokeWidth="3"/>
  {Array.from({length:13},(_,i)=>{
   const x=113+i*20;
   return <g key={i}>
    <ellipse cx={x} cy={98+(i%2)*6} rx="8" ry="7" fill="#9d778d"/>
    <path d={"M"+x+" 105Q"+(x+8)+" 131 "+(x+2)+" 157"}
     stroke="#b78ea4" strokeWidth="1.6" fill="none"/>
    <ellipse cx={x+1} cy={148+(i%3)*3} rx="5" ry="7" fill="#916e96"/>
    <ellipse cx={x+1} cy={198+(i%3)*5} rx="5" ry="9" fill="#856985"/>
    <path d={"M"+(x+1)+" 210v9"} stroke="#b692a0" strokeWidth="2"/>
    <rect x={x-3.3} y="220" width="7" height="32" rx="3"
     fill={i%4===0?"#c69680":"#bd8d99"} stroke="#a68080" strokeWidth="1"/>
    <path d={"M"+(x-2)+" 225h5m-5 5h5m-5 5h5m-5 5h5"} stroke="#785d6c" strokeWidth="1.2"/>
   </g>;
  })}
  {/* Selected rod at x=277, y=229 sits INSIDE the photoreceptor segments. */}
  <path d="M103 261H375" stroke="#6a5664" strokeWidth="4" strokeDasharray="6 4"/>
  {Array.from({length:9},(_,i)=><ellipse key={i} cx={119+i*30} cy="279"
   rx="8" ry="4.5" fill="#d7e7d2" stroke="#659c8e" strokeWidth="1.4"/>)}
  <Label x={14} y={51}>Стекловидное тело</Label>
  <Label x={4} y={97}>Ганглиозные</Label>
  <Label x={4} y={111}>клетки</Label>
  <Label x={4} y={154}>Биполярные</Label>
  <Label x={4} y={167}>клетки</Label>
  <Label x={7} y={200}>Ядра</Label>
  <Label x={7} y={213}>рецепторов</Label>
  <Label x={382} y={233}>Палочки</Label>
  <Label x={382} y={247}>и колбочки</Label>
  <Label x={383} y={268}>Пигментный</Label>
  <Label x={383} y={279}>эпителий</Label>
  <Label x={383} y={295}>Тапетум</Label>
  <Label x={383} y={306}>в хориоидее</Label>
  <Label x={106} y={319}>Свет входит сверху · тапетум снаружи сетчатки</Label>
 </g>;
}
/** Skeletal fibres are long multinucleated cells (not bundles of tiny
 * discrete muscle cells). Nuclei sit at the sarcolemmal PERIPHERY, with
 * repeating cross-striations inside, and endomysium between fibres. */
function Skeletal():ReactNode{
 return <g data-bio-mammal-tissue-art="skeletal">
  <rect width="480" height="330" fill="#f8ebdf"/>
  {[76,138,200,262].map((y,i)=><g key={i}>
   <rect x="36" y={y-23} width="406" height="49" rx="22"
    fill={i%2?"#db9795":"#dcaaa2"} stroke="#ac767a" strokeWidth="4"/>
   <rect x="46" y={y-17} width="388" height="37" rx="18" fill="none"
    stroke="#f2cebc" strokeWidth="3" opacity=".8"/>
   {Array.from({length:25},(_,j)=>{
    const x=55+j*15;
    return <g key={j} stroke={j%2?"#b8737d":"#eab9b0"} strokeWidth={j%2?5:3.5}
     opacity=".77"><path d={"M"+x+" "+(y-17)+"v36"}/></g>;
   })}
   {/* Peripheral nuclei: not placed in the centre of the fibres. */}
   {[119,307].map((x,j)=><ellipse key={j} cx={x+(i%2)*17} cy={y+18-(j%2)*38}
    rx="15" ry="5.4" fill="#876a94" stroke="#cf9da7" strokeWidth="1.6"/>)}
  </g>)}
  <path d="M43 113Q225 111 439 115M43 177Q240 173 439 177M43 238Q228 233 439 238"
   stroke="#f8e9d4" strokeWidth="7" fill="none"/>
  <path d="M38 113Q239 115 444 112" stroke="#f5d4ca" strokeWidth="3" strokeDasharray="9 7"/>
  <path d="M43 239Q219 235 440 240" stroke="#f5d4ca" strokeWidth="3" strokeDasharray="9 7"/>
  <path d="M78 114Q92 125 108 114" stroke="#6e95a7" strokeWidth="6" fill="none"/>
  <ellipse cx="91" cy="117" rx="7" ry="3.8" fill="#b94d64"/>
  <Label x={30} y={42}>Поперечная исчерченность</Label>
  <Line d="M162 45L216 82"/>
  <Label x={273} y={45}>Периферическое ядро</Label>
  <Line d="M357 51L327 94"/>
  <Label x={21} y={321}>Эндомизий между волокнами · капилляры</Label>
 </g>;
}
/** Single layer of polarized ENTEROCYTES on a villus; some goblet cells
 * interspersed, microvilli are tiny apical projections on enterocytes,
 * while the entire villus contains connective tissue and capillaries.
 */
function Intestinal():ReactNode{
 return <g data-bio-mammal-tissue-art="intestinal">
  <rect width="480" height="330" fill="#f9eee3"/>
  <path d="M23 55H457V84H23Z" fill="#fff9ec"/>
  <path d="M35 298Q101 280 127 285Q171 278 178 252V139Q179 82 228 77
   Q270 82 270 139V245Q273 281 319 284Q369 278 446 296V329H35Z"
   fill="#e9c5ae" stroke="#b99185" strokeWidth="5"/>
  {/* The absorptive epithelium runs ON the villus surface, not inside
      the capillary-bearing lamina propria. */}
  <path d="M179 251V139Q180 84 228 77Q270 84 270 140V245"
   stroke="#d5a99b" strokeWidth="20" fill="none" strokeLinecap="round"/>
  <path d="M186 249V137Q185 94 226 87Q260 92 261 141V248"
   stroke="#f4dfc5" strokeWidth="6" fill="none"/>
  {/* A visible layer of columnar enterocytes on the LEFT wall of the
      villus, each with a basal nucleus and a microvillus brush border. */}
  {Array.from({length:8},(_,i)=>{
   const y=105+i*19;
   return <g key={i}>
    <rect x="188" y={y} width="17" height="18" rx="3"
     fill={i===4?"#dfd8e7":"#e7b8a2"} stroke="#b87f7a" strokeWidth="1.3"/>
    <ellipse cx="198" cy={y+12} rx="4" ry="3.1" fill="#a47c9d"/>
    {Array.from({length:4},(_,j)=><path key={j}
     d={"M"+(186-j*2)+" "+(y+3+j*4)+"h-3"} stroke="#e3c190" strokeWidth="1.3"/>)}
   </g>;
  })}
  {/* Goblet cells are secretory and NOT enterocytes; blue mucin is
      apically expanded while the nucleus remains narrow/basal. */}
  {[136,206].map((y,i)=><g key={i} transform={"translate(253 "+y+")"}>
   <path d="M-8 6Q-18-12-6-17Q5-22 9-8L8 7Z"
    fill="#bed7dc" stroke="#92afb4" strokeWidth="2"/>
   <ellipse cx="1" cy="3" rx="3" ry="4" fill="#927b9c"/>
  </g>)}
  {/* Lamina propria of the villus: a blood capillary loop plus a central
      lymphatic capillary (lacteal), both INSIDE connective tissue. */}
  <path d="M218 263Q218 193 217 129Q215 112 226 108Q242 114 239 132V250"
   stroke="#e2d0b5" strokeWidth="10" fill="none"/>
  <path d="M213 239Q207 171 212 121Q229 103 241 129Q244 179 245 237"
   stroke="#bd717d" strokeWidth="3.4" fill="none"/>
  {[[211,159],[244,187],[211,219]].map(([x,y],i)=><ellipse key={i}
   cx={x} cy={y} rx="5" ry="3" fill="#b94d61"/>)}
  <path d="M31 290H449" stroke="#a88085" strokeWidth="5"/>
  <Label x={23} y={46}>Просвет кишки</Label>
  <Label x={300} y={104}>Бокаловидная клетка</Label>
  <Line d="M338 112L265 142"/>
  <Label x={294} y={226}>Собственная пластинка</Label>
  <Line d="M311 233L243 237"/>
  <Label x={304} y={258}>Капилляры и лимфатический</Label>
  <Label x={304} y={272}>сосуд внутри ворсинки</Label>
  <Label x={24} y={316}>Крипты лежат между ворсинками у их основания</Label>
 </g>;
}
const drawings:Record<BioMammalTissueKind,()=>ReactNode>={
 alveolar:Alveolar,cardiac:Cardiac,nervous:Nervous,
 retina:Retina,skeletal:Skeletal,intestinal:Intestinal
};
export default function LektrusBioMammalTissueSections({organism,node}:{
 organism:BioOrganism;node:BioNode
}):ReactNode{
 const kind=bioMammalTissueKind(organism,node);
 if(!kind)return null;
 const spot:BioImageSpot|null=bioMammalTissueCellSpot(organism,node);
 if(!spot)return null;
 const Drawing=drawings[kind];
 return <g data-bio-mammal-tissue={kind}
  data-bio-mammal-organism={organism} data-bio-mammal-depth="tissue"
  data-bio-mammal-cell-x={spot.x} data-bio-mammal-cell-y={spot.y}>
  <Drawing/>
  <rect x="8" y="8" width={kind==="skeletal"?321:kind==="cardiac"?297:kind==="retina"?267:249}
   height="30" rx="9" fill="#fffdf6" stroke="#c7d4c8" strokeWidth="1.4" opacity=".97"/>
  <text x="19" y="28" fontSize="12" fontWeight="800" fill="#355e52">{name[kind]}</text>
  <circle data-bio-mammal-cell-spot="true" cx={spot.x} cy={spot.y}
   r="13" fill="#efcb87" fillOpacity=".24" stroke="#a6764f" strokeWidth="2"
   strokeDasharray="4 3" pointerEvents="none"/>
  <text x="470" y="326" textAnchor="end" fontSize="9" fill="#647c72"
   pointerEvents="none">Тканевый срез · учебная реконструкция</text>
 </g>;
}
