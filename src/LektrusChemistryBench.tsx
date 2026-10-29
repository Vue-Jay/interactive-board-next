import {useEffect,useId,useRef,useState,type PointerEvent} from "react";
import {createPortal} from "react-dom";
import type {LabBench,LabVessel,LabGlassware,LabDose,LabDevice} from "./lektrusChemistryBenchModel";
import {addLabVessel,arrangeLabVessels,emptyLabVessel,labBenchSettings,labGlassware,labMode,LAB_MODES,labModeInfo,setLabMode,glasswareForLabMode,devicesForLabMode,prepareLabModeSetup,labObservation,labReactionNeedsTick,pourLabIntoFilter,
 labIndicatorResult,labIndicators,setLabIndicator,setLabEnvironment,labVesselQuantity,labVesselContents,recordLabReactions,wipeLabChalkboard,labDevices,placedLabDevices,addPlacedLabDevice,movePlacedLabDevice,returnPlacedLabDevice,applyPlacedLabDevice,setPlacedDevicePower,setPlacedDeviceLevel,setLabHotplateTemperature,setLabStandHeight,canMountLabVessel,labAppliancesBelowStand,labReceiverBelowStand,advanceLabSimulation,setLabBuretteValve,LAB_DRIP_RATES,labTitrationTargets,dripLabVessel,positionLabVessel,putLabReagent,removeLabVessel,selectedLabVessel,setLabBenchSettings,formatLabDose,labQuickReagents,setLabQuickReagent,clearLabTable,MAX_QUICK_REAGENTS,labMeasuredCapacityMl,setLabPipetteTarget,fillLabVolumetricFlask,transferLabMeasuredLiquid,startLabPour,advanceLabPour,stopLabPour,placeLabVesselOnStandBase,LAB_POUR_INTERVAL_MS,LAB_POUR_STEPS,labPourPercent,labPourAmounts,
 } from "./lektrusChemistryBenchModel";
import {identifyReaction,reactionAppearance,reviewedReactionCases,substances,type Observation,type ReactionFamily,type ReactionVisual} from "./lektrusReactionDatabase";
import {reagentAppearance} from "./lektrusLabAppearance";
import {labThermalInfo,labVesselThermal,labThermalState} from "./lektrusLabPhysicalProperties";
import {buildLabCatalog,cabinetColor,labReagentForms,labReagentPhaseLabel,type CatalogueGroup,type CatalogueSort,type StoragePhase}
 from "./lektrusLabCatalog";
import {titrationReading} from "./lektrusLabTitration";
import LektrusLabGlasswareIcon from "./LektrusLabGlasswareIcon";
import LektrusLabDeviceIcon from "./LektrusLabDeviceIcon";
import {labDisplayPoint,labLogicalPoint,labMountedGlasswarePoint,labStandBaseVesselPoint,labStandClampSvgY,labTitrationDropEndpoints,isLabSink,isLabCupboard,isLabWorktop} from "./lektrusLabLayout";

const names:Record<LabGlassware,string>=Object.fromEntries(labGlassware.map(v=>[v.id,v.name])) as Record<LabGlassware,string>;
const shape:Record<LabGlassware,{inside:string;outline:string;liquid:string}> ={
 beaker:{
  inside:"M20 18H80V104Q80 116 68 116H32Q20 116 20 104Z",
  outline:"M17 14V105Q17 120 32 120H68Q83 120 83 105V14M15 14H85",
  liquid:"M18 69H82V103Q82 119 67 119H33Q18 119 18 103Z"
 },
 tube:{
  inside:"M33 13H67V101Q67 120 50 120Q33 120 33 101Z",
  outline:"M31 12V101Q31 123 50 123Q69 123 69 101V12M29 12H71",
  liquid:"M32 71H68V100Q68 122 50 122Q32 122 32 100Z"
 },
 flask:{
  inside:"M42 11H58V46Q81 54 81 87Q81 117 50 117Q19 117 19 87Q19 54 42 46Z",
  outline:"M40 9V45Q17 53 17 86Q17 122 50 122Q83 122 83 86Q83 53 60 45V9M38 9H62",
  liquid:"M19 75Q50 69 81 75V91Q79 118 50 118Q21 118 19 91Z"
 },
 cylinder:{
  inside:"M28 10H72V109Q72 118 65 118H35Q28 118 28 109Z",
  outline:"M26 9V110Q26 121 35 121H65Q74 121 74 110V9M24 9H76",
  liquid:"M28 66H72V109Q72 118 65 118H35Q28 118 28 109Z"
 },
 dish:{
  inside:"M12 70Q14 117 50 117Q86 117 88 70Z",
  outline:"M12 70Q14 117 50 117Q86 117 88 70M12 70Q50 82 88 70",
  liquid:"M14 86Q50 94 86 86Q78 115 50 115Q22 115 14 86Z"
 },
 conical:{
  inside:"M39 12H61V55L86 105Q88 119 73 120H27Q12 119 14 105L39 55Z",
  outline:"M38 10V55L13 105Q9 123 27 123H73Q91 123 87 105L62 55V10M36 10H64",
  liquid:"M27 88H73L84 108Q86 120 70 120H30Q14 120 16 108Z"
 },
 volumetric:{
  inside:"M44 9H56V61Q83 75 82 98Q82 121 50 122Q18 121 18 98Q17 75 44 61Z",
  outline:"M43 8V60Q17 72 17 98Q17 124 50 124Q83 124 83 98Q83 72 57 60V8M40 8H60",
  liquid:"M26 91Q50 87 74 91Q83 117 50 120Q17 117 26 91Z"
 },
 crucible:{
  inside:"M22 61H78L72 112Q69 120 50 120Q31 120 28 112Z",
  outline:"M19 58H81L74 113Q70 124 50 124Q30 124 26 113ZM18 57H82",
  liquid:"M26 83H74L69 113Q50 122 31 113Z"
 },
 pipette:{
  inside:"M45 9H55V52L61 76Q62 92 55 99V121H45V99Q38 92 39 76L45 52Z",
  outline:"M43 7H57V50L63 75Q65 92 57 101V125H43V101Q35 92 37 75L43 50ZM40 8H60",
  liquid:"M42 78H58Q62 93 55 101V121H45V101Q38 93 42 78Z"
 },
 burette:{
  inside:"M44 8H56V108H44Z",
  outline:"M43 7H57V111H43ZM39 111H61M50 111V126",
  liquid:"M45 33H55V107H45Z"
 }
};
export const reactionFamilyLabels:Record<ReactionFamily,string>={
 exchange:"Обмен",neutralization:"Нейтрализация",synthesis:"Соединение",
 decomposition:"Разложение",displacement:"Замещение",combustion:"Горение",
 redox:"ОВР",hydration:"Гидратация",organic:"Органическая реакция"
};
/** Ephemeral visual events share their clock through the board model.
 * Existing settled products stay visible, flames and flashes do not. */
function LabReactionBurst({vessel,visual,formula}:{
 vessel:LabVessel;visual?:ReactionVisual;formula:string}){
 const started=vessel.visualStartedAtMs;
 if(!visual||!started)return null;
 const elapsed=Math.max(0,Date.now()-started);
 if(elapsed>6500||elapsed<0)return null;
 const shift={animationDelay:-elapsed/1000+"s"} as React.CSSProperties;
 const blazing=["flame","flash","sparks","glow"].includes(visual);
 return <div key={started} aria-hidden="true"
  className={"lektrus-lab-reaction-burst is-"+visual+
   (formula.includes("Mg + O2")?" is-magnesium":"")+
   (formula.includes("CH3OH")||formula.includes("C2H5OH")?" is-alcohol":"")}>
  {blazing&&<div className="lektrus-lab-reaction-light" style={shift}/>}
  {visual==="flash"&&<div className="lektrus-lab-reaction-shockwave" style={shift}/>}
  {(visual==="flame"||visual==="glow")&&
   <div className="lektrus-lab-reaction-flame" style={shift}>
    <span/><span/><span/>
   </div>}
  {Array.from({length:visual==="sparks"?12:visual==="smoke"||visual==="steam"?9:
    visual==="fizz"?14:visual==="crystals"?12:7},(_,i)=>
   <i key={i} className="lektrus-lab-reaction-mote"
    style={{"--lab-particle-x":(i*53%91-45)+"px",
     "--lab-particle-delay":-(elapsed/1000)+(i%7)*.11+"s",
     "--lab-particle-angle":(i*61%130-65)+"deg"} as React.CSSProperties}/>)}
 </div>;
}

