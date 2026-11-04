/** Human-only, offline, explicitly schematic depth views for the two
 * systems not yet represented by a reviewed five-node biology atlas path.
 * Never substitute feline tissues or the unrelated skin illustration.
 * The camera stays in the SAME world at every level.
 */
import {memo,useId} from "react";
type StudySystem="digestive"|"musculoskeletal";
type Props={system:StudySystem;level:number};
function IntestinalVilli(){
 return <g>
  <rect x="40" y="86" width="400" height="206" rx="15" fill="#f8e6d7"
   stroke="#d6aa9a" strokeWidth="4"/>
  <path d="M40 105H440" stroke="#fff9ec" strokeWidth="24"/>
  {Array.from({length:9},(_,i)=>{
   const x=72+i*41;
   return <g key={i}>
    <path d={"M"+(x-13)+" 150Q"+(x-18)+" 103 "+x+" 90Q"+(x+18)+" 102 "+(x+13)+" 150L"+(x+11)+" 227H"+(x-11)+"Z"}
     fill="#e9b8aa" stroke="#bb8582" strokeWidth="3"/>
    <path d={"M"+x+" 132V222"} stroke="#c27481" strokeWidth="3.5"/>
    <ellipse cx={x} cy="196" rx="7" ry="5" fill="#92759b"/>
   </g>;
  })}
  <path d="M50 258Q245 272 427 256" stroke="#a7787f" strokeWidth="11" fill="none"/>
  <text x="56" y="66" fontSize="18" fontWeight="750" fill="#91615a">Ворсинки тонкой кишки</text>
  <text x="73" y="312" fontSize="12" fill="#805b5d">Кровеносные и лимфатические сосуды внутри каждой ворсинки</text>
 </g>;
}
function Enterocyte(){
 return <g>
  <path d="M141 98H343V272Q244 286 141 272Z" fill="#eac5ad"
   stroke="#b88c7b" strokeWidth="5"/>
  {Array.from({length:31},(_,i)=><path key={i}
   d={"M"+(144+i*6.5)+" 99v-33"} stroke={i%2?"#cea47b":"#dfc095"}
   strokeWidth="3.5" strokeLinecap="round"/>)}
  <path d="M342 111h20m-20 6h20m-20 6h20" stroke="#8e6878" strokeWidth="5"/>
  <ellipse cx="243" cy="230" rx="31" ry="24" fill="#bfa8cb"
   stroke="#967c9f" strokeWidth="3"/>
  <ellipse cx="237" cy="226" rx="11" ry="8" fill="#856995"/>
  {[[192,184],[291,179],[188,231],[294,233]].map(([x,y],i)=>
   <g key={i}><ellipse cx={x} cy={y} rx="13" ry="7" fill="#dba180" stroke="#b47e70" strokeWidth="2"/>
    <path d={"M"+(x-7)+" "+y+"q5 7 10 0t9 0"} fill="none" stroke="#a96b5e" strokeWidth="1.5"/></g>)}
  <text x="100" y="44" fontSize="19" fontWeight="800" fill="#8c645b">Энтероцит</text>
  <text x="22" y="115" fontSize="12" fill="#8c645b">Апикальные</text>
  <text x="22" y="129" fontSize="12" fill="#8c645b">микроворсинки</text>
  <path d="M125 115L170 72" stroke="#b48c71" strokeWidth="2" fill="none"/>
  <text x="340" y="170" fontSize="12" fill="#8c645b">Плотный</text>
  <text x="340" y="184" fontSize="12" fill="#8c645b">контакт</text>
  <path d="M354 155L347 121" stroke="#a27179" strokeWidth="2" fill="none"/>
  <text x="132" y="308" fontSize="12" fill="#8c645b">Поляризованная клетка эпителия</text>
 </g>;
}
function Digestive({level}:{level:number}){
 if(level>=4)return <Enterocyte/>;
 if(level===3)return <IntestinalVilli/>;
 if(level===2)return <g>
  <path d="M175 48Q181 93 200 106Q230 116 234 150Q233 181 273 204
    Q313 226 340 190Q372 149 350 118Q339 85 298 79
    Q256 72 243 44" fill="none" stroke="#d5a28f" strokeWidth="15" strokeLinecap="round"/>
  <path d="M209 93Q251 97 260 133Q277 151 303 149
    Q322 145 321 116Q349 143 330 175
    Q317 216 268 205Q234 183 227 154Z"
    fill="#edbda8" stroke="#ad7d75" strokeWidth="4"/>
  {Array.from({length:6},(_,i)=><path key={i}
   d={"M"+(246+i*12)+" "+(126+i*5)+"q20 5 18 27"}
   fill="none" stroke="#c58e86" strokeWidth="4"/>)}
  <text x="28" y="54" fontSize="19" fontWeight="800" fill="#805856">Желудок</text>
  <text x="38" y="282" fontSize="13" fill="#936d66">Складки слизистой и мышечная стенка</text>
 </g>;
 return <g>
  <path d="M235 49V111Q225 132 242 160" fill="none" stroke="#d7a28f" strokeWidth="11"
   strokeLinecap="round"/>
  <path d="M158 125Q205 107 251 127Q265 152 241 165Q214 174 163 162Z"
   fill="#a16d72" stroke="#7b575e" strokeWidth="3"/>
  <path d="M263 137Q318 129 326 168Q331 207 294 211Q261 211 257 178"
   fill="#ebb7a2" stroke="#a77978" strokeWidth="4"/>
  <path d="M293 214Q349 224 354 258Q344 278 301 271Q247 280 213 258Q214 236 241 221"
   fill="none" stroke="#bd8582" strokeWidth="15" strokeLinecap="round"/>
  {Array.from({length:4},(_,i)=><path key={i}
   d={"M"+(239+i*18)+" 229Q"+(228+i*16)+" 259 "+(259+i*15)+" 262"}
   fill="none" stroke="#dfada0" strokeWidth="9"/>)}
  <text x="20" y="54" fontSize="19" fontWeight="800" fill="#916b55">Пищеварение</text>
  <text x="25" y="303" fontSize="13" fill="#87635a">Пищевод · желудок · печень · кишечник</text>
 </g>;
}
function Muscle({level}:{level:number}){
 if(level>=4)return <g>
  <rect x="38" y="101" width="404" height="155" rx="28" fill="#db979a"
   stroke="#a96e78" strokeWidth="6"/>
  {Array.from({length:26},(_,i)=>{
   const x=51+i*14.7;return <rect key={i} x={x} y="115" width="7" height="127"
    fill={i%2?"#b77580":"#f3bcaf"} opacity=".84"/>;
  })}
  <ellipse cx="104" cy="125" rx="21" ry="9" fill="#9e7caa" stroke="#826494" strokeWidth="2"/>
  <ellipse cx="362" cy="231" rx="20" ry="9" fill="#9e7caa" stroke="#826494" strokeWidth="2"/>
  <text x="28" y="61" fontSize="19" fill="#845f70" fontWeight="800">Мышечное волокно</text>
  <text x="36" y="303" fontSize="12" fill="#8f6874">Многоядерная клетка · ядра у сарколеммы</text>
 </g>;
 if(level===3)return <g>
  {[85,158,231].map((y,i)=><g key={i}>
   <rect x="30" y={y-21} width="421" height="49" rx="22" fill={i===1?"#d99399":"#e4aaa8"}
    stroke="#b77980" strokeWidth="4"/>
   {Array.from({length:24},(_,j)=><path key={j}
    d={"M"+(48+j*16)+" "+(y-17)+"v38"} stroke={j%2?"#b56f79":"#f4cbc0"}
    strokeWidth={j%2?4:2.4}/>)}
  </g>)}
  <text x="31" y="47" fontSize="19" fontWeight="800" fill="#8c6572">Поперечнополосатая ткань</text>
  <text x="33" y="313" fontSize="12" fill="#845e6b">Миофибриллы · эндомизий · капилляры</text>
 </g>;
 if(level===2)return <g>
  <path d="M34 149Q114 136 178 124Q276 96 382 132L432 159
   Q376 206 286 226Q173 236 72 191Z"
   fill="#de989c" stroke="#a36f76" strokeWidth="5"/>
  {Array.from({length:10},(_,i)=><path key={i}
   d={"M"+(69+i*29)+" "+(150-i%3*7)+"Q"+(181+i*13)+" "+(160+i%3*12)+" "+(376-i*9)+" "+(161+i%3*7)}
   fill="none" stroke={i%2?"#f2c1b6":"#ba7b85"} strokeWidth="4"/>)}
  <path d="M34 162L17 152M428 166L468 154" stroke="#e2d8c5" strokeWidth="13" fill="none"/>
  <text x="22" y="58" fontSize="19" fill="#885d70" fontWeight="800">Скелетная мышца</text>
  <text x="25" y="297" fontSize="12" fill="#856678">Сухожилия, пучки волокон и оболочки</text>
 </g>;
 return <g>
  <path d="M234 53V240" stroke="#bcc6d1" strokeWidth="9" strokeLinecap="round"/>
  <path d="M148 112Q233 76 322 112" stroke="#d7c7b8" strokeWidth="15" fill="none"/>
  <path d="M149 122Q190 161 230 154Q275 161 322 122" stroke="#cc9397" strokeWidth="24"
   fill="none" strokeLinecap="round"/>
  <path d="M174 174Q228 157 291 174" stroke="#dda39f" strokeWidth="31" fill="none"/>
  <path d="M201 211L182 282M270 210L303 282" stroke="#c28d91"
   strokeWidth="23" fill="none" strokeLinecap="round"/>
  <text x="22" y="52" fontSize="19" fill="#835f76" fontWeight="800">Опора и движение</text>
  <text x="38" y="316" fontSize="12" fill="#856678">Кости и скелетные мышцы работают совместно</text>
 </g>;
}
function LektrusBioHumanSystemStudy({system,level}:Props){
 const unique=useId().replace(/:/g,"");
 const backgroundId="lektrus-human-study-bg-"+unique;
 return <svg className="lektrus-human-study-svg" viewBox="0 0 480 330"
  preserveAspectRatio="xMidYMid meet" role="img"
  aria-label={system==="digestive"?"Учебная схема пищеварительной системы":"Учебная схема опорно-двигательной системы"}>
  <defs>
   <linearGradient id={backgroundId} x1="0" y1="0" x2="1" y2="1">
    <stop stopColor="#fcfaf7"/><stop offset="1" stopColor="#efe6ef"/>
   </linearGradient>
  </defs>
  <rect width="480" height="330" fill={"url(#"+backgroundId+")"}/>
  {system==="digestive"?<Digestive level={level}/>:<Muscle level={level}/>}
  <rect x="7" y="7" width="466" height="316" rx="12" fill="none" stroke="#cebfd5"
   strokeWidth="2" strokeOpacity=".7"/>
 </svg>;
}
export default memo(LektrusBioHumanSystemStudy);
