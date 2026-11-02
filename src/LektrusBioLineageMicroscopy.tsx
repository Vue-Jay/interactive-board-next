/** Detailed school histology for the other 8 phylogenetic lineages.
 * 24 different anatomical branches, each rendered at tissue and cell depth.
 * No photomicrograph or physically calibrated magnification is implied.
 */
import type {ReactNode} from "react";
import type {BioNewOrganism,BioFurtherOrganism} from "./lektrusBioMicroscopeModel";
type Species=BioNewOrganism|BioFurtherOrganism;
type Depth="tissue"|"cell";
type Props={organism:Species;branch:number;level:Depth;name:string};
const ink="#385b54";
function N({x=241,y=179,r=15}:{x?:number;y?:number;r?:number}){
 return <g><ellipse cx={x} cy={y} rx={r} ry={r*.77} fill="#bb9fc9" stroke="#8974a1" strokeWidth="2.5"/>
 <circle cx={x-3} cy={y} r="3" fill="#8669a1"/></g>;
}
function Green({x,y}:{x:number;y:number}){
 return <g><ellipse cx={x} cy={y} rx="12" ry="6" fill="#6ba66c" stroke="#408352" strokeWidth="1.5"/>
 <path d={"M"+(x-7)+" "+y+"h14"} stroke="#3e7f4d" strokeWidth="1.5"/></g>;
}
function Basal({plant=false}:{plant?:boolean}){return <path d="M35 275Q240 281 447 275" fill="none" stroke={plant?"#689567":"#b68e87"} strokeWidth="8"/>;}
function Header({name,caption}:{name:string;caption:string}){
 return <g pointerEvents="none"><rect x="12" y="8" width="456" height="49" rx="9" fill="#fafff8" fillOpacity=".96" stroke="#d5deda"/>
 <text x="23" y="28" fontSize="13" fontWeight="800" fill={ink}>{name.length>48?name.slice(0,46)+"…":name}</text>
 <text x="23" y="46" fontSize="10.5" fill="#627b70">{caption}</text></g>;
}
function ColumnCells({cell=false,cilia=false,brush=false}:{cell?:boolean;cilia?:boolean;brush?:boolean}){
 const count=cell?4:12,w=cell?83:30,start=cell?75:51;
 return <g><path d="M40 92H440" stroke="#e5d9c8" strokeWidth="8"/>
  {Array.from({length:count},(_,i)=>{const x=start+i*(w+2);
   return <g key={i}><rect x={x} y="111" width={w} height="149" rx="11" fill="#f2d7c5" stroke="#b5958c" strokeWidth="2.7"/>
    <N x={x+w*.5} y={213} r={cell?17:8}/>
    {Array.from({length:cilia?6:brush?9:0},(_,j)=><path key={j}
     d={"M"+(x+4+j*(w-8)/(cilia?5:8))+" 112q"+(cilia?9:0)+" -16 0 -27"} stroke={cilia?"#7faeb3":"#bda092"} strokeWidth={cilia?2.4:2.1} fill="none"/>)}
   </g>;})}
  <Basal/></g>;
}
function Secretory({cell=false,granules=true}:{cell?:boolean;granules?:boolean}){
 return <g><path d="M76 106Q238 62 405 103L405 277Q234 296 76 273Z" fill="#e5c5af" stroke="#af8d82" strokeWidth="7"/>
  <path d="M78 107Q234 75 403 104" stroke="#fff0d7" strokeWidth="18" fill="none"/>
  {Array.from({length:granules?(cell?38:19):0},(_,i)=>{const x=112+(i%8)*32,y=138+Math.floor(i/8)*27;
   return <circle key={i} cx={x} cy={y} r={cell?7:10} fill="#c5a078" stroke="#9e826e" strokeWidth="1.5"/>;})}
  {cell?<N x={241} y={240} r={30}/>:Array.from({length:6},(_,i)=><N key={i} x={124+i*46} y={239} r={9}/>)}
 </g>;
}
function Muscle({cell=false}:{cell?:boolean}){
 return <g>{Array.from({length:cell?1:5},(_,i)=>{
  const y=cell?108:84+i*41,h=cell?157:35;
  return <g key={i}><rect x="40" y={y} width="399" height={h} rx="15" fill="#df9c9e" stroke="#b77880" strokeWidth="3"/>
   {Array.from({length:27},(_,j)=><path key={j} d={"M"+(50+j*14)+" "+(y+5)+"v"+(h-10)} stroke={j%2?"#f4c8bc":"#ac717d"} strokeWidth="5" opacity=".8"/>)}
   {Array.from({length:cell?4:2},(_,j)=><N key={j} x={85+j*(cell?101:245)} y={y+h-7} r={cell?12:7}/>)}
  </g>;})}</g>;
}
function Plant({cell=false,spores=false,stoma=false}:{cell?:boolean;spores?:boolean;stoma?:boolean}){
 if(stoma)return <g><rect x="45" y="74" width="390" height="214" rx="20" fill="#dceaca" stroke="#7ba16b" strokeWidth="5"/>
  {Array.from({length:14},(_,i)=><path key={i} d={"M"+(61+i*27)+" 83v195"} stroke="#b4d39a" strokeWidth="3"/>)}
  <path d="M213 96Q134 130 177 251Q214 277 225 220Q210 163 232 111Z" fill="#90b77e" stroke="#598d60" strokeWidth="6"/>
  <path d="M269 96Q347 130 305 251Q270 276 255 219Q273 158 249 111Z" fill="#90b77e" stroke="#598d60" strokeWidth="6"/>
  <ellipse cx="240" cy="176" rx="12" ry="60" fill="#fcfcef" stroke="#5b9067" strokeWidth="4"/>
  {cell&&<N x={180} y={203} r={13}/>}
  </g>;
 if(spores)return <g><ellipse cx="241" cy="180" rx={cell?117:162} ry={cell?106:110} fill="#e4cca0" stroke="#ae946b" strokeWidth="9"/>
  {Array.from({length:cell?1:17},(_,i)=>{const x=cell?242:111+(i%6)*51,y=cell?181:111+Math.floor(i/6)*65;
   return <g key={i}><circle cx={x} cy={y} r={cell?71:21} fill="#f1dfbd" stroke="#b49c79" strokeWidth="4"/><N x={x} y={y} r={cell?29:8}/></g>;})}
  <text x="239" y="316" textAnchor="middle" fontSize="11.5" fill="#8b704f">Спороцит 2n · гаплоидные споры после мейоза</text></g>;
 return <g>{Array.from({length:cell?1:6},(_,i)=>{const x=cell?110:58+i*68,w=cell?261:65;
  return <g key={i}><rect x={x} y="83" width={w} height="197" rx="15" fill="#d8ebc0" stroke="#729868" strokeWidth="5"/>
   <rect x={x+12} y="105" width={w-24} height="143" rx="17" fill="#c4dede" stroke="#a8c7bc" strokeWidth="2"/>
   {Array.from({length:cell?24:7},(_,j)=>{const cx=x+10+(j%2)*(w-20),cy=114+Math.floor(j/2)*(cell?11:28);
    return <Green key={j} x={cx} y={cy}/>;})}
   <N x={x+w*.5} y={259} r={cell?17:9}/>
  </g>;})}</g>;
}
function CrossSection({cell=false,kind}:{cell?:boolean;kind:"gill"|"lung"|"tube"|"epidermis"|"podia"|"ossicles"|"retina"|"rhabo"}){
 if(kind==="retina")return <g><rect x="52" y="77" width="376" height="208" rx="16" fill="#efe1cb" stroke="#a99d97" strokeWidth="5"/>
  <rect x="54" y="80" width="372" height="26" fill="#9e8685"/>
  {Array.from({length:cell?8:20},(_,i)=>{const x=cell?123+i*30:64+i*17;return <g key={i}><rect x={x} y="115" width={cell?19:11} height="75" rx="5" fill="#92b1ad"/>
   <N x={x+8} y={204} r={cell?8:6}/><path d={"M"+(x+8)+" 207v45"} stroke="#947a9b" strokeWidth="3"/></g>;})}
  <path d="M58 255H426" stroke="#be9ea9" strokeWidth="7"/></g>;
 if(kind==="rhabo")return <g><ellipse cx="241" cy="182" rx="155" ry="103" fill="#e2c9b1" stroke="#b19b89" strokeWidth="7"/>
  <ellipse cx="241" cy="181" rx="96" ry="72" fill="#c0c4a8" stroke="#939d8d" strokeWidth="5"/>
  {Array.from({length:26},(_,i)=>{const a=i*2*Math.PI/26;return <path key={i} d={"M"+(241+36*Math.cos(a))+" "+(180+27*Math.sin(a))+"l"+(48*Math.cos(a))+" "+(37*Math.sin(a))} stroke="#896f97" strokeWidth="5"/>;})}
  {cell&&<N x={241} y={198} r={24}/>}</g>;
 if(kind==="ossicles")return <g><path d="M31 95H447M31 266H447" stroke="#b8a89b" strokeWidth="13"/>
  {Array.from({length:13},(_,i)=>{const x=56+i*29;return <path key={i} d={"M"+x+" 104q-22 48 6 88t2 66"} stroke={i%2?"#d4bea8":"#9faaa0"} strokeWidth="6" fill="none"/>;})}
  {Array.from({length:cell?3:7},(_,i)=>{const x=110+i*50;return <polygon key={i} points={x+",165 "+(x+28)+",147 "+(x+41)+",181 "+(x+12)+",201"} fill="#f0d6b6" stroke="#ab8e75" strokeWidth="2"/>;})}
  {cell&&<N x={237} y={205} r={24}/>}</g>;
 if(kind==="gill"||kind==="lung"||kind==="podia")return <g><ellipse cx="240" cy="186" rx="169" ry="105" fill={kind==="lung"?"#ead0c5":"#d1ded1"} stroke="#9caaa1" strokeWidth="8"/>
  <ellipse cx="240" cy="184" rx={kind==="podia"?93:125} ry={kind==="podia"?72:79} fill="#fcf5dc" stroke="#b6b4a2" strokeWidth="5"/>
  {Array.from({length:kind==="lung"?12:kind==="gill"?22:10},(_,i)=>{const a=i*2*Math.PI/(kind==="lung"?12:kind==="gill"?22:10);
   const x=240+124*Math.cos(a),y=185+76*Math.sin(a);
   return <path key={i} d={"M"+x+" "+y+"l"+(-44*Math.cos(a))+" "+(-35*Math.sin(a))} stroke={kind==="gill"?"#8eb9b5":"#c6a59d"} strokeWidth={cell?5:9} fill="none"/>;})}
  {cell&&<N x={252} y={187} r={23}/>}
  <path d="M77 270Q242 292 402 264" stroke="#bb878c" strokeWidth="11" fill="none"/></g>;
 return <g><ellipse cx="238" cy="182" rx="165" ry="106" fill="#d9bea6" stroke="#ad9486" strokeWidth="8"/>
  <ellipse cx="238" cy="183" rx="116" ry="68" fill="#fff5df" stroke="#c8ab9b" strokeWidth="7"/>
  {Array.from({length:cell?12:23},(_,i)=>{const a=i*2*Math.PI/(cell?12:23);return <ellipse key={i}
   cx={238+139*Math.cos(a)} cy={182+91*Math.sin(a)} rx={11} ry={9} fill="#e3bbac" stroke="#b18f83" strokeWidth="2"/>;})}
  {cell&&<N x={252} y={212} r={25}/>}</g>;
}
const theme:Record<Species,readonly [string,string,string]>={
 earthworm:["cuticle","nephrostome","typhlosole"],
 seastar:["podia","pyloric","ossicles"],
 crayfish:["gill","green-gland","muscle"],
 horsetail:["chlorenchyma","stoma","spores"],
 lizard:["keratin","foveola","cone"],
 spider:["book-lung","silk-gland","rhabdomere"],
 clubmoss:["microphyll","sporangium","rhizodermis"],
 magnolia:["mesophyll","tapetum","stigma"]
};
const caption:Record<Species,readonly [string,string,string]>={
 earthworm:["Кутикула · секреторный эпидермис","Ресничная нефростома · базальные тельца","Тифлозоль · кишечная всасывающая поверхность"],
 seastar:["Ножка · водно-сосудистая система","Железистые клетки пилорического выроста","Коллагеновый матрикс · скелетные оссикулы"],
 crayfish:["Жаберная кутикула · эпителий · гемолимфа","Антеннальная железа · апикальный просвет","Поперечная исчерченность · сократительные нити"],
 horsetail:["Хлоренхима зелёного побега","Устьичный аппарат в борозде стебля","Спороцит 2n → мейоз → споры n"],
 lizard:["Ороговение покрова · живой базальный слой","Ячеистые лёгкие, НЕ человеческие альвеолы","Пигментный слой · колбочки · нейроны"],
 spider:["Ламеллы с гемолимфой · воздушные щели","Секреторные клетки ампуловидной железы","Микроворсинки рабдомера в простом глазе"],
 clubmoss:["Микрофилл · одна жилка · хлоропласты","Спорофилл · спорангий · мейоз","Ризодерма молодого корня"],
 magnolia:["Мезофилл вечнозелёного листа","Тапетум · питание развивающейся пыльцы","Папиллы рыльца · взаимодействие с пыльцой"]
};
function Artwork({kind,cell}:{kind:string;cell:boolean}):ReactNode{
 switch(kind){
 case "cuticle":return <g><ColumnCells cell={cell}/><path d="M46 101H439" stroke="#d6be97" strokeWidth="11"/>
  {cell&&Array.from({length:11},(_,i)=><circle key={i} cx={130+(i%5)*31} cy={130+Math.floor(i/5)*17} r="5" fill="#b89c81"/>)} </g>;
 case "nephrostome":return <ColumnCells cell={cell} cilia/>;
 case "typhlosole":return <g><ColumnCells cell={cell} brush/>{!cell&&<path d="M180 94Q218 252 247 278Q265 167 296 94" stroke="#d8afa2" strokeWidth="22" fill="none"/>}</g>;
 case "podia":return <CrossSection cell={cell} kind="podia"/>;
 case "pyloric":return <Secretory cell={cell}/>;
 case "ossicles":return <CrossSection cell={cell} kind="ossicles"/>;
 case "gill":return <CrossSection cell={cell} kind="gill"/>;
 case "green-gland":return <g><CrossSection cell={cell} kind="tube"/>{cell&&Array.from({length:12},(_,i)=><path key={i} d={"M"+(137+i*17)+" 251v-23"} stroke="#bd9586" strokeWidth="3"/>)}</g>;
 case "muscle":return <Muscle cell={cell}/>;
 case "chlorenchyma":return <Plant cell={cell}/>;
 case "stoma":return <Plant cell={cell} stoma/>;
 case "spores":return <Plant cell={cell} spores/>;
 case "keratin":return <g><ColumnCells cell={cell}/><path d="M35 92H444" stroke="#c9ab8a" strokeWidth="29" strokeDasharray="9 3"/>{cell&&<path d="M150 146q50 65 96 10t77 57" stroke="#ae8588" strokeWidth="6" fill="none"/>}</g>;
 case "foveola":return <CrossSection cell={cell} kind="lung"/>;
 case "cone":return <CrossSection cell={cell} kind="retina"/>;
 case "book-lung":return <g>{Array.from({length:cell?9:16},(_,i)=>{const y=80+i*(cell?22:13);return <g key={i}>
  <path d={"M76 "+y+"Q240 "+(y-15)+" 404 "+y} stroke="#e8d9c5" strokeWidth={cell?10:7} fill="none"/>
  <path d={"M76 "+(y+7)+"Q240 "+(y+19)+" 404 "+(y+7)} stroke="#ab8184" strokeWidth={cell?7:5} fill="none"/>
  </g>;})}{cell&&<N x={238} y={175} r={22}/>}</g>;
 case "silk-gland":return <Secretory cell={cell}/>;
 case "rhabdomere":return <CrossSection cell={cell} kind="rhabo"/>;
 case "microphyll":return <Plant cell={cell}/>;
 case "sporangium":return <Plant cell={cell} spores/>;
 case "rhizodermis":return <g><Plant cell={cell}/>{cell&&<path d="M366 145Q418 155 431 205" stroke="#77a46e" strokeWidth="11" fill="none"/>}</g>;
 case "mesophyll":return <Plant cell={cell}/>;
 case "tapetum":return <g><Secretory cell={cell}/>{!cell&&Array.from({length:9},(_,i)=><circle key={i} cx={102+i*33} cy="101" r="13" fill="#ddbd82" stroke="#b79d6f" strokeWidth="2"/>)}</g>;
 case "stigma":return <g><ColumnCells cell={cell}/>{Array.from({length:9},(_,i)=><ellipse key={i} cx={83+i*39} cy={91-i%3*7} rx="12" ry="8" fill="#e2c997" stroke="#bd9e79" strokeWidth="2"/>)}</g>;
 default:return null;
 }
}
export const LINEAGE_MICRO_SPECIES:readonly Species[]=["earthworm","seastar","crayfish","horsetail","lizard","spider","clubmoss","magnolia"];
export function lineageMicroKind(organism:Species,branch:number):string|null{
 return branch>=0&&branch<3?theme[organism][branch]:null;
}
/** The three cell annotations belong to real anatomical structures and
 * should land ON their illustration, not at identical positions for every taxon.
 * Coordinates are stage pixels, never physical micrometres.
 */
