import {useId,useEffect,useState} from "react";
import type {LabDevice} from "./lektrusChemistryBenchModel";

type MountChoice={id:string;label:string};
type DeviceIconProps={
 kind:LabDevice;size?:number;active?:boolean;
 editable?:boolean;temperatureC?:number;targetTemperatureC?:number;
 standHeight?:number;heatLevel?:number;
 choices?:MountChoice[];shelfChoices?:MountChoice[];
 onPowerToggle?:()=>void;onTemperatureChange?:(value:number)=>void;
 onStandHeightChange?:(value:number)=>void;onLevelCycle?:()=>void;
 onAttach?:(id:string,mount:"clamp"|"shelf")=>void;
 onRelease?:()=>void;onReturn?:()=>void;
};
/** The controls are engraved into the equipment's own scalable SVG.
 * There are no absolute-positioned controls floating over the drawing. */
export default function LektrusLabDeviceIcon({
 kind,size=42,active=false,editable=false,temperatureC,targetTemperatureC=150,
 standHeight=.5,heatLevel=2,choices=[],shelfChoices=[],
 onPowerToggle,onTemperatureChange,onStandHeightChange,onLevelCycle,
 onAttach,onRelease,onReturn
}:DeviceIconProps){
 const uid=useId().replace(/:/g,"");
 const [temperatureDraft,setTemperatureDraft]=useState(String(targetTemperatureC));
 useEffect(()=>setTemperatureDraft(String(targetTemperatureC)),[targetTemperatureC]);
 const commitTemperature=()=>{
  const value=Number(temperatureDraft);
  if(Number.isFinite(value)&&value>=30&&value<=350)onTemperatureChange?.(value);
  else setTemperatureDraft(String(targetTemperatureC));
 };
 const metal=uid+"-metal",glass=uid+"-glass",plastic=uid+"-case";
 const clampShift=40-(52-29*standHeight);
 const activeControl=(handler?:()=>void)=>({
  onPointerDown:(e:import("react").PointerEvent<SVGGElement>)=>e.stopPropagation(),
  onClick:(e:import("react").MouseEvent<SVGGElement>)=>{e.stopPropagation();handler?.()},
  onKeyDown:(e:import("react").KeyboardEvent<SVGGElement>)=>{
   if(e.key==="Enter"||e.key===" "){e.preventDefault();e.stopPropagation();handler?.()}
  }
 });
 return <svg className={"lektrus-lab-device-icon is-"+kind+(active?" is-active":"")}
  viewBox="0 0 110 108" width={size} height={size} aria-hidden={!editable}
  fill="none" strokeLinecap="round" strokeLinejoin="round"
  preserveAspectRatio="none">
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
   {editable?<foreignObject x="26" y="59" width="36" height="15"
    onPointerDown={e=>e.stopPropagation()}>
    <input className="lektrus-device-thermostat" type="number" inputMode="numeric"
     min={30} max={350} step={10} value={temperatureDraft}
     aria-label="Заданная температура плитки, °C" title="Задать 30–350 °C"
     onChange={e=>setTemperatureDraft(e.target.value)}
     onKeyDown={e=>{e.stopPropagation();if(e.key==="Enter"){commitTemperature();
      (e.currentTarget as HTMLInputElement).blur()}
      else if(e.key==="ArrowUp"||e.key==="ArrowDown")setTimeout(()=>{if(e.currentTarget){/* Native input step */}},0)}}
     onBlur={commitTemperature}/>
   </foreignObject>:<text x="43" y="71" textAnchor="middle"
    fontSize="9" fontWeight="800" fill="#c7efbb">
    {Math.round(targetTemperatureC)}°</text>}
   <circle cx="83" cy="68" r="9" fill={"url(#"+metal+")"} stroke="#3f6c60" strokeWidth="2"/>
   <path d="M83 60V64" stroke="#2a6358" strokeWidth="2.6"/>
   {editable&&<g {...activeControl(onPowerToggle)} role="button" tabIndex={0}
    aria-label={active?"Выключить плитку":"Включить плитку"}
    className="lektrus-lab-svg-control" cursor="pointer">
    <circle cx="83" cy="68" r="11" fill="transparent"/>
    <text x="83" y="73" fontSize="13" textAnchor="middle"
     fill={active?"#e7ffdc":"#214a43"}>⏻</text>
   </g>}
   <circle cx="19" cy="82" r="2.2" fill={active?"#d8e874":"#8faca0"}/>
  </>}
  {kind==="burner"&&<>
   <path d="M36 88H74L89 96H21Z" fill={"url(#"+metal+")"} stroke="#406d69" strokeWidth="2.7"/>
   <rect x="46" y="37" width="19" height="50" rx="3" fill={"url(#"+metal+")"}
    stroke="#3f6c67" strokeWidth="2.6"/>
   <path d="M47 42H64M47 48H64" stroke="#e1f2e9" strokeWidth="1.7"/>
   <rect x="42" y="63" width="27" height="13" rx="3" fill="#6e9c92" stroke="#3f6660" strokeWidth="2.4"/>
   <circle cx="55" cy="69" r="3" fill="#d8e8df"/>
   {editable&&<g {...activeControl(onPowerToggle)} role="button" tabIndex={0}
    aria-label={active?"Погасить горелку":"Зажечь горелку"}
    className="lektrus-lab-svg-control" cursor="pointer">
    <circle cx="55" cy="69" r="10" fill={active?"#389b83":"#bad0c5"}
     stroke="#496f66" strokeWidth="2"/>
    <text x="55" y="73" textAnchor="middle" fontSize="12"
     fill={active?"#fff":"#37675b"}>⏻</text>
   </g>
   <path d="M65 80H84Q92 80 94 88" stroke="#527d78" strokeWidth="5"/>
   <path d="M83 80l6 2" stroke="#c2d7cc" strokeWidth="2"/>
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
   {editable&&<g {...activeControl(onPowerToggle)} role="button" tabIndex={0}
    aria-label={active?"Остановить мешалку":"Запустить мешалку"}
    className="lektrus-lab-svg-control" cursor="pointer">
    <circle cx="78" cy="71" r="11" fill="transparent"/>
    <text x="78" y="76" textAnchor="middle" fontSize="13"
     fill={active?"#e7ffdc":"#214a43"}>⏻</text>
   </g>
  </>}
  {kind==="tripod"&&<>
   <path d="M14 90H86L96 98H7Z" fill={"url(#"+metal+")"}
    stroke="#466e66" strokeWidth="2.8"/>
   <path d="M43 90V9" stroke="#345d56" strokeWidth="6"/>
   <path d="M44 90V8" stroke="#c3e0d6" strokeWidth="2.4"/>
   <g transform={`translate(0 ${-clampShift})`}>
   <rect x="37" y="33" width="13" height="13" rx="3" fill={"url(#"+metal+")"} stroke="#37645d" strokeWidth="2"/>
   <path d="M49 40H76" stroke="#5a847c" strokeWidth="5"/>
   <path d="M76 40l11-8M76 40l11 8" stroke="#517e76" strokeWidth="3.5"/>
   <path d="M84 30Q99 40 84 50" stroke="#40756a" strokeWidth="2.5"/>
   </g>
   <rect x="37" y="58" width="13" height="13" rx="3" fill={"url(#"+metal+")"} stroke="#37645d" strokeWidth="2"/>
   <path d="M49 65H70Q77 65 80 59" stroke="#5b8a7e" strokeWidth="4"/>
   <path d="M49 65H70Q77 65 80 71" stroke="#5b8a7e" strokeWidth="4"/>
   <path d="M49 65H84L88 71H50Z" fill={"url(#"+metal+")"}
    stroke="#456e65" strokeWidth="1.8"/>
   <circle cx="43" cy="39" r="2.2" fill="#2c6258"/>
   <circle cx="43" cy="65" r="2.2" fill="#2c6258"/>
   {editable&&<>
    <g {...activeControl(()=>onStandHeightChange?.(Math.min(1,Math.round((standHeight+.1)*10)/10)))}
     role="button" tabIndex={0} aria-label="Поднять зажим штатива"
     className="lektrus-lab-svg-control" cursor="pointer">
     <rect x="9" y="27" width="20" height="17" rx="4" fill="#d3e8d7" stroke="#5c8a7b"/>
     <text x="19" y="40" textAnchor="middle" fontSize="14" fontWeight="900" fill="#245f52">+</text>
    </g>
    <g {...activeControl(()=>onStandHeightChange?.(Math.max(0,Math.round((standHeight-.1)*10)/10)))}
     role="button" tabIndex={0} aria-label="Опустить зажим штатива"
     className="lektrus-lab-svg-control" cursor="pointer">
     <rect x="9" y="47" width="20" height="17" rx="4" fill="#d3e8d7" stroke="#5c8a7b"/>
     <text x="19" y="60" textAnchor="middle" fontSize="14" fontWeight="900" fill="#245f52">−</text>
    </g>
   </>}
  </>}
  {kind==="thermometer"&&<>
   <path d="M46 16Q46 6 55 6Q64 6 64 16V65A20 20 0 1 1 46 65Z"
    fill={"url(#"+glass+")"} stroke="#53867e" strokeWidth="3"/>
   <path d="M55 32V77" stroke="#d96b67" strokeWidth="5"/>
   <circle cx="55" cy="80" r="12" fill="#d96b67" stroke="#b35d57" strokeWidth="2"/>
  </>}
  {kind!=="thermometer"&&<>
   <text className="lektrus-lab-device-brand" x="55" y={kind==="tripod"?95:kind==="burner"?88:86}
    textAnchor="middle" fontSize="7.5" fontWeight="900" letterSpacing=".8"
    fill={kind==="burner"?"#2c645d":"#2e6757"}>LEKTRUS</text>
   {editable&&<foreignObject x="6" y="91" width="98" height="16"
    onPointerDown={e=>e.stopPropagation()} onPointerMove={e=>e.stopPropagation()}
    onPointerUp={e=>e.stopPropagation()} onClick={e=>e.stopPropagation()}>
    <div className="lektrus-lab-device-integrated-controls">
     {kind!=="tripod"&&<button type="button" title="Мощность"
      aria-label={"Мощность: "+heatLevel} onClick={onLevelCycle}>
      {"Ⅰ".repeat(heatLevel)}</button>}
     <select aria-label="Установить сосуд" defaultValue=""
      title="Установить посуду на прибор" onChange={e=>{
       if(e.target.value){onAttach?.(e.target.value,"clamp");e.target.value=""}
      }}>
      <option value="">+ сосуд</option>
      {choices.map(v=><option value={v.id} key={v.id}>{v.label}</option>)}
     </select>
     {kind==="tripod"&&<select aria-label="Поставить сосуд на полку штатива"
      title="Нижняя полка штатива" defaultValue=""
      onChange={e=>{if(e.target.value){onAttach?.(e.target.value,"shelf");e.target.value=""}}}>
      <option value="">+ полка</option>
      {shelfChoices.map(v=><option value={v.id} key={v.id}>{v.label}</option>)}
     </select>}
     <button type="button" aria-label="Снять посуду" title="Снять посуду"
      onClick={onRelease}>↥</button>
     <button type="button" aria-label="Вернуть прибор в шкаф" title="В шкаф"
      onClick={onReturn}>×</button>
    </div>
   </foreignObject>}
  </>}
 </svg>;
}
