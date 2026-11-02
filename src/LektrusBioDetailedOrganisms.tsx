/** Detailed, original, offline SVG specimen plates.
 * Species contours and proportions are recognizable educational reconstructions.
 * Coordinates stay in the shared 480 x 330 atlas space so existing organ hotspots
 * and continuous-zoom navigation remain aligned. These are not photomicrographs.
 */
import type {ReactNode} from "react";
import type {BioOrganism} from "./lektrusBioMicroscopeModel";

const bark="#70513d",skin="#dcaa89";
function Human():ReactNode{
 return <g data-bio-illustration="human" aria-label="Схематичный вид человека спереди">
  <defs>
   <linearGradient id="bio-human-skin" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#f5d8b8"/><stop offset=".55" stopColor={skin}/><stop offset="1" stopColor="#bb826c"/></linearGradient>
   <linearGradient id="bio-human-trunk" x1="0" x2="1"><stop stopColor="#a66f5a"/><stop offset=".24" stopColor="#dfb49a"/><stop offset=".68" stopColor="#f0cbb0"/><stop offset="1" stopColor="#b77c66"/></linearGradient>
  </defs>
  <ellipse cx="239" cy="314" rx="90" ry="6" fill="#496857" opacity=".12"/>
  {/* Draw back limbs first, not cartoon straight rods. */}
  <path d="M215 192Q208 219 210 240L209 279L203 305Q202 315 213 316H227L232 304L236 267L239 229L247 229L252 266L255 304L261 316H276Q287 312 279 301L273 273L276 237Q279 211 271 192Z"
   fill="url(#bio-human-trunk)" stroke="#986f60" strokeWidth="2.2" strokeLinejoin="round"/>
  <path d="M222 232Q224 263 218 286M262 232Q259 268 267 288" fill="none" stroke="#986f60" strokeWidth="1.4" opacity=".55"/>
  <path d="M201 105Q186 110 178 133L161 184L156 206L147 221L150 239Q152 245 157 241L162 224L164 239Q169 246 173 239L174 218L179 208L199 156L211 124Z"
   fill="url(#bio-human-skin)" stroke="#9d7767" strokeWidth="2"/>
  <path d="M278 105Q296 110 302 133L319 184L324 206L334 221L330 239Q328 245 323 241L318 224L315 239Q311 246 306 239L305 218L300 208L280 157L270 125Z"
   fill="url(#bio-human-skin)" stroke="#9d7767" strokeWidth="2"/>
  <path d="M211 103Q221 99 228 91L229 80H251L253 92Q261 102 272 104Q279 107 283 122L276 159Q273 176 277 197Q257 211 241 211Q220 210 204 197Q209 176 206 158L198 123Q201 109 211 103Z"
   fill="url(#bio-human-trunk)" stroke="#986f60" strokeWidth="2.4"/>
  <path d="M209 124Q224 116 240 129Q252 116 272 125M240 132V179M220 158Q222 177 239 177Q257 176 263 157M222 184Q240 193 261 184M223 198Q241 201 258 197"
   fill="none" stroke="#9e7564" strokeWidth="1.4" opacity=".55"/>
  <path d="M215 129Q226 138 237 136M245 136Q258 139 268 127" fill="none" stroke="#fff0d9" strokeWidth="2" opacity=".5"/>
  <ellipse cx="240" cy="52" rx="26" ry="35" fill="url(#bio-human-skin)" stroke="#9a7464" strokeWidth="2.1"/>
  <path d="M215 45Q207 16 232 14Q265 7 269 35L267 50L258 31Q241 37 218 35Z" fill="#4f413a"/>
  <path d="M218 39Q221 26 231 24M238 23Q257 23 262 37" fill="none" stroke="#736056" strokeWidth="2.4"/>
  <ellipse cx="214" cy="54" rx="4" ry="9" fill="#d7a78b"/><ellipse cx="266" cy="54" rx="4" ry="9" fill="#d3a186"/>
  <path d="M224 50Q230 47 234 51M247 51Q253 47 258 50" stroke="#6c5147" strokeWidth="2" strokeLinecap="round" fill="none"/>
  <circle cx="230" cy="52" r="1.5" fill="#3c4038"/><circle cx="251" cy="52" r="1.5" fill="#3c4038"/>
  <path d="M241 52L237 63Q240 66 244 63M234 73Q241 76 247 72" fill="none" stroke="#9e6e60" strokeWidth="1.8" strokeLinecap="round"/>
  <path d="M223 91Q239 96 254 91" stroke="#f8ddbe" strokeWidth="2.2" fill="none" opacity=".8"/>
 </g>;
}
function Cat():ReactNode{
 return <g data-bio-illustration="cat" aria-label="Кошка в профиль с четырьмя лапами, усами и хвостом">
  <defs>
   <linearGradient id="bio-cat-fur" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#dec9a7"/><stop offset=".56" stopColor="#b89474"/><stop offset="1" stopColor="#896d56"/></linearGradient>
  </defs>
  <ellipse cx="265" cy="309" rx="180" ry="7" fill="#51634f" opacity=".12"/>
  <path d="M347 176Q405 161 412 102Q417 61 393 57Q377 55 374 73" stroke="#765d4d" strokeWidth="23" fill="none" strokeLinecap="round"/>
  <path d="M347 175Q401 158 401 100Q404 68 392 68" stroke="#c7a78a" strokeWidth="15" fill="none" strokeLinecap="round"/>
  <path d="M353 174Q395 153 400 114" stroke="#806149" strokeWidth="4" strokeDasharray="14 14" fill="none"/>
  {/* Far legs emerge from the correct underside of the torso. */}
  <path d="M258 220Q268 245 265 277L258 304Q264 310 280 305L287 257L303 224Z" fill="#987c62" stroke="#755945" strokeWidth="4"/>
  <path d="M340 218Q351 251 350 283L343 306Q354 314 369 307L368 277L360 216Z" fill="#987c62" stroke="#755945" strokeWidth="4"/>
  <path d="M197 175Q238 137 294 140Q337 143 364 173Q384 193 358 232Q337 250 297 243Q263 250 234 235Q207 242 191 218Z"
   fill="url(#bio-cat-fur)" stroke="#82654f" strokeWidth="5"/>
  <path d="M250 153Q296 145 335 169M279 176Q321 165 356 188" fill="none" stroke="#785e4c" strokeWidth="9" strokeLinecap="round" opacity=".38"/>
  <path d="M207 216Q212 237 207 262L203 304Q210 313 226 308L232 277L238 237Z" fill="#b69779" stroke="#80664f" strokeWidth="4"/>
  <path d="M319 219Q323 241 319 264L317 302Q322 312 339 306L341 276L347 227Z" fill="#b39777" stroke="#80664f" strokeWidth="4"/>
  <path d="M200 297L227 297M317 297L342 297" stroke="#eed7b7" strokeWidth="5" strokeLinecap="round"/>
  {/* Feline head: wedge-shaped muzzle, high triangular pinnae and almond eye. */}
  <path d="M122 153L125 93Q128 88 135 99L161 122L186 120L203 86Q207 79 212 93L223 146Q238 165 221 190L198 209L152 208Q129 203 118 180Q103 168 122 153Z"
   fill="#c6aa88" stroke="#82654f" strokeWidth="4.5" strokeLinejoin="round"/>
  <path d="M131 107L139 151L160 136Z M192 133L205 101L208 150Z" fill="#c78b85" stroke="#89634f" strokeWidth="2"/>
  <path d="M126 165Q156 148 192 164L188 198Q155 219 127 189Z" fill="#e7d5bd" opacity=".86"/>
  <path d="M174 154Q188 146 204 154Q192 167 177 158Z" fill="#f5dba3" stroke="#665e45" strokeWidth="2"/>
  <ellipse cx="189" cy="157" rx="4.2" ry="8.5" fill="#394c35"/>
  <path d="M111 179Q121 169 133 178L137 185L125 191Z" fill="#9b7772"/>
  <path d="M125 190Q131 201 141 194M125 190Q119 200 109 196" stroke="#785950" strokeWidth="2" fill="none"/>
  <path d="M120 183L77 175M120 188L69 193M121 193L80 207M139 183L169 179M140 192L177 197" stroke="#eee3d1" strokeWidth="1.7" strokeLinecap="round"/>
  <path d="M160 173q-2-12 5-20M215 174q11-4 15-12" fill="none" stroke="#82654f" strokeWidth="4" opacity=".5"/>
  {Array.from({length:13},(_,i)=>{const x=247+i*8;return <path key={i} d={"M"+x+" "+(180+i%3*10)+"q-9 13 -1 27"} fill="none" stroke="#765d4a" strokeWidth="2.4" opacity=".45"/>;})}
 </g>;
}
function Oak():ReactNode{
 return <g data-bio-illustration="oak" aria-label="Дуб с широкой кроной, ветвями и корневой системой">
  <defs>
   <linearGradient id="bio-oak-crown" x1="0" x2=".85" y1="0" y2="1"><stop stopColor="#99ba79"/><stop offset=".58" stopColor="#668d52"/><stop offset="1" stopColor="#3d6747"/></linearGradient>
   <linearGradient id="bio-oak-bark" x1="0" x2="1"><stop stopColor="#503f32"/><stop offset=".45" stopColor="#a27b58"/><stop offset="1" stopColor="#584334"/></linearGradient>
  </defs>
  <ellipse cx="247" cy="307" rx="128" ry="9" fill="#56734b" opacity=".15"/>
  <path d="M220 293Q225 260 222 225L213 181L198 146L218 140L240 179L245 140L259 139L256 197L273 157L288 168L269 222Q264 271 265 292L291 309L262 307L250 299L241 316L234 299L212 310L191 307Z"
   fill="url(#bio-oak-bark)" stroke={bark} strokeWidth="4" strokeLinejoin="round"/>
  <g fill="none" stroke="#6b513a" strokeLinecap="round">
   <path d="M234 211Q201 169 144 150M244 187Q265 124 326 112M252 218Q292 184 346 170M232 180Q211 123 184 102" strokeWidth="13"/>
   <path d="M235 284L234 237M249 281L258 229M227 244L215 212M247 205L245 171" strokeWidth="3" opacity=".65"/>
  </g>
  <path d="M99 185Q67 168 80 131Q62 101 96 77Q105 46 151 50Q180 13 222 39Q250 5 284 35Q335 20 355 65Q401 62 406 104Q431 130 399 166Q393 201 350 207Q327 235 291 217Q251 236 218 211Q173 230 150 201Q115 217 99 185Z"
   fill="url(#bio-oak-crown)" stroke="#416c45" strokeWidth="5" strokeLinejoin="round"/>
  {/* Smaller lobed crowns suggest real oak foliage rather than a green circle. */}
  {Array.from({length:27},(_,i)=>{
   const x=119+(i%9)*29+(Math.floor(i/9)%2?11:0), y=83+Math.floor(i/9)*42+(i%3)*5;
   return <path key={i} d={"M"+(x-10)+" "+(y+2)+"q-6-12 4-13q7-15 18-4q12-2 14 8q5 13-9 16q-11 9-17-7Z"}
    fill={i%4===0?"#9cbd77":i%3===0?"#78a35f":"#5f914e"} stroke="#527a4a" strokeWidth="1.1" opacity=".78"/>;
  })}
  {Array.from({length:20},(_,i)=>{
   const x=125+(i%7)*38,y=110+Math.floor(i/7)*36;
   return <g key={i} transform={"translate("+x+" "+y+") rotate("+((i%5)*23-43)+")"} opacity=".85">
    <path d="M0 0q-6-9 2-13q6-13 13-7q9-4 13 5q11 12-3 19q-9 9-16-1q-7 8-9-3Z" fill={i%3===0?"#a3bb79":"#79a75c"} stroke="#4b7949" strokeWidth="1.3"/>
    <path d="M11 7L13-15" fill="none" stroke="#d2d99b" strokeWidth="1.1"/>
   </g>;
  })}
  <path d="M290 194q7 12 13 21M306 214q15 3 21 0" stroke="#826641" strokeWidth="2.6" fill="none"/>
  <ellipse cx="304" cy="214" rx="6" ry="9" fill="#ae8650" stroke="#72583e" strokeWidth="1.5"/>
  <path d="M298 207q6-9 13 0Z" fill="#819454"/>
  <path d="M221 291L185 314M266 292L299 313" fill="none" stroke="#7f5b43" strokeWidth="5" strokeLinecap="round"/>
 </g>;
}
function Sunflower():ReactNode{
 const petals=Array.from({length:27},(_,i)=>{
  const a=2*Math.PI*i/27-1.56;
  const x=240+48*Math.cos(a),y=100+48*Math.sin(a);
  return <g key={i} transform={"translate("+x+" "+y+") rotate("+(a*180/Math.PI+90)+")"}>
   <path d="M0 3Q-19-15-12-41Q-3-76 0-77Q12-60 13-42Q19-17 0 3Z" fill={i%3===0?"#f2b93b":"#e8aa29"} stroke="#b77b21" strokeWidth="1.7"/>
   <path d="M0 -3L0 -63" stroke="#ffe093" strokeWidth="1.3" opacity=".7"/>
  </g>;
 });
 return <g data-bio-illustration="sunflower" aria-label="Подсолнечник с настоящим соцветием-корзинкой, листьями и стеблем">
  <defs>
   <linearGradient id="bio-sunflower-leaf" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#acd27e"/><stop offset=".65" stopColor="#5b9654"/><stop offset="1" stopColor="#3e764d"/></linearGradient>
   <radialGradient id="bio-sunflower-disk"><stop stopColor="#a17c44"/><stop offset=".8" stopColor="#775632"/><stop offset="1" stopColor="#513d2a"/></radialGradient>
  </defs>
  <ellipse cx="239" cy="307" rx="88" ry="6" fill="#6e925c" opacity=".14"/>
  {/* Stem and secondary veins grow from genuine leaf attachment points. */}
  <path d="M240 298Q237 252 243 195Q244 151 240 116" fill="none" stroke="#487f47" strokeWidth="15" strokeLinecap="round"/>
  <path d="M244 292Q249 234 247 169" fill="none" stroke="#8eb16d" strokeWidth="3" opacity=".8"/>
  <path d="M238 210Q210 187 185 187M245 241Q279 208 320 217" fill="none" stroke="#598c48" strokeWidth="7" strokeLinecap="round"/>
  <path d="M235 209Q196 143 126 171Q132 223 198 231Q216 228 235 209Z" fill="url(#bio-sunflower-leaf)" stroke="#447b48" strokeWidth="4"/>
  <path d="M250 239Q291 177 376 202Q370 252 313 258Q275 257 250 239Z" fill="url(#bio-sunflower-leaf)" stroke="#447b48" strokeWidth="4"/>
  <path d="M231 211L139 179M251 239L367 211" stroke="#d1df9f" strokeWidth="2.8" fill="none"/>
  {Array.from({length:6},(_,i)=><g key={i} stroke="#77a660" strokeWidth="1.6" fill="none">
   <path d={"M"+(157+i*10)+" "+(183+i*2)+"l-7 -13M"+(157+i*10)+" "+(183+i*2)+"l6 19"}/>
   <path d={"M"+(273+i*15)+" "+(227-i*2)+"l9 -16M"+(273+i*15)+" "+(227-i*2)+"l-6 15"}/>
  </g>)}
  <path d="M238 279q-8 21-24 30M240 285q12 16 26 26M239 286v29" stroke="#867553" strokeWidth="3" fill="none" strokeLinecap="round"/>
  <g>{petals}</g>
  <circle cx="240" cy="100" r="48" fill="#66513a" stroke="#a77e42" strokeWidth="5"/>
  <circle cx="240" cy="100" r="43" fill="url(#bio-sunflower-disk)" stroke="#68452a" strokeWidth="2.5"/>
  {/* Fermat spiral makes a dense seed-like floret disk, not a smiley face. */}
  {Array.from({length:220},(_,i)=>{
   const angle=i*2.399963229728653,rad=2.75*Math.sqrt(i),x=240+rad*Math.cos(angle),y=100+rad*Math.sin(angle);
   return <ellipse key={i} cx={x} cy={y} rx="1.7" ry="2.5"
    transform={"rotate("+(angle*180/Math.PI)+" "+x+" "+y+")"}
    fill={i%3===0?"#c99b55":i%5===0?"#d5b36b":"#563e2c"} opacity=".85"/>;
  })}
  <path d="M196 108q-10-8-15-2M282 113q11-8 18-3" stroke="#63884d" strokeWidth="5" fill="none" opacity=".65"/>
 </g>;
}
export default function LektrusBioDetailedOrganisms({organism}:{organism:BioOrganism}):ReactNode{
 switch(organism){
  case "human":return <Human/>;
  case "cat":return <Cat/>;
  case "oak":return <Oak/>;
  case "sunflower":return <Sunflower/>;
  default:return null;
 }
}
