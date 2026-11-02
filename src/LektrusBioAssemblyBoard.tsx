import {useEffect,useMemo,useRef,useState} from "react";
import type {PointerEvent as ReactPointerEvent} from "react";
import type {BioMicroscopeDiagram,BioNode} from "./lektrusBioMicroscopeModel";
import {BIO_LEVEL_LABELS,BIO_ORGANISMS,bioChildren} from "./lektrusBioMicroscopeModel";
import {
 BIO_ASSEMBLY_LEVELS,bioAssemblyAnswer,bioAssemblyPalette,bioAssemblyEvaluate,
 bioAssemblyPlace,bioAssemblyRemove
} from "./lektrusBioAssemblyModel";
import type {BioAssemblyLevel,BioAssemblyPlacements} from "./lektrusBioAssemblyModel";
import LektrusBioAnatomyScene from "./LektrusBioAnatomyScene";

type Props={diagram:BioMicroscopeDiagram;nodes:BioNode[]};
type DragState={id:string;x:number;y:number};
type PointerState={id:string;pointerId:number;startX:number;startY:number;moved:boolean};

/** Teacher sets the target leaf once, in the existing editor.
 * A student constructs the four real ancestors from shuffled cards.
 * Touch users can drag to a slot OR tap a card then the slot; keyboard
 * users can select with Enter and activate the slot with Enter.
 */
