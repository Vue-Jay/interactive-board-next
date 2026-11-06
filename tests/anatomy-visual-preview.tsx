/** Isolated *real React viewport* for honest visual acceptance.
 * This is a development-only entry under /tests, not a new atlas mode.
 * The image below is drawn by the same component as the live board.
 */
import React,{useState} from "react";
import {createRoot} from "react-dom/client";
import LektrusSkinSemanticViewport from "../src/LektrusSkinSemanticViewport";
import LektrusSkinSpecimens from "../src/LektrusSkinSpecimens";
import {anatomyCameraAtBody} from "../src/lektrusAnatomySemanticZoom";
import "../src/lektrusHumanAnatomy.css";
const WIDTH=840,HEIGHT=540;
const ZOOMS=[1,8,24,80,180,360] as const;
function Preview(){
 const params=new URLSearchParams(window.location.search);
 const incoming=Number(params.get("zoom"));
 const start=ZOOMS.find(x=>x===incoming)??24;
 const [scale,setScale]=useState<number>(start);
 // Confirmed deltoid reference (not an invented palm/sole histological map).
 const focus={x:254,y:182};
 const camera=anatomyCameraAtBody(scale===1?{x:180,y:300}:focus,
  scale,WIDTH,HEIGHT);
 return <main style={{fontFamily:"system-ui",padding:18,background:"#edf3f0",
  color:"#254639",minHeight:"100vh"}}>
  <h1 style={{fontSize:20,margin:"0 0 8px"}}>Lektrus · проверка покровной системы</h1>
  <p style={{fontSize:13,maxWidth:WIDTH}}>Настоящий компонент атласа, одна и та же
   область правого плеча. Виртуальный разрез увеличен для обучения и не
   является физической масштабной линейкой или фотографией.</p>
  <nav aria-label="Масштаб для проверки" style={{display:"flex",gap:7,
   marginBottom:12}}>
   {ZOOMS.map(z=><button key={z} type="button" onClick={()=>setScale(z)}
    aria-pressed={scale===z} style={{padding:"8px 12px",fontWeight:650,
     background:z===scale?"#397f58":"white",color:z===scale?"white":"#294a35"}}>
    {z*100}%</button>)}
  </nav>
  <div style={{display:"flex",gap:16,alignItems:"flex-start"}}>
   <div data-testid="skin-visual-stage"
    style={{width:WIDTH,height:HEIGHT,flexShrink:0,position:"relative",
     background:"#f5f7f8",border:"1px solid #b4c9bf",
     borderRadius:12,overflow:"hidden"}}>
    <LektrusSkinSemanticViewport camera={camera}/>
   </div>
   <aside style={{width:270,maxHeight:HEIGHT,overflowY:"auto"}}>
    <LektrusSkinSpecimens defaultOpen/>
   </aside>
  </div>
  <p style={{fontSize:12}}>Текущий цифровой масштаб: {scale*100}%.
   Научная и визуальная приёмка требуют отдельного сравнения с Leeds,
   OpenStax и гистологическими препаратами.</p>
 </main>;
}
const root=document.getElementById("root");
if(root)createRoot(root).render(<Preview/>);
