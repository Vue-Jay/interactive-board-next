/** A small, offline-first SVG atlas with landmarks tied to biological IDs.
 * Drawings are explanatory school diagrams, NOT diagnostic images or true-scale
 * histology. Every tap target maps to a child of the displayed atlas node.
 */
import type {ReactNode} from "react";
import LektrusBioSpeciesArt from "./LektrusBioSpeciesArt";
import LektrusBioDetailedOrganisms from "./LektrusBioDetailedOrganisms";
import LektrusBioDetailedCoreOrgans from "./LektrusBioDetailedCoreOrgans";
import LektrusBioMammalSystems,{bioMammalSystemKind} from "./LektrusBioMammalSystems";
import LektrusBioMammalOrganSections,{bioMammalOrganKind} from "./LektrusBioMammalOrganSections";
import LektrusBioCoreMicroscopyArt from "./LektrusBioCoreMicroscopyArt";
import {bioCoreMicroscopyPlateFor} from "./lektrusBioCoreMicroscopyPlates";
import LektrusBioNewSpeciesArt from "./LektrusBioNewSpeciesArt";
import LektrusBioFurtherSpeciesArt from "./LektrusBioFurtherSpeciesArt";
import {isBioFurtherOrganism} from "./lektrusBioMicroscopeModel";
import {isBioNewOrganism} from "./lektrusBioNewLineages";
import LektrusBioOrganDetail from "./LektrusBioOrganDetail";
import LektrusBioCellDetail from "./LektrusBioCellDetail";
import {bioCellPlateFor} from "./lektrusBioCellPlates";
import {bioSpecimenPlateFor,bioSpecimenChildSpot} from "./lektrusBioSpecimenPlates";
import type {BioNode,BioOrganism} from "./lektrusBioMicroscopeModel";
import {BIO_ORGANISMS,bioVisualKey,bioChildSpot,bioCellFeatures} from "./lektrusBioMicroscopeModel";

