/** Original vector histology for the original four atlas species.
 * A microplate represents an anatomical layer, NOT measured optical zoom.
 * Node IDs/levels are never changed by rendering. Kept as SVG to work offline.
 */
import type {ReactNode} from "react";
import type {BioCoreMicroPlate,BioCoreMicroKind} from "./lektrusBioCoreMicroscopyPlates";
import type {BioCellFeature} from "./lektrusBioMicroscopeModel";

const wall="#648b62",nucleus="#9477ad";
const spots:Record<BioCoreMicroKind,readonly [{x:number;y:number},{x:number;y:number},{x:number;y:number}]>={
 alveoli:[{x:98,y:170},{x:340,y:183},{x:242,y:152}],
 cardiac:[{x:182,y:149},{x:353,y:168},{x:236,y:198}],
 neural:[{x:147,y:110},{x:348,y:184},{x:418,y:239}],
 retina:[{x:240,y:96},{x:239,y:171},{x:239,y:266}],
 skeletal:[{x:110,y:102},{x:245,y:173},{x:370,y:206}],
 intestinal:[{x:232,y:79},{x:354,y:125},{x:215,y:227}],
 palisade:[{x:142,y:129},{x:258,y:172},{x:379,y:196}],
 "root-hair":[{x:384,y:180},{x:144,y:145},{x:247,y:207}],
 stomata:[{x:243,y:167},{x:177,y:176},{x:321,y:171}],
 petal:[{x:113,y:167},{x:242,y:172},{x:240,y:80}],
 xylem:[{x:156,y:167},{x:239,y:88},{x:246,y:192}],
 mesophyll:[{x:148,y:128},{x:257,y:176},{x:392,y:201}]
};
/** Share the exact drawing marker with the microscope camera. */
export function bioCoreMicroscopySpot(kind:BioCoreMicroKind,index:number):{x:number;y:number}|null{
 return spots[kind]?.[index]??null;
}
function CircleNucleus({x,y,rx=15,ry=10}:{x:number;y:number;rx?:number;ry?:number}){
 return <g><ellipse cx={x} cy={y} rx={rx} ry={ry} fill="#c2acd0" stroke="#8f77a7" strokeWidth="2.4"/>
 <circle cx={x-2} cy={y} r="3.5" fill={nucleus}/></g>;
}
function Chloroplast({x,y,angle=0}:{x:number;y:number;angle?:number}){
 return <g transform={`translate(${x} ${y}) rotate(${angle})`}>
  <ellipse rx="12" ry="6.7" fill="#78ad68" stroke="#42794d" strokeWidth="1.6"/>
  <path d="M-6-2h12M-5 1h10" stroke="#3c7750" strokeWidth="1.2"/>
 </g>;
}
function PlantWall({x,y,w,h}:{x:number;y:number;w:number;h:number}){
 return <rect x={x} y={y} width={w} height={h} rx="10" fill="#dbe9c0" stroke={wall} strokeWidth="6"/>;
}
function Tissue({kind}:{kind:BioCoreMicroKind}):ReactNode{
 switch(kind){
 case "alveoli":return <g>
  <path d="M23 267Q120 246 189 270T458 262" fill="none" stroke="#c77d87" strokeWidth="22"/>
  {[[105,122,64],[244,154,76],[373,110,60],[144,238,45],[332,241,51]].map(([x,y,r],i)=><g key={i}>
   <circle cx={x} cy={y} r={r} fill="#f9f5e9" stroke="#dcacac" strokeWidth="14"/>
   <circle cx={x} cy={y} r={r-11} fill="#fff9ed" stroke="#efc9c4" strokeWidth="2"/>
   <CircleNucleus x={x+r*.72} y={y-r*.55} rx={7} ry={4}/>
  </g>)}
  {Array.from({length:13},(_,i)=><ellipse key={i} cx={55+i*31} cy={269+Math.sin(i)*6} rx="11" ry="5.7" fill="#ad6471" stroke="#f4b3af" strokeWidth="1.2"/>)}
  <text x="30" y="320" fontSize="12" fill="#97616a">Альвеола → тонкий барьер → капилляр</text>
 </g>;
 case "cardiac":return <g>
  {Array.from({length:6},(_,i)=>{const y=77+i*35;
   return <g key={i}>
    <path d={`M35 ${y+16}Q120 ${y-12} 196 ${y+7}T439 ${y-3}`} fill="none" stroke="#b96d7b" strokeWidth="28" strokeLinecap="round"/>
    <path d={`M42 ${y+8}Q150 ${y-15} 216 ${y}T431 ${y-11}`} fill="none" stroke="#edb1b4" strokeWidth="10" opacity=".75"/>
    {Array.from({length:14},(_,j)=><path key={j} d={`M${66+j*26} ${y-9}v23`} stroke="#9c5765" strokeWidth="3" opacity=".58"/>)}
    <CircleNucleus x={118+i%2*90} y={y+4} rx={14} ry={7}/>
   </g>;
  })}
  {[170,315].map((x,i)=><path key={i} d={`M${x} 62v249`} stroke="#724a5d" strokeWidth="4" strokeDasharray="8 5"/>)}
  <text x="28" y="320" fontSize="12" fill="#84485a">Разветвлённые волокна · вставочные диски</text>
 </g>;
 case "neural":return <g>
  {Array.from({length:9},(_,i)=>{const x=75+(i%3)*162,y=87+Math.floor(i/3)*83;
   return <g key={i}>
    <path d={`M${x} ${y}q-36-27-57-28m57 28q37-33 63-23m-63 23q-18 37-42 45m42-45q49 24 66 57`}
     stroke="#927cb1" strokeWidth="6" fill="none" strokeLinecap="round"/>
    <ellipse cx={x} cy={y} rx="24" ry="18" fill="#d9c3e0" stroke="#9277a9" strokeWidth="3"/>
    <CircleNucleus x={x} y={y} rx={10} ry={8}/>
   </g>;
  })}
  {Array.from({length:21},(_,i)=><circle key={i} cx={34+(i%7)*68} cy={65+Math.floor(i/7)*100} r="5" fill="#85a7b4" opacity=".75"/>)}
 </g>;
 case "retina":return <g>
  <rect x="35" y="44" width="410" height="243" rx="16" fill="#efdfcb" stroke="#af9a96" strokeWidth="4"/>
  <rect x="35" y="44" width="410" height="25" rx="10" fill="#ad8889"/>
  {Array.from({length:20},(_,i)=>{const x=50+i*20;
   return <g key={i}>
    <rect x={x} y="72" width="10" height="64" rx="4" fill={i%3?"#7893ac":"#9bb6bc"} stroke="#607d96" strokeWidth="1.2"/>
    <ellipse cx={x+5} cy="149" rx="7" ry="12" fill="#cfb2ca"/>
    <path d={`M${x+5} 161v28`} stroke="#a49c9f" strokeWidth="2.1"/>
    <circle cx={x+5} cy="206" r="7" fill="#c9a1b5"/>
   </g>;
  })}
  <path d="M38 188H444M38 239H444" stroke="#d2afa7" strokeWidth="5"/>
  {Array.from({length:9},(_,i)=><g key={i}><circle cx={72+i*42} cy="264" r="11" fill="#dbaaae" stroke="#b98f9c" strokeWidth="1.5"/>
   <path d={`M${72+i*42} 274v16`} stroke="#926f93" strokeWidth="3"/></g>)}
  <text x="38" y="320" fontSize="12" fill="#6f647f">Пигментный слой · фоторецепторы · нейроны</text>
 </g>;
 case "skeletal":return <g>
  {Array.from({length:5},(_,i)=>{const y=65+i*49;return <g key={i}>
   <rect x="32" y={y} width="416" height="40" rx="16" fill={i%2?"#e1a19d":"#d58e8f"} stroke="#ab6f76" strokeWidth="3"/>
   {Array.from({length:27},(_,j)=><path key={j} d={`M${54+j*14} ${y+5}v30`} stroke={j%2?"#b46b75":"#f4c1b2"} strokeWidth="5" opacity=".75"/>)}
   {[105,298,401].map((x,k)=><ellipse key={k} cx={x} cy={y+5} rx="12" ry="5" fill="#9578aa" stroke="#6e5c87" strokeWidth="1.4"/>)}
  </g>;})}
  <text x="36" y="320" fontSize="12" fill="#93656b">Параллельные волокна · периферические ядра</text>
 </g>;
 case "intestinal":return <g>
  <rect x="38" y="47" width="404" height="247" rx="12" fill="#eed0bb" stroke="#bd968d" strokeWidth="5"/>
  {Array.from({length:11},(_,i)=>{const x=51+i*35;return <g key={i}>
   <rect x={x} y="103" width="33" height="164" rx="7" fill="#f7e0c9" stroke="#b79c91" strokeWidth="2.7"/>
   <ellipse cx={x+17} cy="219" rx="9" ry="16" fill="#b6a1c4" stroke="#8c82aa" strokeWidth="1.8"/>
   {Array.from({length:8},(_,j)=><path key={j} d={`M${x+2+j*4} 103v-18`} stroke="#be917f" strokeWidth="2.5" strokeLinecap="round"/>)}
  </g>;})}
  <path d="M41 272H440" stroke="#bd8e89" strokeWidth="7"/>
  <text x="33" y="320" fontSize="12" fill="#977a6b">Однослойный эпителий · щёточная каёмка</text>
 </g>;
 case "palisade":return <g>
  <path d="M30 69H448" stroke="#7b9e6c" strokeWidth="18"/>
  {Array.from({length:8},(_,i)=>{const x=38+i*52;return <g key={i}>
   <PlantWall x={x} y={83} w={48} h={193}/>
   <rect x={x+8} y="104" width="32" height="146" rx="9" fill="#c4e2df" stroke="#92b9ae" strokeWidth="1.5"/>
   {Array.from({length:10},(_,j)=><Chloroplast key={j} x={x+7+(j%2)*34} y={111+Math.floor(j/2)*32} angle={j*33}/>)}
   <CircleNucleus x={x+20} y={255} rx={10} ry={8}/>
  </g>;})}
  <text x="36" y="320" fontSize="12" fill="#4a7754">Клетки столбчатого мезофилла · хлоропласты</text>
 </g>;
 case "root-hair":return <g>
  <rect x="24" y="41" width="429" height="51" rx="12" fill="#c6b297" opacity=".7"/>
  {Array.from({length:7},(_,i)=>{const x=38+i*58;return <g key={i}>
   <PlantWall x={x} y={113} w={54} h={142}/>
   <rect x={x+9} y="135" width="34" height="95" rx="9" fill="#d0e5e8" opacity=".78"/>
   <CircleNucleus x={x+25} y={235} rx={9} ry={6}/>
   <path d={`M${x+30} 116Q${x+8} 80 ${x+18} 55Q${x+10} 38 ${x+29} 27`} stroke="#8bb477" strokeWidth="9" fill="none" strokeLinecap="round"/>
   <path d={`M${x+30} 116Q${x+8} 80 ${x+18} 55Q${x+10} 38 ${x+29} 27`} stroke="#e2edc8" strokeWidth="4" fill="none" strokeLinecap="round"/>
  </g>;})}
  <path d="M24 264H454" stroke="#a2ad85" strokeWidth="5"/>
  <text x="36" y="320" fontSize="12" fill="#527457">Волоски = выросты отдельных клеток ризодермы</text>
 </g>;
 case "stomata":return <g>
  <rect x="35" y="50" width="411" height="237" rx="20" fill="#d8e7c8" stroke="#89a77d" strokeWidth="4"/>
  {Array.from({length:18},(_,i)=>{const x=66+(i%6)*65,y=81+Math.floor(i/6)*77;return <path key={i}
   d={`M${x-23} ${y-24}q30-18 49 0l16 26-20 31q-30 19-53-2Z`} fill="#c3dfb8" stroke="#80a477" strokeWidth="3"/>;})}
  <g transform="translate(240 171)">
   <ellipse cx="-25" cy="0" rx="28" ry="51" fill="#7eac74" stroke="#4c8357" strokeWidth="5" transform="rotate(-13 -25 0)"/>
   <ellipse cx="25" cy="0" rx="28" ry="51" fill="#7eac74" stroke="#4c8357" strokeWidth="5" transform="rotate(13 25 0)"/>
   <ellipse rx="10" ry="37" fill="#f3f9ed" stroke="#4c8357" strokeWidth="4"/>
   {[-1,1].map(s=>Array.from({length:5},(_,j)=><Chloroplast key={s+"-"+j} x={s*38} y={-30+j*15} angle={j*25}/>))}
  </g>
  <text x="37" y="320" fontSize="12" fill="#4f7e52">Эпидермис листа · две замыкающие клетки</text>
 </g>;
 case "petal":return <g>
  <path d="M36 81H447" stroke="#d5a0aa" strokeWidth="9" strokeLinecap="round"/>
  {Array.from({length:10},(_,i)=>{const x=39+i*42;return <g key={i}>
   <path d={`M${x} 260V130Q${x+8} 93 ${x+21} 100Q${x+39} 106 ${x+42} 132V260Z`} fill="#f5d4d8" stroke="#bf929f" strokeWidth="3"/>
   <ellipse cx={x+20} cy="182" rx="15" ry="43" fill="#e7b1c4" opacity=".75"/>
   <CircleNucleus x={x+21} y={240} rx={10} ry={7}/>
   {Array.from({length:4},(_,j)=><ellipse key={j} cx={x+9+(j%2)*18} cy={155+j*20} rx="4" ry="6" fill="#bf83a5" opacity=".7"/>)}
  </g>;})}
  <text x="36" y="320" fontSize="12" fill="#a16d87">Кутикула · папиллы · окрашенные вакуоли</text>
 </g>;
 case "xylem":return <g>
  {[[95,140,55],[221,128,69],[365,150,57],[131,247,50],[299,255,53]].map(([x,y,r],i)=><g key={i}>
   <circle cx={x} cy={y} r={r} fill="#c29b69" stroke="#806440" strokeWidth="9"/>
   <circle cx={x} cy={y} r={r-16} fill="#f3e5c5" stroke="#a88151" strokeWidth="6"/>
   {Array.from({length:11},(_,j)=>{const a=j*2*Math.PI/11;return <circle key={j} cx={x+(r-6)*Math.cos(a)} cy={y+(r-6)*Math.sin(a)} r="3.2" fill="#eed9af"/>;})}
  </g>)}
  <text x="36" y="320" fontSize="12" fill="#92683d">Ксилема · толстые вторичные стенки и просвет</text>
 </g>;
 case "mesophyll":return <g>
  {Array.from({length:9},(_,i)=>{const x=53+(i%3)*132,y=76+Math.floor(i/3)*73;return <g key={i}>
   <path d={`M${x-30} ${y-28}q40-18 66 4l14 36q-28 34-69 25q-35-22-11-65Z`} fill="#d5e9bc" stroke="#78a26b" strokeWidth="5"/>
   <path d={`M${x-12} ${y-12}q25-8 39 11q-6 25-32 22Z`} fill="#b6dbdb"/>
   {[[-17,-11],[19,-8],[-12,24],[28,21]].map(([dx,dy],j)=><Chloroplast key={j} x={x+dx} y={y+dy} angle={j*39}/>)}
   <CircleNucleus x={x+8} y={y+25} rx={8} ry={6}/>
  </g>;})}
  <text x="36" y="320" fontSize="12" fill="#557852">Губчатый мезофилл · межклетники</text>
 </g>;
 }
}

