/** Offline school atlas: refined, species-specific specimen silhouettes.
 * All art is original SVG, displayed at 480x330; schematic, not to scale.
 */
import type {ReactNode} from "react";
import type {BioOrganism} from "./lektrusBioMicroscopeModel";

function Earthworm():ReactNode{
 const rings=Array.from({length:28},(_,i)=>{
  const x=68+i*12.6,y=195+37*Math.sin(i*.17)+13*Math.sin(i*.36);
  return <g key={i} transform={"translate("+x+" "+y+") rotate("+(17*Math.cos(i*.17))+")"}>
   <ellipse rx={i<2||i>25?13:18} ry={i<2||i>25?18:23} fill={i>=8&&i<=12?"#d8b2a4":i%2?"#b9827d":"#c8948c"} stroke="#8c635f" strokeWidth="1.4"/>
   <path d="M-9 -9Q-12 0-7 11" stroke="#e2b6a4" strokeWidth="1.5" fill="none" opacity=".75"/>
   <path d="M-10 20l-3 5m20-5 2 5" stroke="#8a6c62" strokeWidth="1" opacity=".6"/>
  </g>;
 });
 return <g data-bio-illustration="earthworm" aria-label="Сегментированный дождевой червь с поясом, без конечностей">
  <ellipse cx="240" cy="286" rx="177" ry="9" fill="#796d5e" opacity=".1"/>
  {rings}
  <path d="M165 213Q185 234 219 222" fill="none" stroke="#f1c9ab" strokeWidth="3" opacity=".65"/>
  <circle cx="67" cy="196" r="2.5" fill="#79534e"/>
 </g>;
}
function Seastar():ReactNode{
 const arms=Array.from({length:5},(_,i)=>{
  const a=-Math.PI/2+i*2*Math.PI/5;
  return <g key={i} transform={"translate(240 166) rotate("+(a*180/Math.PI+90)+")"}>
   <path d="M-43 7Q-37-26-27-60Q-14-120-4-149Q0-160 5-149Q18-114 30-61Q41-23 43 7Z"
    fill="#d7a37e" stroke="#ad7463" strokeWidth="4" strokeLinejoin="round"/>
   <path d="M-12 -125Q-15-61-20-16M10-124Q16-64 21-15" stroke="#f6c9a6" strokeWidth="3" fill="none"/>
   {Array.from({length:17},(_,j)=>{
    const y=-19-j*7,x=(j%3-1)*(15-j*.4);
    return <circle key={j} cx={x} cy={y} r={j%3===0?3.8:2.2} fill={j%2?"#f2ccab":"#a77660"} opacity=".8"/>;
   })}
  </g>;
 });
 return <g data-bio-illustration="seastar" aria-label="Морская звезда с пятью широкими лучами, покровными бугорками и мадрепоровой пластинкой">
  <path d="M72 295Q243 277 409 303" fill="none" stroke="#c9dacd" strokeWidth="13" opacity=".2"/>
  {arms}
  <circle cx="240" cy="166" r="59" fill="#dda781" stroke="#b27b68" strokeWidth="3"/>
  {Array.from({length:64},(_,j)=>{
   const a=j*2.39996,r=6*Math.sqrt(j),x=240+r*Math.cos(a),y=166+r*Math.sin(a);
   return <circle key={j} cx={x} cy={y} r={j%3===0?3:2} fill={j%3?"#f0c5a1":"#ae7c64"} opacity=".7"/>;
  })}
  <ellipse cx="257" cy="141" rx="11" ry="8" fill="#d4c29a" stroke="#9f8d6d" strokeWidth="2"/>
  {Array.from({length:9},(_,i)=><circle key={i} cx={250+(i%3)*5} cy={136+Math.floor(i/3)*4} r="1.1" fill="#8d816b"/>)}
 </g>;
}
function Crayfish():ReactNode{
 return <g data-bio-illustration="crayfish" aria-label="Речной рак сверху, головогрудь, пять пар ходильных конечностей включая клешни, сегментированное брюшко и хвостовой веер">
  <defs><linearGradient id="bio-crayfish-shell" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#a98c72"/><stop offset=".5" stopColor="#8b775e"/><stop offset="1" stopColor="#637969"/></linearGradient></defs>
  {/* Four pairs narrow walking legs, plus a large claw-bearing pair. */}
  {Array.from({length:4},(_,i)=>{
   const y=161+i*21,lx=189-i*2,rx=291+i*2;
   return <g key={i} fill="none" stroke="#766a55" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round">
    <path d={"M"+lx+" "+y+"L"+(151-i*10)+" "+(177+i*18)+"L"+(92-i*7)+" "+(195+i*22)}/>
    <path d={"M"+rx+" "+y+"L"+(331+i*10)+" "+(177+i*18)+"L"+(392+i*7)+" "+(195+i*22)}/>
    <path d={"M"+lx+" "+y+"L"+(151-i*10)+" "+(177+i*18)} stroke="#c5ab86" strokeWidth="2.4"/>
   </g>;
  })}
  <path d="M206 128Q168 102 137 100L111 85M273 128Q314 106 345 103L366 87" fill="none" stroke="#6d745f" strokeWidth="13" strokeLinecap="round"/>
  <path d="M99 97Q77 72 74 42Q84 26 104 42L133 86Q133 104 119 116Z" fill="#a28d70" stroke="#6d705e" strokeWidth="4"/>
  <path d="M382 97Q405 72 409 42Q395 23 375 43L345 86Q344 107 359 115Z" fill="#a28d70" stroke="#6d705e" strokeWidth="4"/>
  <path d="M76 43Q95 43 111 74M406 43Q387 45 371 73" fill="none" stroke="#e0c49a" strokeWidth="4"/>
  <path d="M80 45L64 19M403 44L418 19" stroke="#696b58" strokeWidth="5" strokeLinecap="round"/>
  {/* Tail segments overlap below the cephalothorax, terminate as five uropodal lobes. */}
  {Array.from({length:5},(_,i)=>{
   const y=214+i*17,rx=47-i*5;
   return <path key={i} d={"M"+(240-rx)+" "+y+"Q240 "+(y+21)+" "+(240+rx)+" "+y+"L"+(240+rx-4)+" "+(y+18)+"Q240 "+(y+26)+" "+(240-rx+4)+" "+(y+18)+"Z"}
    fill={i%2?"#aa9476":"#bda584"} stroke="#6c7766" strokeWidth="3.2"/>;
  })}
  {[-2,-1,0,1,2].map((k)=><path key={k} d={"M"+(240+k*6)+" 288Q"+(240+k*17)+" 300 "+(240+k*20)+" 316Q"+(240+k*7)+" 327 240 308Z"}
   fill="#ae9c7b" stroke="#6e7662" strokeWidth="2.4"/>)}
  <path d="M191 172Q188 112 214 86L235 76L240 53L247 76L275 87Q295 110 292 168L280 224Q242 242 200 221Z"
   fill="url(#bio-crayfish-shell)" stroke="#667568" strokeWidth="5"/>
  <path d="M239 68Q227 100 223 131M241 68Q257 104 263 128" fill="none" stroke="#d3b996" strokeWidth="3"/>
  <path d="M203 169Q238 188 282 168" fill="none" stroke="#b8aa86" strokeWidth="3.4"/>
  <path d="M222 82Q213 57 202 49M258 82Q268 55 281 50" fill="none" stroke="#6e7465" strokeWidth="3"/>
  <circle cx="206" cy="81" r="7.5" fill="#2f3a38" stroke="#b6a688" strokeWidth="2"/>
  <circle cx="274" cy="81" r="7.5" fill="#2f3a38" stroke="#b6a688" strokeWidth="2"/>
  <path d="M240 58Q239 19 219 9M239 59Q259 20 275 10M236 60Q197 43 171 29M243 60Q284 40 309 25"
   stroke="#757c6a" strokeWidth="2.4" fill="none" strokeLinecap="round"/>
 </g>;
}
function Horsetail():ReactNode{
 return <g data-bio-illustration="horsetail" aria-label="Хвощ полевой: зелёный ветвистый летний побег и отдельный спороносный весенний побег">
  <path d="M182 302V61" stroke="#688c65" strokeWidth="12" strokeLinecap="round"/>
  {Array.from({length:8},(_,i)=>{
   const y=269-i*26;
   return <g key={i}>
    <rect x="174" y={y-3} width="16" height="10" rx="3" fill="#a8b67a" stroke="#708c60" strokeWidth="1.5"/>
    {Array.from({length:7},(_,j)=>{
     const a=(j/7)*2*Math.PI,dx=Math.cos(a),dy=Math.sin(a);
     return <g key={j}>
      <path d={"M182 "+y+"Q"+(182+dx*33)+" "+(y-18+dy*9)+" "+(182+dx*79)+" "+(y-44+dy*20)}
       fill="none" stroke={j%2?"#709868":"#86a66d"} strokeWidth="3.3" strokeLinecap="round"/>
      <path d={"M"+(182+dx*49)+" "+(y-27+dy*12)+"l"+(dx*15)+" -13"} stroke="#a0bb82" strokeWidth="2" fill="none"/>
     </g>;
    })}
   </g>;
  })}
  <path d="M182 62L182 31" stroke="#648b62" strokeWidth="6"/>
  <path d="M331 302V116" stroke="#b99f75" strokeWidth="13" strokeLinecap="round"/>
  {Array.from({length:7},(_,i)=><g key={i}>
   <path d={"M322 "+(151+i*21)+"l18 0"} stroke="#8f795b" strokeWidth="5"/>
   <path d={"M325 "+(154+i*21)+"l7 -9 6 9"} fill="#cfb68c" stroke="#987f60" strokeWidth="1.5"/>
  </g>)}
  <path d="M317 51Q327 25 342 51L350 121Q331 131 313 119Z" fill="#b79a69" stroke="#907d5d" strokeWidth="4"/>
  {Array.from({length:7},(_,i)=><path key={i} d={"M"+(318+i*4)+" 53q-7 33 0 61"} stroke="#d5c397" strokeWidth="1.6" fill="none"/>)}
  <path d="M181 293Q153 308 125 316M183 293Q219 306 256 318M331 294Q349 306 375 315" stroke="#9c8464" strokeWidth="3.5" fill="none"/>
 </g>;
}
function Lizard():ReactNode{
 return <g data-bio-illustration="lizard" aria-label="Прыткая ящерица с чешуёй, четырьмя пятипалыми лапами и длинным сужающимся хвостом">
  <defs><linearGradient id="bio-lizard-skin" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#b5ba83"/><stop offset=".7" stopColor="#75945e"/><stop offset="1" stopColor="#536f55"/></linearGradient></defs>
  <path d="M295 189Q362 206 438 275Q455 295 433 285Q358 261 295 228Z" fill="#809969" stroke="#56765b" strokeWidth="4"/>
  {Array.from({length:13},(_,i)=><path key={i} d={"M"+(315+i*9)+" "+(202+i*4)+"l-12 16"} stroke="#59764f" strokeWidth="2.5" opacity=".7"/>)}
  {[[180,161,-1,-1],[180,217,-1,1],[303,168,1,-1],[305,218,1,1]].map(([x,y,sx,sy],i)=>{
   const tx=x+sx*46,ty=y+sy*49;
   return <g key={i} fill="none" stroke="#6c855d" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round">
    <path d={"M"+x+" "+y+"Q"+(x+sx*22)+" "+(y+sy*8)+" "+tx+" "+ty}/>
    {Array.from({length:5},(_,j)=><path key={j} d={"M"+tx+" "+ty+"l"+(sx*(12+j*3))+" "+(sy*(9+(j-2)*5))} strokeWidth="3.2"/>)}
   </g>;
  })}
  <path d="M107 162Q83 149 62 127Q79 95 119 95Q146 104 166 131Q224 107 282 127Q337 140 335 183Q320 231 272 235Q205 242 155 201Z"
   fill="url(#bio-lizard-skin)" stroke="#567858" strokeWidth="5"/>
  <path d="M164 143Q225 132 294 158Q292 192 272 213Q203 220 157 188Z" fill="#a9b782" stroke="#729260" strokeWidth="3"/>
  {Array.from({length:45},(_,i)=>{const x=171+i%9*13,y=152+Math.floor(i/9)*12;
   return <path key={i} d={"M"+x+" "+y+"q6-6 12 0q-6 6-12 0"} fill={i%3===0?"#678559":"#b4c191"} stroke="#718d60" strokeWidth="1"/>;
  })}
  <path d="M101 125Q120 114 135 127" stroke="#d5d19a" strokeWidth="6" fill="none"/>
  <ellipse cx="109" cy="127" rx="9.5" ry="7" fill="#c7be8d" stroke="#60785a" strokeWidth="2"/>
  <ellipse cx="111" cy="127" rx="3.4" ry="5.4" fill="#303c32"/>
  <path d="M64 155Q106 161 123 153" stroke="#4d6a50" strokeWidth="3" fill="none"/>
  <circle cx="75" cy="143" r="2" fill="#334e3d"/>
 </g>;
}
function Spider():ReactNode{
 return <g data-bio-illustration="spider" aria-label="Паук-крестовик с головогрудью, крупным брюшком и восемью членистыми ногами">
  <defs><radialGradient id="bio-spider-shell"><stop stopColor="#b8a288"/><stop offset="1" stopColor="#756957"/></radialGradient></defs>
  {Array.from({length:4},(_,i)=>{
   const y=161+i*18,a=95+i*11,tx=64+i*8,ty=50+i*80;
   return <g key={i} stroke="#776c5c" strokeWidth="7.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
    <path d={"M199 "+y+"Q"+(180-i*12)+" "+(y-20)+" "+a+" "+(88+i*41)+"L"+tx+" "+ty}/>
    <path d={"M278 "+y+"Q"+(319+i*7)+" "+(y-25)+" "+(383+i*4)+" "+(84+i*44)+"L"+(421-i*3)+" "+(48+i*80)}/>
    <path d={"M199 "+y+"Q"+(180-i*12)+" "+(y-20)+" "+a+" "+(88+i*41)} stroke="#baa28b" strokeWidth="2"/>
   </g>;
  })}
  <path d="M214 185Q239 187 259 193" stroke="#6b6253" strokeWidth="13"/>
  <ellipse cx="297" cy="197" rx="78" ry="87" fill="url(#bio-spider-shell)" stroke="#716658" strokeWidth="6"/>
  <ellipse cx="179" cy="180" rx="50" ry="49" fill="#93816e" stroke="#6b6053" strokeWidth="6"/>
  <path d="M268 141l23 38-22 37 18 34M311 139l-15 37 27 34-22 35" fill="none" stroke="#e4d1b1" strokeWidth="10" strokeLinecap="round"/>
  <path d="M253 165Q294 180 330 159M258 220Q295 211 328 222" fill="none" stroke="#e2c7a8" strokeWidth="6"/>
  {Array.from({length:8},(_,i)=><circle key={i} cx={150+i%4*14} cy={162+Math.floor(i/4)*15} r="4.3" fill="#282b29" stroke="#c8b598" strokeWidth="1"/>)}
  <path d="M145 203L132 217M167 213L160 231" stroke="#6d6254" strokeWidth="4" strokeLinecap="round"/>
 </g>;
}
function Clubmoss():ReactNode{
 return <g data-bio-illustration="clubmoss" aria-label="Плаун с ползучим побегом, густо облиственными ветвями и спороносными колосками">
  <path d="M39 289Q119 274 212 282Q309 286 444 273" stroke="#5b8055" strokeWidth="12" fill="none" strokeLinecap="round"/>
  {Array.from({length:6},(_,i)=>{
   const x=80+i*65,top=122+i%3*12;
   return <g key={i}>
    <path d={"M"+x+" 284Q"+(x+9)+" 221 "+(x+3)+" "+top} stroke="#648b5f" strokeWidth="8" fill="none"/>
    {Array.from({length:17},(_,j)=>{
     const y=top+j*9;
     return <g key={j}>
      <path d={"M"+(x+3)+" "+y+"l-14 -15 6 18Z"} fill="#83a36d" stroke="#62895e" strokeWidth="1"/>
      <path d={"M"+(x+3)+" "+y+"l15 -16 -6 19Z"} fill="#91aa74" stroke="#62895e" strokeWidth="1"/>
     </g>;
    })}
    {i%2===1&&<g>
     <path d={"M"+(x+3)+" "+top+"v-57"} stroke="#8b9463" strokeWidth="6"/>
     {Array.from({length:11},(_,j)=><path key={j} d={"M"+(x-5)+" "+(top-57+j*5)+"q9-7 17 0l-8 9Z"} fill="#bbb780" stroke="#888d66" strokeWidth="1.2"/>)}
    </g>}
   </g>;
  })}
  {Array.from({length:8},(_,i)=><path key={i} d={"M"+(80+i*47)+" 284q-11 13-13 32"} fill="none" stroke="#987e62" strokeWidth="2.8"/>)}
 </g>;
}
function Magnolia():ReactNode{
 const petals=Array.from({length:10},(_,i)=>{
  const a=i*2*Math.PI/10-1.55,x=229+32*Math.cos(a),y=107+31*Math.sin(a);
  return <g key={i} transform={"translate("+x+" "+y+") rotate("+(a*180/Math.PI+90)+")"}>
   <path d="M-7 16Q-30-20-22-49Q-15-81 0-88Q20-80 22-48Q30-18 7 16Z" fill={i%3===0?"#eee2d8":"#fff8ed"} stroke="#c9b8b1" strokeWidth="2.2"/>
   <path d="M0 -12Q-4-37 0-70" fill="none" stroke="#e5d6cb" strokeWidth="2"/>
  </g>;
 });
 return <g data-bio-illustration="magnolia" aria-label="Магнолия: крупный обоеполый цветок с многочисленными тычинками, плодолистиками и широкими листьями">
  <path d="M225 319Q254 223 237 80" stroke="#8c785b" strokeWidth="13" fill="none"/>
  {[[128,203,-22],[347,201,21],[345,119,33]].map(([x,y,a],i)=><g key={i}>
   <path d={"M239 "+(y+16)+"Q"+(x+10)+" "+(y-22)+" "+x+" "+y} stroke="#82875d" strokeWidth="7" fill="none"/>
   <ellipse cx={x} cy={y} rx="71" ry="29" fill={i%2?"#5d9870":"#73a67a"} stroke="#458265" strokeWidth="4" transform={"rotate("+a+" "+x+" "+y+")"}/>
   <path d={"M"+(x-57)+" "+y+"L"+(x+58)+" "+y} stroke="#b4d19d" strokeWidth="3" transform={"rotate("+a+" "+x+" "+y+")"}/>
   {[-35,-15,14,34].map(k=><path key={k} d={"M"+(x+k)+" "+(y+2)+"l17 -15"} stroke="#a5c893" strokeWidth="1.6" transform={"rotate("+a+" "+x+" "+y+")"}/>)}
  </g>)}
  {petals}
  <circle cx="229" cy="107" r="24" fill="#e3cf9b" stroke="#a99769" strokeWidth="2"/>
  {Array.from({length:36},(_,i)=>{
   const a=i*2.4,r=5+Math.sqrt(i)*3.1;
   return <path key={i} d={"M"+(229+r*Math.cos(a))+" "+(107+r*Math.sin(a))+"l"+(6*Math.cos(a))+" "+(6*Math.sin(a))}
    stroke="#b39a59" strokeWidth="3.4" strokeLinecap="round"/>;
  })}
  <path d="M220 125Q207 105 219 79Q224 63 229 79Q242 103 235 126Z" fill="#a7a36e" stroke="#7d855e" strokeWidth="3"/>
 </g>;
}
export default function LektrusBioDetailedLineageSpecimens({organism}:{organism:BioOrganism}):ReactNode{
 switch(organism){
  case "earthworm":return <Earthworm/>;
  case "seastar":return <Seastar/>;
  case "crayfish":return <Crayfish/>;
  case "horsetail":return <Horsetail/>;
  case "lizard":return <Lizard/>;
  case "spider":return <Spider/>;
  case "clubmoss":return <Clubmoss/>;
  case "magnolia":return <Magnolia/>;
  default:return null;
 }
}