type Props={organism:BioOrganism;node:BioNode;children:BioNode[];onSelect:(node:BioNode)=>void;interactive:boolean;focusChildId?:string;activeFeatureName?:string|null;onFeatureSelect?:(name:string)=>void};
type BioVisualKey=ReturnType<typeof bioVisualKey>;
const ink="#355f52";
function OrganismShape({organism}:{organism:BioOrganism}){
 return <LektrusBioDetailedOrganisms organism={organism}/>;
}
function SpecificOrgan({organism,keyName}:{organism:BioOrganism;keyName:BioVisualKey}){
 return <LektrusBioDetailedCoreOrgans organism={organism} keyName={keyName}/>;
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
 if(keyName==="eye")return <g>
  <rect x="176" y="28" width="128" height="128" rx="23" fill="#a3c5db" stroke="#7097b8" strokeWidth="6"/>
  {Array.from({length:8},(_,i)=><path key={i} d={"M192 "+(41+i*14)+"H287"} stroke="#6f97b7" strokeWidth="6"/>)}
  <rect x="188" y="157" width="106" height="64" rx="29" fill="#e1cab0" stroke="#b5a18c" strokeWidth="5"/>
  <ellipse cx="241" cy="191" rx="21" ry="12" fill="#b69bbc"/>
  <path d="M240 220V280L285 306" stroke="#b5a18c" strokeWidth="15" fill="none" strokeLinecap="round"/>
  <text x="335" y="102" fontSize="13" fill="#537998">Наружный сегмент</text>
 </g>;
 if(keyName==="lungs")return <g>
  <path d="M42 190Q110 110 206 180Q306 244 434 116" stroke="#d8adb0" strokeWidth="31" strokeLinecap="round" fill="none"/>
  <path d="M44 190Q110 110 206 180Q306 244 434 116" stroke="#f9e8e5" strokeWidth="17" strokeLinecap="round" fill="none"/>
  <ellipse cx="210" cy="181" rx="21" ry="11" transform="rotate(33 210 181)" fill="#c8aed1" stroke="#ad83ad" strokeWidth="3"/>
  <path d="M35 253Q186 215 253 283Q345 317 449 245" fill="none" stroke="#c77b8a" strokeWidth="13" strokeLinecap="round"/>
  <text x="231" y="58" fontSize="16" textAnchor="middle" fill="#98747d">Тонкий пневмоцит I типа</text>
 </g>;
 if(keyName==="heart")return <g>
  <path d="M55 116Q165 58 240 148Q299 202 405 111M61 199Q139 145 213 222Q315 279 415 190" stroke="#d59292" strokeWidth="34" strokeLinecap="round" fill="none"/>
  {Array.from({length:12},(_,i)=><path key={i} d={"M"+(76+i*29)+" 89l-10 53m-3 38-10 51"} stroke="#b97580" strokeWidth="5" opacity=".8"/>)}
  <ellipse cx="239" cy="147" rx="24" ry="15" fill="#a281ae" transform="rotate(28 239 147)"/>
  <path d="M152 110l-8 28M337 180l-9 27" stroke="#684d70" strokeWidth="10"/>
 </g>;
 if(keyName==="gut")return <g>
  <path d="M92 286V85Q92 58 115 58H368Q388 58 388 85V286" fill="#f0dfc5" stroke="#bc9f8e" strokeWidth="8"/>
  {Array.from({length:14},(_,i)=>{const x=110+i*20;return <path key={i} d={"M"+x+" 59v-21"} stroke="#c49e84" strokeWidth="7" strokeLinecap="round"/>;})}
  {Array.from({length:5},(_,i)=>{const x=105+i*55;return <g key={i}>
   <path d={"M"+x+" 78v192"} stroke="#b29e8a" strokeWidth="3"/>
   <ellipse cx={x+19} cy="194" rx="11" ry="20" fill="#ad96c2"/>
  </g>;})}
  <text x="244" y="319" textAnchor="middle" fontSize="14" fill="#927668">Микроворсинки на поверхности</text>
 </g>;
 if(keyName==="wood")return <g>
  <rect x="80" y="35" width="320" height="260" rx="55" fill="#d5b687" stroke="#906a46" strokeWidth="16"/>
  <rect x="125" y="60" width="230" height="208" rx="42" fill="#fbf4e2" stroke="#bd9467" strokeWidth="15"/>
  <path d="M88 104L132 104M80 173H122M350 108h45M356 205h38" stroke="#96734f" strokeWidth="11"/>
  <text x="240" y="170" textAnchor="middle" fontSize="16" fill="#8b744e">Полый просвет</text>
  <text x="240" y="196" textAnchor="middle" fontSize="13" fill="#8b744e">зрелого сосуда</text>
 </g>;
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
   // Photosynthetic leaf mesophyll: green chloroplasts. Yellow ray-floret
   // epidermis: chromoplast-like pigment bodies, not green chloroplasts.
   const leaf=keyName==="leaf";
   return <ellipse key={i} cx={x} cy={y} rx="14" ry="9"
    fill={leaf?"#5da161":"#ebba55"} stroke={leaf?"#3d804b":"#c49335"} strokeWidth="2"/>;
  })}
  {keyName==="root"&&<path d="M72 177Q30 166 17 216" stroke="#7ca36c" strokeWidth="12" fill="none" strokeLinecap="round"/>}
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
export default function LektrusBioAnatomyScene({organism,node,children,onSelect,interactive,focusChildId,activeFeatureName,onFeatureSelect}:Props){
 const keyName=bioVisualKey(node);
 const extra=<LektrusBioSpeciesArt organism={organism} node={node}/>;
 const plate=bioSpecimenPlateFor(organism,node);
 const cellPlate=bioCellPlateFor(organism,node);
 const corePlate=bioCoreMicroscopyPlateFor(organism,node);
 const cellDetail=cellPlate?<LektrusBioCellDetail organism={organism} node={node}
  selectedFeature={activeFeatureName} onFeatureSelect={onFeatureSelect}/>:null;
 const detail=plate?<LektrusBioOrganDetail organism={organism} node={node}/>:null;
 const coreDetail=corePlate?<LektrusBioCoreMicroscopyArt plate={corePlate}
  features={bioCellFeatures(node)} selectedFeature={activeFeatureName} onFeatureSelect={onFeatureSelect}/>:null;
 const shape:ReactNode=cellDetail??detail??coreDetail??(isBioFurtherOrganism(organism)
  ?<LektrusBioFurtherSpeciesArt organism={organism} node={node} selectedFeature={activeFeatureName} onFeatureSelect={onFeatureSelect}/>
  :isBioNewOrganism(organism)
  ?<LektrusBioNewSpeciesArt organism={organism} node={node} selectedFeature={activeFeatureName} onFeatureSelect={onFeatureSelect}/>
  :( ["sparrow","perch","frog","bee","snail","pine","fern","wheat"] as string[]).includes(organism)
  ?extra:bioMammalSystemKind(organism,node)?<LektrusBioMammalSystems organism={organism} node={node}/>
  :bioMammalOrganKind(organism,node)?<LektrusBioMammalOrganSections organism={organism} node={node}/>
  :node.level==="organism"||node.level==="system"
  ?<><g opacity={node.level==="system"?.27:1}><OrganismShape organism={organism}/></g>
    {node.level==="system"&&<g transform="translate(148 80) scale(.39)" opacity=".93"><SpecificOrgan organism={organism} keyName={keyName}/></g>}</>
  :node.level==="organ"?<SpecificOrgan organism={organism} keyName={keyName}/>
  :node.level==="tissue"?<TissueScene keyName={keyName}/>
  :<CellScene keyName={keyName}/>);
 return <svg className="lektrus-bio-anatomy-svg" viewBox="0 0 480 330" role="group"
  aria-label={"Анатомическая схема: "+node.name}>
  <rect width="480" height="330" rx="18" fill="#f3f9f0"/>
  <g className="lektrus-bio-alt-plate" key={node.id}>{shape}</g>
  {plate&&<text x="20" y="25" fontSize="12" fontWeight="800" fill={ink} data-bio-plate-title={plate.id}>{plate.title}</text>}
  {focusChildId&&children.map((child,i)=>{
   if(child.id!==focusChildId)return null;
   const pt=bioSpecimenChildSpot(organism,node,child)??bioChildSpot(organism,node,child,i,children.length);
   return <g key={child.id} className="lektrus-bio-focus-marker"
    transform={"translate("+pt.x+" "+pt.y+")"} aria-hidden="true">
    <circle r="35" fill="#eecb72" fillOpacity=".23" stroke="#b17830" strokeWidth="3" strokeDasharray="8 5"/>
    <circle r="11" fill="#fff8e9" stroke="#ae722d" strokeWidth="4"/>
    <circle r="4" fill="#ae722d"/>
   </g>;
  })}
  {interactive&&children.map((child,i)=>{
   const pt=bioSpecimenChildSpot(organism,node,child)??bioChildSpot(organism,node,child,i,children.length);
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
