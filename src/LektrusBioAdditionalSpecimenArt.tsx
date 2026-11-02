/** Distinct offline original SVG anatomical plates for 16 additional organ
 * branches and their 16 tissue levels. These are annotated school schematics,
 * not measured micrographs, and every focus point maps to a real child node.
 */
import type {ReactNode} from "react";
import type {BioExtraSpecimenKind} from "./lektrusBioAdditionalSpecimenPlates";

const pine="#5d9670",ink="#365e55",blue="#79b8bf",pink="#e4bcae",gold="#c8a477",nuc="#ab94b9";
function Label({x,y,pointX,pointY,caption,right=false}:{x:number;y:number;pointX:number;pointY:number;caption:string;right?:boolean}){
 return <g pointerEvents="none" className="lektrus-bio-specimen-callout">
  <path d={`M${pointX} ${pointY}L${x} ${y-5}`} stroke="#598474" strokeWidth="1.5" strokeDasharray="4 4" fill="none"/>
  <circle cx={pointX} cy={pointY} r="3" fill="#43856e"/>
  <text x={x} y={y} textAnchor={right?"end":"start"} fontSize="12" fontWeight="700" fill={ink}>{caption}</text>
 </g>;
}
function Nucleus({x,y}:{x:number;y:number}){return <g><ellipse cx={x} cy={y} rx="15" ry="11" fill={nuc} stroke="#9b7ba9" strokeWidth="2"/><circle cx={x-2} cy={y} r="4" fill="#916f9e"/></g>;}
function EpithelialCells({y=164,fill="#e9cdbd",end=411,start=70,count=9}:{y?:number;fill?:string;end?:number;start?:number;count?:number}){
 const w=(end-start)/count;
 return <g>{Array.from({length:count},(_,i)=><g key={i}>
  <path d={`M${start+i*w+1} ${y-40}Q${start+(i+.5)*w} ${y-50} ${start+(i+1)*w-1} ${y-40}L${start+(i+1)*w-1} ${y+42}H${start+i*w+1}Z`}
   fill={fill} stroke="#b68f88" strokeWidth="2.5"/>
  <Nucleus x={start+(i+.5)*w} y={y+8}/>
 </g>)}</g>;
}
function RetinaLayers({frog=false}:{frog?:boolean}){
 return <g>
  <rect x="44" y="65" width="395" height="211" rx="20" fill="#e8dec9" stroke="#c0ad93" strokeWidth="6"/>
  <rect x="57" y="81" width="370" height="32" rx="8" fill="#8f957c"/>
  {Array.from({length:17},(_,i)=><path key={i} d={`M${68+i*21} 114v39`}
   stroke={frog&&i%3===0?"#b1d8bb":"#9ed0bb"} strokeWidth={frog?7:8} strokeLinecap="round"/>)}
  <rect x="57" y="158" width="370" height="45" fill="#e6bdb1" stroke="#bd918f" strokeWidth="3"/>
  {Array.from({length:13},(_,i)=><Nucleus key={i} x={72+i*28} y={180}/>)}
  <rect x="57" y="211" width="370" height="45" rx="7" fill="#d2c4d8" stroke="#9d8da8" strokeWidth="3"/>
  {Array.from({length:13},(_,i)=><circle key={i} cx={72+i*28} cy="232" r="7" fill="#9a82b5"/>)}
  <Label x={17} y={34} pointX={145} pointY={94} caption="Пигментный эпителий"/>
  <Label x={465} y={317} pointX={235} pointY={134} caption="Фоторецепторы" right/>
 </g>;
}
function Eye({snail=false}:{snail?:boolean}){
 return <g>
  {snail&&<path d="M110 300Q133 229 160 174" stroke="#d6b9a3" strokeWidth="33" strokeLinecap="round" fill="none"/>}
  <circle cx="253" cy="167" r={snail?110:122} fill="#ebdfca" stroke="#a58e84" strokeWidth="10"/>
  <circle cx="254" cy="167" r={snail?90:103} fill="#f7ecca" stroke="#bba48e" strokeWidth="7"/>
  <path d="M301 76Q342 157 302 260" fill="none" stroke="#b7d7cb" strokeWidth="44" strokeLinecap="round"/>
  <path d="M205 80Q126 163 207 261" fill="none" stroke="#ba9aab" strokeWidth="24" strokeLinecap="round"/>
  <path d="M207 91Q154 169 205 251" fill="none" stroke="#879c8b" strokeWidth="8" strokeDasharray="5 7"/>
  <ellipse cx="272" cy="169" rx={snail?35:47} ry={snail?48:58} fill="#d9e6ca" stroke="#a8c2b4" strokeWidth="6"/>
  <circle cx="254" cy="167" r="13" fill="#91a7a1" opacity=".5"/>
  <Label x={16} y={36} pointX={205} pointY={150} caption="Фоторецепторный слой"/>
  <Label x={461} y={314} pointX={287} pointY={182} caption="Хрусталик" right/>
 </g>;
}
function Skin({tissue=false}:{tissue?:boolean}){
 return <g>
  <rect x="47" y="70" width="386" height="234" rx="17" fill="#e6d6c3" stroke="#b5a18e" strokeWidth="6"/>
  <rect x="51" y="74" width="379" height="69" rx="10" fill="#c8d9b3" stroke="#9fbd9c" strokeWidth="4"/>
  <path d="M56 76Q238 52 429 76" fill="none" stroke="#9bb791" strokeWidth="9"/>
  <EpithelialCells y={tissue?174:114} fill="#dfbcae" count={tissue?10:15} start={61} end={417}/>
  {tissue?<g>
   <path d="M52 224Q159 212 238 233T429 217" fill="none" stroke="#b87e86" strokeWidth="8"/>
   <path d="M58 267q97 -24 178 0t181-8" fill="none" stroke="#e2aeb1" strokeWidth="6"/>
  </g>:<g>
   <path d="M194 85Q189 152 230 190Q243 229 217 287" fill="none" stroke="#ae8e83" strokeWidth="22" strokeLinecap="round"/>
   <path d="M222 76q-11-47 -33-59" fill="none" stroke="#92787a" strokeWidth="8" strokeLinecap="round"/>
   <path d="M271 140q29 22 10 55" fill="none" stroke="#c6a78f" strokeWidth="6"/>
  </g>}
  <Label x={17} y={35} pointX={256} pointY={tissue?153:108} caption={tissue?"Кератиноциты":"Эпидермис"}/>
  <Label x={466} y={320} pointX={tissue?245:295} pointY={tissue?239:235} caption={tissue?"Соединительная ткань":"Дерма"} right/>
 </g>;
}
function Neuromast({tissue=false}:{tissue?:boolean}){
 return <g>
  {tissue?<EpithelialCells y={224} fill="#cdbdc0" count={9} start={79} end={409}/>:<path d="M55 251Q235 226 421 253" stroke="#c9b2a7" strokeWidth="56" strokeLinecap="round" fill="none"/>}
  <path d="M156 229Q185 195 197 158Q220 144 246 158Q272 143 293 161Q311 213 342 225" fill="#e9c7b4" stroke="#ad8f89" strokeWidth="5"/>
  <path d="M188 160Q184 108 211 75Q243 32 282 76Q300 123 285 157Z" fill="#d8efe8" stroke={blue} strokeWidth="6" opacity=".9"/>
  {Array.from({length:7},(_,i)=>{const x=204+i*12;return <path key={i} d={`M${x} 170q-4-22 ${i%2?-4:2} -47`}
   stroke="#669e96" strokeWidth="4" fill="none" strokeLinecap="round"/>})}
  <path d="M252 170Q267 121 256 80" stroke="#447e83" strokeWidth="6" fill="none" strokeLinecap="round"/>
  {Array.from({length:4},(_,i)=><path key={i} d={`M${200+i*31} 238q3 21 14 46`}
   stroke="#a58ca8" strokeWidth="7" strokeLinecap="round" fill="none"/>)}
  <Label x={18} y={34} pointX={248} pointY={75} caption="Купула"/>
  <Label x={469} y={318} pointX={242} pointY={191} caption="Волосковые клетки" right/>
 </g>;
}
function Heart({tissue=false}:{tissue?:boolean}){
 if(tissue)return <g>
  <path d="M42 109Q119 84 209 113Q278 101 437 118V248Q332 230 246 249Q125 246 42 232Z" fill="#dbada8" stroke="#ac7e82" strokeWidth="9"/>
  {Array.from({length:18},(_,i)=><path key={i} d={`M${55+i*21} 118v117`} stroke={i%2?"#b68187":"#f5d1bc"} strokeWidth={i%2?7:5}/>)}
  <path d="M329 118V243" stroke="#656375" strokeWidth="11" strokeDasharray="11 3"/>
  <Nucleus x={208} y={171}/><Nucleus x={267} y={191}/>
  <Label x={18} y={36} pointX={200} pointY={136} caption="Миофибриллы"/>
  <Label x={464} y={314} pointX={329} pointY={176} caption="Вставочные диски" right/>
 </g>;
 return <g>
  <path d="M175 71Q206 33 242 72Q274 39 316 78Q336 112 304 149Q343 208 285 278Q238 309 196 275Q153 233 171 168Q136 130 175 71Z"
   fill="#e3aaa2" stroke="#a8767f" strokeWidth="11"/>
  <ellipse cx="213" cy="124" rx="45" ry="39" fill="#eec3b6" stroke="#b48986" strokeWidth="5"/>
  <path d="M227 166Q252 145 282 171Q313 223 265 269Q219 278 200 233Q200 191 227 166Z" fill="#c8848c" stroke="#995d71" strokeWidth="7"/>
  <path d="M274 122Q307 119 338 84L359 40" fill="none" stroke="#a97882" strokeWidth="22" strokeLinecap="round"/>
  <path d="M168 104q-24-27-40-17" fill="none" stroke="#a97882" strokeWidth="16" strokeLinecap="round"/>
  <Label x={18} y={36} pointX={207} pointY={123} caption="Предсердие"/>
  <Label x={464} y={315} pointX={257} pointY={216} caption="Желудочек" right/>
 </g>;
}
function Lung({tissue=false}:{tissue?:boolean}){
 return <g>
  <path d="M149 63Q218 24 289 67Q376 116 352 234Q324 291 231 289Q141 295 108 225Q98 131 149 63Z"
   fill="#e8c1b8" stroke="#aa8181" strokeWidth="9"/>
  <path d="M168 98Q238 64 294 108Q352 158 304 241Q249 274 172 235Q124 189 168 98Z"
   fill="#f8efde" stroke="#ceaaa0" strokeWidth="5"/>
  {Array.from({length:tissue?10:7},(_,i)=>{const a=i*Math.PI*2/(tissue?10:7);const x=234+Math.cos(a)*79,y=169+Math.sin(a)*65;
   return <path key={i} d={`M${x} ${y}Q${234+Math.cos(a+.3)*59} ${169+Math.sin(a+.3)*49} 234 169`}
    fill="none" stroke="#d8a69d" strokeWidth={tissue?8:12} strokeLinecap="round"/>;
  })}
  <ellipse cx="239" cy="170" rx="46" ry="41" fill="#f6f7e8"/>
  <path d="M121 221Q238 302 347 215" fill="none" stroke="#bd7882" strokeWidth="8" strokeDasharray="10 6"/>
  <Label x={18} y={34} pointX={176} pointY={111} caption={tissue?"Дыхательный эпителий":"Внутренние складки"}/>
  <Label x={462} y={317} pointX={305} pointY={230} caption="Капилляры" right/>
 </g>;
}
function Trachea({tissue=false}:{tissue?:boolean}){
 return <g>
  {tissue?
   <EpithelialCells y={196} fill="#e9d4ba" count={10} start={78} end={411}/>:
   <g><path d="M90 132Q175 93 254 136L390 136" stroke="#dbc5a6" strokeWidth="61" fill="none" strokeLinecap="round"/>
    <path d="M241 139L260 252M305 139L331 259" stroke="#dbc5a6" strokeWidth="27" strokeLinecap="round"/></g>}
  <path d="M75 116H414" stroke="#aa906a" strokeWidth={tissue?34:16} strokeLinecap="round" opacity=".82"/>
  {Array.from({length:15},(_,i)=><path key={i} d={`M${84+i*22} 100v37`} stroke="#e7d9b5" strokeWidth="7"/>)}
  <path d="M75 140H414" stroke="#f7f3e5" strokeWidth="7" strokeLinecap="round"/>
  <Label x={20} y={38} pointX={253} pointY={121} caption="Хитиновая интима"/>
  <Label x={466} y={317} pointX={246} pointY={tissue?195:177} caption={tissue?"Эпителий трахеи":"Воздушные трубки"} right/>
 </g>;
}
function Muscle({tissue=false}:{tissue?:boolean}){
 return <g>
  {Array.from({length:tissue?6:8},(_,i)=>{
   const x=68+i*(tissue?66:49);
   return <g key={i}>
    <path d={`M${x} 75Q${x+16} 168 ${x-4} 266`} stroke={i%2?"#e0aaa2":"#cb9495"} strokeWidth={tissue?44:33} strokeLinecap="round" fill="none"/>
    {Array.from({length:10},(_,j)=><path key={j} d={`M${x-15} ${100+j*15}h30`}
     stroke={j%2?"#b87d8a":"#f3d5b8"} strokeWidth="4"/>)}
    {tissue&&<ellipse cx={x+13} cy={250} rx="9" ry="5" fill={nuc}/>}
   </g>;
  })}
  <Label x={16} y={36} pointX={207} pointY={122} caption={tissue?"Саркомеры":"Пучки летательных мышц"}/>
  <Label x={465} y={315} pointX={tissue?311:345} pointY={tissue?223:239} caption={tissue?"Многоядерное волокно":"Поперечная исчерченность"} right/>
 </g>;
}
function Mantle({tissue=false}:{tissue?:boolean}){
 return <g>
  {tissue?<EpithelialCells y={191} fill="#e0c2b5" count={10} start={76} end={411}/>:
   <path d="M61 247Q63 67 245 68Q437 73 425 246Z" fill="#e2c5aa" stroke="#ab8e77" strokeWidth="10"/>}
  <path d={tissue?"M76 138H411":"M95 229Q99 98 244 102Q390 102 390 229"}
   stroke="#f2e2c9" strokeWidth={tissue?23:22} fill="none"/>
  <path d="M65 258Q184 220 241 247T422 249" stroke="#bf8287" strokeWidth="13" fill="none"/>
  {Array.from({length:8},(_,i)=>{const x=99+i*42;return <circle key={i} cx={x} cy={248+i%2*4} r="6" fill="#ad6477"/>})}
  <Label x={18} y={35} pointX={245} pointY={tissue?128:123} caption="Воздушная полость"/>
  <Label x={465} y={315} pointX={247} pointY={250} caption="Сосудистая стенка" right/>
 </g>;
}
function Root({tissue=false,wheat=false}:{tissue?:boolean;wheat?:boolean}){
 return <g>
  {tissue?
   <g><rect x="94" y="70" width="279" height="220" rx="26" fill="#d8e7bb" stroke="#789b71" strokeWidth="12"/>
    <path d="M365 137Q421 91 455 95Q469 106 439 121Q414 153 369 174"
     fill="#d8e7bb" stroke="#789b71" strokeWidth="10"/></g>:
   <g><path d="M235 46Q217 153 224 298" stroke="#9baf87" strokeWidth="75" strokeLinecap="round" fill="none"/>
    {Array.from({length:10},(_,i)=>{const x=229+(i%2?37:-35),y=80+i*19;
     return <path key={i} d={`M${x} ${y}Q${x+(i%2?38:-38)} ${y-20} ${x+(i%2?76:-76)} ${y-21}`}
      stroke="#afce9b" strokeWidth="5" fill="none" strokeLinecap="round"/>;
    })}</g>}
  {tissue&&<g><ellipse cx="230" cy="185" rx="92" ry="66" fill="#c7e1d9"/><Nucleus x={151} y={208}/></g>}
  <Label x={18} y={35} pointX={tissue?373:263} pointY={tissue?133:142} caption={wheat?"Ризодерма пшеницы":"Ризодерма сосны"}/>
  <Label x={464} y={316} pointX={tissue?417:166} pointY={tissue?130:174} caption="Корневой волосок" right/>
 </g>;
}
function Sporangium({tissue=false}:{tissue?:boolean}){
 return <g>
  <ellipse cx="240" cy="166" rx="140" ry="124" fill="#e9deae" stroke="#ad9f74" strokeWidth="10"/>
  <ellipse cx="241" cy="167" rx="106" ry="94" fill="#f5e8c9" stroke="#c9b186" strokeWidth="5"/>
  {Array.from({length:tissue?12:22},(_,i)=>{const a=i*2.399,rad=Math.sqrt(i)*17;
   return <g key={i}>
    <circle cx={242+Math.cos(a)*rad} cy={166+Math.sin(a)*rad} r={tissue?15:10} fill="#d6bba5" stroke="#a99982" strokeWidth="2"/>
    <circle cx={242+Math.cos(a)*rad} cy={166+Math.sin(a)*rad} r={tissue?6:4} fill={nuc}/>
   </g>;
  })}
  <path d="M133 114Q242 22 347 117" stroke="#b6a27b" strokeWidth="8" fill="none"/>
  <Label x={18} y={34} pointX={150} pointY={119} caption="Стенка микроспорангия"/>
  <Label x={466} y={318} pointX={245} pointY={165} caption={tissue?"Микроспороциты (2n)":"Спорогенная ткань"} right/>
 </g>;
}
function Leaf({tissue=false,grass=false}:{tissue?:boolean;grass?:boolean}){
 return <g>
  {tissue?
   <g><rect x="42" y="81" width="398" height="171" rx="20" fill="#b8d7a8" stroke="#729c70" strokeWidth="8"/>
    <rect x="48" y="108" width="387" height="118" fill="#e4f1cd"/></g>:
   <g>{grass?
    <path d="M71 254Q121 91 412 51Q270 153 190 266Z" fill="#8ebb89" stroke="#5e986c" strokeWidth="8"/>:
    <path d="M70 175Q181 41 391 89Q379 233 225 257Q113 248 70 175Z" fill="#8fbe8e" stroke="#5e986c" strokeWidth="8"/>}
    <path d="M80 177Q231 155 377 94" stroke="#d8eaba" strokeWidth="5" fill="none"/></g>}
  {Array.from({length:tissue?10:7},(_,i)=>{
   const x=86+i*(tissue?31:40),y=tissue?165:grass?169-i*11:158+(i%2)*22;
   return <g key={i}><ellipse cx={x} cy={y} rx={tissue?20:14} ry={tissue?35:13} fill="#c2e1ac" stroke="#659b70" strokeWidth="2"/>
    <ellipse cx={x} cy={y} rx="8" ry={tissue?19:6} fill="#5c9b65"/></g>;
  })}
  {tissue&&<g><ellipse cx="245" cy="167" rx="40" ry="48" fill="#e8e3c5" stroke="#b0b88d" strokeWidth="5"/>
   <path d="M235 130v79m15-79v79" stroke="#ae7e80" strokeWidth="8"/></g>}
  <Label x={18} y={34} pointX={220} pointY={tissue?160:115} caption={grass?"Мезофилл злака":"Мезофилл вайи"}/>
  <Label x={465} y={317} pointX={tissue?246:330} pointY={tissue?170:166} caption="Проводящие ткани" right/>
 </g>;
}
function FernRoot({tissue=false}:{tissue?:boolean}){
 return <g>
  <circle cx="241" cy="169" r="129" fill="#e9dfbd" stroke="#a1a684" strokeWidth="11"/>
  <circle cx="241" cy="169" r="85" fill="#e1e8c4" stroke="#9cb18c" strokeWidth="6"/>
  {Array.from({length:11},(_,i)=>{const a=i*Math.PI*2/11,x=240+Math.cos(a)*96,y=168+Math.sin(a)*95;
   return <g key={i}><ellipse cx={x} cy={y} rx={tissue?24:18} ry={tissue?21:17}
    fill="#c9d9ad" stroke="#8eaf87" strokeWidth="3"/>
    {tissue&&<Nucleus x={x} y={y}/>}</g>;
  })}
  <path d="M220 125l19 21 23-19v27l25 16-25 13 0 29-23-18-19 19v-29l-27-14 27-16Z"
   fill="#bb9190" stroke="#996e7b" strokeWidth="6"/>
  <Label x={18} y={34} pointX={141} pointY={170} caption="Паренхима коры"/>
  <Label x={465} y={319} pointX={241} pointY={171} caption="Центральный цилиндр" right/>
 </g>;
}

