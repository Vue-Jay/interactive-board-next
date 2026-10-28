import {useState} from "react";
import {createPortal} from "react-dom";

type Destination={id:string;title:string};
type Props={destinations:Destination[];onCollect:(destinationId:string)=>void};

/** An explicit move action, never a silent copy into the last open worksheet.
 * The standalone tool is removed only once the destination is committed. */
export default function LektrusChemistryCollectionAction({destinations,onCollect}:Props){
 const [open,setOpen]=useState(false);
 return <div className="lektrus-chem-collect-action" data-board-interactive="true"
  onPointerDown={e=>e.stopPropagation()} onPointerUp={e=>e.stopPropagation()}
  onDoubleClick={e=>e.stopPropagation()} onClick={e=>e.stopPropagation()}>
  <button type="button" aria-expanded={open} aria-label="Поместить на химическую доску"
   onClick={()=>setOpen(value=>!value)}>На химическую доску</button>
  {open&&createPortal(<div className="lektrus-chem-collect-backdrop"
   onPointerDown={e=>{e.stopPropagation();if(e.target===e.currentTarget)setOpen(false)}}
   onClick={e=>e.stopPropagation()}>
   <section className="lektrus-chem-collect-menu" role="dialog" aria-modal="true"
    aria-label="Выберите химическую доску">
    <div className="lektrus-chem-collect-menu-heading">
     <strong>Перенести на химическую доску</strong>
     <button type="button" aria-label="Закрыть" onClick={()=>setOpen(false)}>×</button>
    </div>
    <p>Выберите существующую доску или создайте новую. Исходный объект переносится без дубликата.</p>
    {destinations.map(destination=><button type="button" key={destination.id}
     onClick={()=>onCollect(destination.id)}>{destination.title}</button>)}
    <button type="button" onClick={()=>onCollect("__new__")}>+ Новая химическая доска</button>
   </section>
  </div>,document.body)}
 </div>;
}