function LabVesselGraphic({vessel,small=false,showLabels=true,details=false,readoutLeft=false,stirring=false,titrationResult,temperatureC,temperatureVisible=true}:{
 vessel:LabVessel;small?:boolean;showLabels?:boolean;details?:boolean;readoutLeft?:boolean;stirring?:boolean;
 titrationResult?:ReturnType<typeof titrationReading>;temperatureC?:number;
 temperatureVisible?:boolean}){
 const id=useId().replace(/:/g,"");
 const result=labObservation(vessel);
 const verified=result.status==="reaction"?result.caseData:undefined;
 const visualCase=vessel.completedReaction??verified;
 const appearance=reactionAppearance(visualCase);
 const indicator=titrationResult&&vessel.indicator?{
  medium:titrationResult.phase==="acidic"?"acid":titrationResult.phase==="alkaline"?"base":"neutral",
  label:"pH "+titrationResult.pH,color:titrationResult.tint,
  note:"Расчётное значение при титровании, 25 °C"
 }:labIndicatorResult(vessel);
 const {volumeMl,massG,capacityMl,liquidFraction,solidFraction}=labVesselQuantity(vessel);
 const contents=labVesselContents(vessel);
 const readable=(n:number,decimals=3)=>n.toLocaleString("ru-RU",{maximumFractionDigits:decimals});
 const solutionNames=contents.solution.map(x=>x.formula+(x.mmol===undefined?"":" ("+readable(x.mmol)+" ммоль)"));
 const solidNames=contents.solid.map(x=>x.formula+(x.massG===undefined?"":" ("+readable(x.massG)+" г)"));
 const sedimentH=contents.precipitateFraction===undefined?0:
  Math.min(105*liquidFraction,Math.max(1,106*contents.precipitateFraction));
 const totalLabel=[volumeMl>0?volumeMl.toLocaleString("ru-RU")+" мл":null,
  massG>0?massG.toLocaleString("ru-RU")+" г":null].filter(Boolean).join(" · ");
 const reagent=vessel.reagents[0]?reagentAppearance(vessel.reagents[0],
  massG>0&&volumeMl===0?"dry":vessel.environment):null;
 const active=Boolean(visualCase);
 const dryProductColor=active&&volumeMl===0&&appearance.productSolid?
  appearance.productSolidColor:undefined;
 const color=vessel.filteredResidue?.color??(titrationResult?(vessel.indicator?titrationResult.tint:"#dceff0"):
  indicator?.color??dryProductColor??(active?appearance.solutionAfter:reagent?.color??"#e7f3f3"));
 const observation=visualCase?.observation??"none";
 const gasEventActive=!!vessel.reactionAmounts&&!vessel.reactionAmounts.complete||
  !!vessel.visualStartedAtMs&&Date.now()-vessel.visualStartedAtMs<6500;
 const gasOnly=vessel.reagents.length>0&&vessel.reagents.every(id=>
  substances.find(s=>s.id===id)?.kind==="газ")&&massG===0;
 const singlePhase=vessel.filteredResidue?"solid":gasOnly?"gas":
  massG>0&&volumeMl===0?"solid":volumeMl>0?"solution":
  vessel.reagents.length===1&&!active?reagent?.phase:undefined;
 const pureThermal=labVesselThermal(vessel.reagents,vessel.doses);
 const thermalState=labThermalState(vessel.reagents,vessel.doses,
  temperatureC??vessel.temperatureC??22,vessel.meltFraction);
 const moltenFraction=pureThermal?.unit==="g"&&
  pureThermal.info.meltingC!==undefined?Math.min(1,Math.max(0,vessel.meltFraction??0)):0;
 const geo=shape[vessel.kind];
 const amounts=vessel.reactionAmounts;
 const species=amounts?[...Object.entries(amounts.remainingMol),
  ...Object.entries(amounts.productsMol)].filter(([,mol])=>mol>1e-12):
  vessel.reagents.map(id=>[id,0] as [string,number]);
 const labels=species.map(([id])=>substances.find(s=>s.id===id)?.formula??id);
 const conversionFraction=amounts?amounts.maxExtentMol>0?
  amounts.extentMol/amounts.maxExtentMol:0:1;
 const boiling=!!volumeMl&&thermalState.boiling;
 const renderedSolidFraction=vessel.filteredResidue?Math.max(.23,solidFraction):
  solidFraction*(1-moltenFraction);
 const fillFraction=volumeMl>0?Math.max(.008,liquidFraction):
  (vessel.reagents.length>0?(vessel.pourFraction??0.5):0);
 return <div className={"lektrus-lab-vessel-art"+(small?" is-small":"")}>
  <svg viewBox="0 0 100 133" role="img" aria-label={names[vessel.kind]+": "+(labels.join(", ")||"пустой")}>
   <defs>
    <clipPath id={id+"clip"}><path d={geo.inside}/></clipPath>
    <clipPath id={id+"level"}><rect x="0" y={120-106*fillFraction}
     width="100" height="133"/></clipPath>
    <clipPath id={id+"melt-level"}><rect x="0"
     y={120-106*Math.max(.015,solidFraction*moltenFraction)}
     width="100" height="133"/></clipPath>
    <linearGradient id={id+"glass"} x1="0" x2="1"><stop stopColor="#e9f6f4" stopOpacity=".35"/><stop offset=".3" stopColor="#fff" stopOpacity=".08"/><stop offset=".8" stopColor="#acc9c8" stopOpacity=".2"/><stop offset="1" stopColor="#fff" stopOpacity=".12"/></linearGradient>
   </defs>
   <ellipse cx="50" cy="126" rx="34" ry="4" fill="#254f49" opacity=".12"/>
   <path d={geo.inside} fill={"url(#"+id+"glass)"} stroke="none"/>
   <g clipPath={"url(#"+id+"clip)"}>
    {labels.length>0&&singlePhase!=="solid"&&singlePhase!=="metal"&&singlePhase!=="gas"&&
     <path d={geo.liquid} clipPath={"url(#"+id+"level)"} fill={color} opacity=".76" className="lektrus-lab-fluid"/>}
    {labels.length>0&&moltenFraction>0&&<g className="lektrus-lab-molten-liquid">
     <path d={geo.liquid} clipPath={"url(#"+id+"melt-level)"}
      fill={reagent?.color??"#d6bd82"} opacity=".86"/>
     <ellipse cx="50" cy={119-106*Math.max(.015,solidFraction*moltenFraction)}
      rx="27" ry="2.8" fill="#fff6d9" fillOpacity=".27"/>
    </g>}
    {labels.length>0&&(singlePhase==="solid"||singlePhase==="metal")&&renderedSolidFraction>.005&&<>
     <path d={`M17 ${119-48*renderedSolidFraction}Q29 ${111-48*solidFraction} 47 ${115-48*solidFraction}Q69 ${111-48*solidFraction} 82 ${119-48*solidFraction}L79 119H21Z`}
      fill={color} opacity=".88"/>
     {Array.from({length:Math.min(36,Math.max(3,Math.ceil(32*renderedSolidFraction)))},(_,i)=><circle key={"grain"+i}
      cx={27+(i*17)%46} cy={Math.max(73,115-46*renderedSolidFraction)+(i*13)%(Math.max(3,42*renderedSolidFraction))} r={1.2+i%3*.7}
      fill={color} stroke="#526962" strokeOpacity=".28"/>)}
    </>}
    {labels.length>0&&singlePhase==="gas"&&<>
     <path d={geo.inside} fill={color} opacity=".17"/>
     {Array.from({length:9},(_,i)=><circle key={"gascloud"+i}
      cx={34+(i*13)%33} cy={32+(i*21)%61} r={3+i%3}
      fill={color} opacity=".42"/>)}
    </>}
    {vessel.physicalProcess==="dissolving"&&vessel.physicalStartedAtMs&&
     <g className="lektrus-lab-dissolving-particles">
      {Array.from({length:16},(_,i)=><circle key={i}
       cx={28+i*23%44} cy={85+i*17%27} r={1.3+i%3*.6}
       fill={i%2?"#e9f8ff":"#d7e7f1"} stroke="#83afbb" strokeWidth=".5"
       style={{animationDelay:-(Math.max(0,Date.now()-vessel.physicalStartedAtMs!)/1000)
        -(i%5)*.13+"s"}}/>)}
     </g>}
    {boiling&&<g className="lektrus-lab-boiling-particles">
     {Array.from({length:18},(_,i)=><circle key={i}
      cx={28+i*19%46} cy={80+i*23%30} r={1.6+i%4*.7}
      fill="#fff" fillOpacity=".18" stroke="#9ecfd7" strokeWidth=".8"
      style={{animationDelay:-(i%8)*.31+"s"}}/>)}
    </g>}
    {stirring&&labels.length>0&&<g className="lektrus-lab-stir-vortex">
     <ellipse cx="50" cy="90" rx="24" ry="6" fill="none" stroke="#effffd" strokeWidth="2" opacity=".85"/>
     <ellipse cx="50" cy="93" rx="14" ry="4" fill="none" stroke="#318f90" strokeWidth="2" opacity=".75"/>
     <path d="M42 87Q51 81 59 89" stroke="#e9ffff" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
    </g>}
    {active&&observation==="precipitate"&&conversionFraction>0&&<>
     {/* Quantified precipitation uses actual produced mass/density and vessel volume.
         The one-pixel minimum only keeps subpixel traces perceptible. */}
     {sedimentH>0&&<rect className="lektrus-lab-sediment"
      x="16" y={120-sedimentH} width="70" height={sedimentH}
      fill={appearance.solidColor||"#d6dee1"} opacity=".94"/>}
     {contents.precipitateFraction===undefined&&<g className="lektrus-lab-qualitative-residue">
      {Array.from({length:18},(_,i)=><circle key={i} cx={23+i*17%56}
       cy={116-i%3*1.8} r=".7" fill={appearance.solidColor||"#d6dee1"}/>)}
     </g>}
     {!amounts?.complete&&Array.from({length:14},(_,i)=><circle key={i}
      className="lektrus-lab-particle" cx={28+i*31%45} cy={76+i*13%31}
      r={1.1+i%3*.5} fill={appearance.solidColor||"#cddbe0"}
      style={{animationDelay:-(i%9)*.25+"s"}}/>)}
    </>}
    {active&&observation==="gas"&&gasEventActive&&Array.from({length:Math.ceil(17*conversionFraction)},(_,i)=><circle key={i}
     className="lektrus-lab-bubble" cx={31+i*29%38} cy={98-i*17%45}
     r={2+i%3} stroke="#528eb1" strokeWidth=".9" fill="#fff" fillOpacity=".2"
     style={{animationDelay:-(i%8)*.27+"s",animationDuration:2+i%5*.32+"s"}}/>)}
   </g>
   {["beaker","cylinder","burette"].includes(vessel.kind)&&
    <g className="lektrus-lab-ware-graduations" stroke="#638e8c" strokeWidth="1.25" opacity=".9">
     {Array.from({length:8},(_,i)=><path key={i}
      d={vessel.kind==="burette"?`M44 ${22+i*10}h${i%2?6:10}`:
       vessel.kind==="cylinder"?`M30 ${29+i*10}h${i%2?7:12}`:
       `M65 ${28+i*10}h${i%2?6:11}`}/>)}
    </g>}
   {vessel.kind==="burette"&&<g className="lektrus-lab-burette-stopcock">
    <path d="M42 112H61M50 111V126" stroke="#497b76" strokeWidth="3" strokeLinecap="round"/>
    <path d={vessel.buretteOpen?"M52 102V125":"M39 114H64"} stroke={vessel.buretteOpen?"#27a789":"#758f8c"} strokeWidth="5" strokeLinecap="round"/>
    <circle cx="52" cy="114" r="4" fill="#e2f3ed" stroke="#47776f" strokeWidth="1.5"/>
    
   </g>}
   {boiling&&<g className="lektrus-lab-steam-plumes" aria-hidden="true">
    {Array.from({length:5},(_,i)=><path key={i}
     d={`M${31+i*10} 13q-5 -7 0 -15t0 -14`}
     fill="none" stroke="#dffbfb" strokeWidth="2.5" strokeLinecap="round"
     style={{animationDelay:-(i*.45)+"s"}}/>)}
   </g>}
   <path d={geo.outline} fill="none" stroke="#75a4a4" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
   <path d={geo.outline} fill="none" stroke="#fff" strokeWidth="1.25" opacity=".8" strokeLinecap="round"/>
   {vessel.indicator&&<g className="lektrus-lab-indicator-strip">
    <rect x="73" y="24" width="7" height="73" rx="2" fill="#f4edda" stroke="#9a9f91" strokeWidth="1" transform="rotate(12 76 60)"/>
    <rect x="73" y="71" width="7" height="24" rx="1" fill={indicator?.color??"#b5b9b3"} opacity=".95" transform="rotate(12 76 60)"/>
   </g>}
   <path d="M29 32V57" stroke="#fff" strokeWidth="5" strokeLinecap="round" opacity=".5"/>
   {/* Contents are labelled above the vessel; temperature stays on glass. */}
   {temperatureVisible&&vessel.kind!=="burette"&&<g className="lektrus-lab-ware-engraving">
    <rect x="27" y="75" width="46" height="16" rx="4"
     fill="#f0faf3" fillOpacity=".8" stroke="#83b1a6" strokeWidth=".7"/>
    <text x="50" y="86" fontWeight="800" fontSize="10" textAnchor="middle"
     fill="#2c7162">≈{Math.round(temperatureC??22)}°C</text>
   </g>}
   {moltenFraction>0&&<g className="lektrus-lab-phase-engraving">
    <rect x="22" y="95" width="56" height="13" rx="4"
     fill="#f7e7c5" stroke="#c3a373" strokeWidth=".6"/>
    <text x="50" y="104" fontSize="7.5" fontWeight="800" textAnchor="middle"
     fill="#76542e">{moltenFraction>=.995?"Расплав":
      vessel.phaseTransition==="crystallizing"?"Кристалл.":"Плавление"}</text>
   </g>}


  </svg>
  <LabReactionBurst vessel={vessel} visual={visualCase?.visual} formula={visualCase?.equation??""}/>
  {vessel.reactionHeat&&(!vessel.reactionHeat.complete||
   !!vessel.visualStartedAtMs&&Date.now()-vessel.visualStartedAtMs<8500)&&
   <span className={"lektrus-lab-reaction-heat is-"+vessel.reactionHeat.direction}
    title={"Учебная оценка теплового эффекта, не показание реального термометра"}>
    {vessel.reactionHeat.direction==="exothermic"?"↑ Нагрев":"↓ Охлаждение"}
   </span>}
  {(details||volumeMl>0||contents.solid.length>0)&&
   <div className={"lektrus-lab-quantity-meter"+(details?" has-composition":"")+
     (details&&readoutLeft?" is-reversed":"")}
    aria-label="Количество раствора и твёрдых веществ">
    {(details||volumeMl>0)&&<div className="lektrus-lab-quantity-measure is-liquid"
      title={readable(volumeMl)+" мл / "+capacityMl+" мл (условная вместимость)"}>
      <span className="lektrus-lab-quantity-track">
       <i style={{height:(liquidFraction*100)+"%"}}/>
      </span>
      <strong>{readable(volumeMl)}<small>мл</small></strong>
      {details&&<span className="lektrus-lab-quantity-info is-solution">
       <b>Раствор · {readable(contents.solutionMl)} мл</b>
       <span>{solutionNames.join(", ")||"Растворённых веществ нет"}</span>
      </span>}
     </div>}
    {(details||contents.solid.length>0)&&<div className="lektrus-lab-quantity-measure is-solid"
      title="Масса осадка или твёрдого вещества: данные из состава сосуда">
      <span className="lektrus-lab-quantity-track">
       <i style={{height:((contents.precipitateFraction===undefined?
        solidFraction:contents.precipitateFraction)*100)+"%"}}/>
      </span>
      <strong>{contents.solid.length?
       (contents.precipitateG===undefined?
        contents.solid.every(item=>item.massG!==undefined)?
         readable(contents.solid.reduce((sum,item)=>sum+(item.massG??0),0)):"?":
        readable(contents.precipitateG)):"0"}<small>г</small></strong>
      {details&&<span className="lektrus-lab-quantity-info is-residue">
       <b>{observation==="precipitate"||vessel.filteredResidue?"Осадок":"Твёрдое"} · {contents.solid.length?
        contents.precipitateG===undefined?
         contents.solid.every(item=>item.massG!==undefined)?
          readable(contents.solid.reduce((sum,item)=>sum+(item.massG??0),0))+" г":"масса неизвестна":
         readable(contents.precipitateG)+" г":"0 г"}</b>
       <span>{solidNames.join(", ")||"Нет осадка"}</span>
       {contents.remainderUnknown&&<small>Остаток реагентов не определён</small>}
      </span>}
     </div>}
   </div>}
  {showLabels&&!details&&<span className="lektrus-lab-content-tag"
   title={labels.length?labels.map((formula,i)=>{
    const dose=amounts?undefined:vessel.doses?.[vessel.reagents[i]];
    const mol=amounts?species[i]?.[1]:undefined;
     return formula+(mol!==undefined?" · "+(mol*1000).toLocaleString("ru-RU",{maximumFractionDigits:4})+" ммоль":
      dose?" · "+formatLabDose(dose)+
     (dose.concentrationM!==undefined?" · "+dose.concentrationM.toLocaleString("ru-RU")+" моль/л":""):"");
   }).join("; "):"Пустая посуда"}>
   <strong>{contents.solid.length?"Осадок: "+contents.solid.map(v=>v.formula).join(", "):
     contents.solution.length?contents.solution.map(v=>v.formula).join(" + "):"Пусто"}</strong>
   {labels.length>0&&(!!totalLabel||!!vessel.filteredResidue)&&<small>{totalLabel||"Осадок"}</small>}

   <span className="lektrus-lab-content-quantity" aria-hidden="true">
    {labels.length?labels.map((formula,i)=>{
      const id=species[i]?.[0]??formula;
      const dose=vessel.doses?.[id];
      const mol=amounts?species[i]?.[1]:undefined;
      return <span key={id}>{formula}: {mol!==undefined?
       (mol*1000).toLocaleString("ru-RU",{maximumFractionDigits:4})+" ммоль":
       dose?formatLabDose(dose)+(dose.concentrationM!==undefined?
        " · "+dose.concentrationM.toLocaleString("ru-RU")+" М":""):
       "количество не задано"}</span>;
     }):"Пусто"}
   </span>
  </span>}
 </div>;
}
/** A draft value must not clamp while its digits are still being typed. */
function LabTemperatureInput({temperature,onSet}:{temperature:number;onSet:(v:number)=>void}){
 const [draft,setDraft]=useState(String(temperature));
 useEffect(()=>setDraft(String(temperature)),[temperature]);
 const commit=()=>{
  const value=Number(draft);
  if(draft.trim()&&Number.isFinite(value)&&value>=30&&value<=350)onSet(value);
  else setDraft(String(temperature));
 };
 return <input type="number" className="lektrus-lab-device-face-temp"
  aria-label="Задать температуру плитки в °C" title="Заданная температура 30–350 °C"
  min={30} max={350} step={10} value={draft}
  onChange={e=>setDraft(e.target.value)}
  onPointerDown={e=>e.stopPropagation()}
  onKeyDown={e=>{e.stopPropagation();if(e.key==="Enter"){commit();e.currentTarget.blur()}}}
  onBlur={commit}/>;
}
type SurfaceProps={
 bench:LabBench;editable?:boolean;
 pouringId?:string|null;
 onChange?:(bench:LabBench)=>void;
 onSelect?:(id:string)=>void;
 onPour?:(sourceId:string,targetId:string)=>void;
 onDropReagent?:(id:string,reagent:string,dose?:LabDose)=>void;
};
/** Furniture is part of the shared bench, not a second toolbar. Both the
 * editor and the board use these exact same interactions. */