export default function LektrusBioAssemblyBoard({diagram,nodes}:Props){
 const path=diagram.assignmentPath;
 const root=nodes[0];
 const answer=useMemo(()=>bioAssemblyAnswer(nodes,path),[nodes,path]);
 const palette=useMemo(()=>bioAssemblyPalette(nodes,path),[nodes,path]);
 const [placements,setPlacements]=useState<BioAssemblyPlacements>({});
 const [selected,setSelected]=useState<string|null>(null);
 const [checked,setChecked]=useState(false);
 const [message,setMessage]=useState("");
 const [drag,setDrag]=useState<DragState|null>(null);
 const pointer=useRef<PointerState|null>(null);
 useEffect(()=>{setPlacements({});setSelected(null);setChecked(false);setMessage("");setDrag(null);pointer.current=null;},
  [diagram.organism,diagram.assignmentPath.join("|")]);
 const evaluation=bioAssemblyEvaluate(nodes,path,placements);
 const completed=evaluation.passed&&checked;
 const place=(level:BioAssemblyLevel,id:string|null)=>{
  if(!id)return;
  const next=bioAssemblyPlace(nodes,placements,level,id);
  if(!next){
   setMessage("Эта карточка относится к другому уровню строения. Выберите подходящий уровень.");
   return;
  }
  setPlacements(next);setChecked(false);setMessage("");setSelected(null);
 };
 const choose=(id:string)=>{
  setSelected(current=>current===id?null:id);
  setChecked(false);setMessage("");
 };
 const stopDrag=()=>{pointer.current=null;setDrag(null);};
 const onDown=(e:ReactPointerEvent<HTMLButtonElement>,id:string)=>{
  if(e.pointerType==="mouse"&&e.button!==0)return;
  e.stopPropagation();
  pointer.current={id,pointerId:e.pointerId,startX:e.clientX,startY:e.clientY,moved:false};
  e.currentTarget.setPointerCapture(e.pointerId);
  setSelected(id);setChecked(false);setMessage("");
 };
 const onMove=(e:ReactPointerEvent<HTMLButtonElement>)=>{
  const state=pointer.current;
  if(!state||state.pointerId!==e.pointerId)return;
  if(!state.moved&&Math.hypot(e.clientX-state.startX,e.clientY-state.startY)<8)return;
  state.moved=true;
  setDrag({id:state.id,x:e.clientX,y:e.clientY});
 };
 const onUp=(e:ReactPointerEvent<HTMLButtonElement>)=>{
  const state=pointer.current;
  if(!state||state.pointerId!==e.pointerId)return;
  if(state.moved){
   const target=document.elementFromPoint(e.clientX,e.clientY)?.closest<HTMLElement>("[data-bio-drop-level]");
   const level=target?.dataset.bioDropLevel as BioAssemblyLevel|undefined;
   if(level&&BIO_ASSEMBLY_LEVELS.includes(level))place(level,state.id);
  }
  stopDrag();
 };
 const review=()=>{
  setChecked(true);
  setSelected(null);
  setMessage(!evaluation.complete?
   "Разместите четыре карточки: систему, орган, ткань и клетку.":
   evaluation.passed?
    "Верно! Все четыре уровня и их родственные связи соответствуют выбранному организму.":
    "Правильно "+evaluation.correct+" из 4. Проверьте отмеченные позиции. Учитывается не только уровень, но и принадлежность к выбранной ветви.");
 };
 if(answer.length!==5)return <p role="alert">Задание невозможно открыть: нарушена цепочка строения организма.</p>;
 const categories=BIO_ASSEMBLY_LEVELS.map(level=>({
  level,items:palette.filter(node=>node.level===level)
 }));
 return <section className="lektrus-bio-build" aria-label="Сборка биологического организма" onPointerDown={e=>e.stopPropagation()}>
  <div className="lektrus-bio-build-heading">
   <div><strong>Соберите строение организма</strong>
    <p>Отмечена область на схеме. Перетащите названия в четыре ячейки или нажмите карточку, затем ячейку.</p>
   </div>
   <span className="lektrus-bio-build-progress" aria-live="polite">{Object.keys(placements).length}/4</span>
  </div>
  <div className="lektrus-bio-build-workbench">
   <div className="lektrus-bio-build-specimen">
    <LektrusBioAnatomyScene organism={diagram.organism} node={root}
     children={bioChildren(nodes,root.id)} interactive={false}
     focusChildId={path[1]} onSelect={()=>{}}/>
    <small>{BIO_ORGANISMS[diagram.organism].name} · выделена область для изучения</small>
   </div>
   <div className="lektrus-bio-build-stack" aria-label="Пустые места для четырёх уровней">
    {BIO_ASSEMBLY_LEVELS.map((level,i)=>{
     const id=placements[level];
     const node=id?nodes.find(n=>n.id===id):undefined;
     const assessment=checked?evaluation.results[level]:null;
     return <div className="lektrus-bio-build-slot" key={level}>
      <button type="button" data-bio-drop-level={level}
       className={"lektrus-bio-build-drop"+(selected?" is-ready":"")+
        (assessment==="correct"?" is-correct":assessment==="wrong"?" is-wrong":"")}
       aria-label={BIO_LEVEL_LABELS[level]+": "+(node?.name??"выберите карточку")}
       onClick={()=>selected?place(level,selected):node?(
        setPlacements(prev=>bioAssemblyRemove(prev,level)),setChecked(false),setMessage("")
       ):undefined}>
       <span className="lektrus-bio-build-slot-number">{i+1}</span>
       <span className="lektrus-bio-build-slot-text"><small>{BIO_LEVEL_LABELS[level]}</small>
        <strong>{node?.name??"Перетащите сюда"}</strong>
       </span>
       {node&&<span aria-hidden="true" className="lektrus-bio-build-slot-action">×</span>}
      </button>
     </div>;
    })}
   </div>
  </div>
  <div className="lektrus-bio-build-bank" aria-label="Карточки для сборки">
   {categories.map(({level,items})=><div className="lektrus-bio-build-group" key={level}>
    <strong>{BIO_LEVEL_LABELS[level]}</strong>
    <div className="lektrus-bio-build-cards">
     {items.map(node=>{
      const used=Object.values(placements).includes(node.id);
      return <button type="button" key={node.id} data-bio-card={node.id}
       className={"lektrus-bio-build-card"+(selected===node.id?" is-selected":"")+
        (used?" is-used":"")}
       aria-pressed={selected===node.id}
       onPointerDown={e=>onDown(e,node.id)}
       onPointerMove={onMove} onPointerUp={onUp}
       onPointerCancel={stopDrag}
       onClick={e=>{if(e.detail===0)choose(node.id);}}
       title={node.name}><span className="lektrus-bio-build-card-symbol" aria-hidden="true">⠿</span>
        {node.name}{used&&<span aria-label="Уже поставлено"> ✓</span>}
      </button>;
     })}
    </div>
   </div>)}
  </div>
  <div className="lektrus-bio-build-actions">
   <button type="button" className="lektrus-bio-build-check" onClick={review}>
    Проверить сборку
   </button>
   <button type="button" className="lektrus-bio-build-reset" onClick={()=>{
    setPlacements({});setSelected(null);setChecked(false);setMessage("");
   }}>Очистить</button>
   {completed&&<span className="lektrus-bio-build-result">Все связи правильные <span aria-hidden="true">✓</span></span>}
  </div>
  {message&&<p className={"lektrus-bio-build-feedback"+(completed?" is-success":"")}
   role="status">{message}</p>}
  {drag&&<div className="lektrus-bio-build-ghost" aria-hidden="true"
   style={{left:drag.x+14,top:drag.y+14}}>
   {nodes.find(node=>node.id===drag.id)?.name}
  </div>}
  <small className="lektrus-bio-build-note">Учебные схемы без истинного оптического масштаба. Ответы остаются в этой попытке, эталон преподавателя не изменяется.</small>
 </section>;
}
