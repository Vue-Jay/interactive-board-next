/** Original offline vector histology for eight representative species.
 * Illustrations preserve 480×330 drawing coordinates and show species-specific
 * structures, not measured photomicrographs or actual optical magnification.
 */
import type {ReactNode} from "react";
import type {BioRepresentativeMicroPlate} from "./lektrusBioRepresentativeMicroplates";
const ink="#355d55",purple="#9876a8",red="#bf7a81",green="#67996d";
function N({x=241,y=187,r=14}:{x?:number;y?:number;r?:number}){
 return <g><ellipse cx={x} cy={y} rx={r} ry={r*.72} fill="#b7a4c9" stroke="#866fa2" strokeWidth="2"/>
 <circle cx={x-2} cy={y} r="3" fill="#846da0"/></g>;
}
function Chlor({x,y,r=10}:{x:number;y:number;r?:number}){
 return <g><ellipse cx={x} cy={y} rx={r} ry={r*.53} fill="#70aa67" stroke="#438250" strokeWidth="1.6"/>
 <path d={"M"+(x-r*.6)+" "+y+"h"+(r*1.2)} stroke="#3c8548" strokeWidth="1.2"/></g>;
}
function Vessel({x,y,length=150}:{x:number;y:number;length?:number}){
 return <g><path d={"M"+x+" "+y+"q"+(length/2)+" -20 "+length+" 0"} stroke="#c47e86" strokeWidth="18" fill="none" strokeLinecap="round"/>
 <path d={"M"+x+" "+y+"q"+(length/2)+" -20 "+length+" 0"} stroke="#f6cebc" strokeWidth="8" fill="none"/>
 {Array.from({length:4},(_,i)=><ellipse key={i} cx={x+22+i*length/5} cy={y-3} rx="10" ry="5.6" fill="#b46d79" stroke="#e1a0a4" strokeWidth="1.4"/>)}</g>;
}
function Column({x=50,y=122,w=40,h=145,brush=false}:{x?:number;y?:number;w?:number;h?:number;brush?:boolean}){
 return <g><rect x={x} y={y} width={w} height={h} rx="9" fill="#f1d2be" stroke="#b89589" strokeWidth="3"/>
 <N x={x+w/2} y={y+h-34} r={Math.min(14,w*.27)}/>
 {brush&&Array.from({length:7},(_,j)=><path key={j} d={"M"+(x+4+j*(w-8)/6)+" "+y+"v-21"} stroke="#b99d88" strokeWidth="2.5" strokeLinecap="round"/>)}</g>;
}
function MuscleBand({cell=false,cardiac=false}:{cell?:boolean;cardiac?:boolean}){
 return <g>{Array.from({length:cell?1:5},(_,i)=>{
  const y=cell?107:79+i*43,h=cell?144:36;
  return <g key={i}><rect x="48" y={y} width="387" height={h} rx="17" fill={cardiac?"#d99293":"#de9b9c"} stroke="#ae6d78" strokeWidth="3"/>
   {Array.from({length:27},(_,j)=><path key={j} d={"M"+(62+j*13)+" "+(y+4)+"v"+(h-8)}
    stroke={j%2?"#f0bdb0":"#a56976"} strokeWidth="5" opacity=".88"/>)}
   {Array.from({length:cell?4:2},(_,j)=><N key={j} x={85+j*(cell?96:227)} y={cardiac?y+h/2:y+h-8} r={cell?13:7}/>)}
  </g>;
 })}{cardiac&&[170,320].map((x,i)=><path key={i} d={"M"+x+" 97v158"} stroke="#815d74" strokeWidth="6" strokeDasharray="10 5"/>)}</g>;
}
function PlantCell({x,y,w=72,h=175,chlor=true,spores=false}:{x:number;y:number;w?:number;h?:number;chlor?:boolean;spores?:boolean}){
 return <g><rect x={x} y={y} width={w} height={h} rx="12" fill={spores?"#e8d8a4":"#d7e8bd"} stroke={spores?"#9b8c63":"#709665"} strokeWidth="5"/>
 {(!spores)&&<rect x={x+11} y={y+16} width={w-22} height={h-39} rx="12" fill="#c0dad9" stroke="#91b4b3" strokeWidth="2"/>}
 {(chlor)&&Array.from({length:9},(_,i)=><Chlor key={i} x={x+10+(i%2)*(w-20)} y={y+27+Math.floor(i/2)*(h-57)/4} r={8}/>)}
 <N x={x+w/2} y={y+h-24} r={12}/></g>;
}
function TissuePanel({kind,cell}:{kind:BioRepresentativeMicroPlate["kind"];cell:boolean}):ReactNode{
 switch(kind){
 case "bird-air-capillary":return <g>
  <path d="M75 175Q134 76 229 151Q307 211 415 106" stroke="#c79f9b" strokeWidth={cell?31:47} fill="none" strokeLinecap="round"/>
  <path d="M75 175Q134 76 229 151Q307 211 415 106" stroke="#fff4e7" strokeWidth={cell?23:34} fill="none" strokeLinecap="round"/>
  {Array.from({length:cell?5:13},(_,i)=>{const x=89+i*(cell?69:25),y=246+(i%3)*7;return <ellipse key={i} cx={x} cy={y} rx="16" ry="8" fill="#c87e89" stroke="#9f6876" strokeWidth="2"/>;
  })}
  <path d="M70 225Q225 207 419 229" stroke="#b87983" strokeWidth="11" fill="none"/>
  {cell&&<><path d="M80 153Q215 125 400 160" stroke="#f4d5d0" strokeWidth="14" fill="none"/><N x={212} y={156} r={23}/></>}
 </g>;
 case "bird-keratin":return <g>
  <path d="M53 111Q237 91 427 108" stroke="#d7ba96" strokeWidth={cell?24:16} fill="none"/>
  {Array.from({length:cell?5:13},(_,i)=>{const x=63+i*(cell?73:28);return <g key={i}>
   <path d={"M"+x+" 132q16 -15 29 0l6 124h-35Z"} fill="#e9c4b9" stroke="#b28a85" strokeWidth="2.5"/>
   <N x={x+16} y={216} r={cell?11:8}/>
   {cell&&Array.from({length:5},(_,j)=><path key={j} d={"M"+(x+6+j*5)+" 158v42"} stroke="#ba8d85" strokeWidth="2.6"/>)}
  </g>;})}
  <path d="M59 265H427" stroke="#a27e7b" strokeWidth="9"/>
  {cell&&<path d="M73 167Q220 131 402 161" stroke="#bb938b" strokeWidth="4" fill="none" strokeDasharray="6 8"/>}
 </g>;
 case "bird-cone":case "frog-rod":return <g>
  {Array.from({length:cell?5:16},(_,i)=>{const x=cell?116+i*58:59+i*23;return <g key={i}>
   <path d={"M"+x+" 101l-7 66h26l-7-66Z"} fill={kind==="bird-cone"?"#b3c0a1":"#9aafbf"} stroke="#7997a0" strokeWidth="2.3"/>
   {Array.from({length:7},(_,j)=><path key={j} d={"M"+(x-3)+" "+(112+j*7)+"h13"} stroke="#668ca0" strokeWidth="2.2"/>)}
   {kind==="bird-cone"&&<circle cx={x+6} cy="179" r="9" fill={i%2?"#e1bc70":"#d19c7c"} stroke="#bb9772" strokeWidth="2"/>}
   <rect x={x-5} y={kind==="bird-cone"?189:176} width="22" height={kind==="bird-cone"?51:63} rx="9" fill="#e7c7b7" stroke="#aa9293" strokeWidth="2"/>
   <N x={x+5} y={235} r={7}/><path d={"M"+(x+5)+" 242v22"} stroke="#947d9d" strokeWidth="3"/>
  </g>;})}
  <rect x="45" y="72" width="392" height="20" rx="8" fill="#9c8388"/>
  <path d="M45 281H439" stroke="#ac869f" strokeWidth="10"/>
 </g>;
 case "fish-lamella":return <g>
  <path d="M52 236Q236 264 427 236" stroke="#91b5b8" strokeWidth="24" fill="none"/>
  {Array.from({length:cell?7:13},(_,i)=>{const x=68+i*(cell?54:27);return <g key={i}>
   <path d={"M"+x+" 225Q"+(x-21)+" 158 "+(x+4)+" 93"} stroke="#a4c5bb" strokeWidth={cell?13:9} fill="none" strokeLinecap="round"/>
   <path d={"M"+x+" 225Q"+(x-21)+" 158 "+(x+4)+" 93"} stroke="#e9ede0" strokeWidth={cell?6:3} fill="none"/>
  </g>;})}
  <Vessel x={166} y={252} length={165}/>
  {cell&&<N x={231} y={136} r={22}/>}
 </g>;
 case "fish-neuromast":return <g>
  <path d="M120 170Q168 72 237 64Q329 72 358 168Q245 210 120 170Z" fill="#c4e0df" stroke="#83b3bb" strokeWidth="6" opacity=".79"/>
  {Array.from({length:cell?7:13},(_,i)=>{const x=137+i*(cell?35:17);return <g key={i}>
   <Column x={x} y={182} w={cell?33:16} h={86}/>
   <path d={"M"+(x+8)+" 183q-6 -40 3 -71"} stroke="#739db4" strokeWidth="3" fill="none"/>
   {i%3===0&&<path d={"M"+(x+13)+" 181q12 -63 14 -99"} stroke="#6686aa" strokeWidth="4" fill="none"/>}
  </g>;})}
  <path d="M75 293Q240 303 411 293" stroke="#b893b0" strokeWidth="11" fill="none"/>
 </g>;
 case "fish-myocardium":return <g><MuscleBand cell={cell} cardiac/>
  {cell&&Array.from({length:11},(_,i)=><ellipse key={i} cx={96+(i%6)*48} cy={130+Math.floor(i/6)*89} rx="9" ry="5" fill="#b98573" stroke="#a56d70" strokeWidth="1.5"/>)}</g>;
 case "frog-skin":return <g>
  <path d="M50 108Q242 95 430 108" stroke="#d3c1a5" strokeWidth="19" fill="none"/>
  {Array.from({length:cell?6:13},(_,i)=><Column key={i} x={57+i*(cell?63:29)} y={125} w={cell?56:28} h={115}/>)}
  {!cell&&<g><ellipse cx="169" cy="242" rx="45" ry="37" fill="#dfb2bd" stroke="#b17f8f" strokeWidth="5"/>
   <path d="M171 218Q176 170 183 127" stroke="#ae7c92" strokeWidth="8" fill="none"/></g>}
  <Vessel x={212} y={276} length={187}/>
 </g>;
 case "frog-lung":return <g>
  <path d="M76 204Q79 99 193 93Q302 54 406 132Q455 237 347 268Q202 312 76 204Z" fill="#f6e6da" stroke="#c79593" strokeWidth="11"/>
  {Array.from({length:cell?6:15},(_,i)=>{const angle=i*2*Math.PI/(cell?6:15);const x=237+124*Math.cos(angle),y=182+72*Math.sin(angle);
   return <path key={i} d={"M"+x+" "+y+"Q"+(237+80*Math.cos(angle+.18))+" "+(181+50*Math.sin(angle+.18))+" 241 179"} stroke="#d7a4a2" strokeWidth={cell?13:8} fill="none"/>;})}
  <Vessel x={133} y={268} length={223}/>
  {cell&&<N x={227} y={161} r={24}/>}
 </g>;
 case "bee-trachea":return <g>
  <ellipse cx="238" cy="183" rx="165" ry="104" fill="#e8cfaa" stroke="#ac9a83" strokeWidth="10"/>
  <ellipse cx="238" cy="183" rx="124" ry="75" fill="#fff4da" stroke="#c2a78a" strokeWidth="7"/>
  {Array.from({length:cell?10:23},(_,i)=>{const a=i*2*Math.PI/(cell?10:23),x=238+144*Math.cos(a),y=183+91*Math.sin(a);
   return <path key={i} d={"M"+x+" "+y+"l"+(-17*Math.cos(a))+" "+(-12*Math.sin(a))} stroke="#a68169" strokeWidth={cell?6:8}/>;})}
  {cell&&<N x={236} y={269} r={19}/>}
 </g>;
 case "bee-rhabdom":return <g>
  <path d="M241 77L355 132V237L241 292L125 235V129Z" fill="#d8bd9e" stroke="#ab8d86" strokeWidth="8"/>
  <path d="M241 110L326 148V215L241 256L158 212V145Z" fill="#ecd5b8" stroke="#c2a58c" strokeWidth="4"/>
  <ellipse cx="241" cy="185" rx="35" ry="63" fill="#a187b3" stroke="#846899" strokeWidth="6"/>
  {Array.from({length:cell?35:18},(_,i)=>{const a=i*2*Math.PI/(cell?35:18);
   return <path key={i} d={"M"+(241+36*Math.cos(a))+" "+(184+61*Math.sin(a))+"l"+(-21*Math.cos(a))+" "+(-29*Math.sin(a))} stroke="#765d94" strokeWidth={cell?3.5:5}/>;})}
  {cell&&<N x={176} y={197} r={21}/>}
 </g>;
 case "bee-flight-muscle":return <g><MuscleBand cell={cell}/>
  {Array.from({length:cell?15:9},(_,i)=><ellipse key={i} cx={87+(i%8)*42} cy={cell?193:122+Math.floor(i/8)*80} rx="11" ry="5.5" fill="#ad8066" stroke="#8f6e63" strokeWidth="1.5"/>)}</g>;
 case "snail-foot-muscle":return <g>
  {Array.from({length:cell?3:10},(_,i)=>{const y=cell?124+i*68:100+i*19;return <g key={i}>
   <path d={"M58 "+(y+12)+"Q175 "+(y-19)+" 243 "+y+"Q318 "+(y-20)+" 428 "+(y+13)+"Q310 "+(y+39)+" 243 "+(y+23)+"Q137 "+(y+37)+" 58 "+(y+12)+"Z"}
    fill={i%2?"#dcb0a4":"#cfa099"} stroke="#a97b7b" strokeWidth="2.6"/>
   <N x={244} y={y+11} r={cell?16:9}/>
  </g>;})}
 </g>;
 case "snail-eye":return <g>
  <ellipse cx="238" cy="183" rx="166" ry="111" fill="#e4c7ac" stroke="#a68e82" strokeWidth="9"/>
  <ellipse cx="238" cy="181" rx="127" ry="80" fill="#f8e9ca" stroke="#c3a58f" strokeWidth="6"/>
  <path d="M142 220Q235 149 333 218" fill="none" stroke="#9675a2" strokeWidth="21"/>
  {Array.from({length:cell?28:17},(_,i)=>{const x=155+i*(cell?6:10),y=206-Math.sin(i/(cell?28:17)*Math.PI)*43;
   return <path key={i} d={"M"+x+" "+y+"l-3 -18"} stroke="#846b9c" strokeWidth={cell?3:5}/>;})}
  {cell&&<N x={230} y={246} r={25}/>}
 </g>;
 case "snail-mantle":return <g>
  <path d="M50 95Q242 77 434 98" stroke="#dccab1" strokeWidth="17" fill="none"/>
  {Array.from({length:cell?5:13},(_,i)=><Column key={i} x={55+i*(cell?75:29)} y={119} w={cell?68:28} h={129}/>)}
  <Vessel x={83} y={279} length={316}/>
  {cell&&<path d="M60 133Q211 104 425 132" stroke="#e7ad9c" strokeWidth="6" fill="none"/>}
 </g>;
 default:return null;
 }
}