type Mark={x:number;y:number};
type Three=readonly [Mark,Mark,Mark];
const featureSpots:Record<Species,readonly [Three,Three,Three]>={
 earthworm:[
  [{x:195,y:141},{x:259,y:115},{x:242,y:222}],
  [{x:177,y:94},{x:253,y:125},{x:258,y:214}],
  [{x:180,y:95},{x:304,y:127},{x:221,y:216}]
 ],
 seastar:[
  [{x:235,y:124},{x:327,y:189},{x:253,y:206}],
  [{x:200,y:157},{x:266,y:117},{x:238,y:231}],
  [{x:154,y:167},{x:328,y:174},{x:240,y:203}]
 ],
 crayfish:[
  [{x:224,y:105},{x:277,y:142},{x:237,y:209}],
  [{x:217,y:125},{x:327,y:243},{x:241,y:208}],
  [{x:161,y:162},{x:279,y:179},{x:355,y:237}]
 ],
 horsetail:[
  [{x:180,y:144},{x:265,y:103},{x:241,y:260}],
  [{x:191,y:169},{x:239,y:177},{x:284,y:142}],
  [{x:241,y:180},{x:284,y:213},{x:173,y:132}]
 ],
 lizard:[
  [{x:169,y:156},{x:311,y:158},{x:238,y:207}],
  [{x:206,y:141},{x:318,y:208},{x:240,y:181}],
  [{x:198,y:129},{x:262,y:184},{x:241,y:248}]
 ],
 spider:[
  [{x:173,y:126},{x:298,y:202},{x:244,y:182}],
  [{x:183,y:158},{x:282,y:114},{x:242,y:233}],
  [{x:242,y:182},{x:297,y:153},{x:324,y:236}]
 ],
 clubmoss:[
  [{x:166,y:132},{x:242,y:97},{x:247,y:220}],
  [{x:239,y:177},{x:294,y:223},{x:172,y:131}],
  [{x:156,y:111},{x:237,y:191},{x:276,y:219}]
 ],
 magnolia:[
  [{x:168,y:124},{x:266,y:95},{x:253,y:221}],
  [{x:145,y:184},{x:302,y:121},{x:242,y:225}],
  [{x:182,y:108},{x:301,y:92},{x:243,y:221}]
 ]
};
export function lineageMicroSpots(organism:Species,branch:number):Three{
 return featureSpots[organism][branch]??[{x:190,y:157},{x:290,y:195},{x:244,y:251}];
}

export default function LektrusBioLineageMicroscopy({organism,branch,level,name}:Props):ReactNode{
 const kind=lineageMicroKind(organism,branch);
 if(!kind)return null;
 const plant=["horsetail","clubmoss","magnolia"].includes(organism),cell=level==="cell";
 return <g data-bio-lineage-micro={kind} data-bio-lineage-species={organism} data-bio-lineage-level={level}>
  <rect width="480" height="330" fill={plant?"#f0f6e7":"#f9f2ea"}/>
  <Artwork kind={kind} cell={cell}/>
  <Header name={name} caption={caption[organism][branch]}/>
 </g>;
}
