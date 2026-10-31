import {useEffect,useRef,useState} from "react";
import {createPortal} from "react-dom";
import type {Item} from "./boardModel";
import LektrusChemistryBenchSurface from "./LektrusChemistryBench";
import {putLabReagent,pourLabVessel,readLabBench,selectLabVessel,type LabBench,type LabDose}
 from "./lektrusChemistryBenchModel";
import {subjectEditorStyle} from "./lektrusSubjectAccent";

type Props={item:Item;onChange:(next:Item)=>void;onSave:()=>void;onCancel:()=>void};
/** The fullscreen view renders the EXACT shared bench used by the board object.
 * Its only extra control is an unobtrusive exit button; all apparatus settings
 * and the reagent cupboard remain directly on the same tabletop. */
export default function LektrusChemistryBenchEditor({item,onChange,onSave,onCancel}:Props){
 const bench=readLabBench(item);
 const viewport=useRef<HTMLDivElement>(null);
 const [stage,setStage]=useState({width:1600,height:1000,scale:1,compact:false});
 // The full-screen laboratory owns the live simulation. Keep the underlying
 // board out of Android WebView's paint tree while the portal is shown.
 useEffect(()=>{
  document.body.classList.add("lektrus-lab-fullscreen-active");
  window.dispatchEvent(new Event("lektrus-lab-fullscreen-change"));
  return()=>{
   document.body.classList.remove("lektrus-lab-fullscreen-active");
   window.dispatchEvent(new Event("lektrus-lab-fullscreen-change"));
  };
 },[]);
 useEffect(()=>{
  const node=viewport.current;if(!node)return;
  const resize=()=>{
   const w=node.clientWidth,h=node.clientHeight;
   if(!w||!h)return;
   // Phones need real-size controls, not a 1000px desktop stage zoomed
   // down to illegible text. Landscape/portrait can change at runtime.
   const compact=window.matchMedia("(pointer:coarse) and (max-width:1100px)").matches||
    window.matchMedia("(max-width:650px)").matches;
   const scale=compact?1:h/1000;
   const width=compact?w:w/scale;
   const height=compact?h:1000;
   setStage(old=>Math.abs(old.width-width)<.5&&
    Math.abs(old.height-height)<.5&&Math.abs(old.scale-scale)<.001&&
    old.compact===compact?old:{width,height,scale,compact});
  };
  resize();
  const observer=new ResizeObserver(resize);
  observer.observe(node);
  return()=>observer.disconnect();
 },[]);
 const patch=(updated:LabBench)=>{
  if(updated!==bench)onChange({...item,scienceLabBench:updated,
   scienceReagents:undefined,scienceExperimentStage:undefined});
 };
 useEffect(()=>{
  const onKey=(event:KeyboardEvent)=>{
   if(event.key!=="Escape")return;
   // Cabinets own Escape while they are open.
   if(document.querySelector(".lektrus-lab-furniture-modal")||
     document.querySelector(".lektrus-lab-return-confirm"))return;
   event.preventDefault();onSave();
  };
  document.addEventListener("keydown",onKey);
  return()=>document.removeEventListener("keydown",onKey);
 },[onSave]);
 const pour=(from:string,to:string)=>patch(pourLabVessel(bench,from,to));
 const addReagent=(id:string,reagent:string,dose?:LabDose)=>
  patch(putLabReagent(bench,id,reagent,dose));
 return createPortal(<div className="lektrus-lab-editor-overlay is-board-identical"
  style={subjectEditorStyle("chemistry")} data-board-interactive="true"
  onPointerDown={e=>{if(e.target===e.currentTarget)onCancel()}}>
  <section className={"lektrus-lab-editor is-board-identical"+(stage.compact?" is-compact-fullscreen":"")} role="dialog" aria-modal="true"
   aria-label="Химический стол" onPointerDown={e=>e.stopPropagation()}>
   <div ref={viewport} className="lektrus-lab-editor-bench-viewport" data-board-interactive="true"
    role="region" tabIndex={0} aria-label="Интерактивный химический стол"
    onWheel={e=>e.stopPropagation()} onTouchMove={e=>e.stopPropagation()}>
    <div className="lektrus-lab-fit-stage" style={{
     // CSS zoom scales the stage in layout space. A transformed 2000+ px
     // layer with animated SVG filters was intermittently repainted as pale
     // rectangles on Android when selections and thermal ticks updated.
     width:stage.width,height:stage.height,zoom:stage.scale}}>
     <LektrusChemistryBenchSurface bench={bench} editable fullscreenOwner compactFullscreen={stage.compact}
      onSelect={id=>patch(selectLabVessel(bench,id))}
      onPour={pour} onChange={patch} onDropReagent={addReagent}/>
    </div>
   </div>
   <button type="button" className="lektrus-lab-editor-exit" onClick={onSave}
    aria-label="Закрыть лабораторию">✕ <span>Закрыть</span></button>
  </section>
 </div>,document.body);
}
