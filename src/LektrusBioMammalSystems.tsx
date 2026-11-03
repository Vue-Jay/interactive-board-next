/** Anatomically located mammalian SYSTEM plates.
 * Phase 1 of the focused Mammalia curriculum: root -> system, not a generic
 * enlarged organ icon. All artwork is an offline, non-calibrated teaching map.
 * It deliberately reuses the same 480×330 space and existing node identity.
 */
import type {ReactNode} from "react";
import type {BioNode,BioOrganism} from "./lektrusBioMicroscopeModel";
import LektrusBioDetailedOrganisms from "./LektrusBioDetailedOrganisms";

export type BioMammal="human"|"cat";
export type BioMammalSystem="respiratory"|"circulatory"|"nervous"|"visual"|"musculoskeletal"|"digestive";
export const BIO_MAMMAL_SYSTEMS:Readonly<Record<BioMammal,readonly [BioMammalSystem,BioMammalSystem,BioMammalSystem]>>={
 human:["respiratory","circulatory","nervous"],
 cat:["visual","musculoskeletal","digestive"]
};
const idMap:Readonly<Record<string,BioMammalSystem>>={
 "human/дыхательная-система":"respiratory",
 "human/кровеносная-система":"circulatory",
 "human/нервная-система":"nervous",
 "cat/сенсорная-система":"visual",
 "cat/опорно-двигательная-система":"musculoskeletal",
 "cat/пищеварительная-система":"digestive"
};
export function bioMammalSystemKind(organism:BioOrganism,node:BioNode):BioMammalSystem|null{
 if((organism!=="human"&&organism!=="cat")||node.level!=="system")return null;
 return idMap[node.id]??null;
}
function HumanRespiration():ReactNode{
 return <g data-bio-mammal-anatomy="respiratory">
  <path d="M239 91V126" fill="none" stroke="#a5c8cb" strokeWidth="10" strokeLinecap="round"/>
  {Array.from({length:7},(_,i)=><path key={i} d={"M235 "+(96+i*4.5)+"h8"} stroke="#748e99" strokeWidth="1.8"/>)}
  {/* Viewer-left represents the anatomical right lung. Three right lobes;
      the heart notch is on the anatomical left lung (viewer's right). */}
  <path d="M229 129Q218 123 213 139Q206 156 213 172Q223 178 232 171L236 138Z"
   fill="#e5a6a3" fillOpacity=".87" stroke="#a46d76" strokeWidth="3.1"/>
  <path d="M249 129Q261 122 269 141Q277 165 267 177Q259 180 250 170Q248 156 244 147Z"
   fill="#e5a6a3" fillOpacity=".87" stroke="#a46d76" strokeWidth="3.1"/>
  <path d="M215 147Q226 149 234 147M213 161Q226 160 233 162M252 151Q259 152 270 148"
   fill="none" stroke="#bf8184" strokeWidth="1.6"/>
  <path d="M239 127Q231 137 223 142M240 127Q251 137 260 143"
   fill="none" stroke="#e7ddbb" strokeWidth="5" strokeLinecap="round"/>
  {[-1,1].map(side=><g key={side} transform={side===-1?"translate(480 0) scale(-1 1)":undefined}>
   <path d="M259 146q-7 8-6 21m7-20q5 8 6 15" stroke="#efdfcf" strokeWidth="2" fill="none"/>
  </g>)}
  <path d="M210 184Q237 176 270 184" stroke="#b16e7b" strokeWidth="4" fill="none"/>
  <path d="M241 95L295 67H344" stroke="#648b93" strokeWidth="2" fill="none"/>
  <text x="348" y="71" fontSize="12" fill="#3b6869">Трахея</text>
  <path d="M268 158L309 119H351" stroke="#ad6d75" strokeWidth="2" fill="none"/>
  <text x="354" y="123" fontSize="12" fill="#7d505c">Лёгкое</text>
  <path d="M245 181L305 226H353" stroke="#b16e7b" strokeWidth="2" fill="none"/>
  <text x="357" y="230" fontSize="12" fill="#7d505c">Диафрагма</text>
 </g>;
}
function HumanCirculation():ReactNode{
 const artery="#b95362",vein="#5885aa";
 return <g data-bio-mammal-anatomy="circulatory">
  {/* Four-chamber mammalian heart and continuous schematic arterial/venous
      trunks; red and blue denote oxygenation only for systemic circulation. */}
  <path d="M230 149Q214 137 220 157Q226 168 232 180Q247 167 248 150Q241 136 230 149Z"
   fill="#c96e78" stroke="#97515e" strokeWidth="3"/>
  <path d="M232 149Q232 161 234 175" stroke="#e4a5a3" strokeWidth="2" fill="none"/>
  <path d="M234 150Q250 135 248 121L248 99" stroke={artery} strokeWidth="5" fill="none" strokeLinecap="round"/>
  <path d="M227 148Q225 130 226 112L224 97" stroke={vein} strokeWidth="5" fill="none"/>
  <path d="M247 115Q268 119 284 149L296 194L323 226" stroke={artery} strokeWidth="3.5" fill="none"/>
  <path d="M225 112Q199 124 187 154L162 209" stroke={vein} strokeWidth="3.5" fill="none"/>
  <path d="M234 178Q246 198 255 229L264 277" stroke={artery} strokeWidth="4" fill="none"/>
  <path d="M228 176Q225 202 217 232L214 283" stroke={vein} strokeWidth="4" fill="none"/>
  <path d="M248 103Q252 84 246 77M225 103Q227 88 233 79" fill="none" strokeWidth="3" stroke={artery}/>
  <path d="M240 160L289 80H349" fill="none" stroke="#a95d68" strokeWidth="2"/>
  <text x="353" y="83" fill="#824956" fontSize="12">Сердце</text>
  <path d="M274 147L322 181H363" stroke="#b95362" fill="none" strokeWidth="2"/>
  <text x="367" y="184" fill="#824956" fontSize="11">Артерии</text>
  <path d="M216 260L134 267H71" stroke="#5885aa" fill="none" strokeWidth="2"/>
  <text x="28" y="270" fontSize="11" fill="#3c6987">Вены</text>
  <text x="28" y="291" fill="#526878" fontSize="10">Схема: не полная карта сосудов</text>
 </g>;
}
function HumanNervous():ReactNode{
 return <g data-bio-mammal-anatomy="nervous">
  <path d="M219 48Q214 30 234 32Q241 24 249 32Q267 30 264 48Q271 57 256 67Q251 75 241 68Q227 74 220 64Q209 60 219 48Z"
   fill="#e8b6ac" stroke="#ae817d" strokeWidth="3"/>
  <path d="M225 39Q238 41 231 50Q241 45 250 50Q250 36 257 39M221 57Q230 59 235 64M245 58Q251 64 258 55"
   fill="none" stroke="#bf8d84" strokeWidth="2"/>
  <path d="M241 68Q239 82 240 100L239 183Q240 197 240 207" stroke="#f5d9a6" strokeWidth="7" fill="none" strokeLinecap="round"/>
  {Array.from({length:11},(_,i)=>{
   const y=98+i*9.6,length=15+i*.45;
   return <g key={i} stroke="#e7c794" strokeWidth="2.3" fill="none">
    <path d={"M239 "+y+"Q"+(238-length)+" "+(y+6)+" "+(213-i%3*4)+" "+(y+4)}/>
    <path d={"M241 "+y+"Q"+(242+length)+" "+(y+6)+" "+(268+i%3*3)+" "+(y+3)}/>
   </g>;
  })}
  <path d="M234 130Q213 150 188 188L164 222M245 129Q271 156 303 206L323 232"
   fill="none" stroke="#e7c794" strokeWidth="3"/>
  <path d="M238 197Q226 224 218 254L213 290M243 199Q251 227 261 258L267 292"
   fill="none" stroke="#e7c794" strokeWidth="3"/>
  <path d="M258 47L298 55H350" stroke="#ae817d" fill="none" strokeWidth="2"/>
  <text x="352" y="59" fontSize="12" fill="#84535c">Головной мозг</text>
  <path d="M240 146L303 151H352" stroke="#bd9a63" fill="none" strokeWidth="2"/>
  <text x="354" y="155" fontSize="11" fill="#8a714a">Спинной мозг</text>
  <text x="32" y="295" fontSize="10" fill="#647869">Периферические нервы показаны условно</text>
 </g>;
}
function CatVision():ReactNode{
 return <g data-bio-mammal-anatomy="visual">
  <circle cx="189" cy="158" r="8" fill="#e4cb8e" stroke="#536547" strokeWidth="2"/>
  <ellipse cx="190" cy="158" rx="2.3" ry="6" fill="#273b32"/>
  <path d="M198 159Q219 166 231 175" stroke="#dec58c" strokeWidth="4" fill="none"/>
  <path d="M205 154L266 102H301" stroke="#6d8b7d" strokeWidth="2" fill="none"/>
  <circle cx="358" cy="158" r="67" fill="#faf3dd" fillOpacity=".96" stroke="#8ba08d" strokeWidth="6"/>
  <path d="M310 126Q283 154 307 188" fill="none" stroke="#8a9588" strokeWidth="9"/>
  <path d="M306 136Q320 145 306 180" fill="none" stroke="#bf8d81" strokeWidth="5"/>
  <path d="M312 123Q372 105 405 155Q379 210 316 194" fill="#d6e2bc" fillOpacity=".45" stroke="#bbad8b" strokeWidth="3"/>
  <path d="M392 133Q416 155 391 182" fill="none" stroke="#cda64f" strokeWidth="8"/>
  <path d="M397 120Q420 155 393 192" fill="none" stroke="#936f85" strokeWidth="5"/>
  <path d="M411 155L442 155" stroke="#bbad8b" strokeWidth="9" strokeLinecap="round"/>
  <text x="310" y="92" fontSize="11" fill="#536e5e">Схема глаза</text>
  <text x="313" y="244" fontSize="11" fill="#636d55">Сетчатка и тапетум</text>
  <text x="31" y="289" fontSize="10" fill="#687666">Светочувствительный слой расположен на задней стенке глаза</text>
 </g>;
}
function CatMovement():ReactNode{
 const gold="#d6a279";
 return <g data-bio-mammal-anatomy="musculoskeletal">
  <g fill={gold} fillOpacity=".65" stroke="#8a6050" strokeWidth="2.6">
   <path d="M214 191Q249 159 292 166Q328 163 348 191Q320 208 277 211Q243 204 214 191Z"/>
   <path d="M233 197Q262 205 293 214Q308 224 320 229Q300 239 271 225L236 211Z"/>
   <path d="M206 215Q219 220 227 246L221 293L209 295L208 264Z"/>
   <path d="M332 209Q342 221 344 251L339 288L326 295L327 256Z"/>
  </g>
  <path d="M241 185Q277 183 340 186M245 194Q284 203 333 194M253 216Q272 228 289 220" stroke="#815747" fill="none" strokeWidth="3" strokeLinecap="round"/>
  {Array.from({length:12},(_,i)=><path key={i} d={"M"+(244+i*8)+" "+(186+i%3*6)+"q3 10 6 12"} stroke="#b67e63" strokeWidth="1.7" fill="none"/>)}
  <path d="M299 210L352 108H388" fill="none" stroke="#a77d60" strokeWidth="2"/>
  <text x="355" y="94" fontSize="11" fill="#82614a">Скелетные мышцы</text>
  <path d="M337 252L387 250H429" fill="none" stroke="#a77d60" strokeWidth="2"/>
  <text x="365" y="272" fontSize="10" fill="#82614a">Задняя конечность</text>
  <text x="25" y="292" fontSize="10" fill="#617262">Парные мышцы работают с костями и суставами</text>
 </g>;
}
function CatDigestion():ReactNode{
 return <g data-bio-mammal-anatomy="digestive">
  <path d="M147 183Q170 192 193 192Q212 196 237 205Q251 208 261 207" fill="none" stroke="#d49c79" strokeWidth="7" strokeLinecap="round"/>
  <path d="M261 204Q273 187 287 197Q300 215 282 230Q265 232 260 220Z" fill="#e2a890" stroke="#aa7a72" strokeWidth="3"/>
  <path d="M279 225Q306 235 319 223Q324 210 302 212Q287 213 297 226Q320 244 338 226"
   fill="none" stroke="#d8a98e" strokeWidth="9" strokeLinecap="round"/>
  <path d="M279 236Q297 254 313 234Q329 225 343 241Q324 251 308 250"
   fill="none" stroke="#ad8579" strokeWidth="6" strokeLinecap="round"/>
  <path d="M248 205Q254 191 270 189" stroke="#8e7b5b" strokeWidth="8" fill="none"/>
  <path d="M282 210L353 115H405" stroke="#b98276" strokeWidth="2" fill="none"/>
  <text x="371" y="108" fontSize="11" fill="#815c54">Желудок</text>
  <path d="M310 231L372 261H410" stroke="#ae8977" strokeWidth="2" fill="none"/>
  <text x="354" y="285" fontSize="11" fill="#815c54">Тонкая кишка</text>
  <text x="24" y="289" fontSize="10" fill="#617262">Путь пищи показан условно, не в масштабе</text>
 </g>;
}
const overlays:Record<BioMammalSystem,()=>ReactNode>={
 respiratory:HumanRespiration,circulatory:HumanCirculation,nervous:HumanNervous,
 visual:CatVision,musculoskeletal:CatMovement,digestive:CatDigestion
};
const labels:Record<BioMammalSystem,string>={
 respiratory:"ДЫХАНИЕ",circulatory:"КРОВООБРАЩЕНИЕ",nervous:"НЕРВНАЯ РЕГУЛЯЦИЯ",
 visual:"ЗРЕНИЕ",musculoskeletal:"ДВИЖЕНИЕ",digestive:"ПИЩЕВАРЕНИЕ"
};
export default function LektrusBioMammalSystems({organism,node}:{
 organism:BioOrganism;node:BioNode
}):ReactNode{
 const kind=bioMammalSystemKind(organism,node);
 if(!kind)return null;
 const Picture=overlays[kind];
 return <g data-bio-mammal-system={kind} data-bio-mammal-species={organism} data-bio-mammal-level="system">
  <rect width="480" height="330" fill="#edf2e9"/>
  <g opacity=".35"><LektrusBioDetailedOrganisms organism={organism}/></g>
  <Picture/>
  <rect x="11" y="8" width={kind==="musculoskeletal"?230:kind==="circulatory"?212:182}
   height="32" rx="9" fill="#f9fff7" fillOpacity=".96" stroke="#adc4b1" strokeWidth="1.6"/>
  <text x="22" y="29" fontSize="12" fontWeight="800" fill="#355d50">{labels[kind]}</text>
 </g>;
}