function Cell({kind}:{kind:BioCoreMicroKind}):ReactNode{
 switch(kind){
 case "alveoli":return <g>
  <path d="M28 140Q129 135 216 144Q319 152 455 130" stroke="#dfaeb2" strokeWidth="33" fill="none" strokeLinecap="round"/>
  <path d="M27 138Q125 131 215 140Q323 149 453 128" stroke="#f8e2d8" strokeWidth="20" fill="none"/>
  <path d="M32 129Q123 119 214 128Q329 140 453 118" stroke="#ba8d9a" strokeWidth="3.5" fill="none"/>
  <path d="M37 160Q123 154 222 166Q330 176 444 151" stroke="#a78494" strokeWidth="3.5" fill="none"/>
  <CircleNucleus x={244} y={155} rx={28} ry={13}/>
  <path d="M35 217Q230 198 452 226" stroke="#d6a3a5" strokeWidth="12" fill="none"/>
  <path d="M35 249Q226 233 452 256" stroke="#c57b86" strokeWidth="28" fill="none"/>
  {Array.from({length:8},(_,i)=><ellipse key={i} cx={68+i*49} cy={254+Math.sin(i)*9} rx="15" ry="8" fill="#a9576a" stroke="#f0a8a0" strokeWidth="2"/>)}
  <text x="37" y="73" fontSize="14" fill="#9d7181">Воздух альвеолы</text>
  <text x="37" y="313" fontSize="14" fill="#a36c74">Капилляр</text>
 </g>;
 case "cardiac":return <g>
  <path d="M36 172Q88 134 156 144Q190 116 235 140Q305 126 346 162Q387 180 447 148L454 219Q391 244 342 225Q288 237 246 204Q189 235 147 208Q80 230 30 202Z"
   fill="#d78f92" stroke="#ab6473" strokeWidth="6"/>
  {Array.from({length:18},(_,i)=>{const x=61+i*21;return <path key={i} d={`M${x} 149q-12 23 0 61`} fill="none" stroke={i%2?"#edb4a9":"#b66e79"} strokeWidth="4"/>;
  })}
  <path d="M134 132L156 225M354 148L332 229" stroke="#80546c" strokeWidth="8" strokeDasharray="9 4"/>
  <CircleNucleus x={250} y={176} rx={30} ry={17}/>
  {Array.from({length:11},(_,i)=><ellipse key={i} cx={65+(i%6)*61} cy={146+Math.floor(i/6)*74} rx="8" ry="4" fill="#bb6f65" stroke="#9b5963" strokeWidth="1.5"/>)}
  <path d="M30 157L9 134M342 207L405 259" stroke="#ca8186" strokeWidth="19" strokeLinecap="round" fill="none"/>
  <text x="34" y="92" fontSize="14" fill="#974e63">Саркомеры · вставочные диски</text>
 </g>;
 case "neural":return <g>
  <path d="M217 155Q145 97 98 76M198 164Q134 160 78 186M200 186Q133 218 99 260M239 130Q239 79 203 44M259 135Q320 89 350 49"
   stroke="#8d78ac" strokeWidth="11" fill="none" strokeLinecap="round"/>
  <path d="M288 186Q350 181 421 215L457 240" stroke="#a283b5" strokeWidth="13" fill="none" strokeLinecap="round"/>
  {[[98,76],[78,186],[99,260],[203,44],[350,49]].map(([x,y],i)=><g key={i} fill="none" stroke="#826da4" strokeWidth="4" strokeLinecap="round">
   <path d={`M${x} ${y}l-18 -17M${x} ${y}l4 -23`}/></g>)}
  <path d="M198 145Q227 115 267 136Q309 152 286 195Q259 226 221 207Q183 193 198 145Z"
   fill="#d5b7df" stroke="#987ba9" strokeWidth="5"/>
  <CircleNucleus x={245} y={172} rx={24} ry={21}/>
  {Array.from({length:7},(_,i)=><path key={i} d={`M${302+i*20} ${177+i*5}l8 -12`} stroke="#745a97" strokeWidth="4"/>)}
  {Array.from({length:5},(_,i)=><circle key={i} cx={419+i*9} cy={213+i*6} r="6" fill="#d6aacb" stroke="#85699d" strokeWidth="1.5"/>)}
  <text x="37" y="318" fontSize="13" fill="#75618f">Дендриты ← тело клетки → аксон</text>
 </g>;
 case "retina":return <g>
  <rect x="184" y="37" width="110" height="91" rx="13" fill="#a8c5d7" stroke="#6f98b4" strokeWidth="5"/>
  {Array.from({length:14},(_,i)=><path key={i} d={`M196 ${44+i*6}h87`} stroke="#658cae" strokeWidth="3.6"/>)}
  <rect x="197" y="127" width="82" height="69" rx="19" fill="#f0d9bd" stroke="#b1a18f" strokeWidth="4"/>
  <CircleNucleus x={237} y={164} rx={19} ry={13}/>
  {Array.from({length:9},(_,i)=><ellipse key={i} cx={211+(i%3)*26} cy={141+Math.floor(i/3)*17} rx="9" ry="4" fill="#bba388" stroke="#96846f" strokeWidth="1.2"/>)}
  <path d="M237 195V256" stroke="#c39e8b" strokeWidth="17" strokeLinecap="round"/>
  <path d="M215 254Q239 276 264 252L255 284H226Z" fill="#dba4b7" stroke="#b27f9b" strokeWidth="4"/>
  <path d="M229 279l-26 19M248 279l30 21" stroke="#95759d" strokeWidth="4" fill="none"/>
  <text x="303" y="84" fontSize="13" fill="#577e9b">Диски</text>
  <path d="M297 86h-17" stroke="#688ea7" strokeWidth="2"/>
  </g>;
 case "skeletal":return <g>
  <rect x="33" y="102" width="414" height="133" rx="29" fill="#d9a19d" stroke="#ac6f79" strokeWidth="8"/>
  <rect x="45" y="113" width="390" height="110" rx="23" fill="#ebaaa3" stroke="#d69a94" strokeWidth="3"/>
  {Array.from({length:23},(_,i)=><rect key={i} x={56+i*16} y="115" width="7" height="106" rx="2" fill={i%2?"#f4cbc0":"#ba737a"} opacity=".78"/>)}
  {Array.from({length:9},(_,i)=><path key={i} d={`M48 ${121+i*11}h386`} stroke="#b57678" strokeWidth="1.9" opacity=".6"/>)}
  {[72,244,404].map((x,i)=><CircleNucleus key={i} x={x} y={i%2?213:116} rx={15} ry={8}/>)}
  <text x="38" y="86" fontSize="14" fill="#955d70">Сарколемма</text>
  <text x="40" y="268" fontSize="13" fill="#955d70">Миофибриллы · множественные ядра</text>
 </g>;
 case "intestinal":return <g>
  <path d="M124 100Q147 80 176 101L184 260Q154 284 120 265Z" fill="#f5dbc9" stroke="#b49a94" strokeWidth="5"/>
  <path d="M177 101Q208 82 232 101L235 266Q200 279 183 260Z" fill="#f5dbc9" stroke="#b49a94" strokeWidth="5"/>
  <path d="M230 101Q265 79 287 100L297 259Q265 281 235 265Z" fill="#f5dbc9" stroke="#b49a94" strokeWidth="5"/>
  <path d="M292 101Q325 80 348 106L355 263Q325 283 297 259Z" fill="#f5dbc9" stroke="#b49a94" strokeWidth="5"/>
  {Array.from({length:48},(_,i)=>{const x=125+(i%48)*4.7,y=97+(i%3)*3;return <path key={i} d={`M${x} ${y}v-26`} stroke="#ba8d7e" strokeWidth="3.2" strokeLinecap="round"/>;})}
  {[150,211,264,328].map((x,i)=><CircleNucleus key={i} x={x} y={219} rx={15} ry={23}/>)}
  {Array.from({length:18},(_,i)=><ellipse key={i} cx={139+(i%6)*39} cy={154+Math.floor(i/6)*15} rx="8" ry="4" fill="#c7a394" stroke="#ae887e" strokeWidth="1"/>)}
  <path d="M178 120v94M235 123v93M296 120v93" stroke="#a77d7f" strokeWidth="4"/>
  <text x="36" y="320" fontSize="13" fill="#98786c">Щёточная каёмка сверху · плотные контакты</text>
 </g>;
 case "palisade":case "mesophyll":return <g>
  <PlantWall x={87} y={47} w={306} h={244}/>
  <rect x="103" y="63" width="275" height="213" rx="19" fill="#ebf4d7" stroke="#a3c092" strokeWidth="3"/>
  <rect x="155" y="84" width="190" height="176" rx="48" fill="#c2dfe2" stroke="#90bab9" strokeWidth="3"/>
  <CircleNucleus x={130} y={201} rx={19} ry={14}/>
  {Array.from({length:21},(_,i)=>{const a=i*2*Math.PI/21,x=240+127*Math.cos(a),y=169+91*Math.sin(a);
   return <Chloroplast key={i} x={x} y={y} angle={i*41}/>;
  })}
  {Array.from({length:6},(_,i)=><path key={i} d={`M${151+i*37} 69l-9 12`} stroke="#a1bd86" strokeWidth="2"/>)}
  <text x="32" y="319" fontSize="13" fill="#507f56">Вакуоль · стенка · хлоропласты</text>
 </g>;
 case "root-hair":return <g>
  <path d="M83 114H292Q309 114 316 133Q366 130 393 155Q418 176 435 178Q447 200 428 212Q406 209 390 199Q363 183 318 186L310 246Q307 261 285 261H89Q66 258 66 238V138Q66 116 83 114Z"
   fill="#dae7bc" stroke="#749963" strokeWidth="8" strokeLinejoin="round"/>
  <path d="M91 135H280Q293 133 299 150L302 238H91Z" fill="#c9e6df" opacity=".8" stroke="#8cb8a4" strokeWidth="2"/>
  <path d="M316 144Q363 149 397 179Q409 188 430 192" stroke="#eaf0d5" strokeWidth="11" fill="none" strokeLinecap="round"/>
  <CircleNucleus x={121} y={228} rx={22} ry={15}/>
  <path d="M75 146L74 235M308 154L312 232" stroke="#a8c893" strokeWidth="2" opacity=".8"/>
  <text x="40" y="83" fontSize="13" fill="#5b8062">Вырост принадлежит этой же клетке</text>
  </g>;
 case "stomata":return <g>
  <rect x="44" y="42" width="392" height="257" rx="22" fill="#e0edcf" stroke="#8aa775" strokeWidth="4"/>
  <path d="M203 82Q143 90 143 172Q143 254 205 259Q236 245 224 216Q205 176 224 127Q237 94 203 82Z"
   fill="#8ab47d" stroke="#4f885e" strokeWidth="8"/>
  <path d="M279 82Q340 90 340 172Q338 254 278 259Q247 245 260 216Q279 177 260 127Q245 94 279 82Z"
   fill="#8ab47d" stroke="#4f885e" strokeWidth="8"/>
  <ellipse cx="242" cy="171" rx="15" ry="69" fill="#fff7ed" stroke="#567e5a" strokeWidth="4"/>
  {[-1,1].map(s=>Array.from({length:9},(_,i)=><Chloroplast key={s+"-"+i} x={242+s*(54+(i%3)*10)} y={113+Math.floor(i/3)*43} angle={i*25}/>))}
  <CircleNucleus x={187} y={201} rx={13} ry={16}/><CircleNucleus x={298} y={201} rx={13} ry={16}/>
  <path d="M216 126Q191 170 219 216M268 126Q290 170 267 216" stroke="#4f7959" strokeWidth="7" fill="none" strokeLinecap="round"/>
  <text x="38" y="320" fontSize="12" fill="#547950">Пара клеток показана ради устьичной щели</text>
  </g>;
 case "petal":return <g>
  <path d="M82 104Q145 59 243 69Q336 58 396 98L396 261Q318 296 242 271Q154 297 82 261Z"
   fill="#f1d8d9" stroke="#be9ca1" strokeWidth="8"/>
  <path d="M83 100Q235 54 397 98" stroke="#c8929d" strokeWidth="9" fill="none"/>
  <path d="M104 121Q130 101 148 110Q190 83 232 112Q290 89 347 117L367 249Q300 268 241 252Q182 276 113 245Z"
   fill="#eab5ca" stroke="#cf9aad" strokeWidth="2.5"/>
  <ellipse cx="240" cy="173" rx="98" ry="68" fill="#d39fbe" opacity=".86"/>
  <CircleNucleus x={144} y={223} rx={19} ry={14}/>
  {Array.from({length:16},(_,i)=><ellipse key={i} cx={161+(i%4)*53} cy={130+Math.floor(i/4)*31} rx="7" ry="5" fill="#c086ad" opacity=".8"/>)}
  <text x="32" y="320" fontSize="13" fill="#9f6d8c">Пигментированная вакуоль · наружная кутикула</text>
 </g>;
 case "xylem":return <g>
  <rect x="100" y="38" width="278" height="258" rx="51" fill="#c2a277" stroke="#7b5e3e" strokeWidth="15"/>
  <rect x="125" y="56" width="229" height="221" rx="37" fill="#f7efd8" stroke="#b38a5a" strokeWidth="12"/>
  {Array.from({length:15},(_,i)=>{const y=66+i*14;
   return <g key={i}>
    <path d={`M104 ${y}h22M354 ${y}h24`} stroke="#795c43" strokeWidth="3.5"/>
    <circle cx="113" cy={y} r="3" fill="#ebd7b1"/><circle cx="365" cy={y} r="3" fill="#ebd7b1"/>
   </g>;
  })}
  <path d="M130 68H351M130 267H351" stroke="#96734f" strokeWidth="8" strokeDasharray="12 6"/>
  <text x="239" y="168" textAnchor="middle" fontSize="16" fontWeight="700" fill="#987953">Пустой просвет</text>
  <text x="239" y="190" textAnchor="middle" fontSize="12" fill="#987953">без ядра и цитоплазмы</text>
  </g>;
 }
}
export default function LektrusBioCoreMicroscopyArt({plate,features=[],selectedFeature,onFeatureSelect}:{
 plate:BioCoreMicroPlate;features?:BioCellFeature[];selectedFeature?:string|null;onFeatureSelect?:(name:string)=>void
}){
 const artwork=plate.level==="tissue"?<Tissue kind={plate.kind}/>:<Cell kind={plate.kind}/>;
 return <g data-bio-core-micro={plate.kind} data-bio-core-level={plate.level}>
  <rect x="0" y="0" width="480" height="330" fill={["palisade","root-hair","stomata","mesophyll","xylem"].includes(plate.kind)?"#f2f7e9":"#fbf5f1"}/>
  {artwork}
  <rect x="14" y="9" width="452" height="29" rx="9" fill="#ffffff" fillOpacity=".91" stroke="#e4e6d9" pointerEvents="none"/>
  <text x="26" y="28" fontSize="13" fontWeight="700" fill="#385c54" pointerEvents="none">{plate.name}</text>
  {plate.level==="cell"&&onFeatureSelect&&features.map((feature,i)=>{
   const pos=spots[plate.kind][i];if(!pos)return null;
   return <g key={feature.name} transform={`translate(${pos.x} ${pos.y})`}
    className={"lektrus-bio-cell-hotspot"+(selectedFeature===feature.name?" is-selected":"")}
    role="button" tabIndex={0} aria-pressed={selectedFeature===feature.name} aria-label={"Изучить: "+feature.name}
    data-bio-core-feature={feature.name}
    onClick={()=>onFeatureSelect(feature.name)}
    onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();onFeatureSelect(feature.name);}}}>
    <circle r="19" fill="#e3f7eb" fillOpacity=".92" stroke={selectedFeature===feature.name?"#b97d35":"#318868"} strokeWidth="3"/>
    <circle r="12" fill="#fffdfa" stroke="#3b876a" strokeWidth="1.8"/>
    <text textAnchor="middle" dominantBaseline="central" fontSize="12" fontWeight="800" fill="#386d57">{i+1}</text>
    <title>{feature.name}</title>
   </g>;
  })}
 </g>;
}
