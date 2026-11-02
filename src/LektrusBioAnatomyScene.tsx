/** A small, offline-first SVG atlas with landmarks tied to biological IDs.
 * Drawings are explanatory school diagrams, NOT diagnostic images or true-scale
 * histology. Every tap target maps to a child of the displayed atlas node.
 */
import type {ReactNode} from "react";
import type {BioNode,BioOrganism} from "./lektrusBioMicroscopeModel";
import {BIO_ORGANISMS,bioVisualKey,bioChildSpot} from "./lektrusBioMicroscopeModel";

type Props={organism:BioOrganism;node:BioNode;children:BioNode[];onSelect:(node:BioNode)=>void;interactive:boolean};
type BioVisualKey=ReturnType<typeof bioVisualKey>;
const ink="#355f52";
function OrganismShape({organism}:{organism:BioOrganism}){
 if(organism==="human")return <g>
  <circle cx="240" cy="59" r="33" fill="#efcfb5" stroke="#ad8d79" strokeWidth="4"/>
  <path d="M203 105Q240 93 278 105L294 214L264 221L257 307H227L218 220L188 215Z" fill="#d4e7dc" stroke="#779e8d" strokeWidth="4"/>
  <path d="M200 120L162 223M280 120L320 223" fill="none" stroke="#edc9ad" strokeWidth="24" strokeLinecap="round"/>
 </g>;
 if(organism==="cat")return <g>
  <path d="M94 196Q82 140 128 119L167 135Q211 109 260 128L307 114Q353 147 340 201L323 263H124L107 225Z" fill="#dfb994" stroke="#9e765c" strokeWidth="5"/>
  <path d="M300 183Q389 174 367 77" fill="none" stroke="#bb966f" strokeWidth="22" strokeLinecap="round"/>
  <path d="M128 129L142 73L174 113M257 130L289 81L304 146" fill="#d4a982" stroke="#997158" strokeWidth="4"/>
  <ellipse cx="196" cy="166" rx="14" ry="18" fill="#f9f2de"/><ellipse cx="269" cy="166" rx="14" ry="18" fill="#f9f2de"/>
  <ellipse cx="196" cy="167" rx="5" ry="12" fill="#597d55"/><ellipse cx="269" cy="167" rx="5" ry="12" fill="#597d55"/>
  <path d="M222 192L244 192L233 205Z" fill="#b4777c"/>
 </g>;
 if(organism==="oak")return <g>
  <path d="M223 276L214 170L258 170L250 276L281 303H184Z" fill="#a98560" stroke="#79583f" strokeWidth="5"/>
  <path d="M239 210Q159 227 137 167Q81 179 89 109Q83 48 153 51Q181 1 244 26Q309 -1 343 54Q420 50 408 121Q419 180 342 182Q302 226 239 210Z" fill="#79af75" stroke="#477d57" strokeWidth="6"/>
  <path d="M212 192L190 85M252 178L312 90" fill="none" stroke="#638f61" strokeWidth="5"/>
  <path d="M223 290L181 312M250 290L293 312" stroke="#876a4c" strokeWidth="6"/>
 </g>;
 return <g>
  <path d="M237 302V124" stroke="#549663" strokeWidth="12" strokeLinecap="round"/>
  <path d="M235 214Q164 164 123 211Q168 256 235 214ZM245 181Q310 133 352 172Q311 218 245 181Z" fill="#87bf7b" stroke="#4f9258" strokeWidth="5"/>
  {Array.from({length:12},(_,i)=>{
   const a=i*Math.PI/6;
   return <ellipse key={i} cx={240+61*Math.cos(a)} cy={89+61*Math.sin(a)}
    rx="20" ry="34" transform={"rotate("+(i*30+90)+" "+(240+61*Math.cos(a))+" "+(89+61*Math.sin(a))+")"} fill="#efc856" stroke="#cb9d37" strokeWidth="2"/>;
  })}
  <circle cx="240" cy="89" r="37" fill="#795838" stroke="#573d2a" strokeWidth="4"/>
  <path d="M237 295L212 317M237 295L265 315M237 289L231 323" stroke="#896d48" strokeWidth="4" fill="none"/>
 </g>;
}
function SpecificOrgan({keyName}:{keyName:BioVisualKey}){
 const accent="#74aa88",pink="#d59498",dark="#945d69",green="#67a878";
 switch(keyName){
  case "lungs":return <g stroke={dark} strokeWidth="5" fill="#eab2b6">
   <path d="M225 84Q155 65 129 130Q90 231 164 271Q213 294 227 211Z"/>
   <path d="M254 84Q326 65 351 130Q390 231 318 271Q268 294 252 211Z"/>
   <path d="M238 78V215M238 132L189 169M239 132L294 169" fill="none" stroke="#ad747c" strokeWidth="10"/>
  </g>;
  case "heart":return <g>
   <path d="M237 279C200 239 134 211 129 146C122 81 199 63 241 121C296 57 374 99 344 166C321 225 269 256 237 279Z" fill="#d88c95" stroke="#915a64" strokeWidth="6"/>
   <path d="M238 123L221 45M268 135L290 45" stroke="#aa6d76" strokeWidth="18" strokeLinecap="round"/>
   <path d="M243 140Q209 198 247 243M277 142L302 187" stroke="#b96070" strokeWidth="5" fill="none"/>
  </g>;
  case "brain":return <g fill="#e7b8b4" stroke="#a67c86" strokeWidth="5">
   <path d="M233 71Q176 42 143 90Q103 108 128 149Q97 191 151 226Q170 271 232 249Q271 270 320 236Q374 211 347 169Q374 116 328 97Q304 46 250 75Z"/>
   <path d="M234 69Q219 127 234 250M155 135Q188 116 212 139M266 131Q305 109 333 146M163 204L209 189M270 211L326 193" fill="none" stroke="#c58d95"/>
  </g>;
  case "eye":return <g>
   <path d="M81 165Q235 11 398 165Q237 309 81 165Z" fill="#f5e9d7" stroke="#8c795f" strokeWidth="8"/>
   <circle cx="241" cy="166" r="87" fill="#98c3a3" stroke="#5c9386" strokeWidth="8"/>
   <circle cx="241" cy="166" r="40" fill="#294c43"/><circle cx="255" cy="144" r="11" fill="#fff"/>
   <path d="M94 167Q242 45 382 165" stroke="#a57f64" strokeWidth="7" fill="none"/>
  </g>;
  case "muscle":return <g>
   <path d="M62 178Q91 102 187 99Q299 104 418 153L418 212Q263 249 171 229Q89 240 62 178Z" fill="#dca1a0" stroke="#945a5c" strokeWidth="6"/>
   {Array.from({length:8},(_,i)=><path key={i} d={"M"+(98+i*37)+" 117Q"+(110+i*31)+" 170 "+(96+i*38)+" 222"} stroke="#b87377" fill="none" strokeWidth="5"/>)}
  </g>;
  case "gut":return <g fill="none" strokeLinecap="round">
   <path d="M134 98H351V251H134Z" stroke="#bf8f7e" strokeWidth="29" strokeLinejoin="round"/>
   <path d="M167 115H321Q354 126 320 150H164Q131 177 177 194H318Q348 220 301 237H177" stroke="#e5ae99" strokeWidth="23"/>
  </g>;
  case "flower":return <g>
   {Array.from({length:9},(_,i)=>{const a=i*Math.PI*2/9;return <ellipse key={i} cx={241+92*Math.cos(a)} cy={162+92*Math.sin(a)}
    transform={"rotate("+(i*40+90)+" "+(241+92*Math.cos(a))+" "+(162+92*Math.sin(a))+")"}
    rx="32" ry="67" fill="#efc654" stroke="#c69b3c" strokeWidth="4"/>;})}
   <circle cx="241" cy="162" r="56" fill="#80603f" stroke="#543b27" strokeWidth="5"/>
   {Array.from({length:17},(_,i)=><circle key={i} cx={209+(i%5)*15} cy={136+Math.floor(i/5)*18} r="4" fill="#bb955e"/>)}
  </g>;
  case "root":return <g stroke="#9d7c54" strokeLinecap="round" strokeWidth="11" fill="none">
   <path d="M236 34Q225 129 242 186Q224 242 241 298"/>
   <path d="M236 131Q192 164 166 212M239 163Q288 183 327 232M232 209Q184 250 176 289M244 253Q273 265 293 295" strokeWidth="7"/>
   <path d="M164 213l-20 24M326 231l27 33M176 287l-15 21" strokeWidth="4"/>
  </g>;
  case "leaf":return <g>
   <path d="M86 249Q66 89 362 75Q380 246 86 249Z" fill="#91c784" stroke="#4e8c56" strokeWidth="7"/>
   <path d="M87 249L346 92M161 194L152 108M235 153L260 89M175 189L266 218M249 150L316 177" fill="none" stroke="#568e57" strokeWidth="5"/>
  </g>;
  case "wood":return <g>
   <ellipse cx="240" cy="160" rx="174" ry="125" fill="#d9b28a" stroke="#865d41" strokeWidth="10"/>
   {[44,80,115].map((delta,i)=><ellipse key={i} cx="240" cy="160" rx={174-delta} ry={125-delta*.67} fill="none" stroke={i===0?"#9e734e":"#b08056"} strokeWidth="10"/>)}
   <ellipse cx="240" cy="160" rx="28" ry="21" fill="#bd9067"/>
   <path d="M240 160L375 95" stroke="#986c47" strokeWidth="4"/>
  </g>;
  default:return <g><circle cx="238" cy="155" r="102" fill="#bde1bd" stroke="#659778" strokeWidth="7"/><circle cx="245" cy="162" r="41" fill="#e4bedf" stroke="#ad85a5" strokeWidth="5"/></g>;
 }
}
function TissueScene({keyName}:{keyName:BioVisualKey}){
 const plant=["leaf","root","wood","flower"].includes(keyName);
 return <g>
  <rect x="48" y="37" width="384" height="253" rx="26" fill={plant?"#e2f0cf":"#f4dcd3"} stroke={plant?"#85a96f":"#bf9d91"} strokeWidth="5"/>
  {Array.from({length:5},(_,r)=>Array.from({length:8},(_,c)=>{
   const x=76+c*46+(r%2?10:0),y=63+r*46;
   return plant?<g key={r+"-"+c}>
    <rect x={x} y={y} width="38" height="37" rx="5" fill={c%3===0?"#c8e6ae":"#def0c7"} stroke="#82a375" strokeWidth="2"/>
    {keyName==="leaf"||keyName==="flower"?<><circle cx={x+12} cy={y+16} r="5" fill="#65a465"/><circle cx={x+27} cy={y+25} r="5" fill="#65a465"/></>:null}
    <circle cx={x+20} cy={y+18} r="4" fill="#a3a8c4"/>
   </g>:<g key={r+"-"+c}>
    <ellipse cx={x+18} cy={y+18} rx="20" ry="16" fill={keyName==="muscle"?"#d5a6a4":"#f9ede2"} stroke="#bf9d91" strokeWidth="2"/>
    <circle cx={x+18} cy={y+18} r="6" fill="#c0a2c1"/>
    {keyName==="muscle"&&<path d={"M"+x+" "+(y+7)+"h34m-34 18h34"} stroke="#a66d74" strokeWidth="2"/>}
   </g>;
  }))}
 </g>;
}
function CellScene({keyName}:{keyName:BioVisualKey}){
 const plant=["leaf","root","wood","flower"].includes(keyName);
 const nerve=keyName==="brain",muscle=keyName==="muscle",redCell=keyName==="heart";
 if(nerve)return <g fill="none" stroke="#8666a0" strokeLinecap="round">
  <path d="M240 171L240 42M240 171L120 97M240 171L352 104M240 171L355 261M240 171L141 266M240 171L243 307" strokeWidth="8"/>
  <path d="M240 42L195 23M120 97L83 82M352 104L398 74M355 261L408 289" strokeWidth="4"/>
  <ellipse cx="239" cy="171" rx="57" ry="48" fill="#d8c2e2" strokeWidth="5"/>
  <circle cx="241" cy="170" r="22" fill="#a883b8"/>
 </g>;
 if(plant)return <g>
  <rect x="72" y="45" width="337" height="249" rx="35" fill="#e4efcc" stroke="#739b65" strokeWidth="15"/>
  <rect x="88" y="60" width="306" height="220" rx="27" fill="#f0f7dc" stroke="#99bb85" strokeWidth="3"/>
  <ellipse cx="265" cy="161" rx="88" ry="83" fill="#cce2ea" stroke="#8bbac5" strokeWidth="3"/>
  <circle cx="137" cy="178" r="33" fill="#d7b6d6" stroke="#9e82a7" strokeWidth="4"/>
  <circle cx="138" cy="178" r="12" fill="#ad8cae"/>
  {(keyName==="leaf"||keyName==="flower")&&Array.from({length:11},(_,i)=>{
   const x=110+(i%4)*85,y=86+Math.floor(i/4)*78;
   return <ellipse key={i} cx={x} cy={y} rx="14" ry="9" fill="#5da161" stroke="#3d804b" strokeWidth="2"/>;
  })}
  {keyName==="root"&&<path d="M72 177Q30 166 17 216" stroke="#7ca36c" strokeWidth="12" fill="none" strokeLinecap="round"/>}
  {keyName==="wood"&&<path d="M95 76V270M377 73V266" stroke="#9b7150" strokeWidth="12"/>}
 </g>;
 if(muscle)return <g>
  <path d="M58 85Q215 45 420 85L420 237Q240 282 58 237Z" fill="#e1a6a0" stroke="#a97476" strokeWidth="6"/>
  {Array.from({length:13},(_,i)=><path key={i} d={"M"+(78+i*26)+" 84V243"} stroke={i%2?"#bf8284":"#f3c4b5"} strokeWidth="9"/>)}
  <ellipse cx="254" cy="174" rx="26" ry="17" fill="#9674a3"/>
 </g>;
 return <g>
  <path d="M67 179C52 72 127 56 235 73Q398 31 411 158C440 269 323 299 224 272Q102 297 67 179Z" fill={redCell?"#f0d1c9":"#f9e5d2"} stroke="#bd9b8c" strokeWidth="6"/>
  <ellipse cx="245" cy="169" rx="76" ry="63" fill="#c5b5de" stroke="#987ead" strokeWidth="5"/>
  <circle cx="243" cy="169" r="24" fill="#9872b3"/>
  {[0,1,2,3].map(i=><ellipse key={i} cx={128+i*73} cy={i%2?242:105}
   rx="24" ry="12" fill="#dcb69e" stroke="#b8877b" strokeWidth="3"
   transform={"rotate("+(i*17)+" "+(128+i*73)+" "+(i%2?242:105)+")"}/>)}
 </g>;
}
export default function LektrusBioAnatomyScene({organism,node,children,onSelect,interactive}:Props){
 const keyName=bioVisualKey(node);
 const shape:ReactNode=node.level==="organism"||node.level==="system"
  ?<><g opacity={node.level==="system"?.27:1}><OrganismShape organism={organism}/></g>
    {node.level==="system"&&<g transform="translate(148 80) scale(.39)" opacity=".93"><SpecificOrgan keyName={keyName}/></g>}</>
  :node.level==="organ"?<SpecificOrgan keyName={keyName}/>
  :node.level==="tissue"?<TissueScene keyName={keyName}/>
  :<CellScene keyName={keyName}/>;
 return <svg className="lektrus-bio-anatomy-svg" viewBox="0 0 480 330" role="group"
  aria-label={"Анатомическая схема: "+node.name}>
  <rect width="480" height="330" rx="18" fill="#f3f9f0"/>
  {shape}
  {interactive&&children.map((child,i)=>{
   const pt=bioChildSpot(organism,node,child,i,children.length);
   return <g key={child.id} role="button" tabIndex={0}
    data-bio-node={child.id} aria-label={"Изучить: "+child.name}
    className="lektrus-bio-hotspot" onClick={()=>onSelect(child)}
    onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();onSelect(child);}}}
    transform={"translate("+pt.x+" "+pt.y+")"}>
    <circle className="lektrus-bio-hotspot-halo" r="28" fill="#318667" fillOpacity=".14"/>
    <circle r="15" fill="#fff" stroke="#32875f" strokeWidth="4"/>
    <circle r="5" fill="#32875f"/>
    <title>{child.name}</title>
   </g>;
  })}
  <text x="470" y="320" textAnchor="end" fontSize="11" fill={ink} opacity=".68">
   {BIO_ORGANISMS[organism].name} · схема
  </text>
 </svg>;
}
