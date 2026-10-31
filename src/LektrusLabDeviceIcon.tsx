import {useId} from "react";
import type {LabDevice} from "./lektrusChemistryBenchModel";
import {labStandClampSvgY} from "./lektrusLabLayout";

type MountChoice={id:string;label:string};
type DeviceIconProps={
 kind:LabDevice;size?:number;active?:boolean;
 editable?:boolean;controlsVisible?:boolean;temperatureC?:number;temperatureVisible?:boolean;targetTemperatureC?:number;
 standHeight?:number;heatLevel?:number;
 collectedResidue?:{formula:string;color:string;massG?:number};filtering?:boolean;
 choices?:MountChoice[];shelfChoices?:MountChoice[];
 onPowerToggle?:()=>void;onTemperatureChange?:(value:number)=>void;
 onStandHeightChange?:(value:number)=>void;onLevelCycle?:()=>void;
 onAttach?:(id:string,mount:"clamp"|"shelf")=>void;
 onRelease?:()=>void;onReturn?:()=>void;
};
/** The controls are engraved into the equipment's own scalable SVG.
 * There are no absolute-positioned controls floating over the drawing. */
export default function LektrusLabDeviceIcon({
 kind,size=42,active=false,temperatureC,temperatureVisible=true,targetTemperatureC=150,
 standHeight=.5,collectedResidue,filtering=false
}:DeviceIconProps){
 const uid=useId().replace(/:/g,"");
 const metal=uid+"-metal",glass=uid+"-glass",plastic=uid+"-case";
 const clampY=labStandClampSvgY(standHeight);
 return <svg className={"lektrus-lab-device-icon is-"+kind+(active?" is-active":"")}
  viewBox="0 0 110 108" width={size} height={size} aria-hidden="true"
  fill="none" strokeLinecap="round" strokeLinejoin="round"
  preserveAspectRatio={kind==="tripod"?"none":"xMidYMid meet"}>
  <defs>
   <linearGradient id={metal} x1="0" y1="0" x2="1" y2=".3">
    <stop stopColor="#dcebea"/><stop offset=".32" stopColor="#789e9c"/>
    <stop offset=".65" stopColor="#cde4e0"/><stop offset="1" stopColor="#4e7e7b"/>
   </linearGradient>
   <linearGradient id={glass} x1="0" y1="0" x2="1" y2=".9">
    <stop stopColor="#ffffff" stopOpacity=".92"/>
    <stop offset=".38" stopColor="#dbf6ef" stopOpacity=".46"/>
    <stop offset="1" stopColor="#76b9ac" stopOpacity=".65"/>
   </linearGradient>
   <linearGradient id={plastic} x1=".1" y1="0" x2=".9" y2="1">
    <stop stopColor="#eff9f2"/><stop offset=".48" stopColor="#b8d0c4"/>
    <stop offset="1" stopColor="#719d8b"/>
   </linearGradient>
  </defs>
  <ellipse cx="55" cy="101" rx="43" ry="5" fill="#1d5a49" opacity=".15"/>
  {kind==="hotplate"&&<>
   <path d="M13 45H97L102 77Q103 87 93 88H18Q8 87 9 77Z"
    fill={"url(#"+plastic+")"} stroke="#456f63" strokeWidth="2.8"/>
   <path d="M17 45L28 21H84L96 45Z" fill="#aec7b9" stroke="#456f63" strokeWidth="2.5"/>
   <path d="M27 23H84L94 42H19Z" fill="#5a7770" stroke="#385d55" strokeWidth="1.5"/>
   <ellipse cx="56" cy="34" rx="31" ry="10.5" fill="#3f5a53" stroke="#b4d2c5" strokeWidth="2.6"/>
   <ellipse cx="56" cy="34" rx="24" ry="7" fill={active?"#d58b65":"#9bafa7"}
    stroke={active?"#f4b37d":"#b9d0c4"} strokeWidth="2"/>
   <path d="M37 34c11-8 26-8 38 0c-11 8-27 8-38 0Z"
    stroke={active?"#f5cf97":"#627f76"} strokeWidth="2.3"/>
   <rect x="24" y="57" width="40" height="19" rx="3" fill="#214f44" stroke="#537c6e" strokeWidth="1.8"/>
   <text x="43" y="71" textAnchor="middle" fontSize="10" fontWeight="800"
    fill="#c7efbb">{Math.round(targetTemperatureC)}°</text>
   <circle cx="83" cy="68" r="9" fill={"url(#"+metal+")"} stroke="#3f6c60" strokeWidth="2"/>
   <path d="M83 60V64" stroke="#2a6358" strokeWidth="2.6"/>
   <circle cx="19" cy="82" r="2.2" fill={active?"#d8e874":"#8faca0"}/>
   {temperatureVisible&&<text x="43" y="84" fill="#2b6a5a" fontSize="7.5" fontWeight="800"
    textAnchor="middle">≈{Math.round(temperatureC??22)}°C</text>}
  </>}
  {kind==="cooler"&&<>
   {/* Insulated cooling basin with real ice crystals and a small target display. */}
   <path d="M14 42H96L92 81Q90 91 78 91H30Q18 91 17 81Z"
    fill={"url(#"+plastic+")"} stroke="#487d8c" strokeWidth="2.7"/>
   <path d="M16 42Q55 52 94 42L88 70Q55 83 22 70Z"
    fill="#8fc5d5" stroke="#397e94" strokeWidth="2"/>
   <ellipse cx="55" cy="42" rx="40" ry="12" fill="#c6edf1"
    stroke="#649aa7" strokeWidth="2.4"/>
   <ellipse cx="55" cy="41" rx="32" ry="8" fill={active?"#9bd8ec":"#c0e4e7"}
    stroke="#f4ffff" strokeWidth="1.4"/>
   {Array.from({length:5},(_,i)=><g key={i}
    transform={`translate(${29+(i*13)%50} ${38+(i%2)*7}) rotate(${i*26})`}>
    <path d="M0 -6L5 0L0 6L-5 0Z" fill="#f3feff"
     stroke="#74aab7" strokeWidth="1.1"/>
    <path d="M-4 0H4M0 -4V4" stroke="#acdce5" strokeWidth=".9"/>
   </g>)}
   {/* The broad display and separate knob have independent hit areas.
        The editable value input owns the display on the tabletop; the
        shelf thumbnail keeps an engraved value instead. */}
   <rect x="19" y="64" width="55" height="22" rx="5"
    fill="#d1e9ee" stroke="#558a99" strokeWidth="1.2"/>
   <rect x="26" y="68" width="42" height="14" rx="3"
    fill="#255568" stroke="#70a2ad" strokeWidth="1"/>
   {size<100&&<text x="47" y="78" textAnchor="middle"
    fontSize="10" fontWeight="800" fill="#d8faff">
    {Math.round(targetTemperatureC)}°</text>}
   <circle cx="87" cy="76" r="8" fill={"url(#"+metal+")"}
    stroke="#477a8b" strokeWidth="1.7"/>
   <path d="M87 70V74" stroke="#376d7d" strokeWidth="2.2"/>
   {active&&<g stroke="#d1f6fc" strokeWidth="1.8" strokeLinecap="round">
    <path d="M21 27l-4 -5M34 20v-6M77 20v-6M90 27l4 -5"/>
   </g>}
   {temperatureVisible&&<text x="53" y="100" textAnchor="middle"
    fontSize="8" fontWeight="750" fill="#316c80">
    ≈{Math.round(temperatureC??22)}°C</text>}
  </>}
  {kind==="burner"&&<>
   <path d="M36 88H74L89 96H21Z" fill={"url(#"+metal+")"} stroke="#406d69" strokeWidth="2.7"/>
   <rect x="46" y="37" width="19" height="50" rx="3" fill={"url(#"+metal+")"}
    stroke="#3f6c67" strokeWidth="2.6"/>
   <path d="M47 42H64M47 48H64" stroke="#e1f2e9" strokeWidth="1.7"/>
   <rect x="42" y="63" width="27" height="13" rx="3" fill="#6e9c92" stroke="#3f6660" strokeWidth="2.4"/>
   <circle cx="55" cy="69" r="3" fill="#d8e8df"/>
   <path d="M65 80H84Q92 80 94 88" stroke="#527d78" strokeWidth="5"/>
   <path d="M83 80l6 2" stroke="#c2d7cc" strokeWidth="2"/>
   {/* Gas tap at the hose connection. The actual clickable lever is a
       small native button placed over this marking. */}
   <circle cx="84" cy="79" r="5" fill="#b7d4c9" stroke="#446b64" strokeWidth="1.5"/>
   <rect x="43" y="31" width="26" height="9" rx="3" fill="#91b8a9" stroke="#427467" strokeWidth="2"/>
   {active&&<g className="lektrus-lab-device-flame">
    <path d="M49 31Q32 13 52 1Q54 12 59 15Q67 8 63 3Q84 25 66 33Z"
     fill="#e99747" stroke="#bd6b38" strokeWidth="2"/>
    <path d="M52 30Q47 20 58 9Q55 19 64 22Q64 29 59 32Z"
     fill="#77cbe1" stroke="#b4f4ef" strokeWidth="1.6"/>
   </g>}
  </>}
  {kind==="stirrer"&&<>
   <path d="M14 48H96V82Q96 92 86 92H24Q14 92 14 82Z"
    fill={"url(#"+plastic+")"} stroke="#476f65" strokeWidth="2.8"/>
   <rect x="20" y="27" width="70" height="25" rx="7" fill="#4b807a" stroke="#426b64" strokeWidth="2.8"/>
   <ellipse cx="55" cy="36" rx="28" ry="9.5" fill="#c5e2d9" stroke="#316f64" strokeWidth="2.4"/>
   <ellipse cx="55" cy="36" rx="19" ry="6" fill="#8ab7ac" stroke="#5d9088" strokeWidth="1.4"/>
   <rect x="46" y="33.5" width="18" height="4" rx="2" fill="#f5fbf7" stroke="#3c8074" strokeWidth="1"/>
   {active&&<ellipse className="lektrus-lab-stir-ring" cx="55" cy="36" rx="24" ry="8"
    stroke="#d3fff1" strokeWidth="2" strokeDasharray="5 6"/>}
   <rect x="25" y="64" width="30" height="15" rx="3" fill="#254c46" stroke="#779f8d" strokeWidth="1.5"/>
   <text x="40" y="74" textAnchor="middle" fontSize="10"
    fontWeight="700" fontFamily="monospace" fill={active?"#b5ffe3":"#91b1a8"}>
    {active?"RUN":"STOP"}</text>
   <circle cx="78" cy="71" r="9" fill={"url(#"+metal+")"} stroke="#49776b" strokeWidth="2"/>
   <path d="M78 64V68" stroke="#295d54" strokeWidth="2.5"/>
  </>}
  {kind==="filter"&&<>
   {/* Open membrane cup on a sturdy base. No separate funnel or popup. */}
   <ellipse cx="55" cy="97" rx="40" ry="5" fill="#183d34" opacity=".16"/>
   <path d="M26 92H84L90 99H20Z" fill={"url(#"+metal+")"}
    stroke="#46746a" strokeWidth="2.5"/>
   <path d="M39 91V65M72 91V65" stroke="#70978c" strokeWidth="4.5"/>
   <path d="M26 27V53Q26 64 38 64H73Q84 64 84 53V27"
    fill={"url(#"+glass+")"} stroke="#47887b" strokeWidth="3"/>
   <path d="M29 44Q55 50 81 44" fill="none"
    stroke="#a7d9c7" strokeWidth="7" strokeLinecap="round"/>
   <ellipse cx="55" cy="45" rx="26" ry="6" fill="#d8eadd"
    stroke="#5c9a81" strokeWidth="2.3"/>
   {Array.from({length:9},(_,i)=><path key={i}
    d={`M${34+i*5} 43l-3 5`} stroke="#78ac8f" strokeWidth="1.2"/>)}
   {collectedResidue&&<>
    <ellipse cx="55" cy="43" rx="23" ry="5"
     fill={collectedResidue.color} stroke="#72887e" strokeWidth="1.2"/>
    {Array.from({length:8},(_,i)=><circle key={i}
     cx={36+i*5} cy={42+(i%2)*2} r={1.3+(i%3)*.25}
     fill={collectedResidue.color} stroke="#677e76" strokeWidth=".4"/>)}
   </>}
   <ellipse cx="55" cy="27" rx="34" ry="9.5"
    fill="#e5f7f0" fillOpacity=".68" stroke="#578b7f" strokeWidth="3"/>
   <ellipse cx="55" cy="27" rx="29" ry="6.5"
    fill="#c4e0d5" fillOpacity=".42" stroke="#9abbb0" strokeWidth="1"/>
   <path d="M42 64V68H68V64" stroke="#66988a" strokeWidth="2.2"/>
   <path d="M55 69V81" stroke="#78b9b9" strokeWidth="2.8" strokeLinecap="round"/>
   {filtering&&[0,1,2].map(i=><path key={i}
    className="lektrus-lab-filter-drain-drop"
    d="M55 75C52 79 51 82 55 85C59 82 58 79 55 75Z"
    fill="#9edce9" stroke="#4aabb2" strokeWidth=".7"
    style={{animationDelay:i*.35+"s"}}/>)}
  </>}
  {kind==="tripod"&&<>
   {/* Taller metal rod: one sliding clamp from y=12 to y=64. */}
   <ellipse cx="50" cy="100" rx="45" ry="5" fill="#1e5249" opacity=".19"/>
   <path d="M3 96H106L109 103H1Z" fill={"url(#"+metal+")"}
    stroke="#466e66" strokeWidth="2.7"/>
   <path d="M22 96V3" stroke="#345d56" strokeWidth="6.5" strokeLinecap="round"/>
   <path d="M23 95V4" stroke="#d6eee3" strokeWidth="2.2" strokeLinecap="round"/>
   <path d="M16 7H29" stroke="#94bdb0" strokeWidth="3.2" strokeLinecap="round"/>
   <g transform={`translate(0 ${clampY-40})`}>
    <rect x="16" y="35" width="12" height="11" rx="2.4"
     fill={"url(#"+metal+")"} stroke="#37645d" strokeWidth="1.8"/>
    <path d="M27 40H76" stroke="#537d78" strokeWidth="3.1" strokeLinecap="round"/>
    <path d="M27 38.7H75" stroke="#c8e5d8" strokeWidth="1.2" strokeLinecap="round"/>
    <circle cx="21" cy="40.5" r="2" fill="#315f55" stroke="#d9ece2" strokeWidth=".8"/>
   </g>
  </>}
  {kind==="thermometer"&&<>
   <path d="M46 16Q46 6 55 6Q64 6 64 16V65A20 20 0 1 1 46 65Z"
    fill={"url(#"+glass+")"} stroke="#53867e" strokeWidth="3"/>
   <path d="M55 32V77" stroke="#d96b67" strokeWidth="5"/>
   <circle cx="55" cy="80" r="12" fill="#d96b67" stroke="#b35d57" strokeWidth="2"/>
  </>}
 </svg>;
}