export default function LektrusChemistryBenchSurface({bench,editable=false,pouringId,
 onChange,onSelect,onPour,onDropReagent}:SurfaceProps){
 const host=useRef<HTMLDivElement>(null);
 const [stageSize,setStageSize]=useState({width:1600,height:1000});
 useEffect(()=>{
  const node=host.current;if(!node)return;
  const update=()=>{
   // CSS container queries use untransformed layout pixels, not the
   // scaled bounding rect of a board item being zoomed.
   const width=node.clientWidth,height=node.clientHeight;
   if(width>0&&height>0)setStageSize(old=>
    Math.abs(old.width-width)<1&&Math.abs(old.height-height)<1?old:{width,height});
  };
  update();
  const resize=new ResizeObserver(update);resize.observe(node);
  return()=>resize.disconnect();
 },[]);
 const dialogRef=useRef<HTMLElement>(null);
 const sinkId=useId().replace(/:/g,"");
 const scrollRef=useRef<HTMLDivElement>(null);
 const gesture=useRef<{id:string;startX:number;startY:number;x:number;y:number;dragged:boolean}|null>(null);
 const shelfGesture=useRef<{kind:LabGlassware;startX:number;startY:number;dragged:boolean}|null>(null);
 const deviceShelfGesture=useRef<{kind:LabDevice;startX:number;startY:number;dragged:boolean}|null>(null);
 const deviceGesture=useRef<{id:string;startX:number;startY:number;x:number;y:number;dragged:boolean}|null>(null);
 const [devicePreview,setDevicePreview]=useState<{id:string;x:number;y:number}|null>(null);
 const [deviceShelfGhost,setDeviceShelfGhost]=useState<{kind:LabDevice;x:number;y:number}|null>(null);
 const [activeDeviceId,setActiveDeviceId]=useState<string|null>(null);
 const [vesselMenuId,setVesselMenuId]=useState<string|null>(null);
 const [preview,setPreview]=useState<{id:string;x:number;y:number}|null>(null);
 const contactRef=useRef<{sourceId:string;targetId:string;activated:boolean}|null>(null);
 const contactTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const [contactCountdown,setContactCountdown]=useState<string|null>(null);
 const contactPourRef=useRef<string|null>(null);
 const cancelContact=()=>{if(contactTimer.current)clearTimeout(contactTimer.current);
  contactTimer.current=null;contactRef.current=null;setContactCountdown(null);};
 useEffect(()=>()=>{if(contactTimer.current)clearTimeout(contactTimer.current)},[]);
 const [shelfGhost,setShelfGhost]=useState<{kind:LabGlassware;x:number;y:number}|null>(null);
 const [dropTarget,setDropTarget]=useState<string|null>(null);
 const [dropDeviceId,setDropDeviceId]=useState<string|null>(null);
 const [dropFurniture,setDropFurniture]=useState<"sink"|"glassware"|null>(null);
 const [dropDeviceShelf,setDropDeviceShelf]=useState(false);
 const [transfer,setTransfer]=useState<{from:{x:number;y:number};to:{x:number;y:number}}|null>(null);
 const [cabinet,setCabinet]=useState<"reagents"|"glassware"|"equipment"|null>(null);
 const [pendingGlassware,setPendingGlassware]=useState<LabGlassware|null>(null);
 const [showAllGlassware,setShowAllGlassware]=useState(false);
 const [showAllDevices,setShowAllDevices]=useState(false);
 const [query,setQuery]=useState("");
 const [category,setCategory]=useState("Все");
 const [phase,setPhase]=useState<"all"|StoragePhase>("all");
 const [sort,setSort]=useState<CatalogueSort>("recommended");
 const [group,setGroup]=useState<CatalogueGroup>("phase");
 const [cabinetTab,setCabinetTab]=useState<
 "all"|"acid"|"base"|"salt"|"oxide"|"metal"|"organic"|"other"|"experiments">("all");
 const [effectFilter,setEffectFilter]=useState<"all"|Observation|ReactionFamily>("all");
 const [chosen,setChosen]=useState<string|null>(null);
 const [amount,setAmount]=useState("10");
 const [unit,setUnit]=useState<"ml"|"g">("ml");
 const [molarity,setMolarity]=useState("0.1");
 const [titrationTarget,setTitrationTarget]=useState("");
 const [measuredMl,setMeasuredMl]=useState("5");
 const [measuredPartnerId,setMeasuredPartnerId]=useState("");
 const [localPourId,setLocalPourId]=useState<string|null>(null);
 const [notice,setNotice]=useState("");
 const [sinkFlow,setSinkFlow]=useState(false);
 const [confirmClear,setConfirmClear]=useState(false);
 const [doseEffect,setDoseEffect]=useState<{x:number;y:number;color:string;solid:boolean}|null>(null);
 const settings=labBenchSettings(bench);
 const selected=bench.selectedId?selectedLabVessel(bench):undefined;
 const physicalDevices=placedLabDevices(bench);
 const vesselPosition=(v:LabVessel)=>{
  const stand=physicalDevices.find(d=>d.kind==="tripod"&&d.active&&d.linkedVesselId===v.id);
  const anchor=stand??physicalDevices.find(d=>d.active&&d.linkedVesselId===v.id);
  const device=anchor&&devicePreview?.id===anchor.id?{...anchor,...devicePreview}:anchor;
  if(device)return labMountedGlasswarePoint(device,v,stageSize.width,stageSize.height);
  const base=physicalDevices.find(d=>d.kind==="tripod"&&d.id===v.restingOnStandId);
  if(base){
   const current=devicePreview?.id===base.id?{...base,...devicePreview}:base;
   return labStandBaseVesselPoint(current,v,stageSize.width,stageSize.height);
  }
  return labDisplayPoint(v);
 };
 const benchRef=useRef(bench);
 const changeRef=useRef(onChange);
 const localPourRef=useRef<string|null>(null);
 const lastPourStepRef=useRef(-1);
 benchRef.current=bench;changeRef.current=onChange;
 useEffect(()=>{
  if(!editable)return;
  const current=benchRef.current,updated=recordLabReactions(current);
  if(updated!==current){benchRef.current=updated;changeRef.current?.(updated)}
 },[bench.vessels,editable]);
 const endContact=()=>{
  cancelContact();const id=contactPourRef.current;
  contactPourRef.current=null;
  if(!id)return;
  const current=benchRef.current;
  if(current.pouring?.id===id){const next=stopLabPour(current,id);
   benchRef.current=next;changeRef.current?.(next)}
  if(localPourRef.current===id)localPourRef.current=null;
 };
 const isGlobalSearch=!!query.trim();
 const catalogKind=(v:{kind:string})=>{
  if(cabinetTab==="all"||isGlobalSearch)return true;
  if(cabinetTab==="acid")return v.kind==="кислота";
  if(cabinetTab==="base")return v.kind==="основание";
  if(cabinetTab==="salt")return v.kind==="соль";
  if(cabinetTab==="oxide")return v.kind==="оксид";
  if(cabinetTab==="metal")return v.kind==="металл"||v.kind==="неметалл";
  if(cabinetTab==="organic")return v.kind==="органика";
  return !["кислота","основание","соль","оксид","металл","неметалл","органика"].includes(v.kind);
 };
 const catalogue=buildLabCatalog({query,kind:isGlobalSearch?"Все":category,
  phase:isGlobalSearch?"all":phase,sort,group})
  .map(section=>({...section,items:section.items.filter(catalogKind)}))
  .filter(section=>section.items.length>0);
 const visibleSubstances=catalogue.flatMap(v=>v.items);
 const reagent=chosen?substances.find(s=>s.id===chosen):null;
 const classes=["Все",...new Set(substances.map(s=>s.kind))];
 const selectedBurette=selected?.kind==="burette"?selected:undefined;
 const buretteTargets=selectedBurette?bench.vessels.filter(v=>
  v.id!==selectedBurette.id&&["beaker","flask","conical","tube"].includes(v.kind)):[];
 const belowBurette=selectedBurette?labReceiverBelowStand(bench,selectedBurette.id):undefined;
 const mountedBurette=!!selectedBurette&&physicalDevices.some(d=>
  d.kind==="tripod"&&d.active&&d.linkedVesselId===selectedBurette.id);
 const chosenValveTarget=mountedBurette?belowBurette?.id:
  buretteTargets.some(v=>v.id===(selectedBurette?.buretteTargetId??titrationTarget))?
   (selectedBurette?.buretteTargetId??titrationTarget):
   buretteTargets[0]?.id;
 const effectivePouringId=pouringId??localPourId;
 const experimentCases=reviewedReactionCases.filter(v=>v.status==="reaction"&&
  v.reactants.length<=3&&(effectFilter==="all"||v.observation===effectFilter||v.family===effectFilter)&&
  (v.equation+" "+v.description+" "+v.reactants.join(" ")).toLocaleLowerCase("ru-RU")
   .includes(query.trim().toLocaleLowerCase("ru-RU")));
 /** Only the participant who starts a pour advances the shared 5% ticks.
  * The session itself lives in the board so other users see every portion. */
 useEffect(()=>{
  const id=bench.pouring?.id;
  if(!editable||!id||localPourRef.current!==id)return;
  const timer=setInterval(()=>{
   const current=benchRef.current,session=current.pouring;
   if(!session||session.id!==id||session.step>=LAB_POUR_STEPS)return;
   if(session.step<=lastPourStepRef.current)return;
   lastPourStepRef.current=session.step;
   const next=advanceLabPour(current);
   if(next!==current){benchRef.current=next;changeRef.current?.(next)}
  },LAB_POUR_INTERVAL_MS);
  return()=>clearInterval(timer);
 },[bench.pouring?.id,editable]);
 useEffect(()=>{
  const session=bench.pouring;
  if(!session||session.step!==LAB_POUR_STEPS||
   session.id!==localPourRef.current)return;
  const timer=setTimeout(()=>{
   const current=benchRef.current;
   if(current.pouring?.id===session.id&&current.pouring.step===LAB_POUR_STEPS)
    changeRef.current?.(stopLabPour(current,session.id));
   localPourRef.current=null;
  },1600);
  return()=>clearTimeout(timer);
 },[bench.pouring?.id,bench.pouring?.step]);
 /** Persist one deterministic simulated thermal clock in board state. */
 useEffect(()=>{
  if(!editable)return;
  const timer=setInterval(()=>{
   const current=benchRef.current;
   const openBurette=current.vessels.some(v=>v.buretteOpen);
   const active=openBurette||current.vessels.some(labReactionNeedsTick)||
    current.vessels.some(v=>v.physicalProcess==="dissolving")||
    placedLabDevices(current).some(d=>d.powered||
    (d.temperatureC??22)>22.1)||
    current.vessels.some(v=>(v.temperatureC??22)>22.1);
   if(!active)return;
   // Fine-grained updates only while titrating. Heating needs fewer board writes.
   if(!openBurette&&!current.vessels.some(labReactionNeedsTick)&&
     !current.vessels.some(v=>v.physicalProcess==="dissolving")&&
     Date.now()-(current.simulationAtMs??0)<1900)return;
   const next=advanceLabSimulation(current,Date.now());
   if(next!==current)changeRef.current?.(next);
  },500);
  return ()=>clearInterval(timer);
 },[editable]);
 useEffect(()=>{if(cabinet)dialogRef.current?.focus()},[cabinet]);
 useEffect(()=>{scrollRef.current?.scrollTo({top:0})},
  [cabinet,cabinetTab,query,category,phase,sort,group,effectFilter]);
 useEffect(()=>{
  if(!cabinet)return;
  const onEscape=(event:KeyboardEvent)=>{
   if(event.key!=="Escape")return;
   event.preventDefault();event.stopPropagation();setCabinet(null);
  };
  document.addEventListener("keydown",onEscape,true);
  return()=>document.removeEventListener("keydown",onEscape,true);
 },[cabinet]);
 useEffect(()=>{if(!transfer)return;const timer=setTimeout(()=>setTransfer(null),900);return()=>clearTimeout(timer)},[transfer]);
 useEffect(()=>{if(!sinkFlow)return;const timer=setTimeout(()=>setSinkFlow(false),900);return()=>clearTimeout(timer)},[sinkFlow]);
 useEffect(()=>{if(!doseEffect)return;const timer=setTimeout(()=>setDoseEffect(null),900);return()=>clearTimeout(timer)},[doseEffect]);
 const point=(event:PointerEvent)=>{const rect=host.current?.getBoundingClientRect();
  if(!rect||!rect.width||!rect.height)return null;
  return{x:(event.clientX-rect.left)/rect.width*100,y:(event.clientY-rect.top)/rect.height*100};};
 const inGlassware=isLabCupboard;
 const inSink=isLabSink;
 const targetAt=(sourceId:string,p:{x:number;y:number})=>{
  const rect=host.current?.getBoundingClientRect();
  const source=bench.vessels.find(v=>v.id===sourceId);
  if(!rect||!source||(!source.reagents.length&&source.kind!=="pipette")||!onPour)return null;
  return bench.vessels.filter(v=>v.id!==sourceId).map(v=>{
   const screen=vesselPosition(v);
   return {id:v.id,dist:Math.hypot((p.x-screen.x)*rect.width/100,
     (p.y-screen.y)*rect.height/100)};
  }).filter(v=>v.dist<Math.min(115,Math.max(54,rect.width*.15))).sort((a,b)=>a.dist-b.dist)[0]?.id??null;
 };
 const drip=(sourceId:string,targetId:string,ml:number)=>{
  const next=dripLabVessel(bench,sourceId,targetId,ml);
  if(next===bench){
   setNotice("Для титрования наполните бюретку и колбу кислотой и щёлочью с известной концентрацией");
   return;
  }
  onChange?.(next);
  const from=bench.vessels.find(v=>v.id===sourceId);
  const to=bench.vessels.find(v=>v.id===targetId);
  if(from&&to){
   const start=vesselPosition(from),end=vesselPosition(to);
   setTransfer({from:{x:start.x,y:start.y-11},to:{x:end.x,y:end.y-10}});
  }
  setNotice("Добавлено "+ml.toLocaleString("ru-RU")+" мл из бюретки");
 };
 const transferVessel=(sourceId:string,targetId:string)=>{
  const from=bench.vessels.find(v=>v.id===sourceId);
  if(from?.kind==="burette"&&labTitrationTargets(bench,sourceId).some(v=>v.id===targetId)){
   drip(sourceId,targetId,1);return;
  }
  const id=String(Date.now())+"-"+Math.random().toString(36).slice(2);
  const next=startLabPour(bench,sourceId,targetId,id);
  if(next===bench){
   setNotice(bench.pouring&&bench.pouring.step<LAB_POUR_STEPS?
    "Сначала завершите текущее переливание":
    "Нельзя перелить: проверьте содержимое и вместимость второго сосуда");
   return;
  }
  localPourRef.current=id;lastPourStepRef.current=-1;
  onChange?.(next);
  setLocalPourId(null);
  setNotice("Переливание: по 5% каждые 0,15 секунды");
 };
 const beginContact=(sourceId:string,targetId:string)=>{
  const old=contactRef.current;
  if(old?.sourceId===sourceId&&old.targetId===targetId)return;
  endContact();
  contactRef.current={sourceId,targetId,activated:false};
  setContactCountdown(targetId);
  const source=benchRef.current.vessels.find(v=>v.id===sourceId);
  const target=benchRef.current.vessels.find(v=>v.id===targetId);
  if(!source||!target)return;
  const perform=()=>{
   const c=contactRef.current;
   if(!c||c.sourceId!==sourceId||c.targetId!==targetId||c.activated)return;
   const latest=benchRef.current;
   const from=latest.vessels.find(v=>v.id===sourceId);
   const to=latest.vessels.find(v=>v.id===targetId);
   if(!from||!to)return;
   let next=latest;
   if(from.kind==="pipette"||to.kind==="pipette"){
    const pipette=from.kind==="pipette"?from:to;
    const drawing=pipette.reagents.length===0;
    const donor=drawing?(pipette===from?to:from):pipette;
    const receiver=drawing?pipette:(pipette===from?to:from);
    const requested=pipette.pipetteTargetMl??5;
    next=transferLabMeasuredLiquid(latest,donor.id,receiver.id,requested);
    setNotice(next===latest?
     "Недостаточно раствора или места для "+requested.toLocaleString("ru-RU")+" мл":
     "Пипетка "+(drawing?"набрала ":"выдала ")+requested.toLocaleString("ru-RU")+" мл");
   }else if(from.reagents.length){
    const id="pour-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,7);
    next=startLabPour(latest,sourceId,targetId,id);
    if(next!==latest){localPourRef.current=id;contactPourRef.current=id;
     lastPourStepRef.current=-1;setNotice("Удерживайте сосуд, чтобы переливать")}
    else setNotice("Переливание невозможно: проверьте содержимое и объём");
   }
   if(next!==latest){benchRef.current=next;changeRef.current?.(next)}
   contactRef.current={...c,activated:true};setContactCountdown(null);
  };
  // Collect a measured sample only after one uninterrupted second of contact.
  // Moving to another vessel or releasing cancels the pending aspiration.
  const pipette=source.kind==="pipette"?source:target.kind==="pipette"?target:null;
  const sampling=!!pipette&&pipette.reagents.length===0;
  contactTimer.current=setTimeout(perform,sampling?1000:120);
 };
 const clean=(id:string)=>{
  const next=emptyLabVessel(bench,id);
  if(next===bench)return;
  onChange?.(next);setSinkFlow(true);setNotice("Содержимое слито в виртуальную раковину");
 };
 const returnGlass=(id:string)=>{
  const next=removeLabVessel(bench,id);
  if(next===bench){setNotice("Сначала слейте содержимое в раковину");return}
  onChange?.(next);setNotice("Чистая посуда возвращена в шкаф");
 };
 const take=(kind:LabGlassware,p?:{x:number;y:number})=>{
  if(!p||!isLabWorktop(p)){setNotice("Нажмите на свободное место стола");return}
  const next=addLabVessel(bench,kind,labLogicalPoint(p));
  if(next===bench){setNotice("На столе не больше шести сосудов");return}
  onChange?.(next);setPendingGlassware(null);
  setNotice(names[kind]+" поставлен в выбранное место");setCabinet(null);
 };
 const chooseGlassware=(kind:LabGlassware)=>{
  if(bench.vessels.length>=6){setNotice("На столе не больше шести сосудов");return}
  setPendingGlassware(kind);setCabinet(null);
  setNotice("Нажмите на свободное место стола, чтобы поставить: "+names[kind]);
 };
 useEffect(()=>{
  if(!pendingGlassware)return;
  const escape=(event:KeyboardEvent)=>{
   if(event.key!=="Escape")return;
   event.preventDefault();event.stopPropagation();setPendingGlassware(null);
  };
  document.addEventListener("keydown",escape,true);
  return()=>document.removeEventListener("keydown",escape,true);
 },[pendingGlassware]);
 const down=(event:PointerEvent<HTMLButtonElement>,v:LabVessel)=>{
  if(!editable||event.button!==0||!event.isPrimary)return;
  event.preventDefault();event.stopPropagation();const p=point(event);if(!p)return;
  const origin=labLogicalPoint(vesselPosition(v));
  gesture.current={id:v.id,startX:p.x,startY:p.y,x:origin.x,y:origin.y,dragged:false};
  event.currentTarget.setPointerCapture(event.pointerId);
 };
 const move=(event:PointerEvent<HTMLButtonElement>)=>{
  const g=gesture.current;if(!g||!editable)return;
  event.stopPropagation();const p=point(event),rect=host.current?.getBoundingClientRect();if(!p||!rect)return;
  if(Math.hypot((p.x-g.startX)*rect.width/100,(p.y-g.startY)*rect.height/100)>8)g.dragged=true;
  if(g.dragged){
   const furniture=inSink(p)?"sink":inGlassware(p)?"glassware":null;
   const nearestFilter=physicalDevices.find(d=>d.kind==="filter"&&
    Math.hypot((d.x-p.x)*rect.width/100,(d.y-p.y)*rect.height/100)<95);
   setDropFurniture(furniture);
   const pouring=furniture||nearestFilter?null:targetAt(g.id,p);
   setDropTarget(pouring);
   if(pouring)beginContact(g.id,pouring);
   else if(contactRef.current)endContact();
   const vessel=bench.vessels.find(v=>v.id===g.id);
   const nearby=!furniture&&!pouring&&vessel?physicalDevices.map(d=>({
    d,dist:Math.hypot((d.x-p.x)*rect.width/100,(d.y-p.y)*rect.height/100)
   })).filter(v=>v.dist<105&&canMountLabVessel(v.d.kind,vessel.kind))
    .sort((a,b)=>a.dist-b.dist)[0]:undefined;
   setDropDeviceId(nearestFilter?.id??nearby?.d.id??null);
   const a=labDisplayPoint({x:g.x,y:g.y},bench.vessels.length>3);
   setPreview({id:g.id,x:Math.max(1,Math.min(99,a.x+p.x-g.startX)),
    y:Math.max(1,Math.min(99,a.y+p.y-g.startY))});
  }
 };
 const finish=(event:PointerEvent<HTMLButtonElement>)=>{
  const g=gesture.current;if(!g)return;gesture.current=null;
  const contacted=contactRef.current?.activated===true;
  endContact();
  event.preventDefault();event.stopPropagation();
  if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
  const p=point(event);
  if(g.dragged&&p){
   if(inSink(p))clean(g.id);
   else if(inGlassware(p))returnGlass(g.id);
   else{
    const rect=host.current?.getBoundingClientRect();
    const filter=rect?physicalDevices.filter(d=>d.kind==="filter").map(d=>({
     d,distance:Math.hypot((d.x-p.x)*rect.width/100,(d.y-p.y)*rect.height/100)
    })).sort((a,b)=>a.distance-b.distance)[0]:undefined;
    if(filter&&filter.distance<95){
     const next=pourLabIntoFilter(bench,g.id,filter.d.id);
     if(next!==bench){
      const from=bench.vessels.find(v=>v.id===g.id);
      if(from)setTransfer({from:vesselPosition(from),to:{x:filter.d.x,y:filter.d.y-3}});
      onChange?.(next);
      setNotice("Осадок задержан фильтром, фильтрат в чистом сосуде");
     }else setNotice("Нужен завершённый осадок и свободное место для фильтрата");
     setPreview(null);setDropDeviceId(null);setDropTarget(null);return;
    }
    const target=targetAt(g.id,p);
    if(contacted){setLocalPourId(null);}
    else if(target){setNotice("Поднесите сосуд ближе к приёмнику");}
    else{
     const rect=host.current?.getBoundingClientRect();
     const vessel=bench.vessels.find(v=>v.id===g.id);
     const nearby=rect?physicalDevices.map(d=>({
      device:d,distance:Math.hypot((d.x-p.x)*rect.width/100,(d.y-p.y)*rect.height/100)
     })).filter(v=>v.distance<105).sort((a,b)=>a.distance-b.distance):[];
     // When tools overlap, prefer the closest physically compatible surface.
     // Another vessel can stand directly under the occupied upper clamp.
     const beneath=rect&&vessel?physicalDevices.filter(d=>d.kind==="tripod"&&
      d.linkedVesselId!==g.id).map(d=>{
       const base=labStandBaseVesselPoint(d,vessel,stageSize.width,stageSize.height,
        bench.vessels.length>3);
       return {d,distance:Math.hypot((p.x-base.x)*rect.width/100,
        (p.y-base.y)*rect.height/100)};
      }).sort((a,b)=>a.distance-b.distance)[0]:undefined;
     if(beneath&&beneath.distance<65){
      onChange?.(placeLabVesselOnStandBase(bench,g.id,beneath.d.id));
      setNotice("Сосуд установлен на основание штатива");
     }else{
     const appliance=nearby.find(v=>vessel&&canMountLabVessel(v.device.kind,vessel.kind))
      ??nearby[0];
     if(appliance&&appliance.distance<105&&vessel&&
      canMountLabVessel(appliance.device.kind,vessel.kind)){
      const applied=applyPlacedLabDevice(bench,appliance.device.id,g.id,"clamp");
      onChange?.(applied);
      setNotice("Сосуд установлен на "+(labDevices.find(d=>d.id===appliance.device.kind)?.name??"прибор"));
     }else if(appliance&&appliance.distance<105&&vessel){
      setNotice("Эта посуда не подходит для "+(labDevices.find(d=>d.id===appliance.device.kind)?.name??"прибора"));
     }else{
      const a=labDisplayPoint({x:g.x,y:g.y},bench.vessels.length>3);
      const next=labLogicalPoint({x:a.x+p.x-g.startX,y:a.y+p.y-g.startY});
      onChange?.(positionLabVessel(bench,g.id,next.x,next.y));
     }
     }
    }
   }
  }else if(!g.dragged&&effectivePouringId&&effectivePouringId!==g.id)transferVessel(effectivePouringId,g.id);
  else if(!g.dragged){setActiveDeviceId(null);onSelect?.(g.id);setVesselMenuId(current=>current===g.id?null:g.id)}
  setPreview(null);setDropTarget(null);setDropFurniture(null);setDropDeviceId(null);
 };
 const beginShelf=(event:PointerEvent<HTMLButtonElement>,kind:LabGlassware)=>{
  if(!editable||event.button!==0||!event.isPrimary)return;
  event.stopPropagation();event.preventDefault();
  shelfGesture.current={kind,startX:event.clientX,startY:event.clientY,dragged:false};
  event.currentTarget.setPointerCapture(event.pointerId);
 };
 const moveShelf=(event:PointerEvent<HTMLButtonElement>)=>{
  const g=shelfGesture.current;if(!g)return;
  event.stopPropagation();const p=point(event);if(!p)return;
  if(Math.hypot(event.clientX-g.startX,event.clientY-g.startY)>7)g.dragged=true;
  if(g.dragged)setShelfGhost({kind:g.kind,x:p.x,y:p.y});
 };
 const finishShelf=(event:PointerEvent<HTMLButtonElement>)=>{
  const g=shelfGesture.current;if(!g)return;shelfGesture.current=null;
  event.stopPropagation();event.preventDefault();
  if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
  const p=point(event);if(g.dragged&&p&&isLabWorktop(p))
   take(g.kind,p);
  else if(!g.dragged)chooseGlassware(g.kind);
  setShelfGhost(null);
 };
 const takeDevice=(kind:LabDevice,p?:{x:number;y:number})=>{
  const updated=addPlacedLabDevice(bench,kind,p&&isLabWorktop(p)?p:undefined);
  if(updated===bench){setNotice("На столе не больше десяти приборов");return}
  onChange?.(updated);
  const newest=placedLabDevices(updated).at(-1);
  setActiveDeviceId(newest?.id??null);
  setNotice("Прибор установлен: "+(labDevices.find(d=>d.id===kind)?.name??kind));
  setCabinet(null);
 };
 const beginDeviceShelf=(e:PointerEvent<HTMLButtonElement>,kind:LabDevice)=>{
  if(!editable||e.button!==0||!e.isPrimary)return;
  e.preventDefault();e.stopPropagation();
  deviceShelfGesture.current={kind,startX:e.clientX,startY:e.clientY,dragged:false};
  e.currentTarget.setPointerCapture(e.pointerId);
 };
 const moveDeviceShelf=(e:PointerEvent<HTMLButtonElement>)=>{
  const g=deviceShelfGesture.current;if(!g)return;
  e.stopPropagation();
  const p=point(e);if(!p)return;
  if(Math.hypot(e.clientX-g.startX,e.clientY-g.startY)>7)g.dragged=true;
  if(g.dragged)setDeviceShelfGhost({kind:g.kind,...p});
 };
 const finishDeviceShelf=(e:PointerEvent<HTMLButtonElement>)=>{
  const g=deviceShelfGesture.current;if(!g)return;
  deviceShelfGesture.current=null;e.preventDefault();e.stopPropagation();
  if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);
  const p=point(e);
  if(!g.dragged)takeDevice(g.kind);
  else if(p&&isLabWorktop(p))takeDevice(g.kind,p);
  else setNotice("Прибор можно поставить только на рабочую поверхность");
  setDeviceShelfGhost(null);
 };
 const nearestVessel=(p:{x:number;y:number},kind:LabDevice)=>{
  const bounds=host.current?.getBoundingClientRect();
  if(!bounds)return null;
  const candidates=bench.vessels.filter(v=>canMountLabVessel(kind,v.kind)).map(v=>{
   const q=vesselPosition(v);
   return {id:v.id,distance:Math.hypot((q.x-p.x)*bounds.width/100,(q.y-p.y)*bounds.height/100)};
  }).sort((a,b)=>a.distance-b.distance);
  return candidates[0]&&candidates[0].distance<Math.min(150,Math.max(65,bounds.width*.10))?
   candidates[0].id:null;
 };
 const downDevice=(e:PointerEvent<HTMLDivElement>,id:string,x:number,y:number)=>{
  if(!editable||e.button!==0||!e.isPrimary)return;
  e.preventDefault();e.stopPropagation();
  const p=point(e);if(!p)return;
  deviceGesture.current={id,startX:p.x,startY:p.y,x,y,dragged:false};
  e.currentTarget.setPointerCapture(e.pointerId);
 };
 const moveDevice=(e:PointerEvent<HTMLDivElement>)=>{
  const g=deviceGesture.current;if(!g)return;
  e.stopPropagation();const p=point(e),rect=host.current?.getBoundingClientRect();
  if(!p||!rect)return;
  if(Math.hypot((p.x-g.startX)*rect.width/100,(p.y-g.startY)*rect.height/100)>8)g.dragged=true;
  if(g.dragged){
   setDevicePreview({id:g.id,x:Math.max(1,Math.min(99,g.x+p.x-g.startX)),
    y:Math.max(1,Math.min(99,g.y+p.y-g.startY))});
   setDropDeviceShelf(p.x>=82&&p.y>=8&&p.y<=42);
  }
 };
 const finishDevice=(e:PointerEvent<HTMLDivElement>)=>{
  const g=deviceGesture.current;if(!g)return;
  deviceGesture.current=null;e.preventDefault();e.stopPropagation();
  if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);
  const p=point(e);
  if(g.dragged&&p){
   if(p.y>=8&&p.y<=42&&p.x>=82){
    onChange?.(returnPlacedLabDevice(bench,g.id));
    setActiveDeviceId(null);setNotice("Прибор возвращён в шкаф");
   }else{
    const moved=movePlacedLabDevice(bench,g.id,g.x+p.x-g.startX,g.y+p.y-g.startY);
    const device=physicalDevices.find(d=>d.id===g.id);
    // A heater or mixer on the tabletop beneath a stand must remain free:
    // otherwise old proximity binding teleports it onto the upper clamp.
    const underneath=physicalDevices.some(d=>d.kind==="tripod"&&d.active&&
     d.linkedVesselId&&Math.abs((g.x+p.x-g.startX)-d.x-3.5)<8&&
     g.y+p.y-g.startY>d.y+1&&g.y+p.y-g.startY<d.y+18);
    const vesselId=device&&!underneath?nearestVessel(p,device.kind):null;
    const final=vesselId?applyPlacedLabDevice(moved,g.id,vesselId):moved;
    onChange?.(final);
    setActiveDeviceId(g.id);
    setNotice(vesselId&&final!==moved?"Прибор установлен рядом с сосудом":"Прибор перемещён по столу");
   }
  }else{
   setActiveDeviceId(g.id);
   if(physicalDevices.some(d=>d.id===g.id&&d.kind==="filter")){
    if(effectivePouringId){
     const next=pourLabIntoFilter(bench,effectivePouringId,g.id);
     if(next!==bench){
      const source=bench.vessels.find(v=>v.id===effectivePouringId);
      const filter=physicalDevices.find(d=>d.id===g.id);
      if(source&&filter)setTransfer({from:vesselPosition(source),to:{x:filter.x,y:filter.y-3}});
      onChange?.(next);setLocalPourId(null);
      setNotice("Фильтрат прошёл через мембрану, осадок остался на фильтре");
     }else setNotice("Нужна завершённая реакция с осадком и свободный приёмник");
    }else setNotice("Перетащите сосуд с готовым осадком непосредственно на фильтр");
   }
  }
  setDevicePreview(null);setDropDeviceShelf(false);
 };
 useEffect(()=>{
  if(selected?.kind==="pipette")setMeasuredMl(String(selected.pipetteTargetMl??5));
 },[selected?.id,selected?.pipetteTargetMl]);
 const quickReagents=labQuickReagents(bench);
 const addQuick=(id:string,targetId?:string)=>{
  if(!editable)return;
  const preset=quickReagents.find(v=>v.id===id);
  if(!preset)return;
  const target=bench.vessels.find(v=>v.id===(targetId??selected?.id));
  if(!target){setNotice("Сначала возьмите посуду из шкафа");return}
  const next=putLabReagent(bench,target.id,id,preset.dose);
  if(next===bench){setNotice("Не удалось добавить реагент: проверьте сосуд и количество");return}
  onChange?.(next);
  setDoseEffect({...vesselPosition(target),
   color:reagentAppearance(id,preset.dose.unit==="g"?"dry":"aqueous").color,
   solid:preset.dose.unit==="g"});
  setNotice(id+" · "+formatLabDose(preset.dose)+" добавлено в "+names[target.kind]);
 };
 const dispense=()=>{
  if(!editable||!chosen)return;
  if(!selected){setNotice("Возьмите чистую посуду из шкафа");return}
  const value=Number(amount.replace(",","."));
  if(reagent&&!labReagentForms(reagent).includes(unit)){setNotice("Эта форма реактива недоступна");return}
  if(!Number.isFinite(value)||value<=0||value>10000){setNotice("Укажите количество больше нуля и не более 10000");return}
  const isQuantifiedSolution=unit==="ml"&&!!reagent&&
   ["кислота","основание","соль","пероксид"].includes(reagent.kind);
  const concentration=Number(molarity.replace(",","."));
  if(isQuantifiedSolution&&(!Number.isFinite(concentration)||
    concentration<.001||concentration>2)){
    setNotice("Укажите концентрацию от 0,001 до 2 моль/л");return;
  }
  const dose:LabDose={value:Math.round(value*100)/100,unit,
   ...(isQuantifiedSolution?{concentrationM:concentration}:{})};
  const updated=putLabReagent(bench,selected.id,chosen,dose);
  if(updated===bench){setNotice("Реагент уже добавлен или посуда заполнена");return}
  onChange?.(updated);
  setDoseEffect({...labDisplayPoint(selected,bench.vessels.length>3),
   color:reagentAppearance(chosen,unit==="g"?"dry":"aqueous").color,solid:unit==="g"});
  setNotice(chosen+" · "+dose.value+" "+(unit==="ml"?"мл":"г")+" добавлено в "+names[selected.kind]);
  setCabinet(null);setChosen(null);
 };
 const prepareExample=(row:(typeof reviewedReactionCases)[number])=>{
  const vessels=row.reactants.map((reagent,i)=>({
   id:"v"+(i+1),kind:(i===0?"beaker":"tube") as LabGlassware,
   x:row.reactants.length===3?23+i*27:i===0?31:72,y:69,reagents:[reagent],
   environment:(row.environment==="aqueous"?"aqueous":"dry") as "aqueous"|"dry",observed:false
  }));
  if(!vessels.length)return;
  // Reused IDs in a new example must never reconnect old powered equipment.
  onChange?.({...bench,vessels,selectedId:vessels[0].id,
   placedDevices:physicalDevices.map(d=>({...d,active:false,
    linkedVesselId:undefined,shelfVesselId:undefined})),
   stirringVesselId:undefined,titrationPair:undefined,titration:undefined,
   instrumentTarget:undefined,event:bench.event+1});
  setNotice(row.environment==="ignited"?"Смешайте вещества и запустите виртуальное воспламенение":
   row.environment==="heated"?"Смешайте и нагрейте посуду на приборе":
   "Опыт подготовлен: соедините вещества, чтобы наблюдать реакцию");
  setCabinet(null);
 };
 const openCabinet=(next:"reagents"|"glassware"|"equipment")=>{
  if(!editable)return;setCabinet(next);setNotice("");setChosen(null);
  setShowAllGlassware(false);setShowAllDevices(false);
 };
 return <div className={"lektrus-lab-bench"+(!editable?" is-readonly":"")+
  (pendingGlassware?" is-placing-glassware":"")+
  (!settings.animateEffects?" lab-reduced-animation":"")} ref={host}
  aria-label="Интерактивный химический стол с шкафами и раковиной"
  onPointerDown={e=>{
   if(!editable||e.button!==0||!e.isPrimary)return;
   // Apparatus and cabinetry keep their own gestures; only bare table
   // pixels dismiss vessel selection.
   if((e.target as HTMLElement).closest("[data-board-interactive]"))return;
   const p=point(e);
   if(pendingGlassware){
    if(!p||!isLabWorktop(p))return;
    e.preventDefault();e.stopPropagation();take(pendingGlassware,p);
    return;
   }
   if(!bench.selectedId&&!vesselMenuId)return;
   e.stopPropagation();setVesselMenuId(null);setActiveDeviceId(null);
   onSelect?.("");
  }}>
  <div className="lektrus-lab-bench-backdrop" aria-hidden="true">
   <div className="lektrus-lab-back-shelf"/>
   <div className="lektrus-lab-counter"/>
   <div className="lektrus-lab-counter-front"/>
   <div className="lektrus-lab-worktop-zone"/>
  </div>
  <div className="lektrus-lab-scene-header">
   <span className="lektrus-lab-scene-brand">LEKTRUS <span>LAB</span></span>
   <strong>Химическая лаборатория</strong>
   <label className="lektrus-lab-mode-picker" data-board-interactive="true"
    onPointerDown={e=>e.stopPropagation()} onPointerUp={e=>e.stopPropagation()}>
    <span>Режим</span>
    <select value={labMode(bench)} aria-label="Режим химической лаборатории"
     disabled={!editable} title={labModeInfo(bench).description}
     onChange={e=>{
      onChange?.(setLabMode(bench,e.target.value as typeof LAB_MODES[number]["id"]));
      setPendingGlassware(null);setShowAllGlassware(false);setShowAllDevices(false);
      setNotice("Режим: "+(LAB_MODES.find(m=>m.id===e.target.value)?.name??"Лаборатория"));
     }}>
     {LAB_MODES.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}
    </select>
   </label>
   <button type="button" className="lektrus-lab-prepare-mode"
    data-board-interactive="true" disabled={!editable}
    title="Добавить рекомендуемый набор без перемещения существующей посуды"
    aria-label="Подготовить комплект для выбранного режима"
    onPointerDown={e=>e.stopPropagation()}
    onClick={e=>{
     e.stopPropagation();
     const prepared=prepareLabModeSetup(bench);
     if(prepared!==bench){onChange?.(prepared);setNotice("Комплект подготовлен. Расставленная посуда сохранена.")}
     else setNotice("Нужная посуда и приборы уже на столе");
     setPendingGlassware(null);
    }}>
    <span aria-hidden="true">⚗</span><span className="lektrus-lab-prepare-label">Комплект</span>
   </button>
   <span className="lektrus-lab-scene-stats">{bench.vessels.length} из 6 сосудов <b>·</b> {physicalDevices.length} приборов</span>
   <div className="lektrus-lab-header-tools" data-board-interactive="true"
    onPointerDown={e=>e.stopPropagation()} onPointerUp={e=>e.stopPropagation()}>
    <button type="button" className="lektrus-lab-temperature-toggle"
     aria-label={settings.showTemperatures?"Скрыть температуры посуды":"Показать температуры посуды"}
     aria-pressed={settings.showTemperatures}
     title={settings.showTemperatures?"Скрыть температуры на посуде":"Показать температуры на посуде"}
     disabled={!editable} onClick={e=>{e.stopPropagation();
      onChange?.(setLabBenchSettings(bench,{showTemperatures:!settings.showTemperatures}))}}>
     <span aria-hidden="true">°C</span>
     <span>{settings.showTemperatures?"Температуры":"Показать °C"}</span>
    </button>
    {editable&&(bench.vessels.length>0||physicalDevices.length>0)&&
     <button type="button" className={"lektrus-lab-clear-worktop"+(confirmClear?" is-confirm":"")}
      aria-label={confirmClear?"Подтвердить очистку стола":"Очистить стол"}
      title="Убрать всю посуду и приборы со стола, сохранить быстрый доступ"
      onClick={e=>{e.stopPropagation();
       if(!confirmClear){setConfirmClear(true);return}
       onChange?.(clearLabTable(bench));setConfirmClear(false);
       setVesselMenuId(null);setActiveDeviceId(null);
       setNotice("Рабочая поверхность очищена. Быстрые реактивы сохранены.")}}>
      {confirmClear?"Подтвердить очистку":"Очистить стол"}
     </button>}
    {confirmClear&&<button type="button" className="lektrus-lab-cancel-clear"
     aria-label="Отменить очистку" onClick={e=>{e.stopPropagation();setConfirmClear(false)}}>×</button>}
   </div>
   {editable&&bench.vessels.length>1&&<button type="button" className="lektrus-lab-arrange-btn"
    aria-label="Автоматически расставить посуду без наложений"
    title="Упорядочить посуду" data-board-interactive="true"
    onPointerDown={e=>e.stopPropagation()} onPointerUp={e=>e.stopPropagation()}
    onClick={e=>{e.stopPropagation();onChange?.(arrangeLabVessels(bench))}}>
    <span aria-hidden="true">▦</span> Расставить
   </button>}
  </div>
  {/* The writing is physically on the same large wall board behind
        the glassware, never in a floating reaction card. */}
  <div className="lektrus-lab-chalkboard" aria-label="Доска на стене за лабораторным столом"
   aria-live="polite">
   <button type="button" className={"lektrus-lab-board-write-toggle"+(settings.showEquationBoard?" is-active":"")}
    data-board-interactive="true" disabled={!editable}
    aria-label={settings.showEquationBoard?"Скрыть уравнения на доске":"Показать уравнения на доске"}
    aria-pressed={settings.showEquationBoard}
    title="Показывать уравнения реакций на задней доске"
    onPointerDown={e=>e.stopPropagation()}
    onClick={e=>{e.stopPropagation();onChange?.(setLabBenchSettings(bench,{showEquationBoard:!settings.showEquationBoard}))}}>
    <span aria-hidden="true">{settings.showEquationBoard?"✎":"✕"}</span><span>{settings.showEquationBoard?"Пишем":"Не пишем"}</span>
   </button>

   <button type="button" className="lektrus-lab-chalk-wipe"
    data-board-interactive="true" disabled={!editable||!(bench.reactionLog?.length)}
    title="Стереть записанные уравнения с доски" aria-label="Стереть с доски"
    onPointerDown={e=>e.stopPropagation()}
    onClick={e=>{e.stopPropagation();onChange?.(wipeLabChalkboard(bench))}}>
    <svg viewBox="0 0 32 28" width="24" height="21" aria-hidden="true">
     <path d="M5 12L10 4H25L29 12L24 24H10Z" fill="#e5cda8"
      stroke="#956f4e" strokeWidth="1.8"/>
     <path d="M6 13L28 13L24 24H10Z" fill="#85b7ac"/>
     <path d="M9 17H26" stroke="#d8f5e7" strokeWidth="1.5"/>
    </svg>
   </button>
   {settings.showEquationBoard&&<div className="lektrus-lab-chalk-writing">
    <small>УРАВНЕНИЯ РЕАКЦИЙ</small>
    {(bench.reactionLog??[]).length>0?
     <ol className="lektrus-lab-equation-history">
      {bench.reactionLog!.map((equation,i)=><li key={i}>{equation}</li>)}
     </ol>:
     <span className="lektrus-lab-chalk-empty">Проведите опыт. Уравнения останутся здесь до стирания тряпкой.</span>}
   </div>}
  </div>
  <div className="lektrus-lab-reagent-furniture" data-board-interactive="true"
   aria-label="Быстрые реактивы" onPointerDown={e=>e.stopPropagation()}
   onPointerUp={e=>e.stopPropagation()}>
   <button type="button" className="lektrus-lab-furniture-title lektrus-lab-reagent-shelf-header"
    disabled={!editable} onClick={e=>{e.stopPropagation();openCabinet("reagents")}}
    title="Открыть шкаф реактивов">РЕАКТИВЫ</button>
   <div className="lektrus-lab-bottle-rack" role="group" aria-label="Реактивы быстрого доступа">
    {quickReagents.map(v=>{
     const item=substances.find(r=>r.id===v.id);
     const color=reagentAppearance(v.id,v.dose.unit==="g"?"dry":"aqueous").color;
     return <button type="button" key={v.id} draggable={editable}
      className={"lektrus-lab-quick-bottle"+(v.dose.unit==="g"?" is-solid":" is-solution")}
      disabled={!editable} title={(item?.name??v.id)+" · "+formatLabDose(v.dose)+
       (v.dose.concentrationM!==undefined?" · "+v.dose.concentrationM+" М":"")+
       " · добавить в выбранный сосуд или перетащить"}
      aria-label={"Добавить "+(item?.name??v.id)+" в выбранный сосуд"}
      onDragStart={e=>{e.stopPropagation();
       e.dataTransfer.setData("application/x-lektrus-reagent",v.id);
       e.dataTransfer.effectAllowed="copy"}}
      onPointerDown={e=>e.stopPropagation()}
      onClick={e=>{e.stopPropagation();addQuick(v.id)}}>
      <i style={{"--bottle-color":color} as React.CSSProperties}/>
      <strong>{item?.formula??v.id}</strong>
      <small>{v.dose.value}{v.dose.unit==="ml"?" мл":" г"}</small>
      <span className="lektrus-lab-quick-phase">{item?labReagentPhaseLabel(item,v.dose.unit):"Реактив"}</span>
     </button>;
    })}
    {editable&&quickReagents.length<MAX_QUICK_REAGENTS&&<button type="button"
     className="lektrus-lab-quick-bottle is-add"
     title="Добавить реактив быстрого доступа"
     aria-label="Редактировать быстрые реактивы"
     onClick={e=>{e.stopPropagation();openCabinet("reagents")}}>+</button>}
   </div>
   <span className="lektrus-lab-furniture-foot">Нажмите для добавления · перетащите на сосуд</span>
  </div>
  <div className={"lektrus-lab-glass-cupboard"+(dropFurniture==="glassware"?" is-dropzone":"")} data-board-interactive="true"
    onPointerDown={e=>e.stopPropagation()} onPointerUp={e=>e.stopPropagation()}>
   <button type="button" className="lektrus-lab-furniture-title lektrus-lab-shelf-header"
    disabled={!editable} aria-label="Открыть шкаф посуды"
    onClick={e=>{e.stopPropagation();openCabinet("glassware")}}>ПОСУДА</button>
   <div className="lektrus-lab-shelf-items">
    {glasswareForLabMode(bench).map(kind=><button type="button" key={kind.id} disabled={!editable}
      className="lektrus-lab-shelf-item" title={"Взять: "+kind.name}
      aria-label={"Взять из шкафа "+kind.name} onPointerDown={e=>beginShelf(e,kind.id)}
      onPointerMove={moveShelf} onPointerUp={finishShelf}
      onClick={e=>{if(e.detail===0)chooseGlassware(kind.id)}}
      onPointerCancel={e=>{e.stopPropagation();shelfGesture.current=null;setShelfGhost(null)}}>
      <LektrusLabGlasswareIcon kind={kind.id} size={32}/>
      <small>{kind.name}</small>
     </button>)}
   </div>
   <span className="lektrus-lab-furniture-foot">Выберите место на столе или перетащите</span>
  </div>
  <div className="lektrus-lab-indicator-cupboard" data-board-interactive="true"
   onPointerDown={e=>e.stopPropagation()} onPointerUp={e=>e.stopPropagation()}>
   <strong>ИНДИКАТОРЫ</strong>
   <div className="lektrus-lab-indicator-shelf" role="group"
    aria-label="Добавить индикатор в выбранный сосуд">
    {labIndicators.map((indicator,i)=><button key={indicator.id} type="button"
     title={indicator.name+" · "+indicator.note} disabled={!editable||!selected?.reagents.length}
     aria-pressed={selected?.indicator===indicator.id}
     className={selected?.indicator===indicator.id?"is-active":""}
     onClick={e=>{e.stopPropagation();
      if(selected)onChange?.(setLabIndicator(bench,selected.id,
       selected.indicator===indicator.id?undefined:indicator.id))}}>
     <i style={{"--indicator-tint":["#a28dd2","#d84c9c","#e4aa53","#64b992"][i]} as React.CSSProperties}/>
     <span>{indicator.name}</span>
    </button>)}
   </div>
  </div>
  <div  className={"lektrus-lab-device-cupboard"+(dropDeviceShelf?" is-dropzone":"")} data-board-interactive="true"
   onPointerDown={e=>e.stopPropagation()} onPointerUp={e=>e.stopPropagation()}>
   <button type="button" className="lektrus-lab-device-cupboard-title"
    disabled={!editable} onClick={e=>{e.stopPropagation();openCabinet("equipment")}}>
    ПРИБОРЫ <span>{physicalDevices.length}/10</span>
   </button>
   <div className="lektrus-lab-device-cupboard-shelf">
    {devicesForLabMode(bench).map(device=><button type="button" key={device.id}
     disabled={!editable} title={"Взять: "+device.name+" · нажмите или перетащите на стол"}
     aria-label={"Взять прибор: "+device.name}
     onPointerDown={e=>beginDeviceShelf(e,device.id)}
     onPointerMove={moveDeviceShelf} onPointerUp={finishDeviceShelf}
     onPointerCancel={e=>{e.stopPropagation();deviceShelfGesture.current=null;setDeviceShelfGhost(null)}}
     onClick={e=>{e.stopPropagation();if(e.detail===0)takeDevice(device.id)}}>
     <LektrusLabDeviceIcon kind={device.id} size={40}/>
     <small>{device.name}</small>
    </button>)}
   </div>
   <span className="lektrus-lab-furniture-foot">Нажмите или перетащите</span>
  </div>
  {physicalDevices.map((device,i)=>{
   const current=devicePreview?.id===device.id?devicePreview:device;
   const meta=labDevices.find(d=>d.id===device.kind);
   const focused=activeDeviceId===device.id;
   return <div key={device.id} data-board-interactive="true"
    className={"lektrus-lab-placed-device is-"+device.kind+
     (focused?" is-selected":"")+(device.powered?" is-running":"")+
     (device.active?" is-mounted":"")+
     (dropDeviceId===device.id?" is-drop-device":"")}
    style={{left:current.x+"%",top:current.y+"%",zIndex:focused?28:11+i}}>
    <div role="button" tabIndex={editable?0:-1} data-board-interactive="true"
     className="lektrus-lab-device-grip"
     aria-label={"Переместить "+(meta?.name??device.kind)}
     aria-pressed={focused}
     title={(meta?.name??device.kind)+": перетащить по столу"}
     onKeyDown={e=>{if(e.key==="Enter"){e.stopPropagation();setActiveDeviceId(device.id)}}}
     onPointerDown={e=>downDevice(e,device.id,device.x,device.y)}
     onPointerMove={e=>moveDevice(e)}
     onPointerUp={e=>finishDevice(e)}
     onPointerCancel={e=>{e.stopPropagation();deviceGesture.current=null;setDevicePreview(null);setDropDeviceShelf(false)}}
     onClick={e=>{e.stopPropagation();if(e.detail===0)setActiveDeviceId(device.id)}}>
     <LektrusLabDeviceIcon kind={device.kind} size={150}
      collectedResidue={device.collectedResidue}
      filtering={!!device.filterStartedAtMs&&Date.now()-device.filterStartedAtMs<2400}
      active={!!device.powered} editable={editable} controlsVisible={focused}
      temperatureVisible={settings.showTemperatures}
      temperatureC={device.temperatureC} targetTemperatureC={device.targetTemperatureC}
      standHeight={device.standHeight} heatLevel={device.heatLevel}
      />
      {device.kind==="filter"&&<span className="lektrus-lab-filter-residue"
       title={device.collectedResidue?"Осадок "+device.collectedResidue.formula:
        "Слейте сюда сосуд с осадком"}>
       {device.collectedResidue?<><i style={{background:device.collectedResidue.color}}/>
        <strong>{device.collectedResidue.formula}</strong>
        <small>{device.collectedResidue.massG!==undefined?
         device.collectedResidue.massG.toLocaleString("ru-RU")+" г":"осадок"}</small></>:
        "↓ Слить сюда"}
      </span>}
      {editable&&<div className={"lektrus-lab-device-face-controls is-"+device.kind}
       onPointerDown={e=>e.stopPropagation()}
       onPointerMove={e=>e.stopPropagation()}
       onPointerUp={e=>e.stopPropagation()}
       onClick={e=>e.stopPropagation()}>
       {device.kind==="filter"?<>{device.collectedResidue&&<button type="button"
        title="Очистить мембранный фильтр" aria-label="Очистить мембранный фильтр"
        onClick={()=>onChange?.({...bench,placedDevices:physicalDevices.map(d=>d.id===device.id?
         {...d,collectedResidue:undefined}:d),event:bench.event+1})}>×</button>}</>:
        device.kind!=="tripod"?<>
        {device.kind==="burner"?
         <button type="button" className="lektrus-lab-burner-valve"
          aria-pressed={!!device.powered}
          aria-label={device.powered?"Перекрыть газ горелки":"Открыть газ и зажечь горелку"}
          title={device.powered?"Закрыть газ":"Повернуть кран, зажечь горелку"}
          onClick={()=>onChange?.(setPlacedDevicePower({...bench,simulationAtMs:Date.now()},
           device.id,!device.powered))}>
          <span className="lektrus-lab-burner-valve-lever" aria-hidden="true"/>
         </button>:
         <button type="button" className="lektrus-lab-device-power"
          aria-pressed={!!device.powered}
          aria-label={(device.powered?"Выключить ":"Включить ")+(meta?.name??device.kind)}
          title={(device.powered?"Выключить ":"Включить ")+(meta?.name??device.kind)}
          onClick={()=>onChange?.(setPlacedDevicePower({...bench,simulationAtMs:Date.now()},
           device.id,!device.powered))}>⏻</button>}
        {device.kind==="hotplate"&&<LabTemperatureInput
         temperature={device.targetTemperatureC??150}
         onSet={value=>onChange?.(setLabHotplateTemperature(bench,device.id,value))}/>}
        {device.kind==="burner"&&focused&&<button type="button"
         className="lektrus-lab-device-level" title="Изменить мощность горелки"
         aria-label="Мощность горелки"
         onClick={()=>onChange?.(setPlacedDeviceLevel(bench,device.id,
          ((device.heatLevel??2)%3+1) as 1|2|3))}>
         {["Ⅰ","Ⅱ","Ⅲ"][(device.heatLevel??2)-1]}</button>}
       </>:<>
        <button type="button" className="lektrus-lab-stand-raise" aria-label="Поднять зажим штатива"
         disabled={(device.standHeight??.5)>=1}
         onClick={()=>onChange?.(setLabStandHeight(bench,device.id,
          Math.min(1,Math.round(((device.standHeight??.5)+.1)*10)/10)))}>+</button>
        <button type="button" className="lektrus-lab-stand-lower" aria-label="Опустить зажим штатива"
         disabled={(device.standHeight??.5)<=0}
         onClick={()=>onChange?.(setLabStandHeight(bench,device.id,
          Math.max(0,Math.round(((device.standHeight??.5)-.1)*10)/10)))}>−</button>
       </>}
      </div>}
    </div>
   </div>;
  })}
  {/* The single forward jaw is drawn above the glass while the rod and
      rear arm remain behind it. Both share the exact SVG clamp height. */}
  {physicalDevices.filter(d=>d.kind==="tripod"&&d.active&&
   bench.vessels.some(v=>v.id===d.linkedVesselId)).map(d=>{
   const p=devicePreview?.id===d.id?{...d,...devicePreview}:d;
   const y=labStandClampSvgY(p.standHeight);
   return <svg key={d.id+"-clamp"} className="lektrus-lab-retort-jaws"
    viewBox="0 0 110 108" preserveAspectRatio="none"
    aria-hidden="true" style={{left:p.x+"%",top:p.y+"%"}}>
    <g transform={`translate(0 ${y-40})`}>
     <path d="M77 40Q82 34 88 36M77 40Q82 46 88 44"
      stroke="#4b796e" strokeWidth="2.6" strokeLinecap="round" fill="none"/>
     <path d="M80 38Q84 36 87 37" stroke="#d2ede1" strokeWidth="1" fill="none"/>
    </g>
   </svg>;
  })}
  {deviceShelfGhost&&<div className="lektrus-lab-device-shelf-ghost"
   style={{left:deviceShelfGhost.x+"%",top:deviceShelfGhost.y+"%"}} aria-hidden="true">
   <LektrusLabDeviceIcon kind={deviceShelfGhost.kind} size={58}/>
  </div>}
  {editable&&vesselMenuId===selectedBurette?.id&&selectedBurette&&<div className="lektrus-lab-titration-on-table is-burette-valve"
   style={{"--lab-menu-x":Math.min(67,Math.max(12,vesselPosition(selectedBurette).x))+"%",
    "--lab-menu-y":Math.max(42,vesselPosition(selectedBurette).y-20)+"%"} as React.CSSProperties}
   data-board-interactive="true" onPointerDown={e=>e.stopPropagation()}
   onPointerUp={e=>e.stopPropagation()}>
   <strong>Бюретка <span className={selectedBurette.buretteOpen?"is-open":""}>
    {selectedBurette.buretteOpen?"● Кран открыт":"○ Кран закрыт"}</span></strong>
   <label>Приёмник
    {mountedBurette?<span className="lektrus-lab-titration-receiver">
     {belowBurette?names[belowBurette.kind]+" · "+belowBurette.id:
      "Поставьте колбу на основание штатива"}</span>:
    <select aria-label="Сосуд под бюреткой" value={chosenValveTarget??""}
     onChange={e=>{setTitrationTarget(e.target.value);
      onChange?.(setLabBuretteValve(bench,selectedBurette.id,false,
       e.target.value,selectedBurette.buretteRateMlS))}}>
     {!buretteTargets.length&&<option value="">Нет подходящего сосуда</option>}
     {buretteTargets.map(v=><option key={v.id} value={v.id}>
      {names[v.kind]} · {v.id}
     </option>)}
    </select>}
   </label>
   <div className="lektrus-lab-burette-rate" role="group"
    aria-label="Скорость титрования">
    <span className="lektrus-lab-burette-rate-label">Скорость</span>
    <div className="lektrus-lab-burette-rate-buttons">
     {LAB_DRIP_RATES.map(rate=><button key={rate} type="button"
      className={(selectedBurette.buretteRateMlS??.2)===rate?"is-active":""}
      aria-pressed={(selectedBurette.buretteRateMlS??.2)===rate}
      title={rate.toLocaleString("ru-RU")+" мл/с"}
      onClick={e=>{e.stopPropagation();onChange?.(setLabBuretteValve(
       bench,selectedBurette.id,!!selectedBurette.buretteOpen,chosenValveTarget,rate))}}>
      <strong>{rate===.05?"Медленно":rate===.2?"Средне":"Быстро"}</strong>
      <small>{rate.toLocaleString("ru-RU")} мл/с</small>
     </button>)}
    </div>
   </div>
   <button type="button" className={selectedBurette.buretteOpen?"is-open":""}
    disabled={!selectedBurette.reagents.length||!chosenValveTarget}
    onClick={e=>{e.stopPropagation();
     const next=setLabBuretteValve({...bench,simulationAtMs:Date.now()},selectedBurette.id,
      !selectedBurette.buretteOpen,chosenValveTarget,selectedBurette.buretteRateMlS);
     onChange?.(next);
     setNotice(selectedBurette.buretteOpen?"Кран бюретки закрыт":"Кран бюретки открыт");
    }}>{selectedBurette.buretteOpen?"Закрыть кран":"Открыть кран"}</button>
   {bench.titration&&bench.titrationPair?.sourceId===selectedBurette.id&&
    <span className="lektrus-lab-ph-readout">pH {titrationReading(bench.titration).pH} ·
     {bench.titration.addedMl.toLocaleString("ru-RU")} мл</span>}
  </div>}
  <div data-board-interactive="true"
   className={"lektrus-lab-sink"+(dropFurniture==="sink"?" is-dropzone":"")+
     (sinkFlow?" is-flowing":"")}
   title="Перетащите сюда один сосуд, чтобы слить только его содержимое"
   aria-label="Раковина: слив содержимого только перетаскиванием посуды">
   <svg className="lektrus-lab-sink-art" viewBox="0 0 220 164"
    role="img" aria-label="Лабораторная раковина с краном">
    <defs>
     <linearGradient id={sinkId+"-steel"} x1="0" y1="0" x2=".9" y2="1">
      <stop stopColor="#f1f8f7"/><stop offset=".47" stopColor="#b7cecb"/>
      <stop offset="1" stopColor="#789f9a"/>
     </linearGradient>
     <linearGradient id={sinkId+"-ceramic"} x1="0" y1="0" x2="0" y2="1">
      <stop stopColor="#f4f8f5"/><stop offset=".55" stopColor="#d8e6e2"/>
      <stop offset="1" stopColor="#a4c1b9"/>
     </linearGradient>
    </defs>
    <ellipse cx="113" cy="138" rx="100" ry="14" fill="#14392f" opacity=".19"/>
    <path d="M27 87H194Q205 87 203 100L194 137Q191 145 179 145H45Q33 145 30 137L19 100Q17 87 27 87Z"
     fill="#8ca7a0" stroke="#6c928a" strokeWidth="2"/>
    <ellipse cx="110" cy="94" rx="96" ry="39" fill={"url(#"+sinkId+"-steel)"} stroke="#7baba2" strokeWidth="3"/>
    <ellipse cx="110" cy="97" rx="79" ry="27" fill="#779d98" stroke="#c9e2d9" strokeWidth="3"/>
    <ellipse cx="110" cy="105" rx="70" ry="22" fill={"url(#"+sinkId+"-ceramic)"} opacity=".98"/>
    <ellipse cx="110" cy="115" rx="17" ry="5.5" fill="#5e8582" opacity=".65"/>
    <ellipse cx="110" cy="114" rx="10" ry="3" fill="#3d716f"/>
    <path d="M112 80V40Q112 26 126 26H147Q160 26 160 39V50"
     stroke="#5e8f90" strokeWidth="15" strokeLinecap="round" fill="none"/>
    <path d="M112 78V40Q112 26 126 26H147Q160 26 160 39V49"
     stroke={"url(#"+sinkId+"-steel)"} strokeWidth="10" strokeLinecap="round" fill="none"/>
    <path d="M153 50h15" stroke="#548789" strokeWidth="7" strokeLinecap="round"/>
    <rect x="102" y="69" width="22" height="17" rx="7" fill="#b7ccca" stroke="#679690" strokeWidth="2"/>
    <path d="M125 23v-9h20" stroke="#5b8a88" strokeWidth="5" strokeLinecap="round"/>
    <rect x="145" y="11" width="18" height="7" rx="3" fill="#b9d0c9" stroke="#709d94"/>
    {sinkFlow&&<>
     <path className="lektrus-lab-sink-water" d="M160 52Q162 72 153 94"
      fill="none" stroke="#b1e7ee" strokeWidth="5" strokeLinecap="round"/>
     <circle className="lektrus-lab-sink-drop" cx="147" cy="110" r="6"
      fill="#8ac8d1" opacity=".8"/>
    </>}
   </svg>
   <span className="lektrus-lab-sink-caption"><strong>РАКОВИНА</strong>
    <small>{sinkFlow?"Сосуд опорожнён":"Перетащите сосуд"}</small></span>
  </div>

  {bench.vessels.map((v,i)=>{
   const p=preview?.id===v.id?preview:vesselPosition(v);
   const selectedVessel=bench.selectedId===v.id;
   return <button type="button" key={v.id} data-board-interactive="true"
    className={"lektrus-lab-vessel is-"+v.kind+(selectedVessel?" selected":"")+
    (effectivePouringId===v.id?" is-pouring":"")+
    (dropTarget===v.id?" is-drop-target":"")+(bench.stirringVesselId===v.id||
     labAppliancesBelowStand(bench,v.id).some(d=>d.kind==="stirrer"&&d.powered)?" is-stirring":"")+
    (preview?.id===v.id&&dropTarget?" is-pour-drag":"")+
    (effectivePouringId&&effectivePouringId!==v.id?" is-pour-target":"")}
    style={{left:p.x+"%",top:p.y+"%",zIndex:v.kind==="burette"?44:selectedVessel||preview?.id===v.id?35:23+i}}
    disabled={!editable} aria-label={"Сосуд "+(i+1)+": "+names[v.kind]+
      (v.reagents.length?", "+v.reagents.join(", "):", пустой")}
    aria-pressed={selectedVessel} title={(v.reactionHeat?
      (v.reactionHeat.direction==="exothermic"?"Экзотермический нагрев":"Эндотермическое охлаждение")+" · ":"")+
      (v.reagents.length?
      labThermalState(v.reagents,v.doses,v.temperatureC??22,v.meltFraction).label+" · ":"")+
      (editable?"Выбрать или переместить; перетащить на сосуд для переливания, на раковину для слива, в шкаф для возврата":"Посуда")}
    onPointerDown={e=>down(e,v)} onPointerMove={move} onPointerUp={finish}
    onPointerCancel={e=>{e.stopPropagation();endContact();gesture.current=null;setPreview(null);
     setDropTarget(null);setDropFurniture(null);setDropDeviceId(null)}}
    onDragOver={e=>{if(editable)e.preventDefault()}}
    onDrop={e=>{if(!editable)return;e.preventDefault();e.stopPropagation();
     const id=e.dataTransfer.getData("application/x-lektrus-reagent");
     if(id&&quickReagents.some(r=>r.id===id))addQuick(id,v.id);
     else if(id)onDropReagent?.(v.id,id);
    }}>
    {bench.instrumentTarget?.kind==="tripod"&&bench.instrumentTarget.vesselId===v.id&&<span
     className="lektrus-lab-instrument-attachment">На штативе</span>}
    <LabVesselGraphic vessel={v} showLabels={settings.showVesselLabels}
     details={selectedVessel} readoutLeft={p.x>62}
     temperatureVisible={settings.showTemperatures&&v.kind!=="burette"}
     stirring={bench.stirringVesselId===v.id||
      labAppliancesBelowStand(bench,v.id).some(d=>d.kind==="stirrer"&&d.powered)}
     temperatureC={v.temperatureC??22}
     titrationResult={bench.titrationPair?.targetId===v.id&&bench.titration?
      titrationReading(bench.titration):undefined}/>
   </button>;
  })}
  {editable&&bench.vessels.filter(v=>v.kind==="burette").map(v=>{
   const p=vesselPosition(v);
   const below=labReceiverBelowStand(bench,v.id);
   const mounted=physicalDevices.some(d=>d.kind==="tripod"&&d.active&&d.linkedVesselId===v.id);
   const receiver=mounted?below?.id:v.buretteTargetId??
    bench.vessels.find(other=>other.id!==v.id&&["beaker","conical","flask","tube"].includes(other.kind))?.id;
   const toggle=()=>{
    onSelect?.(v.id);setVesselMenuId(v.id);
    if(!v.buretteOpen&&(!v.reagents.length||!receiver)){
     setNotice("Наполните бюретку и поставьте колбу на основание штатива");
     return;
    }
    const next=setLabBuretteValve({...bench,simulationAtMs:Date.now()},v.id,
     !v.buretteOpen,receiver,v.buretteRateMlS);
    if(next!==bench)onChange?.(next);
    setNotice(v.buretteOpen?"Кран закрыт, титрование остановлено":"Кран открыт, идёт титрование");
   };
   return <button key={v.id+"-valve"} type="button" data-board-interactive="true"
    className={"lektrus-lab-valve-toggle"+(v.buretteOpen?" is-open":"")}
    style={{left:Math.min(95,p.x+2.3)+"%",top:Math.min(91,p.y+7.4)+"%"}}
    aria-label={(v.buretteOpen?"Закрыть":"Открыть")+" кран бюретки"}
    aria-pressed={!!v.buretteOpen}
    title={v.buretteOpen?"Перекрыть бюретку":"Открыть бюретку для титрования"}
    onPointerDown={e=>e.stopPropagation()} onPointerUp={e=>e.stopPropagation()}
    onClick={e=>{e.stopPropagation();toggle()}}>
    <span className="lektrus-lab-valve-lever" aria-hidden="true"/>
   </button>;
  })}
  {bench.vessels.filter(v=>v.kind==="burette"&&v.buretteOpen&&v.buretteTargetId).map(v=>{
   const destination=bench.vessels.find(other=>other.id===v.buretteTargetId);
   if(!destination)return null;
   const from=vesselPosition(v),to=vesselPosition(destination);
   const width=stageSize.width,height=stageSize.height;
   const endpoints=labTitrationDropEndpoints(from,to,destination.kind,width,height);
   if(!endpoints)return null;
   const {x:nozzleX,y:nozzleY,targetX:receiverX,targetY:receiverY}=endpoints;
   const dx=receiverX-nozzleX,dy=receiverY-nozzleY;
   // ~0.05 ml per drop: 1 / 4 / 20 drops a second at the available rates.
   const rate=v.buretteRateMlS??.2,interval=.05/rate;
   const dropCount=rate>=1?12:rate>=.2?5:1;
   const cycleSeconds=interval*dropCount;
   const gradientId="lektrus-titrant-"+v.id;
   const liquidTint=v.reagents[0]?reagentAppearance(v.reagents[0]).color:"#8fcedc";
   const drops=Array.from({length:dropCount},(_,i)=>{
    const phaseStyle={
     "--lab-drop-x-early":dx*.14+"px",
     "--lab-drop-y-early":dy*.15+"px",
     "--lab-drop-x-middle":dx*.57+"px",
     "--lab-drop-y-middle":dy*.57+"px",
     "--lab-drop-x-final":dx+"px",
     "--lab-drop-y-final":dy+"px",
     animationDuration:cycleSeconds+"s",
     animationDelay:-(i*interval+.04)+"s"
    } as React.CSSProperties;
    return <g key={i} className="lektrus-lab-droplet" style={phaseStyle}>
     <path d="M0 -3.4C-1.4 -1.6 -2.4 .2 -2.1 2C-1.7 4.8 1.7 4.8 2.1 2C2.4 .2 1.4 -1.6 0 -3.4Z"
      fill={"url(#"+gradientId+")"} stroke="#5b9ea9" strokeWidth=".5"/>
     <path d="M-1.1 .2Q-1.7 1.1 -1.15 2.1" stroke="#fff" strokeWidth=".65"
      strokeLinecap="round" fill="none" opacity=".86"/>
    </g>;
   });
   return <svg key={v.id+"-drops"} className="lektrus-lab-titration-drops"
    viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
    <defs><linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
     <stop stopColor="#e8ffff" stopOpacity=".88"/>
     <stop offset=".27" stopColor="#fff" stopOpacity=".95"/>
     <stop offset=".7" stopColor={liquidTint} stopOpacity=".9"/>
     <stop offset="1" stopColor="#5199ae" stopOpacity=".93"/>
    </linearGradient></defs>
    <g transform={`translate(${nozzleX} ${nozzleY})`}>{drops}</g>
    {Array.from({length:dropCount},(_,i)=><ellipse key={i}
     className="lektrus-lab-titration-ripple" cx={receiverX} cy={receiverY}
     rx="3.5" ry=".95" fill="none" stroke="#80c7d6" strokeWidth=".9"
     style={{animationDuration:cycleSeconds+"s",
      animationDelay:-(i*interval+.04)+"s"}}/>)}
   </svg>;
  })}
  {doseEffect&&<svg className={"lektrus-lab-dose-animation"+(doseEffect.solid?" is-solid":"")}
   viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
   {doseEffect.solid?Array.from({length:12},(_,i)=><circle key={i}
    cx={doseEffect.x-4+i%5*2} cy={doseEffect.y-19-Math.floor(i/5)*4}
    r={.27+i%3*.12} fill={doseEffect.color}
    style={{animationDelay:i*.035+"s"}}/>):
    <path d={`M 22 34 Q 30 20 ${doseEffect.x} ${doseEffect.y-13}`}
     fill="none" stroke={doseEffect.color} strokeWidth="1" strokeLinecap="round"/>}
  </svg>}
  {shelfGhost&&<div className="lektrus-lab-shelf-ghost"
    style={{left:shelfGhost.x+"%",top:shelfGhost.y+"%"}} aria-hidden="true">
    {names[shelfGhost.kind]}</div>}
  {bench.pouring&&(()=>{
   const p=bench.pouring;
   const source=bench.vessels.find(v=>v.id===p.sourceId);
   const target=bench.vessels.find(v=>v.id===p.targetId);
   if(!source||!target)return null;
   const a=preview?.id===source.id?preview:vesselPosition(source),b=vesselPosition(target),percent=labPourPercent(p);
    const dx=b.x-a.x,tipX=a.x+(dx>=0?2.5:-2.5);
    const tipY=Math.min(a.y-12,b.y-11),receiveY=b.y-7.6;
    const flowPath=`M ${tipX} ${tipY} C ${tipX+dx*.36} ${tipY+6}, ${b.x-dx*.22} ${receiveY-6}, ${b.x} ${receiveY}`;
   const amounts=labPourAmounts(p);
   const fmt=(field:"transferred"|"remaining")=>{
    const totals=new Map<string,number>();
    for(const item of amounts)totals.set(item.unit,(totals.get(item.unit)??0)+item[field]);
    const values=[...totals.entries()].map(([unit,value])=>
     Number(value.toFixed(3)).toLocaleString("ru-RU")+" "+(unit==="ml"?"мл":"г"));
    if(p.unmeasured||!values.length)values.push(field==="transferred"?
     percent+"% исходного содержимого":(100-percent)+"% исходного содержимого");
    return values.join(" + ");
   };
   const flowing=p.step<LAB_POUR_STEPS;
   return <>
    {flowing&&<svg className="lektrus-lab-pour-stream is-gradual"
      viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <path d={flowPath} fill="none" stroke="#9fe4ed" strokeWidth=".95"
       strokeLinecap="round" className="lektrus-lab-fluid-stream"/>
      <path d={flowPath} fill="none" stroke="#3b9cc2" strokeWidth=".38"
       strokeLinecap="round" className="lektrus-lab-stream-pulses"/>
     </svg>}
    <div data-board-interactive="true"
     className={"lektrus-lab-gradual-pour"+(!flowing?" is-complete":"")}
     style={{left:Math.max(14,Math.min(77,(a.x+b.x)/2))+"%",
      top:Math.max(40,Math.min(78,Math.min(a.y,b.y)-24))+"%"}}
     role="status" aria-label={"Переливание "+percent+" процентов"}
     onPointerDown={e=>e.stopPropagation()} onPointerUp={e=>e.stopPropagation()}>
     <div className="lektrus-lab-pour-progress-title">
      <strong>{flowing?"Переливание":"Переливание завершено"}</strong>
      <b>{percent}%</b>
     </div>
     <div className="lektrus-lab-pour-progress-track">
      <span style={{width:percent+"%"}}/>
     </div>
     <div className="lektrus-lab-pour-progress-amounts">
      <span><b>Перелилось</b> {fmt("transferred")}</span>
      <span><b>Осталось</b> {fmt("remaining")}</span>
     </div>
     {flowing&&editable&&<button type="button" title="Остановить переливание, оставив остаток в исходном сосуде"
      onClick={e=>{e.stopPropagation();
       onChange?.(stopLabPour(bench,p.id));
       if(localPourRef.current===p.id)localPourRef.current=null;
       setNotice("Переливание остановлено. Оставшееся содержимое сохранено.")}}>
      Остановить</button>}
    </div>
   </>;
  })()}
  {transfer&&<svg className="lektrus-lab-pour-stream" viewBox="0 0 100 100"
    preserveAspectRatio="none" aria-hidden="true">
   <path d={`M ${transfer.from.x} ${transfer.from.y} Q ${(transfer.from.x+transfer.to.x)/2} ${Math.min(transfer.from.y,transfer.to.y)-12} ${transfer.to.x} ${transfer.to.y}`}
     fill="none" stroke="#58afe0" strokeWidth=".9" strokeLinecap="round"/>
  </svg>}
  {editable&&(dropTarget||dropDeviceId||effectivePouringId||dropFurniture||notice)&&<div className="lektrus-lab-pour-hint" aria-live="polite">
   {dropFurniture==="sink"?"Отпустите для слива в раковину":
    dropFurniture==="glassware"?"Отпустите, чтобы вернуть пустую посуду":
    dropTarget?(contactCountdown===dropTarget?"Удерживайте пипетку на растворе 1 секунду":"Переливание идёт. Отпустите, чтобы остановить"):
     dropDeviceId?"Отпустите, чтобы установить посуду":
    effectivePouringId?"Выберите посуду для переливания":notice}
  </div>}
  {cabinet&&createPortal(<div className={"lektrus-lab-furniture-modal is-"+cabinet}
   data-board-interactive="true"
   onPointerDown={e=>e.stopPropagation()} onPointerMove={e=>e.stopPropagation()}
   onPointerUp={e=>e.stopPropagation()}
   onWheel={e=>e.stopPropagation()} onTouchMove={e=>e.stopPropagation()}
   onClick={e=>{e.stopPropagation();if(e.target===e.currentTarget)setCabinet(null)}}>
    <section ref={dialogRef} tabIndex={-1}
     className={"lektrus-lab-furniture-dialog is-"+cabinet} role="dialog" aria-modal="true"
     aria-label={cabinet==="reagents"?"Шкаф реактивов":cabinet==="glassware"?"Шкаф посуды":cabinet==="equipment"?"Шкаф приборов":"Настройки химического стола"}
     onKeyDown={event=>{
      if(event.key!=="Tab")return;
      const focusable=dialogRef.current?.querySelectorAll<HTMLElement>(
       'button:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex="0"]');
      if(!focusable?.length)return;
      const first=focusable[0],last=focusable[focusable.length-1];
      if(event.shiftKey&&(document.activeElement===first||document.activeElement===dialogRef.current)){
       event.preventDefault();last.focus();
      }else if(!event.shiftKey&&document.activeElement===last){
       event.preventDefault();first.focus();
      }
     }}>
     <header className="lektrus-lab-modal-head">
      <div className="lektrus-lab-modal-heading">
       <span className="lektrus-lab-modal-emblem" aria-hidden="true">{cabinet==="reagents"?"⚗":cabinet==="glassware"?"◈":"▤"}</span>
       <span><strong>{cabinet==="reagents"?"Шкаф реактивов":cabinet==="glassware"?"Шкаф посуды":"Шкаф приборов"}</strong>
        <small>{cabinet==="reagents"?"Выберите вещество и отмерьте нужное количество":
          cabinet==="glassware"?"Возьмите посуду на рабочий стол":"Возьмите прибор и работайте с ним на столе"}</small></span>
      </div>
      <button type="button" aria-label="Закрыть шкаф" onClick={()=>setCabinet(null)}>×</button>
     </header>
     {cabinet==="reagents"&&<>
      <div className="lektrus-lab-modal-tabs lektrus-lab-class-tabs" role="tablist"
       aria-label="Разделы шкафа реактивов">
       {([
        ["all","Все"],["acid","Кислоты"],["base","Основания"],
        ["salt","Соли"],["oxide","Оксиды"],["metal","Простые вещества"],
        ["organic","Органические"],["other","Прочие"],["experiments","Готовые опыты"]
       ] as const).map(([id,name])=><button type="button" key={id} role="tab"
        className={cabinetTab===id?"active":""} aria-selected={cabinetTab===id}
        onClick={()=>{setCabinetTab(id);setChosen(null);setCategory("Все");setPhase("all")}}>{name}</button>)}
      </div>
      <div className="lektrus-lab-modal-filters">
       <input type="search" placeholder="Поиск по всем веществам и формулам" value={query}
        onChange={e=>{setQuery(e.target.value);if(e.target.value.trim())setCabinetTab("all")}}
        aria-label="Поиск по всем веществам"/>
       {cabinetTab!=="experiments"?<select value={category} onChange={e=>setCategory(e.target.value)}
        aria-label="Класс реактива">
        {classes.map(c=><option key={c}>{c}</option>)}
       </select>:<select value={effectFilter}
        aria-label="Признак реакции" onChange={e=>setEffectFilter(e.target.value as "all"|Observation|ReactionFamily)}>
        <option value="all">Все</option><option value="gas">Газ</option>
        <option value="precipitate">Осадок</option><option value="color">Цвет</option>
        <option value="heat">Тепло</option><option value="dissolution">Растворение</option>
        {Object.entries(reactionFamilyLabels).map(([id,label])=>
         <option key={id} value={id}>{label}</option>)}
       </select>}
      </div>
      {cabinetTab!=="experiments"&&<div className="lektrus-lab-reagent-form-tabs"
       role="group" aria-label="Выбор формы реактива">
       {([["all","Все формы"],["liquid","Растворы"],["solid","Твёрдые"],["gas","Газы"]] as const).
        map(([id,label])=><button type="button" key={id}
         aria-pressed={phase===id} className={phase===id?"is-active":""}
         onClick={()=>{setPhase(id);setChosen(null)}}>{label}</button>)}
      </div>}
      {cabinetTab!=="experiments"&&<details className="lektrus-lab-catalog-extra">
       <summary>Дополнительные фильтры и сортировка</summary>
       <div className="lektrus-lab-modal-sortbar">
        <label>Сортировка <select aria-label="Сортировка реактивов" value={sort}
         onChange={e=>setSort(e.target.value as CatalogueSort)}>
         <option value="recommended">Сначала растворы</option>
         <option value="name">По названию</option><option value="formula">По формуле</option>
        </select></label>
        <label>Группировка <select aria-label="Группировка реактивов" value={group}
         onChange={e=>setGroup(e.target.value as CatalogueGroup)}>
         <option value="class">По классам</option><option value="phase">По состоянию</option>
         <option value="none">Без группировки</option>
        </select></label>
       </div>
      </details>}
      <div className="lektrus-lab-modal-results-head">
       <span><strong>{cabinetTab!=="experiments"?visibleSubstances.length:experimentCases.length}</strong>
        {cabinetTab!=="experiments"?" веществ в каталоге":" опытов найдено"}</span>
       <span className="lektrus-lab-modal-scroll-help">Колесо мыши, тачпад или прокрутка пальцем</span>
       <div className="lektrus-lab-scroll-buttons">
        <button type="button" aria-label="Прокрутить список вверх"
         onClick={()=>scrollRef.current?.scrollBy({top:-310,behavior:"smooth"})}>↑</button>
        <button type="button" aria-label="Прокрутить список вниз"
         onClick={()=>scrollRef.current?.scrollBy({top:310,behavior:"smooth"})}>↓</button>
       </div>
      </div>
      <div ref={scrollRef} className="lektrus-lab-modal-reagents"
       role="region" tabIndex={0} aria-label="Прокручиваемый список веществ и опытов"
       onWheel={e=>e.stopPropagation()} onTouchMove={e=>e.stopPropagation()}>
       {cabinetTab!=="experiments"?catalogue.map(({title,items})=>
        <div className="lektrus-lab-reagent-group" key={title}>
         {group!=="none"&&<h3>{title}<small>{items.length}</small></h3>}
         <div className="lektrus-lab-reagent-group-grid">
          {items.map(v=><button key={v.id} type="button"
           className={chosen===v.id?"active":""} aria-pressed={chosen===v.id}
           onClick={()=>{setChosen(v.id);
            const saved=quickReagents.find(q=>q.id===v.id)?.dose;
            const forms=labReagentForms(v);
            setUnit(saved&&forms.includes(saved.unit)?saved.unit:
             forms.includes("ml")?"ml":"g");
            setAmount(String(saved?.value??10));
            setMolarity(String(saved?.concentrationM??.1))}}>
           <i style={{background:cabinetColor(v)}}/>
           <strong>{v.formula}</strong>
           <span>{v.name}<small>{labReagentForms(v).includes("ml")?"Раствор · доступен":
            labReagentPhaseLabel(v,labReagentForms(v)[0])}</small>
            {labReagentForms(v).includes("g")&&
             <small className="lektrus-lab-solid-property">Твёрдое · {labThermalInfo(v.id,"g").meltingC!==undefined?
              "tпл "+labThermalInfo(v.id,"g").meltingC+" °C":
              labThermalInfo(v.id,"g").behavior==="decomposes"?"разлагается при нагреве":
              "tпл не установлена"}</small>}
           </span>
          </button>)}
         </div>
        </div>):experimentCases.map((row,i)=><button type="button" key={i}
         className="lektrus-lab-example-choice" onClick={()=>prepareExample(row)}
         title="Разместить исходные вещества отдельно">
         <strong>{row.reactants.join(" + ")}{row.family&&
          <small className="lektrus-lab-reaction-family">{reactionFamilyLabels[row.family]}</small>}</strong>
         <span>{row.description}</span>
        </button>)}
       {((cabinetTab!=="experiments"?visibleSubstances:experimentCases).length===0)&&
        <p>Совпадений не найдено</p>}
      </div>
      {cabinetTab!=="experiments"&&<details className="lektrus-lab-quick-editor">
       <summary>Быстрый доступ: {quickReagents.length} веществ · изменить полку</summary>
       <div className="lektrus-lab-quick-editor-title">
        <strong>Быстрый доступ на столе</strong>
        <small>{quickReagents.length} из {MAX_QUICK_REAGENTS} · нажмите, чтобы изменить дозировку</small>
       </div>
       <div className="lektrus-lab-quick-editor-list">
        {quickReagents.map(q=><div key={q.id} className="lektrus-lab-quick-editor-entry">
         <button type="button" className={chosen===q.id?"active":""}
          title="Изменить количество и концентрацию" onClick={()=>{
           setChosen(q.id);setAmount(String(q.dose.value));setUnit(q.dose.unit);
           setMolarity(String(q.dose.concentrationM??.1))}}>
          <strong>{substances.find(v=>v.id===q.id)?.formula??q.id}</strong>
          <small>{formatLabDose(q.dose)}</small>
         </button>
         <button type="button" aria-label={"Убрать "+q.id+" из быстрого доступа"}
          title="Убрать с полки" onClick={()=>{
           onChange?.(setLabQuickReagent(bench,q.id));
          }}>×</button>
        </div>)}
       </div>
      </details>}
      {cabinetTab!=="experiments"&&<div className="lektrus-lab-modal-dose">
       <div><strong>{reagent?.name??"Выберите реактив"}</strong>
        <small>{reagent?labReagentPhaseLabel(reagent,unit)+" · "+
          reagentAppearance(reagent.id,unit==="g"?"dry":"aqueous").label:
          "Сначала выберите вещество из шкафа"}</small>
       </div>
       <div className="lektrus-lab-dose-controls">
        <label>{unit==="ml"?"Объём, мл":"Масса, г"}
         <input type="number" inputMode="decimal" min="0" max="10000" step="10"
          value={amount} onChange={e=>setAmount(e.target.value)} /></label>
        {reagent&&unit==="ml"&&["кислота","основание","соль","пероксид"].includes(reagent.kind)&&
         <label>Концентрация, моль/л
          <input type="number" min="0" max="2" step="0.1" value={molarity}
           onChange={e=>setMolarity(e.target.value)} />
         </label>}
        <div className="lektrus-lab-solid-form" role="group" aria-label="Выберите форму добавления вещества">
         <strong>Что добавляем?</strong>
         <div className="lektrus-lab-solid-form-switch">
          <button type="button" className={unit==="ml"?"is-active":""}
           aria-pressed={unit==="ml"} disabled={!!reagent&&!labReagentForms(reagent).includes("ml")}
           onClick={()=>setUnit("ml")}>💧 Раствор · мл</button>
          <button type="button" className={unit==="g"?"is-active":""}
           aria-pressed={unit==="g"} disabled={!!reagent&&!labReagentForms(reagent).includes("g")}
           onClick={()=>setUnit("g")}>▦ Порошок / кусочки · г</button>
         </div>
         {reagent&&<small className="lektrus-lab-thermal-note">
          {unit==="g"?"Насыпать в выбранный сосуд. ":"Налить в выбранный сосуд. "}
          {labThermalInfo(reagent.id,unit).meltingC!==undefined?
           "Плавление / кристаллизация: "+labThermalInfo(reagent.id,unit).meltingC+" °C. ":""}
          {labThermalInfo(reagent.id,unit).boilingC!==undefined?
           "Кипение: "+labThermalInfo(reagent.id,unit).boilingC+" °C. ":""}
          {labThermalInfo(reagent.id,unit).decompositionC!==undefined?
           "Разложение при нагреве: около "+labThermalInfo(reagent.id,unit).decompositionC+" °C. ":""}
          {reagent.id==="CaCO3"&&unit==="g"?
           "Для разложения CaCO₃ используйте тигель и горелку на высокой мощности. ":""}
          {labThermalInfo(reagent.id,unit).description}
         </small>}
        </div>
        <button type="button" className="primary" disabled={!chosen||!selected}
         onClick={dispense}>{unit==="g"?"▦ Насыпать в сосуд":"💧 Налить в сосуд"}</button>
        <button type="button" disabled={!chosen||
          (!quickReagents.some(v=>v.id===chosen)&&quickReagents.length>=MAX_QUICK_REAGENTS)}
         className="lektrus-lab-save-quick" onClick={()=>{
          if(!chosen)return;
          const value=Number(amount.replace(",","."));
          const substance=substances.find(v=>v.id===chosen);
          if(substance&&!labReagentForms(substance).includes(unit)){
           setNotice("Выбранная форма реактива не подходит");return}
          const concentration=Number(molarity.replace(",","."));
          if(!Number.isFinite(value)||value<=0||value>10000){setNotice("Укажите положительное количество");return}
          const isQuantifiedSolution=unit==="ml"&&!!substance&&
   ["кислота","основание","соль","пероксид"].includes(substance.kind);
          if(isQuantifiedSolution&&(!Number.isFinite(concentration)||concentration<.001||concentration>2)){
           setNotice("Концентрация должна быть от 0,001 до 2 моль/л");return}
          const next=setLabQuickReagent(bench,chosen,{value,unit,
           ...(isQuantifiedSolution?{concentrationM:concentration}:{})});
          if(next===bench){setNotice("Не удалось изменить быстрый доступ");return}
          onChange?.(next);setNotice("Быстрый реактив обновлён: "+chosen);
         }}>{quickReagents.some(q=>q.id===chosen)?"Сохранить на полке":"На полку быстрого доступа"}</button>
       </div>
       <small>Для титрования заполните бюретку и колбу кислотой и щёлочью с известными концентрациями. {selected?"Выбран: "+names[selected.kind]:"Выберите посуду на столе."}</small>
      </div>}
     </>}
     {cabinet==="glassware"&&<div className="lektrus-lab-modal-ware">
      <div className="lektrus-lab-mode-cabinet-note">
       <span>{labModeInfo(bench).name}: {labModeInfo(bench).description}</span>
       <button type="button" onClick={()=>setShowAllGlassware(x=>!x)}>
        {showAllGlassware?"Рекомендуемый набор":"Вся посуда"}
       </button>
      </div>
      {(showAllGlassware?labGlassware:glasswareForLabMode(bench)).map(v=><button type="button" key={v.id}
       disabled={bench.vessels.length>=6} onClick={()=>chooseGlassware(v.id)}>
       <LektrusLabGlasswareIcon kind={v.id} size={60}/>
       <strong>{v.name}</strong><small>{v.description}</small></button>)}
      {selected&&["pipette","cylinder","volumetric"].includes(selected.kind)&&
       <section className="lektrus-lab-measuring-cabinet">
        <strong>{names[selected.kind]} · измерение и перенос</strong>
        {selected.kind!=="volumetric"&&<>
         <label>Объём, мл <input type="number" min=".01" step=".01"
          max={labMeasuredCapacityMl(selected.kind)} value={measuredMl}
          onChange={e=>setMeasuredMl(e.target.value)}/></label>
         <label>Другой сосуд <select value={bench.vessels.some(v=>v.id===measuredPartnerId&&v.id!==selected.id)?
          measuredPartnerId:(bench.vessels.find(v=>v.id!==selected.id)?.id??"")}
          onChange={e=>setMeasuredPartnerId(e.target.value)}>
          {bench.vessels.filter(v=>v.id!==selected.id).map(v=>
           <option key={v.id} value={v.id}>{names[v.kind]} · {v.id}</option>)}
         </select></label>
         {(["Набрать","Выдать"] as const).map(action=><button type="button" key={action}
          onClick={()=>{
           const partner=bench.vessels.some(v=>v.id===measuredPartnerId&&v.id!==selected.id)?
            measuredPartnerId:bench.vessels.find(v=>v.id!==selected.id)?.id;
           const from=action==="Набрать"?partner:selected.id;
           const to=action==="Набрать"?selected.id:partner;
           const requested=Number(measuredMl);
           const configured=selected.kind==="pipette"?
            setLabPipetteTarget(bench,selected.id,requested):bench;
           const next=from&&to?transferLabMeasuredLiquid(configured,from,to,requested):bench;
           if(next!==bench){onChange?.(next);setNotice(action+" "+measuredMl+" мл")}
           else setNotice("Не удалось отмерить: проверьте объём и сосуд");
          }}>{action}</button>)}
        </>}
        {selected.kind==="volumetric"&&<button type="button"
         onClick={()=>{const next=fillLabVolumetricFlask(bench,selected.id);
          if(next!==bench)onChange?.(next)}}>Долить до метки</button>}
       </section>}
      <p>В шкаф возвращается только пустая посуда. Сначала слейте содержимое в раковину.</p>
      <button type="button" className="lektrus-lab-store-selected"
       disabled={!selected||!!selected.reagents.length}
       onClick={()=>{if(selected)returnGlass(selected.id);setCabinet(null)}}>
       Вернуть выбранную пустую посуду
      </button>
     </div>}
     {cabinet==="equipment"&&<div className="lektrus-lab-equipment-catalog">
      <p>{labModeInfo(bench).name}: {labModeInfo(bench).description}</p>
      <button type="button" className="lektrus-lab-show-all-devices"
       onClick={()=>setShowAllDevices(x=>!x)}>
       {showAllDevices?"Рекомендуемые приборы":"Все приборы"}
      </button>
      <div className="lektrus-lab-equipment-grid">
       {(showAllDevices?labDevices:devicesForLabMode(bench)).map(device=>{
        const count=physicalDevices.filter(d=>d.kind===device.id).length;
        return <button type="button" key={device.id}
         aria-label={"Поставить на стол: "+device.name} onClick={()=>takeDevice(device.id)}>
         <LektrusLabDeviceIcon kind={device.id} size={56}/>
         <strong>{device.name}</strong><small>{device.description}</small>
         <em>＋ На стол {count>0?" · "+count:""}</em>
        </button>;
       })}
      </div>
      {selected&&selected.reagents.length>0&&<div className="lektrus-lab-measuring-cabinet">
       <strong>Условия выбранного сосуда</strong>
       <label>Среда <select value={selected.environment==="dry"?"dry":"aqueous"}
        onChange={e=>onChange?.(setLabEnvironment(bench,selected.id,
         e.target.value as typeof selected.environment))}>
        <option value="aqueous">Раствор</option><option value="dry">Сухая среда</option>
       </select></label>
       {identifyReaction(selected.reagents,"ignited").status==="reaction"&&
        selected.environment!=="ignited"&&<button type="button"
         className="lektrus-lab-virtual-ignition"
         title="Учебная имитация воспламенения, только виртуально"
         onClick={()=>onChange?.(setLabEnvironment(bench,selected.id,"ignited"))}>
         🔥 Виртуальное воспламенение
        </button>}
      </div>}
      <p className="lektrus-lab-safe-caption">Нагрев и горение изменяют условия выбранного сосуда только в виртуальной модели. Мешалка и штатив не создают новых химических продуктов; термометр не показывает выдуманную температуру.</p>
     </div>}
    </section>
   </div>,document.body)}
 </div>;
}
