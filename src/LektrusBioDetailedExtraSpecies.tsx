/** Original offline schematic specimen drawings for representative school taxa.
 * Whole animals and plants deliberately use species-specific morphology;
 * no silhouette is reused for unrelated lineages. Fixed 480x330 atlas space.
 */
import type {ReactNode} from "react";
import type {BioOrganism} from "./lektrusBioMicroscopeModel";

function Sparrow():ReactNode{
 return <g data-bio-illustration="sparrow" aria-label="Домовый воробей сбоку, клюв, крыло, хвост, лапки">
  <defs><linearGradient id="bio-sparrow-body" x1="0" y1="0" x2=".9" y2="1"><stop stopColor="#b89d7d"/><stop offset=".57" stopColor="#d9bfa0"/><stop offset="1" stopColor="#8b7664"/></linearGradient></defs>
  <ellipse cx="241" cy="314" rx="164" ry="6" fill="#6b8e76" opacity=".12"/>
  <path d="M314 197Q361 196 443 242L420 252L341 226Z" fill="#715d4f" stroke="#57493e" strokeWidth="3"/>
  {Array.from({length:5},(_,i)=><path key={i} d={"M321 "+(202+i*5)+"Q389 "+(212+i*6)+" "+(429-i*7)+" "+(239+i*3)} fill="none" stroke={i%2?"#c4ae93":"#957761"} strokeWidth="4"/>)}
  <path d="M145 178Q173 136 239 139Q309 134 350 185Q363 220 322 253Q236 286 172 242Q139 215 145 178Z" fill="url(#bio-sparrow-body)" stroke="#775e4b" strokeWidth="4.5"/>
  <path d="M191 177Q234 141 318 171Q310 223 239 240Q202 230 191 177Z" fill="#91745e" stroke="#685344" strokeWidth="4"/>
  {Array.from({length:8},(_,i)=><path key={i} d={"M"+(201+i*12)+" "+(189-i%3*3)+"Q"+(235+i*8)+" 218 "+(233+i*9)+" "+(232-i*2)} stroke={i%2?"#e1cba6":"#b59a7d"} strokeWidth="5" fill="none" strokeLinecap="round"/>)}
  <path d="M168 189Q150 199 166 223Q200 256 241 255" fill="#ead7bd" opacity=".9"/>
  <path d="M151 174Q117 146 126 112Q135 83 164 84Q204 84 212 116Q214 152 190 182Z" fill="#ab8970" stroke="#745b4d" strokeWidth="3.5"/>
  <path d="M133 115Q155 94 195 111Q204 129 196 148L183 157Q157 141 133 147Z" fill="#685346"/>
  <path d="M134 153L81 165L128 175Z" fill="#c8a46d" stroke="#805f44" strokeWidth="3"/>
  <path d="M84 164L128 166" stroke="#f6dfae" strokeWidth="2.5"/>
  <ellipse cx="168" cy="126" rx="6.5" ry="7.5" fill="#2e342f"/><circle cx="166" cy="124" r="2" fill="#fdfbf3"/>
  <path d="M188 159Q174 162 163 158" stroke="#f2e5d5" strokeWidth="5" fill="none"/>
  <path d="M239 262L228 302M278 255L270 301" stroke="#896f54" strokeWidth="5" strokeLinecap="round"/>
  <path d="M227 300l-14 11m14-11 15 8m28-7-15 10m15-10 14 6" stroke="#936945" strokeWidth="3" strokeLinecap="round"/>
 </g>;
}
function Perch():ReactNode{
 return <g data-bio-illustration="perch" aria-label="Речной окунь: жаберная крышка, боковая линия, два спинных плавника и полосы">
  <defs><linearGradient id="bio-perch-body" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#597b60"/><stop offset=".45" stopColor="#94b38a"/><stop offset="1" stopColor="#d1d2a8"/></linearGradient></defs>
  <path d="M382 172L451 102L439 177L453 254L379 207Z" fill="#ac9459" stroke="#74734f" strokeWidth="4"/>
  {Array.from({length:10},(_,i)=><path key={i} d={"M383 177L"+(444-i%2*9)+" "+(117+i*13)} stroke="#72805b" strokeWidth="1.8" opacity=".6"/>)}
  <path d="M200 112L205 60L224 78L242 43L259 78L276 42L290 90L320 67L328 121Z" fill="#9b9b6c" stroke="#717954" strokeWidth="3"/>
  <path d="M317 127Q348 96 387 106L389 150" fill="#b4ac75" stroke="#79825b" strokeWidth="3"/>
  <path d="M84 182Q96 135 156 114Q266 75 363 129Q397 149 402 178Q393 226 356 236Q251 275 155 239Q94 225 84 182Z"
   fill="url(#bio-perch-body)" stroke="#55735f" strokeWidth="5"/>
  <path d="M117 195Q231 250 376 208" stroke="#eef1c9" strokeWidth="5" fill="none" opacity=".5"/>
  {Array.from({length:7},(_,i)=><path key={i} d={"M"+(199+i*24)+" "+(113-i%3*6)+"Q"+(212+i*24)+" 174 "+(196+i*24)+" "+(235-i%3*5)} stroke="#647955" strokeWidth="13" opacity=".58" fill="none"/>)}
  {Array.from({length:5},(_,i)=>Array.from({length:11},(_,j)=><path key={i+"-"+j} d={"M"+(188+j*16)+" "+(145+i*15)+"q9 7 17 0"} fill="none" stroke="#d9ddb0" opacity=".38" strokeWidth="1.2"/>))}
  <path d="M159 117Q193 160 168 232" fill="none" stroke="#527866" strokeWidth="5"/>
  <path d="M153 150Q143 187 166 213" fill="none" stroke="#b6c2a0" strokeWidth="2.4"/>
  <path d="M171 187Q222 165 232 197L197 223Z" fill="#b6b485" stroke="#75855d" strokeWidth="3"/>
  <path d="M249 239L281 288L318 234" fill="#c7b782" stroke="#79835a" strokeWidth="3"/>
  <circle cx="119" cy="157" r="13" fill="#f5e8be" stroke="#5b6756" strokeWidth="3"/><circle cx="118" cy="156" r="6.5" fill="#2b3c38"/>
  <circle cx="116" cy="153" r="2" fill="#fff"/>
  <path d="M86 186L122 196M109 197Q123 205 145 199" fill="none" stroke="#5f7458" strokeWidth="3.5"/>
  <path d="M185 160Q286 136 382 165" fill="none" stroke="#c4cd97" strokeWidth="2.2" strokeDasharray="5 4"/>
 </g>;
}
function Frog():ReactNode{
 return <g data-bio-illustration="frog" aria-label="Травяная лягушка, характерные задние конечности и перепончатые пальцы">
  <defs><linearGradient id="bio-frog-skin" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#a5b67d"/><stop offset=".58" stopColor="#778e62"/><stop offset="1" stopColor="#526f52"/></linearGradient></defs>
  <ellipse cx="242" cy="309" rx="177" ry="8" fill="#567958" opacity=".12"/>
  <path d="M183 208Q130 206 104 250L66 286M292 201Q339 215 376 267L428 286" fill="none" stroke="#6e805c" strokeWidth="29" strokeLinecap="round" strokeLinejoin="round"/>
  <path d="M113 244Q127 270 93 292M365 256Q351 278 392 296" fill="none" stroke="#a6b78b" strokeWidth="9" strokeLinecap="round"/>
  <path d="M86 282L52 295M87 283L67 310M91 284L90 314M397 287L420 307M399 288L442 296M395 287L390 314" stroke="#697b57" strokeWidth="5" strokeLinecap="round"/>
  <path d="M180 219Q155 247 148 283M290 215Q307 257 323 289" fill="none" stroke="#809568" strokeWidth="17" strokeLinecap="round"/>
  <path d="M149 283l-21 21m21-21 3 26m173-22-10 24m10-24 19 19" stroke="#7f9467" strokeWidth="5" strokeLinecap="round"/>
  <path d="M153 167Q164 122 192 111Q237 100 285 112Q319 134 329 177Q336 237 289 265Q240 288 190 266Q147 245 153 167Z"
   fill="url(#bio-frog-skin)" stroke="#597655" strokeWidth="5"/>
  <path d="M184 220Q237 256 303 218Q297 271 239 270Q199 266 184 220Z" fill="#c2be91" opacity=".82"/>
  <path d="M178 135Q158 88 179 78Q204 66 222 103M257 106Q273 71 299 81Q319 99 300 140"
   fill="#8caa75" stroke="#5c7857" strokeWidth="4"/>
  <ellipse cx="190" cy="112" rx="19" ry="18" fill="#d3b888" stroke="#68815d" strokeWidth="3"/>
  <ellipse cx="290" cy="112" rx="19" ry="18" fill="#d3b888" stroke="#68815d" strokeWidth="3"/>
  <circle cx="190" cy="112" r="9" fill="#404b3a"/><circle cx="291" cy="112" r="9" fill="#404b3a"/>
  <circle cx="187" cy="109" r="2.6" fill="#fff"/><circle cx="288" cy="109" r="2.6" fill="#fff"/>
  <path d="M175 166Q239 181 306 165" stroke="#435f4e" strokeWidth="3.5" fill="none"/>
  <circle cx="202" cy="153" r="2.5" fill="#53694e"/><circle cx="282" cy="151" r="2.5" fill="#53694e"/>
  {Array.from({length:24},(_,i)=><ellipse key={i} cx={175+i%6*24} cy={180+Math.floor(i/6)*17} rx="4" ry="2.3" fill="#4f6e4e" opacity=".45"/>)}
  <path d="M157 164Q173 178 170 217M315 165Q302 181 315 217" stroke="#c2bb8a" strokeWidth="3" fill="none" opacity=".65"/>
 </g>;
}
function Bee():ReactNode{
 return <g data-bio-illustration="bee" aria-label="Медоносная пчела с шестью ногами, двумя парами крыльев и фасеточными глазами">
  <defs><linearGradient id="bio-bee-wing" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#e9f2e9" stopOpacity=".9"/><stop offset="1" stopColor="#91b7ba" stopOpacity=".4"/></linearGradient></defs>
  <path d="M204 164Q183 84 231 42Q264 41 251 126M251 151Q289 71 342 83Q369 107 303 175" fill="url(#bio-bee-wing)" stroke="#86a6a7" strokeWidth="3.3"/>
  <path d="M211 153L236 56M251 149L335 98M210 161L228 97M259 158L312 122" stroke="#a6c5c3" strokeWidth="2" fill="none"/>
  <path d="M236 193L173 272M251 203L221 293M277 207L287 298M292 206L351 278M231 191L186 232M286 189L335 237"
   fill="none" stroke="#53493c" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/>
  <path d="M274 163Q344 145 401 180Q427 193 427 213Q392 243 341 231Q289 221 274 197Z" fill="#d6aa51" stroke="#664d36" strokeWidth="4"/>
  {Array.from({length:5},(_,i)=><path key={i} d={"M"+(303+i*20)+" "+(163-i%2*1)+"Q"+(311+i*21)+" 200 "+(305+i*22)+" "+(231-i%2*2)} fill="none" stroke="#594938" strokeWidth="12" opacity=".91"/>)}
  <path d="M409 207l27 8-25 3" fill="#8d795b" stroke="#70533e" strokeWidth="2"/>
  <ellipse cx="250" cy="182" rx="48" ry="44" fill="#927652" stroke="#655340" strokeWidth="4"/>
  {Array.from({length:20},(_,i)=><path key={i} d={"M"+(216+i%5*17)+" "+(153+Math.floor(i/5)*14)+"l7 5"} stroke="#d0b279" strokeWidth="2.3" opacity=".7"/>)}
  <ellipse cx="169" cy="179" rx="44" ry="43" fill="#9b815c" stroke="#695541" strokeWidth="4"/>
  <ellipse cx="147" cy="169" rx="20" ry="28" fill="#333e39" stroke="#5b6558" strokeWidth="3"/>
  {Array.from({length:17},(_,i)=><circle key={i} cx={135+(i%4)*7} cy={149+Math.floor(i/4)*9} r="2.1" fill="#6e8a7d"/>)}
  <path d="M160 139Q142 100 116 98M175 138Q188 96 213 101" fill="none" stroke="#5a4d3f" strokeWidth="4" strokeLinecap="round"/>
  <path d="M127 195l-19 13" stroke="#6d5948" strokeWidth="4"/>
 </g>;
}
function Snail():ReactNode{
 return <g data-bio-illustration="snail" aria-label="Виноградная улитка с настоящей спиральной раковиной, четырьмя щупальцами и ногой">
  <ellipse cx="254" cy="301" rx="190" ry="8" fill="#77856e" opacity=".13"/>
  <path d="M71 261Q104 223 158 237L198 228Q265 228 323 242Q368 240 402 268Q419 286 383 292H100Q68 286 71 261Z"
   fill="#b4a789" stroke="#796f59" strokeWidth="4"/>
  <path d="M105 244Q118 224 135 210L139 150Q139 136 153 139Q162 141 167 151L180 208L216 220"
   fill="#b5a38b" stroke="#7d705b" strokeWidth="3.5"/>
  <path d="M124 158L118 96M159 146L170 84" stroke="#b1a083" strokeWidth="8" strokeLinecap="round"/>
  <ellipse cx="117" cy="91" rx="12" ry="8" fill="#9b927a"/><ellipse cx="171" cy="82" rx="12" ry="8" fill="#9b927a"/>
  <circle cx="117" cy="89" r="4" fill="#36392f"/><circle cx="171" cy="80" r="4" fill="#36392f"/>
  <path d="M122 190L101 169M166 191L181 175" stroke="#aa987d" strokeWidth="5" strokeLinecap="round"/>
  <path d="M170 235Q165 176 186 124Q217 71 286 83Q358 100 377 161Q398 233 329 252Q235 262 170 235Z"
   fill="#bc9a70" stroke="#75604a" strokeWidth="5"/>
  {Array.from({length:12},(_,i)=><path key={i} d={"M"+(200+i*12)+" "+(124+i%3*4)+"q24 24 17 90"} fill="none" stroke={i%2?"#e0c59c":"#947251"} strokeWidth="3" opacity=".4"/>)}
  <path d="M264 109Q341 100 357 164Q369 233 293 234Q226 227 227 173Q230 133 278 134Q312 142 307 174Q304 201 272 201Q247 201 250 178Q255 166 270 168"
   fill="none" stroke="#634d3d" strokeWidth="9" strokeLinecap="round"/>
  <path d="M258 110Q332 111 344 162" stroke="#e5cb9e" strokeWidth="3.5" fill="none"/>
  {Array.from({length:15},(_,i)=><circle key={i} cx={90+i*17} cy={267+i%3*5} r="2" fill="#796f5f" opacity=".5"/>)}
 </g>;
}
function Pine():ReactNode{
 const branches=Array.from({length:8},(_,i)=>{
  const y=83+i*27,half=63+i*15;
  return <g key={i}>
   <path d={"M240 "+(y+20)+"Q"+(230-half*.25)+" "+y+" "+(240-half)+" "+(y-4)+"M240 "+(y+20)+"Q"+(250+half*.25)+" "+y+" "+(240+half)+" "+(y-4)}
    stroke="#775b42" strokeWidth="6" strokeLinecap="round" fill="none"/>
   {[-1,1].map(side=>Array.from({length:13},(_,j)=>{const x=240+side*(17+j*half/14),yy=y+9-j*.45;
    return <path key={side+"-"+j} d={"M"+x+" "+yy+"l"+(side*(7+j%3*2))+" "+(-16-j%4*2)+"m"+(-side*(7+j%3*2))+" "+(16+j%4*2)+"l"+(side*(12+j%3*2))+" "+(2+j%4)} stroke={j%3?"#4f7550":"#7fa06b"} strokeWidth="2.5" strokeLinecap="round" fill="none"/>;
   }))}
  </g>;
 });
 return <g data-bio-illustration="pine" aria-label="Сосна с мутовчатыми ветвями, хвоей и верхушкой">
  <path d="M236 297Q240 230 239 161L241 43" fill="none" stroke="#85684b" strokeWidth="20" strokeLinecap="round"/>
  <path d="M242 293L244 78" fill="none" stroke="#a7885b" strokeWidth="5"/>
  <path d="M238 295L204 314M239 299L271 317" stroke="#806248" strokeWidth="5" strokeLinecap="round"/>
  {branches}
  <path d="M240 15L228 61L252 61Z" fill="#668a5b"/>
  <path d="M187 159Q194 150 202 159L204 177Q189 176 187 159Z" fill="#a88454" stroke="#715842" strokeWidth="2"/>
  <path d="M200 160l-7 15m11-12-4 14" fill="none" stroke="#d8c092" strokeWidth="2"/>
 </g>;
}
function Fern():ReactNode{
 const fronds=[-1,1].flatMap(side=>[0,1,2].map((level)=>{
  const x0=240+side*level*6,y0=283-level*16,x1=240+side*(105+level*32),y1=89+level*25;
  return <g key={side+"-"+level}>
   <path d={"M"+x0+" "+y0+"Q"+(240+side*40)+" "+(193-level*20)+" "+x1+" "+y1} fill="none" stroke="#6a9364" strokeWidth="4"/>
   {Array.from({length:13},(_,j)=>{const t=(j+1)/14,x=x0+(x1-x0)*t,y=y0+(y1-y0)*t-36*Math.sin(Math.PI*t);
    return <g key={j} transform={"translate("+x+" "+y+") rotate("+(side*(-42+level*9))+")"}>
     <path d={"M0 0Q"+(side*17)+" -30 "+(side*32)+" -23Q"+(side*26)+" -8 0 0Z"} fill={j%3?"#7ca66c":"#92b777"} stroke="#4a7a56" strokeWidth="1.6"/>
     <path d={"M0 0Q"+(side*19)+" 24 "+(side*33)+" 16Q"+(side*25)+" 0 0 0Z"} fill="#83ae72" stroke="#4a7a56" strokeWidth="1.6"/>
    </g>;
   })}
  </g>;
 }));
 return <g data-bio-illustration="fern" aria-label="Папоротник орляк с вайями и корневищем">
  <path d="M239 286Q212 302 167 301M241 287Q278 303 333 296" stroke="#88724d" strokeWidth="8" fill="none" strokeLinecap="round"/>
  {fronds}
  <path d="M240 292Q235 176 249 57" stroke="#5b885b" strokeWidth="5" fill="none"/>
  {Array.from({length:15},(_,i)=><g key={i} transform={"translate("+(242+(i%2?-1:1)*(10+i%3*4))+" "+(79+i*11)+")"}>
    <path d="M0 0q-20-7-25-25q18 2 25 25Z" fill="#86ab72" stroke="#527e57" strokeWidth="1.8"/>
    <circle cx="-15" cy="-14" r="2.5" fill="#986b4d"/>
   </g>)}
  <path d="M238 292q-11 13-17 22m19-21q14 17 19 23" stroke="#87724d" strokeWidth="3" fill="none"/>
 </g>;
}
function Wheat():ReactNode{
 return <g data-bio-illustration="wheat" aria-label="Пшеница: колос, зерновки, узлы стебля, линейные листья и мочковатые корни">
  <path d="M238 288Q241 206 239 87" stroke="#81985e" strokeWidth="6" fill="none"/>
  <path d="M233 261Q167 216 129 166Q209 169 240 241" fill="#97ad74" stroke="#628355" strokeWidth="3"/>
  <path d="M243 224Q299 152 382 145Q344 209 244 250" fill="#97b47c" stroke="#628355" strokeWidth="3"/>
  <path d="M237 250L145 178M246 231L367 154" stroke="#d2d8a4" strokeWidth="2" fill="none"/>
  <circle cx="239" cy="261" r="5.5" fill="#768d5b"/><circle cx="242" cy="225" r="5.5" fill="#768d5b"/>
  <path d="M239 91L239 31" stroke="#9b955d" strokeWidth="4"/>
  {Array.from({length:11},(_,i)=>{
   const y=42+i*12,s=i%2?-1:1;
   return <g key={i}>
    <path d={"M239 "+y+"Q"+(239+s*12)+" "+(y-18)+" "+(239+s*24)+" "+(y-12)+"Q"+(239+s*31)+" "+(y+5)+" 239 "+(y+9)+"Z"}
     fill={i%3?"#c7ae74":"#d8c392"} stroke="#98845a" strokeWidth="1.7"/>
    <path d={"M"+(239+s*24)+" "+(y-12)+"l"+(s*20)+" -30"} stroke="#ac9867" strokeWidth="1.7" fill="none"/>
   </g>;
  })}
  <path d="M238 287Q221 302 193 317M239 290Q255 304 275 318M239 288L236 322M239 290Q215 297 212 324M243 289Q266 295 291 312"
   stroke="#a88f6a" strokeWidth="2.7" strokeLinecap="round" fill="none"/>
 </g>;
}
export default function LektrusBioDetailedExtraSpecies({organism}:{organism:BioOrganism}):ReactNode{
 switch(organism){
  case "sparrow":return <Sparrow/>;
  case "perch":return <Perch/>;
  case "frog":return <Frog/>;
  case "bee":return <Bee/>;
  case "snail":return <Snail/>;
  case "pine":return <Pine/>;
  case "fern":return <Fern/>;
  case "wheat":return <Wheat/>;
  default:return null;
 }
}
