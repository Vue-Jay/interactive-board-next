/** Isolated *real React viewport* for honest visual acceptance.
 * This is a development-only entry under /tests, not a new atlas mode.
 * The image below is drawn by the same component as the live board.
 */
import React,{useEffect,useRef,useState} from "react";
import {createRoot} from "react-dom/client";
import LektrusSkinSemanticViewport,{type EpidermisHitTest} from "../src/LektrusSkinSemanticViewport";
import {EPIDERMIS_RECORDS,EPIDERMIS_STRATA_ORDER,EPIDERMIS_THICK_STRATA_ORDER,
 type EpidermisId} from "../src/lektrusEpidermisAtlas";
import LektrusSkinSpecimens from "../src/LektrusSkinSpecimens";
import type {ThickSkinKind} from "../src/lektrusThickEpidermis";
import {anatomyCameraAtBody,anatomyScreenToBody,anatomyBodyFit} from "../src/lektrusAnatomySemanticZoom";
import "../src/lektrusHumanAnatomy.css";
const WIDTH=840,HEIGHT=540;
const ZOOMS=[1,8,24,80,120,180,220,360] as const;
function Preview(){
 const params=new URLSearchParams(window.location.search);
 const incoming=Number(params.get("zoom"));
 const start=ZOOMS.find(x=>x===incoming)??24;
 const modeValue=params.get("site");
 const site:ThickSkinKind|null=modeValue==="palm"||modeValue==="sole"?
  modeValue:null;
 const querySource=params.get("source");
 const source=querySource==="thin"||querySource==="thick"?querySource:"human";
 const [scale,setScale]=useState<number>(start);
 const [selected,setSelected]=useState<EpidermisId|null>(
  params.get("layer")&&params.get("layer")!=="none"?
   params.get("layer") as EpidermisId:null);
 const hitRef=useRef<EpidermisHitTest|null>(null);
 const anchorRef=useRef<{x:number;y:number}|null>(null);
 const thickAnchorsRef=useRef<Record<ThickSkinKind,
  {x:number;y:number}|null>|null>(null);
 const [focus,setFocus]=useState({x:260,y:182});
 useEffect(()=>{
  // Wait for the *actual loaded silhouette contour*, not an estimated
  // x coordinate from the older atlas. Screenshots should inspect the
  // registered epidermis rather than hundreds of pink dermis pixels.
  const timer=window.setInterval(()=>{
   const target=site?thickAnchorsRef.current?.[site]:anchorRef.current;
   if(!target)return;
   setFocus({...target});
   window.clearInterval(timer);
  },100);
  return ()=>window.clearInterval(timer);
 },[site]);
 const camera=anatomyCameraAtBody(scale===1?{x:180,y:300}:focus,
  scale,WIDTH,HEIGHT);
 return <main style={{fontFamily:"system-ui",padding:18,background:"#edf3f0",
  color:"#254639",minHeight:"100vh"}}>
  <h1 style={{fontSize:20,margin:"0 0 8px"}}>Lektrus · проверка покровной системы</h1>
  <p style={{fontSize:13,maxWidth:WIDTH}}>Настоящий компонент атласа, одна и та же
   область {site?site==="palm"?"кисти (условная ладонь)":"стопы (условная подошва)":"правого плеча"}. Виртуальный разрез увеличен для обучения и не
   является физической масштабной линейкой или фотографией.</p>
  <nav aria-label="Масштаб для проверки" style={{display:"flex",gap:7,
   marginBottom:12}}>
   {ZOOMS.map(z=><button key={z} type="button" onClick={()=>setScale(z)}
    aria-pressed={scale===z} style={{padding:"8px 12px",fontWeight:650,
     background:z===scale?"#397f58":"white",color:z===scale?"white":"#294a35"}}>
    {z*100}%</button>)}
  </nav>
  <div style={{display:"flex",gap:16,alignItems:"flex-start"}}>
   <div data-testid="skin-visual-stage" role="button" tabIndex={0}
    aria-label="Выбрать слой эпидермиса на модели тела"
    onClick={e=>{
     const bounds=e.currentTarget.getBoundingClientRect();
     const p=anatomyScreenToBody(camera,
      {x:e.clientX-bounds.left,y:e.clientY-bounds.top},WIDTH,HEIGHT);
     const id=hitRef.current?.(p,anatomyBodyFit(WIDTH,HEIGHT).pixelPerWorld*scale);
     if(id)setSelected(id);
    }}
    style={{width:WIDTH,height:HEIGHT,flexShrink:0,position:"relative",
     background:"#f5f7f8",border:"1px solid #b4c9bf",
     borderRadius:12,overflow:"hidden"}}>
    <LektrusSkinSemanticViewport camera={camera}
     selectedEpidermis={selected} hitTestRef={hitRef}
     anchorRef={anchorRef} thickKind={site}
     thickAnchorsRef={thickAnchorsRef}/>
   </div>
   <aside style={{width:270,maxHeight:HEIGHT,overflowY:"auto"}}>
    <div style={{border:"1px solid #bcd5ca",padding:9,borderRadius:10,
     background:"#fff",display:"grid",gap:6,marginBottom:8}}>
     <b style={{fontSize:12}}>Эпидермис · нажмите на слой</b>
     {(site?EPIDERMIS_THICK_STRATA_ORDER:EPIDERMIS_STRATA_ORDER).map(id=>
      <button type="button" key={id}
      aria-pressed={selected===id} onClick={()=>setSelected(id)}
      style={{fontSize:11,textAlign:"left",padding:7,background:selected===id?"#e3f1e8":"#f7faf8"}}>
      {EPIDERMIS_RECORDS[id].name}</button>)}
     {selected&&<div role="status" style={{fontSize:11,lineHeight:1.5}}>
      <b>{EPIDERMIS_RECORDS[selected].name}</b>
      <p>{EPIDERMIS_RECORDS[selected].microAppearance}</p></div>}
    </div>
    <LektrusSkinSpecimens defaultOpen defaultSelection={source}/>
   </aside>
  </div>
  <p style={{fontSize:12}}>Текущий цифровой масштаб: {scale*100}%.
   Научная и визуальная приёмка требуют отдельного сравнения с Leeds,
   OpenStax и гистологическими препаратами.</p>
 </main>;
}
const root=document.getElementById("root");
if(root)createRoot(root).render(<Preview/>);