function picture(kind:BioExtraSpecimenKind,tissue:boolean):ReactNode{
 switch(kind){
  case "sparrow-skin":return <Skin tissue={tissue}/>;
  case "sparrow-retina":return tissue?<RetinaLayers/>:<Eye/>;
  case "perch-neuromast":return <Neuromast tissue={tissue}/>;
  case "perch-heart":return <Heart tissue={tissue}/>;
  case "frog-lung":return <Lung tissue={tissue}/>;
  case "frog-retina":return tissue?<RetinaLayers frog/>:<Eye/>;
  case "bee-trachea":return <Trachea tissue={tissue}/>;
  case "bee-flight-muscle":return <Muscle tissue={tissue}/>;
  case "snail-eye":return tissue?<RetinaLayers frog/>:<Eye snail/>;
  case "snail-mantle":return <Mantle tissue={tissue}/>;
  case "pine-root":return <Root tissue={tissue}/>;
  case "pine-microsporangium":return <Sporangium tissue={tissue}/>;
  case "fern-frond":return <Leaf tissue={tissue}/>;
  case "fern-root":return <FernRoot tissue={tissue}/>;
  case "wheat-leaf":return <Leaf tissue={tissue} grass/>;
  case "wheat-root":return <Root tissue={tissue} wheat/>;
 }
}
export default function LektrusBioAdditionalSpecimenArt({kind,tissue}:{
 kind:BioExtraSpecimenKind;tissue:boolean
}):ReactNode{
 return <g data-bio-additional-specimen={kind} data-bio-level={tissue?"tissue":"organ"}
  className="lektrus-bio-extra-specimen-art">
  {picture(kind,tissue)}
 </g>;
}
