/** Offline scientific-style plates for organs of the four original atlas species.
 * Drawings emphasize morphology over decorative icons, with teaching-level
 * simplifications; they are not medical images or calibrated sections.
 */
import type {ReactNode} from "react";
import type {BioOrganism,BioVisualKey} from "./lektrusBioMicroscopeModel";

function Lungs():ReactNode{
 return <g data-bio-organ-illustration="lungs">
  <defs><linearGradient id="bio-lung-flesh" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#f5ccca"/><stop offset=".6" stopColor="#d9a1a7"/><stop offset="1" stopColor="#b67e8c"/></linearGradient></defs>
  <path d="M213 84Q165 62 137 110Q106 164 103 231Q116 283 171 289Q205 281 216 249Q222 215 226 118Z"
   fill="url(#bio-lung-flesh)" stroke="#986b7a" strokeWidth="5"/>
  <path d="M268 85Q313 64 340 111Q380 166 379 228Q364 288 312 289Q279 282 264 247Q254 210 255 124Z"
   fill="url(#bio-lung-flesh)" stroke="#986b7a" strokeWidth="5"/>
  <path d="M109 207Q160 188 205 209M271 181Q313 185 367 168M283 225Q326 217 377 228" fill="none" stroke="#b9798c" strokeWidth="2.4"/>
  <path d="M237 40V123M237 122L198 161M237 122L288 165" stroke="#cb9790" strokeWidth="22" strokeLinecap="round" fill="none"/>
  <path d="M237 40V119M237 124L198 161M237 124L288 165" stroke="#f9dfca" strokeWidth="14" strokeLinecap="round" fill="none"/>
  {Array.from({length:9},(_,i)=><path key={i} d={"M231 "+(49+i*8)+"h12"} stroke="#a77c78" strokeWidth="2" opacity=".65"/>)}
  {[-1,1].map(s=><g key={s} fill="none" stroke="#ad7b81" strokeWidth="6" strokeLinecap="round">
   <path d={"M"+(237+s*45)+" 157Q"+(237+s*83)+" 172 "+(237+s*92)+" 205M"+(237+s*75)+" 181L"+(237+s*114)+" 153M"+(237+s*91)+" 205L"+(237+s*118)+" 249"}/>
   <path d={"M"+(237+s*116)+" 247l"+(s*16)+" 14M"+(237+s*113)+" 153l"+(s*14)+" -20"} strokeWidth="3.1"/>
  </g>)}
  {Array.from({length:18},(_,i)=>{
   const s=i%2?-1:1,x=237+s*(83+(i%3)*24),y=189+Math.floor(i/6)*30;
   return <g key={i} opacity=".65"><circle cx={x} cy={y} r="6" fill="#efc4bf" stroke="#b78691" strokeWidth="1.6"/><circle cx={x+6} cy={y+3} r="4" fill="#eed4c7"/></g>;
  })}
  <path d="M104 245Q147 299 199 271M269 270Q317 301 369 241" fill="none" stroke="#e9bec4" strokeWidth="4"/>
 </g>;
}
function Heart():ReactNode{
 return <g data-bio-organ-illustration="heart" aria-label="Анатомический рисунок сердца с предсердиями, желудочками и крупными сосудами">
  <defs><linearGradient id="bio-heart-muscle" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#d9787b"/><stop offset=".55" stopColor="#b65b69"/><stop offset="1" stopColor="#8e4455"/></linearGradient></defs>
  {/* The external myocardium is NOT shaped like a symmetrical emoji heart. */}
  <path d="M207 117Q166 96 149 131Q132 167 151 191Q146 223 168 249Q190 278 237 294Q268 276 290 239Q324 217 330 169Q323 119 287 113Q256 109 244 128Q224 110 207 117Z"
   fill="url(#bio-heart-muscle)" stroke="#874c56" strokeWidth="5"/>
  <path d="M244 135Q221 176 241 224L239 282M169 191Q207 193 223 224M274 152Q283 190 305 192" stroke="#edabb0" strokeWidth="5" fill="none" opacity=".72"/>
  <path d="M238 143Q215 119 214 79Q214 47 243 42Q274 37 288 62L286 95" stroke="#bc5f68" strokeWidth="25" fill="none" strokeLinecap="round"/>
  <path d="M238 140Q219 111 219 80Q219 48 246 47Q270 48 276 66" stroke="#e8a9a6" strokeWidth="15" fill="none" strokeLinecap="round"/>
  <path d="M267 136Q300 106 306 77Q312 50 338 50" fill="none" stroke="#658aab" strokeWidth="23" strokeLinecap="round"/>
  <path d="M266 134Q298 111 305 78Q309 52 338 52" fill="none" stroke="#a7c6d7" strokeWidth="13" strokeLinecap="round"/>
  <path d="M178 124L160 76M187 118L180 59" fill="none" stroke="#7c9ab6" strokeWidth="16" strokeLinecap="round"/>
  <path d="M194 155Q206 147 215 157M283 152Q294 156 306 151" fill="none" stroke="#903e4e" strokeWidth="7"/>
  <path d="M175 196Q214 183 227 218Q238 239 257 248M281 169Q275 200 266 220" fill="none" stroke="#edaa9c" strokeWidth="3.7" strokeLinecap="round"/>
  <path d="M186 198L173 227M217 211l-4 36M264 230l14 8" stroke="#9c4154" strokeWidth="2.4"/>
 </g>;
}
function Brain():ReactNode{
 const grooves=["M138 133q32-25 58-1","M150 172q25-15 46 3","M166 211q28-11 50 4","M206 106q21 17 20 38","M237 148q21-30 48-17","M247 193q22-19 50-5","M296 161q23-5 38 20","M282 224q27 0 43-25","M201 237q17-25 27-18"];
 return <g data-bio-organ-illustration="brain" aria-label="Мозг в профиль с большими полушариями, мозжечком и стволом">
  <path d="M308 210Q340 216 346 249L332 270L291 267Q283 251 281 233Z" fill="#d8a0a3" stroke="#a96b7a" strokeWidth="4"/>
  <path d="M254 239Q254 278 236 312" stroke="#cf989a" strokeWidth="25" strokeLinecap="round" fill="none"/>
  <path d="M127 176Q97 151 119 127Q108 100 135 88Q151 53 186 68Q215 38 248 66Q282 46 302 78Q344 77 348 116Q377 147 345 173Q350 205 326 225Q304 244 274 231Q240 250 215 233Q180 249 155 224Q120 220 127 176Z"
   fill="#eac0bd" stroke="#a97d84" strokeWidth="6"/>
  {grooves.map((d,i)=><path key={i} d={d} fill="none" stroke="#ba8c95" strokeWidth="5" strokeLinecap="round"/>)}
  <path d="M231 72Q244 103 230 122M316 103Q302 127 318 151M137 167Q168 169 172 187" fill="none" stroke="#bb8e95" strokeWidth="3"/>
  <path d="M290 228Q308 240 332 224Q344 203 326 194Q300 191 284 207Z" fill="#d8a5a9" stroke="#a66d7e" strokeWidth="4"/>
  {Array.from({length:6},(_,i)=><path key={i} d={"M"+(285+i*7)+" "+(214+i%3*5)+"q15 -6 24 -2"} fill="none" stroke="#a8747e" strokeWidth="2.6"/>)}
 </g>;
}
function Eye():ReactNode{
 return <g data-bio-organ-illustration="eye" aria-label="Сагиттальный разрез глазного яблока с роговицей, радужкой, хрусталиком и сетчаткой">
  <defs><radialGradient id="bio-eye-vitreous"><stop stopColor="#e3f1ed"/><stop offset="1" stopColor="#b7d3d2"/></radialGradient></defs>
  <path d="M132 165Q124 98 179 74Q234 42 293 76Q340 104 339 162Q339 218 290 254Q216 295 158 249Q124 222 132 165Z"
   fill="url(#bio-eye-vitreous)" stroke="#9b9389" strokeWidth="12"/>
  <path d="M125 127Q100 163 125 209" fill="none" stroke="#b2d2df" strokeWidth="12" strokeLinecap="round"/>
  <path d="M136 133Q117 165 137 200" fill="none" stroke="#ebf5eb" strokeWidth="6"/>
  <path d="M184 127Q161 164 184 203" fill="none" stroke="#7eae9b" strokeWidth="19" strokeLinecap="round"/>
  <path d="M190 127Q205 165 190 204" fill="none" stroke="#4a7469" strokeWidth="7" strokeLinecap="round"/>
  <ellipse cx="217" cy="165" rx="22" ry="46" fill="#f1dfc6" stroke="#a99b8d" strokeWidth="5"/>
  <path d="M290 81Q353 164 289 250" stroke="#c9959f" strokeWidth="7" fill="none"/>
  <path d="M301 74Q371 163 300 260" stroke="#c3a9a7" strokeWidth="5" fill="none"/>
  <path d="M336 168Q376 173 429 197" stroke="#d9c5b1" strokeWidth="32" strokeLinecap="round" fill="none"/>
  <path d="M336 168Q375 172 429 197" stroke="#d9a772" strokeWidth="14" strokeLinecap="round" fill="none"/>
  <path d="M133 126Q150 88 180 74" fill="none" stroke="#fff" strokeWidth="4" opacity=".75"/>
 </g>;
}
function Muscle():ReactNode{
 return <g data-bio-organ-illustration="muscle">
  <path d="M59 157Q75 133 111 134L165 101Q249 78 314 115L368 140L422 150L417 184L364 197L312 232Q222 265 164 227L110 193L61 192Z"
   fill="#d99790" stroke="#a5676a" strokeWidth="5"/>
  {Array.from({length:12},(_,i)=><g key={i}>
   <path d={"M"+(109+i*22)+" "+(133-i%4*3)+"Q"+(170+i*10)+" "+(152+i%2*8)+" "+(334-i*7)+" "+(188+i%3*9)}
    stroke={i%2?"#be7577":"#edb6aa"} strokeWidth="5" fill="none" opacity=".9"/>
   <path d={"M"+(151+i*13)+" "+(144+i%2*13)+"l-7 21"} stroke="#a5686c" strokeWidth="2" opacity=".5"/>
  </g>)}
  <path d="M61 157Q78 174 62 191M421 150L440 153L438 181L418 184" stroke="#e9dfc9" strokeWidth="13" strokeLinecap="round" fill="none"/>
 </g>;
}
function Gut():ReactNode{
 return <g data-bio-organ-illustration="gut">
  <path d="M154 74Q127 105 145 131Q146 157 184 166" stroke="#e6b9a4" strokeWidth="30" strokeLinecap="round" fill="none"/>
  <path d="M187 104Q224 79 271 95Q316 102 307 145Q291 177 252 163Q215 144 187 104Z" fill="#e5b9a8" stroke="#af8078" strokeWidth="5"/>
  <path d="M147 154H345Q370 170 360 194L357 255Q345 270 326 268H163Q135 259 137 236V179Q137 164 147 154Z"
   fill="none" stroke="#b88678" strokeWidth="31" strokeLinejoin="round" strokeLinecap="round"/>
  <path d="M149 154H345Q370 170 357 194L354 252Q345 270 326 268H164Q135 255 140 237V179Q140 163 149 154Z"
   fill="none" stroke="#e7b9a4" strokeWidth="22" strokeLinejoin="round" strokeLinecap="round"/>
  <path d="M173 187Q232 167 311 188Q339 200 301 213H183Q149 229 185 237H312"
   stroke="#c39080" strokeWidth="20" fill="none" strokeLinecap="round"/>
  <path d="M173 187Q232 167 311 188Q339 200 301 213H183Q149 229 185 237H312"
   stroke="#efc8b2" strokeWidth="11" fill="none" strokeLinecap="round"/>
  <path d="M236 264V300" stroke="#ddb09b" strokeWidth="23" strokeLinecap="round"/>
 </g>;
}
function Flower():ReactNode{
 const ray=Array.from({length:24},(_,i)=>{
  const a=i*Math.PI/12,x=240+71*Math.cos(a),y=157+71*Math.sin(a);
  return <ellipse key={i} cx={x} cy={y} rx="14" ry="42"
   transform={"rotate("+(a*180/Math.PI+90)+" "+x+" "+y+")"} fill={i%3?"#f0be3c":"#f6ca52"} stroke="#bd8c2e" strokeWidth="2"/>;
 });
 return <g data-bio-organ-illustration="flower">
  <path d="M237 273V326" stroke="#6d994f" strokeWidth="12"/>
  {ray}
  <circle cx="240" cy="157" r="72" fill="#967047" stroke="#6e4f33" strokeWidth="5"/>
  {Array.from({length:260},(_,i)=>{
   const a=i*2.3999632,r=4*Math.sqrt(i),x=240+r*Math.cos(a),y=157+r*Math.sin(a);
   return <ellipse key={i} cx={x} cy={y} rx="2" ry="3.3" fill={i%4?"#5b3b28":"#d8ae69"}/>;
  })}
 </g>;
}
function Root():ReactNode{
 return <g data-bio-organ-illustration="root">
  <path d="M240 24Q229 103 240 167Q232 240 242 311" stroke="#99784e" strokeWidth="21" fill="none" strokeLinecap="round"/>
  {Array.from({length:12},(_,i)=>{
   const y=86+i*16,s=i%2?-1:1,l=56+(i%3)*30,x=240+s*l;
   return <g key={i} fill="none" stroke="#aa9065" strokeLinecap="round">
    <path d={"M240 "+y+"Q"+(240+s*29)+" "+(y+6)+" "+x+" "+(y+49)} strokeWidth={i%3?5:7}/>
    {Array.from({length:5},(_,j)=><path key={j} d={"M"+(240+s*(22+j*10))+" "+(y+12+j*5)+"l"+(s*16)+" "+(13+j*2)} strokeWidth="2"/>)}
   </g>;
  })}
  <path d="M237 28Q211 35 189 21M240 31Q265 36 291 21" stroke="#7f9c5a" strokeWidth="6" fill="none"/>
 </g>;
}
function Leaf({organism}:{organism:BioOrganism}):ReactNode{
 const isOak=organism==="oak";
 return <g data-bio-organ-illustration="leaf">
  <path d="M133 282Q205 228 355 79" stroke="#6b9657" strokeWidth="7" fill="none"/>
  {isOak?
   <path d="M135 281Q93 247 117 214Q72 192 98 158Q79 118 121 113Q126 74 165 82Q191 46 215 69Q257 40 268 79Q314 60 318 110Q354 119 333 158Q372 197 317 212Q296 260 247 251Q197 284 135 281Z"
    fill="#80ab64" stroke="#4b8353" strokeWidth="6"/>:
   <path d="M135 281Q87 211 105 156Q111 98 175 90Q236 78 355 79Q337 135 315 178Q277 259 211 267Q169 281 135 281Z"
    fill="#83b96a" stroke="#4c8b51" strokeWidth="6"/>}
  <path d="M135 281Q211 223 339 95" stroke="#e4e7b1" strokeWidth="4" fill="none"/>
  {Array.from({length:9},(_,i)=>{const x=156+i*19,y=261-i*19;return <g key={i} stroke="#699b60" strokeWidth="2.5" fill="none">
   <path d={"M"+x+" "+y+"l-36 -34M"+x+" "+y+"l36 23"}/>
  </g>})}
 </g>;
}
function Wood():ReactNode{
 return <g data-bio-organ-illustration="wood">
  <defs><radialGradient id="bio-oak-wood"><stop stopColor="#e6c8a0"/><stop offset=".7" stopColor="#c9a67a"/><stop offset="1" stopColor="#8d6d51"/></radialGradient></defs>
  <ellipse cx="239" cy="163" rx="168" ry="127" fill="url(#bio-oak-wood)" stroke="#72543b" strokeWidth="16"/>
  {Array.from({length:9},(_,i)=><ellipse key={i} cx="239" cy="163" rx={145-i*14} ry={109-i*10}
   fill="none" stroke={i%2?"#e1c39c":"#9e784f"} strokeWidth={i%3===0?7:3.5} opacity=".8"/>)}
  {Array.from({length:32},(_,i)=>{
   const a=i*2.4,r=25+(i%8)*15;
   return <path key={i} d={"M"+(239+r*Math.cos(a))+" "+(163+r*.77*Math.sin(a))+"l"+(7*Math.cos(a))+" "+(5*Math.sin(a))}
    stroke="#986d4c" strokeWidth="2.7" strokeLinecap="round"/>;
  })}
  <ellipse cx="239" cy="163" rx="14" ry="12" fill="#b78960" stroke="#855d41" strokeWidth="2.5"/>
  <path d="M239 163L375 99" stroke="#865e43" strokeWidth="3" opacity=".6"/>
 </g>;
}
export default function LektrusBioDetailedCoreOrgans({organism,keyName}:{organism:BioOrganism;keyName:BioVisualKey}):ReactNode{
 switch(keyName){
  case "lungs":return <Lungs/>;
  case "heart":return <Heart/>;
  case "brain":return <Brain/>;
  case "eye":return <Eye/>;
  case "muscle":return <Muscle/>;
  case "gut":return <Gut/>;
  case "flower":return <Flower/>;
  case "root":return <Root/>;
  case "leaf":return <Leaf organism={organism}/>;
  case "wood":return <Wood/>;
  default:return null;
 }
}
