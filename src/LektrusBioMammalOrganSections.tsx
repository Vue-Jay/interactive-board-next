/** Organ stage (3/5) of the focused mammal atlas.
 * Six original offline histology-aware plates, each linked to its own organ
 * and to the single legitimate tissue child. Inset circles are schematic
 * previews, NOT a photomicrograph of an identical physical coordinate.
 */
import type {ReactNode} from "react";
import type {BioNode,BioOrganism} from "./lektrusBioMicroscopeModel";
import {bioMammalOrganTissueSpot} from "./lektrusBioMicroscopeModel";
export type BioMammalOrganKind="lungs"|"heart"|"brain"|"eye"|"muscle"|"intestine";
const stages:Record<string,BioMammalOrganKind>={
 "human/дыхательная-система/лёгкие":"lungs",
 "human/кровеносная-система/сердце":"heart",
 "human/нервная-система/головной-мозг":"brain",
 "cat/сенсорная-система/глаз":"eye",
 "cat/опорно-двигательная-система/скелетная-мышца":"muscle",
 "cat/пищеварительная-система/тонкая-кишка":"intestine"
};
const labels:Record<BioMammalOrganKind,string>={
 lungs:"ЛЁГКИЕ · ПРАВОЕ И ЛЕВОЕ",
 heart:"СЕРДЦЕ · ЧЕТЫРЕ КАМЕРЫ",
 brain:"ГОЛОВНОЙ МОЗГ · ОТДЕЛЫ",
 eye:"ГЛАЗ КОШКИ · САГИТТАЛЬНЫЙ СРЕЗ",
 muscle:"СКЕЛЕТНАЯ МЫШЦА · ПУЧКИ",
 intestine:"ТОНКАЯ КИШКА · СЛИЗИСТАЯ"
};
export function bioMammalOrganKind(organism:BioOrganism,node:BioNode):BioMammalOrganKind|null{
 if(node.level!=="organ"||(organism!=="human"&&organism!=="cat")||
    !node.id.startsWith(organism+"/"))return null;
 return stages[node.id]??null;
}
const sea="#477d88",ink="#385c55",rose="#af6973";
function Caption({x,y,children,color=ink}:{x:number;y:number;children:ReactNode;color?:string}){
 return <text x={x} y={y} fontSize="11" fontWeight="650" fill={color} pointerEvents="none">{children}</text>;
}
function Lead({d,color=sea}:{d:string;color?:string}){
 return <path d={d} stroke={color} strokeWidth="1.8" fill="none" opacity=".86"/>;
}
function TissueInset({x,y,kind}:{
 x:number;y:number;kind:BioMammalOrganKind
}):ReactNode{
 // The inset is on the SAME organ diagram and matches the authored
 // organ->tissue hotspot. All 6 coordinates are defined in the model.
 return <g data-bio-mammal-tissue-preview={kind}>
  <circle cx={x} cy={y} r="64" fill="#fffaf0" stroke="#b69b8f" strokeWidth="4"/>
  <circle cx={x} cy={y} r="58" fill={["brain","eye"].includes(kind)?"#f4f2e8":"#f7e9dc"}
   stroke="#e2d1b5" strokeWidth="1.8"/>
  {kind==="lungs"&&<g>
   {[[x-24,y-22,21],[x+14,y-27,18],[x-26,y+16,21],
     [x+17,y+16,22],[x,y+1,16]].map(([cx,cy,r],i)=>
    <g key={i}><circle cx={cx} cy={cy} r={r} fill="#fff9ed" stroke="#d3a0a1" strokeWidth="5"/>
     <circle cx={cx} cy={cy} r={r-5} fill="#fff" fillOpacity=".58"/></g>)}
   <path d={"M"+(x-47)+" "+(y+33)+"Q"+x+" "+(y+57)+" "+(x+51)+" "+(y+32)}
    fill="none" stroke="#b86572" strokeWidth="10"/>
   {Array.from({length:6},(_,i)=><ellipse key={i} cx={x-38+i*15} cy={y+40}
    rx="6" ry="3.6" fill="#f2c4ba" stroke="#a76a77" strokeWidth="1"/>)}
  </g>}
  {kind==="heart"&&<g>
   {Array.from({length:7},(_,i)=><g key={i}>
    <path d={"M"+(x-54)+" "+(y-38+i*12)+"Q"+x+" "+(y-47+i*12)+" "+(x+48)+" "+(y-31+i*12)}
     fill="none" stroke="#c98391" strokeWidth="5" strokeLinecap="round"/>
    <path d={"M"+(x-44)+" "+(y-36+i*12)+"Q"+x+" "+(y-42+i*12)+" "+(x+40)+" "+(y-31+i*12)}
     fill="none" stroke="#ebadb3" strokeWidth="1.6"/>
   </g>)}
   {Array.from({length:4},(_,i)=><path key={i}
    d={"M"+(x-31+i*19)+" "+(y-32)+"L"+(x-23+i*19)+" "+(y+31)}
    stroke="#a95872" strokeWidth="2.2" strokeDasharray="5 3"/>)}
  </g>}
  {kind==="brain"&&<g>
   {Array.from({length:5},(_,i)=><g key={i}>
    <path d={"M"+(x-55)+" "+(y-37+i*17)+"Q"+x+" "+(y-49+i*17)+" "+(x+52)+" "+(y-33+i*17)}
     fill="none" stroke={i%2?"#d6a9a7":"#eabcb4"} strokeWidth="11"/>
    {Array.from({length:5},(_,j)=><ellipse key={j} cx={x-43+j*20}
     cy={y-39+i*17+Math.sin(j)*4} rx="4" ry="2.4" fill="#ad8b9b"/>)}
   </g>)}
  </g>}
  {kind==="eye"&&<g>
   <path d={"M"+(x-42)+" "+(y-44)+"Q"+(x-22)+" "+y+" "+(x-42)+" "+(y+44)}
    fill="none" stroke="#ab96b1" strokeWidth="14"/>
   <path d={"M"+(x-24)+" "+(y-47)+"Q"+(x+4)+" "+y+" "+(x-24)+" "+(y+47)}
    fill="none" stroke="#9ab8b1" strokeWidth="9"/>
   <path d={"M"+(x-11)+" "+(y-48)+"Q"+(x+18)+" "+y+" "+(x-11)+" "+(y+48)}
    fill="none" stroke="#83afa4" strokeWidth="11"/>
   <path d={"M"+(x+12)+" "+(y-40)+"Q"+(x+42)+" "+y+" "+(x+12)+" "+(y+40)}
    fill="none" stroke="#d3c987" strokeWidth="8"/>
  </g>}
  {kind==="muscle"&&<g>
   <ellipse cx={x} cy={y} rx="50" ry="40" fill="#edbfad" stroke="#b48681" strokeWidth="5"/>
   {Array.from({length:14},(_,i)=>{const a=i*2.399,rad=Math.sqrt(i)*10;
    return <g key={i}><ellipse cx={x+Math.cos(a)*rad} cy={y+Math.sin(a)*rad*.81}
     rx="8" ry="7" fill="#d18a8a" stroke="#a86575" strokeWidth="2"/>
     <circle cx={x+Math.cos(a)*rad+3} cy={y+Math.sin(a)*rad*.81} r="1.8" fill="#976879"/></g>;
   })}
  </g>}
  {kind==="intestine"&&<g>
   <path d={"M"+(x-52)+" "+(y+34)+"Q"+x+" "+(y+59)+" "+(x+52)+" "+(y+32)}
    fill="none" stroke="#bf9291" strokeWidth="12"/>
   {Array.from({length:7},(_,i)=>{const bx=x-47+i*15,by=y+15;
    return <g key={i}>
     <path d={"M"+bx+" "+(by+20)+"Q"+(bx-10)+" "+(by-12)+" "+bx+" "+(by-36)+
       "Q"+(bx+10)+" "+(by-12)+" "+(bx+8)+" "+(by+20)}
      fill="#f3c7b0" stroke="#bd8a85" strokeWidth="2.8"/>
     <path d={"M"+bx+" "+(by+15)+"V"+(by-20)} stroke="#be727e" strokeWidth="2"/>
    </g>;
   })}
  </g>}
  <circle cx={x} cy={y} r="58" fill="none" stroke="#fefcf3" strokeWidth="1.4" strokeDasharray="5 7"/>
 </g>;
}
function Lungs():ReactNode{
 return <g data-bio-mammal-organ-drawing="lungs">
  <defs><linearGradient id="bio-mammal-lung-surface"><stop stopColor="#f5cfc7"/>
   <stop offset=".6" stopColor="#e2aaa9"/><stop offset="1" stopColor="#c58692"/></linearGradient></defs>
  <path d="M169 84Q133 70 110 113Q90 160 91 233Q99 277 145 287Q181 285 201 254L208 155L206 99Z"
   fill="url(#bio-mammal-lung-surface)" stroke="#976673" strokeWidth="5"/>
  <path d="M228 86Q261 72 284 111Q306 147 307 216Q310 266 276 284Q247 289 225 257Q232 230 217 218Q206 210 227 192L218 109Z"
   fill="url(#bio-mammal-lung-surface)" stroke="#976673" strokeWidth="5"/>
  {/* Anatomical right lung appears on the viewer's left: two fissures,
      dividing superior, middle, inferior lobes. */}
  <path d="M99 157Q139 164 195 153M110 197Q154 206 201 187M235 181Q266 193 301 183"
   fill="none" stroke="#a6687e" strokeWidth="3" strokeDasharray="0" opacity=".88"/>
  <path d="M203 54L203 128M203 124Q187 140 160 152M205 124Q228 136 250 154"
   stroke="#e1b49d" strokeWidth="18" fill="none" strokeLinecap="round"/>
  <path d="M203 54L203 128M203 124Q187 140 160 152M205 124Q228 136 250 154"
   stroke="#fff2d9" strokeWidth="10" fill="none" strokeLinecap="round"/>
  {Array.from({length:7},(_,i)=><path key={i}
   d={"M199 "+(65+i*8)+"h8"} stroke="#9f8b83" strokeWidth="2"/>)}
  {[-1,1].flatMap(sign=>[0,1,2,3].map(i=>{
   const origin=sign<0?162:250,bx=origin+sign*(12+i*5),end=origin+sign*(30+i*9);
   return <path key={sign+":"+i} d={"M"+origin+" 152Q"+bx+" "+(173+i*14)+" "+end+" "+(194+i*15)}
    fill="none" stroke="#f9e0cf" strokeWidth={4-i*.45} strokeLinecap="round"/>;
  }))}
  <Lead d="M116 148L60 130H20"/><Caption x={20} y={122}>Правое · 3 доли</Caption>
  <Lead d="M265 119L313 94H360"/><Caption x={315} y={86}>Левое · 2 доли</Caption>
  <Lead d="M204 55L244 45H292"/><Caption x={247} y={39}>Трахея</Caption>
  <Lead d="M273 264L315 285H359"/><Caption x={314} y={298}>Плевра</Caption>
  <Lead d="M290 208L328 203H347"/><Caption x={319} y={129}>Альвеолы</Caption>
 </g>;
}
function Heart():ReactNode{
 return <g data-bio-mammal-organ-drawing="heart">
  {/* Section: viewer-left = anatomical right; viewer-right = anatomical left.
      LV myocardium is visibly thicker and surrounds the right-hand chamber. */}
  <path d="M154 114Q126 130 137 182Q137 241 206 275Q243 298 274 261Q321 213 314 162Q318 120 279 111Q251 114 239 123Q216 104 190 105Z"
   fill="#ca7e85" stroke="#955761" strokeWidth="7"/>
  <path d="M149 150Q134 171 151 219Q166 253 204 265" stroke="#eeadb1" fill="none" strokeWidth="8"/>
  <path d="M269 141Q302 157 290 205Q288 239 261 259" stroke="#e7a0a3" fill="none" strokeWidth="17"/>
  <path d="M157 140Q165 112 200 127Q218 139 210 169Q205 181 183 178Q159 175 157 140Z"
   fill="#7eacc6" stroke="#577b9d" strokeWidth="3"/>
  <path d="M173 189Q198 174 214 194Q226 233 208 253Q185 238 173 213Z"
   fill="#7eacc6" stroke="#577b9d" strokeWidth="3"/>
  <path d="M243 133Q259 115 284 131Q298 148 283 173Q257 181 245 162Z"
   fill="#d99a9d" stroke="#ac6878" strokeWidth="3"/>
  <path d="M243 188Q261 174 274 190Q285 217 256 245Q240 257 238 234Z"
   fill="#edb3a9" stroke="#ad6e78" strokeWidth="4"/>
  <path d="M232 125Q228 174 228 240" stroke="#965b69" strokeWidth="9" fill="none"/>
  <path d="M207 182L222 186M246 182L236 187" stroke="#e9d9c7" strokeWidth="6" strokeLinecap="round"/>
  <path d="M223 124Q216 103 217 82Q225 46 251 52Q286 54 277 91" fill="none" stroke="#b65e6b" strokeWidth="18" strokeLinecap="round"/>
  <path d="M218 136Q203 106 180 81M270 130Q292 101 305 77" fill="none"
   stroke="#678da8" strokeWidth="16" strokeLinecap="round"/>
  <Lead d="M181 151L111 97H46"/><Caption x={24} y={90}>Правое предсердие</Caption>
  <Lead d="M197 233L111 258H40"/><Caption x={26} y={275}>Правый желудочек</Caption>
  <Lead d="M264 149L314 109H365"/><Caption x={321} y={101}>Левое предсердие</Caption>
  <Lead d="M271 225L325 249H370"/><Caption x={336} y={270}>Миокард ЛЖ</Caption>
 </g>;
}
function Brain():ReactNode{
 const sulci=["M103 108Q123 93 142 106","M113 151q25-12 40 7","M152 90q25 3 31 21",
  "M174 129q-21 28 2 42","M214 87q-22 19-13 40","M234 139q-26 2-36 26",
  "M271 107q-24 11-14 35","M278 166q-22 19-44 16","M193 201q25-5 37 16"];
 return <g data-bio-mammal-organ-drawing="brain">
  <path d="M259 227Q267 239 257 257L239 282" stroke="#c49a9c" strokeWidth="21" fill="none" strokeLinecap="round"/>
  <path d="M86 155Q69 129 89 110Q82 83 108 72Q123 50 153 64Q173 39 203 62Q231 45 250 67Q282 66 288 96Q307 113 292 136Q301 165 271 180Q264 203 235 203Q205 221 182 206Q154 223 132 198Q91 199 86 155Z"
   fill="#edbdb8" stroke="#ad7a82" strokeWidth="6"/>
  {sulci.map((d,i)=><path key={i} d={d} stroke="#bd8992" strokeWidth="4.5" fill="none" strokeLinecap="round"/>)}
  <path d="M248 185Q278 176 294 202Q292 227 265 238Q241 228 248 185Z"
   fill="#d19eac" stroke="#9c768d" strokeWidth="4"/>
  {Array.from({length:6},(_,i)=><path key={i} d={"M"+(251+i*5)+" "+(199+i%2*10)+"q9 -7 14 0"}
   fill="none" stroke="#a77e8e" strokeWidth="2.4"/>)}
  <path d="M234 194Q222 214 234 242" stroke="#bf9b93" strokeWidth="13" fill="none" strokeLinecap="round"/>
  <Lead d="M167 66L124 28H46"/><Caption x={20} y={22}>Большие полушария</Caption>
  <Lead d="M268 211L303 241H340"/><Caption x={310} y={261}>Мозжечок</Caption>
  <Lead d="M239 275L205 304H120"/><Caption x={26} y={306}>Ствол мозга</Caption>
  <Lead d="M203 120L334 118H404"/><Caption x={341} y={110}>Кора</Caption>
  <Lead d="M265 137L332 183H345"/>
 </g>;
}
function CatEye():ReactNode{
 return <g data-bio-mammal-organ-drawing="eye">
  <defs><radialGradient id="bio-cat-eye-fluid"><stop stopColor="#f3f9eb"/><stop offset="1" stopColor="#c5e5dc"/></radialGradient></defs>
  <ellipse cx="187" cy="162" rx="114" ry="103" fill="url(#bio-cat-eye-fluid)" stroke="#a5a096" strokeWidth="12"/>
  <path d="M78 124Q55 164 79 199" fill="none" stroke="#a8d2dc" strokeWidth="12" strokeLinecap="round"/>
  <path d="M110 128Q91 164 110 197" fill="none" stroke="#78aab1" strokeWidth="16"/>
  <path d="M116 131Q132 166 116 198" fill="none" stroke="#3f6b71" strokeWidth="7"/>
  <ellipse cx="142" cy="162" rx="19" ry="44" fill="#eee7cd" stroke="#bcac8b" strokeWidth="4"/>
  {/* Inside to outside posterior wall: retina, pigmented epithelium,
      choroid (with tapetum), sclera. NOT tapetum within the retina. */}
  <path d="M246 84Q305 161 249 243" stroke="#b48797" strokeWidth="8" fill="none"/>
  <path d="M257 77Q319 165 259 249" stroke="#cfc89a" strokeWidth="9" fill="none"/>
  <path d="M267 74Q330 165 270 253" stroke="#8bbba8" strokeWidth="9" fill="none"/>
  <path d="M273 80Q337 165 275 251" stroke="#a7a393" strokeWidth="5" fill="none"/>
  <path d="M299 174Q325 185 351 188" stroke="#e1cdb7" strokeWidth="25" fill="none" strokeLinecap="round"/>
  <path d="M300 174Q324 185 353 188" stroke="#c5aa8f" strokeWidth="10" fill="none" strokeLinecap="round"/>
  <Lead d="M79 163L42 110H16"/><Caption x={17} y={100}>Роговица</Caption>
  <Lead d="M143 121L139 45H95"/><Caption x={24} y={36}>Хрусталик</Caption>
  <Lead d="M252 240L293 274H349"/><Caption x={308} y={293}>Сетчатка</Caption>
  <Lead d="M273 114L330 67H394"/><Caption x={335} y={59}>Тапетум</Caption>
  <Lead d="M300 174L341 148H371"/>
 </g>;
}
function CatMuscle():ReactNode{
 return <g data-bio-mammal-organ-drawing="muscle">
  <path d="M54 146Q85 155 125 142Q211 94 300 133Q320 148 331 172Q307 197 294 222Q212 249 126 206Q87 181 54 192Z"
   fill="#da9696" stroke="#a76e75" strokeWidth="5"/>
  <path d="M43 147L73 158Q86 166 83 181L48 190M314 165L354 157L359 179L318 195"
   fill="none" stroke="#e2d7bd" strokeWidth="17" strokeLinecap="round"/>
  {Array.from({length:12},(_,i)=>{
   const y=148+i*5.5;
   return <path key={i} d={"M110 "+y+"Q220 "+(105+i*10)+" 300 "+(143+i*5)}
    stroke={i%2?"#f3bdb5":"#b86e7b"} strokeWidth="3.7" fill="none" strokeLinecap="round"/>;
  })}
  <ellipse cx="190" cy="183" rx="26" ry="16" fill="#eed0c6" stroke="#b17d80" strokeWidth="3"/>
  {Array.from({length:12},(_,i)=>{const a=i*2.4,rad=7+2*i;
   return <ellipse key={i} cx={190+Math.cos(a)*rad} cy={183+Math.sin(a)*rad*.46}
    rx="4" ry="3" fill="#ca9094" stroke="#a46d73" strokeWidth="1"/>;
  })}
  <Lead d="M50 154L30 113H12"/><Caption x={18} y={101}>Сухожилие</Caption>
  <Lead d="M170 138L167 72H88"/><Caption x={82} y={63}>Брюшко мышцы</Caption>
  <Lead d="M192 183L306 103H361"/><Caption x={306} y={93}>Пучок волокон</Caption>
  <Lead d="M279 210L324 260H375"/><Caption x={325} y={278}>Перимизий</Caption>
 </g>;
}
function CatIntestine():ReactNode{
 return <g data-bio-mammal-organ-drawing="intestine">
  {/* Cut longitudinal section of jejunal wall; folds and mucosa are clearly
      distinct from smooth muscle layers, with villi directed into lumen. */}
  <path d="M52 97Q180 86 310 99L310 282Q179 302 53 280Z"
   fill="#e5b3a5" stroke="#b68180" strokeWidth="5"/>
  <path d="M55 107Q181 101 304 110V273Q180 289 57 271Z"
   fill="#ead5be" stroke="#b99181" strokeWidth="3.5"/>
  <path d="M61 130Q180 122 302 131L301 251Q180 267 61 252Z"
   fill="#f0ccb1" stroke="#d9aa91" strokeWidth="3"/>
  <rect x="61" y="154" width="241" height="76" rx="4" fill="#f6efe0"/>
  {Array.from({length:12},(_,i)=>{
   const x=67+i*19.4,h=29+(i%3)*7;
   return <g key={i}>
    <path d={"M"+x+" 155Q"+(x-8)+" "+(150-h*.45)+" "+(x+1)+" "+(153-h)+
      "Q"+(x+8)+" "+(149-h*.35)+" "+(x+11)+" 156"}
     fill="#dfb5a2" stroke="#b6827e" strokeWidth="3"/>
    <path d={"M"+(x+1)+" 154v"+(-h*.68)} stroke="#bc7783" strokeWidth="2.3"/>
   </g>;
  })}
  {Array.from({length:7},(_,i)=>{
   const x=80+i*32;
   return <path key={i} d={"M"+x+" 234v19"} stroke="#cb9a88" strokeWidth="5" strokeLinecap="round"/>;
  })}
  <path d="M58 278Q179 295 307 278" stroke="#a6727a" strokeWidth="9" fill="none"/>
  <path d="M58 290Q180 308 307 288" stroke="#d19e9b" strokeWidth="8" fill="none"/>
  <Lead d="M125 144L94 70H30"/><Caption x={22} y={60}>Ворсинки</Caption>
  <Lead d="M158 252L169 267H199"/><Caption x={136} y={318}>Крипты</Caption>
  <Lead d="M280 285L333 300H399"/><Caption x={335} y={316}>Мышечная оболочка</Caption>
  <Lead d="M297 148L341 103H392"/><Caption x={343} y={94}>Эпителий</Caption>
 </g>;
}
const drawing:Record<BioMammalOrganKind,()=>ReactNode>={
 lungs:Lungs,heart:Heart,brain:Brain,eye:CatEye,muscle:CatMuscle,intestine:CatIntestine
};
export default function LektrusBioMammalOrganSections({organism,node}:{
 organism:BioOrganism;node:BioNode
}):ReactNode{
 const kind=bioMammalOrganKind(organism,node);
 if(!kind)return null;
 const point=bioMammalOrganTissueSpot(organism,node);
 if(!point)return null;
 const Picture=drawing[kind];
 return <g data-bio-mammal-organ={kind} data-bio-mammal-organism={organism}
  data-bio-mammal-depth="organ" data-bio-mammal-tissue-x={point.x}
  data-bio-mammal-tissue-y={point.y}>
  <rect width="480" height="330" fill={organism==="human"?"#f8f2ed":"#f3f4ed"}/>
  <Picture/>
  <TissueInset x={point.x} y={point.y} kind={kind}/>
  <path d={"M"+(point.x-76)+" "+point.y+"h25"} stroke="#bb847f" strokeWidth="2.6"
   strokeDasharray="5 4" fill="none"/>
  <rect x="12" y="8" width={kind==="eye"?316:kind==="intestine"?300:268}
   height="27" rx="8" fill="#ffffff" fillOpacity=".95" stroke="#d6ded2"/>
  <text x="22" y="26" fontSize="12" fontWeight="800" fill={ink}>{labels[kind]}</text>
  <text x="462" y="321" textAnchor="end" fontSize="10" fill="#7c8f83">
   Вставка: участок ткани · схема, не микрофотография
  </text>
 </g>;
}
