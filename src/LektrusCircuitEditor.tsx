import {useEffect,useMemo,useState,type DragEvent,type PointerEvent as ReactPointerEvent} from "react";
import {createPortal} from "react-dom";
import type {Item} from "./boardModel";
import {circuitSymbols,type CircuitCategory,type CircuitSymbol} from "./ScienceCircuitGlyph";
import ScienceCircuitGlyph from "./ScienceCircuitGlyph";
import LektrusCircuitView,{circuitSvgCoords,type CircuitSelection,type CircuitTool} from "./LektrusCircuitView";
import {
  circuitTemplate,circuitFromLegacyItem,circuitId,createCircuitDocument,
  clampCircuit,gridCircuit,circuitDocumentWithWire,
  circuitRemoveComponent,circuitRemoveJunction,
  type CircuitAnchor,type CircuitComponent,type CircuitDocument,type CircuitJunction
} from "./lektrusCircuitModel";

type Props={item:Item;onSave:(value:Item)=>void;onCancel:()=>void;onClose?:(value:Item)=>void};
type History={past:CircuitDocument[];present:CircuitDocument;future:CircuitDocument[]};
const templates=[
  {id:"physics-circuit-series",label:"Последовательная цепь"},
  {id:"physics-circuit-parallel",label:"Параллельное соединение"},
  {id:"physics-circuit-meters",label:"С измерительными приборами"},
  {id:"physics-circuit-free",label:"Чистая схема"}
] as const;
type TemplateId=(typeof templates)[number]["id"];
type Dragging={
  kind:"component"|"junction";id:string;pointerId:number;
  startX:number;startY:number;previewX:number;previewY:number;
  sourceX:number;sourceY:number;
};
const palettes:[CircuitCategory,string][]=[
  ["Источники","Источники питания"],["Нагрузка","Потребители и сопротивления"],
  ["Управление","Управление и защита"],["Измерение","Измерительные приборы"],
  ["Электроника","Электроника"]
];
const elementLabel=(type:CircuitSymbol)=>circuitSymbols.find(x=>x.id===type)?.label??type;
const countConnections=(doc:CircuitDocument,id:string)=>
  doc.wires.filter(w=>[w.from,w.to].some(a=>a.kind==="terminal"&&a.componentId===id)).length;

function addCircuitPart(doc:CircuitDocument,type:CircuitComponent["type"],x:number,y:number):CircuitDocument{
  if(doc.components.length>=120)return doc;
  return {...doc,components:[...doc.components,{
    id:circuitId(),type,x:clampCircuit(gridCircuit(x,doc.snap),45,855),
    y:clampCircuit(gridCircuit(y,doc.snap),45,535),rotation:0,label:"",value:"",
    closed:false
  }]};
}
function addCircuitNode(doc:CircuitDocument,x:number,y:number):[CircuitDocument,CircuitJunction]{
  const node:CircuitJunction={
    id:circuitId(),x:clampCircuit(gridCircuit(x,doc.snap),10,890),
    y:clampCircuit(gridCircuit(y,doc.snap),10,570)
  };
  return [{...doc,junctions:[...doc.junctions,node]},node];
}
export default function LektrusCircuitEditor({item,onSave,onCancel,onClose}:Props){
  const [history,setHistory]=useState<History>(()=>({
    past:[],present:circuitFromLegacyItem(item),future:[]
  }));
  const [title,setTitle]=useState(item.text||"Электрическая цепь");
  const [tool,setTool]=useState<CircuitTool>("select");
  const [category,setCategory]=useState<CircuitCategory>("Источники");
  const [placing,setPlacing]=useState<CircuitComponent["type"]>("resistor");
  const [selection,setSelection]=useState<CircuitSelection>(null);
  const [pending,setPending]=useState<CircuitAnchor|null>(null);
  const [cursor,setCursor]=useState<{x:number;y:number}|null>(null);
  const [dragging,setDragging]=useState<Dragging|null>(null);
  const [notice,setNotice]=useState("");
  const doc=history.present;
  const currentComponent=selection?.kind==="component"?
    doc.components.find(x=>x.id===selection.id):undefined;
  const currentJunction=selection?.kind==="junction"?
    doc.junctions.find(x=>x.id===selection.id):undefined;
  const currentWire=selection?.kind==="wire"?
    doc.wires.find(x=>x.id===selection.id):undefined;
  const visibleParts=useMemo(
    ()=>circuitSymbols.filter(x=>x.id!=="wire"&&x.category===category),[category]);
  const displayDoc=useMemo(()=>{
    if(!dragging)return doc;
    if(dragging.kind==="component")return {...doc,
      components:doc.components.map(c=>c.id===dragging.id?
        {...c,x:dragging.previewX,y:dragging.previewY}:c)};
    return {...doc,
      junctions:doc.junctions.map(n=>n.id===dragging.id?
        {...n,x:dragging.previewX,y:dragging.previewY}:n)};
  },[doc,dragging]);

  const commit=(next:CircuitDocument)=>{
    if(next===doc)return;
    setHistory(h=>({past:[...h.past.slice(-60),h.present],present:next,future:[]}));
  };
  const update=(change:(old:CircuitDocument)=>CircuitDocument)=>commit(change(doc));
  const undo=()=>setHistory(h=>h.past.length?{
    past:h.past.slice(0,-1),present:h.past[h.past.length-1],
    future:[h.present,...h.future].slice(0,60)
  }:h);
  const redo=()=>setHistory(h=>h.future.length?{
    past:[...h.past.slice(-60),h.present],
    present:h.future[0],future:h.future.slice(1)
  }:h);
  const normalized=():Item=>({
    ...item,text:title.trim().slice(0,100)||"Электрическая цепь",
    graphFigureId:"physics-circuit-free",graphPurpose:"geometry",graphAxisMode:"none",
    graphGrid:doc.showGrid,graphSnap:doc.snap,graphPoints:[],graphSegments:[],
    graphPolygons:[],graphCircles:[],graphAngles:[],graphMidpoints:[],
    scienceCircuit:doc,
    width:item.scienceCircuit?item.width:820,
    height:item.scienceCircuit?item.height:560
  });
  const close=()=>onClose?onClose(normalized()):onCancel();
  const changeTool=(next:CircuitTool)=>{
    setTool(next);setPending(null);setDragging(null);setNotice("");
  };
  const startTemplate=(id:TemplateId)=>{
    if(doc.components.length+doc.junctions.length+doc.wires.length>0&&
      !window.confirm("Заменить текущий чертёж выбранным шаблоном?"))return;
    commit(circuitTemplate(id));
    setPending(null);setSelection(null);setDragging(null);
    setTool("select");setNotice("Шаблон открыт. Все элементы можно перемещать и изменять.");
  };
  const dropSymbol=(type:CircuitComponent["type"],point:{x:number;y:number})=>{
    if(doc.components.length>=120){setNotice("Достигнут предел 120 элементов.");return}
    const next=addCircuitPart(doc,type,point.x,point.y);
    commit(next);
    setSelection({kind:"component",id:next.components[next.components.length-1].id});
    setNotice(elementLabel(type)+" добавлен. Контакты показаны по сторонам.");
  };
  const clickAnchor=(anchor:CircuitAnchor)=>{
    if(tool!=="wire"){
      if(anchor.kind==="terminal")setSelection({kind:"component",id:anchor.componentId});
      else setSelection({kind:"junction",id:anchor.junctionId});
      return;
    }
    if(!pending){setPending(anchor);setNotice("Выберите второй контакт или щёлкните по пустому полю.");return}
    if(doc.wires.length>=400){setNotice("Слишком много соединений.");return}
    const result=circuitDocumentWithWire(doc,pending,anchor);
    commit(result);setPending(null);setNotice(result===doc?"Такое соединение уже существует.":"Провод добавлен.");
  };
  const blank=(point:{x:number;y:number})=>{
    if(tool==="select"){setSelection(null);return}
    if(tool==="place"){dropSymbol(placing,point);return}
    if(doc.junctions.length>=240){setNotice("Достигнут предел 240 узлов.");return}
    if(tool==="junction"){
      const [next,node]=addCircuitNode(doc,point.x,point.y);
      commit(next);setSelection({kind:"junction",id:node.id});return;
    }
    if(tool==="wire"){
      const [next,node]=addCircuitNode(doc,point.x,point.y);
      const anchor:CircuitAnchor={kind:"junction",junctionId:node.id};
      const result=pending?circuitDocumentWithWire(next,pending,anchor):next;
      commit(result);setPending(anchor);
      setNotice("Узел создан. Продолжайте цепь или нажмите Esc.");
    }
  };
  const deleteSelected=()=>{
    if(!selection)return;
    if(selection.kind==="component")update(d=>circuitRemoveComponent(d,selection.id));
    else if(selection.kind==="junction")update(d=>circuitRemoveJunction(d,selection.id));
    else update(d=>({...d,wires:d.wires.filter(w=>w.id!==selection.id)}));
    setSelection(null);
  };
  const changeComponent=(part:Partial<CircuitComponent>)=>{
    if(!currentComponent)return;
    update(d=>({...d,components:d.components.map(c=>
      c.id===currentComponent.id?{...c,...part}:c)}));
  };
  const updateJunction=(position:Partial<CircuitJunction>)=>{
    if(!currentJunction)return;
    update(d=>({...d,junctions:d.junctions.map(n=>
      n.id===currentJunction.id?{...n,...position}:n)}));
  };
  const selectPart=(type:CircuitComponent["type"])=>{
    setPlacing(type);setTool("place");setPending(null);
    setSelection(null);setNotice("Щёлкните на чертеже, чтобы разместить "+elementLabel(type).toLowerCase()+".");
  };
  const downComponent=(event:ReactPointerEvent<SVGGElement>,component:CircuitComponent)=>{
    if(tool==="wire"){setSelection({kind:"component",id:component.id});return}
    if(tool!=="select")return;
    event.preventDefault();
    setSelection({kind:"component",id:component.id});
    const point=circuitSvgCoords(event.clientX,event.clientY,event.currentTarget.ownerSVGElement!);
    setDragging({kind:"component",id:component.id,pointerId:event.pointerId,
      startX:point.x,startY:point.y,sourceX:component.x,sourceY:component.y,
      previewX:component.x,previewY:component.y});
    event.currentTarget.ownerSVGElement?.setPointerCapture(event.pointerId);
  };
  const downJunction=(event:ReactPointerEvent<SVGCircleElement>,node:CircuitJunction)=>{
    if(tool!=="select")return;
    event.preventDefault();
    setSelection({kind:"junction",id:node.id});
    const point=circuitSvgCoords(event.clientX,event.clientY,event.currentTarget.ownerSVGElement!);
    setDragging({kind:"junction",id:node.id,pointerId:event.pointerId,
      startX:point.x,startY:point.y,sourceX:node.x,sourceY:node.y,
      previewX:node.x,previewY:node.y});
    event.currentTarget.ownerSVGElement?.setPointerCapture(event.pointerId);
  };
  const svgMove=(event:ReactPointerEvent<SVGSVGElement>)=>{
    const position=circuitSvgCoords(event.clientX,event.clientY,event.currentTarget);
    if(tool==="wire")setCursor(position);
    if(dragging&&dragging.pointerId===event.pointerId){
      event.preventDefault();
      setDragging(d=>d?{
        ...d,previewX:clampCircuit(gridCircuit(d.sourceX+position.x-d.startX,doc.snap),45,855),
        previewY:clampCircuit(gridCircuit(d.sourceY+position.y-d.startY,doc.snap),40,540)
      }:d);
    }
  };
  const svgUp=(event:ReactPointerEvent<SVGSVGElement>)=>{
    if(dragging&&dragging.pointerId===event.pointerId){
      const moved=Math.hypot(dragging.previewX-dragging.sourceX,dragging.previewY-dragging.sourceY)>0.5;
      if(moved){
        if(dragging.kind==="component")update(d=>({...d,components:d.components.map(c=>
          c.id===dragging.id?{...c,x:dragging.previewX,y:dragging.previewY}:c)}));
        else update(d=>({...d,junctions:d.junctions.map(n=>
          n.id===dragging.id?{...n,x:dragging.previewX,y:dragging.previewY}:n)}));
      }
      setDragging(null);
      if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };
  const drop=(event:DragEvent<SVGSVGElement>)=>{
    event.preventDefault();event.stopPropagation();
    const type=event.dataTransfer.getData("application/x-lektrus-circuit") as CircuitComponent["type"];
    if(String(type)==="wire"||!circuitSymbols.some(x=>x.id===type))return;
    dropSymbol(type,circuitSvgCoords(event.clientX,event.clientY,event.currentTarget));
    changeTool("select");
  };
  const duplicate=()=>{
    if(!currentComponent)return;
    if(doc.components.length>=120)return;
    const part={...currentComponent,id:circuitId(),
      x:clampCircuit(currentComponent.x+60,45,855),
      y:clampCircuit(currentComponent.y+60,45,535)};
    update(d=>({...d,components:[...d.components,part]}));
    setSelection({kind:"component",id:part.id});
  };
  const toggleSetting=(name:"showGrid"|"snap")=>update(d=>({...d,[name]:!d[name]}));
  const groupTypes=visibleParts;
  const modeInstruction=tool==="place"?"Щёлкните на листе, чтобы поставить элемент. Можно перетащить его из палитры.":
    tool==="wire"?"Щёлкните контакт → второй контакт. Щелчок по пустому месту создаст узел.":
    tool==="junction"?"Щёлкните, чтобы поставить узел соединения проводов.":
    "Выберите элемент или провод. Перетаскивание элемента сохраняет его соединения.";
  useEffect(()=>{
    const keyboard=(event:KeyboardEvent)=>{
      const target=event.target as HTMLElement;
      if(target?.closest("input,textarea,select,[contenteditable]"))return;
      const modifier=event.ctrlKey||event.metaKey;
      if(modifier&&event.key.toLowerCase()==="z"){
        event.preventDefault();event.stopPropagation();if(event.shiftKey)redo();else undo();
      }else if(modifier&&event.key.toLowerCase()==="y"){
        event.preventDefault();event.stopPropagation();redo();
      }else if(event.key==="Delete"||event.key==="Backspace"){
        event.preventDefault();deleteSelected();
      }else if(event.key==="Escape"){
        if(pending||tool!=="select"){event.preventDefault();changeTool("select")}
        else {event.stopPropagation();close()}
      }
    };
    window.addEventListener("keydown",keyboard,true);
    return()=>window.removeEventListener("keydown",keyboard,true);
  });
  return createPortal(
    <div className="lektrus-circuit-backdrop" onPointerDown={e=>{if(e.currentTarget===e.target)close()}}>
      <section className="lektrus-circuit-editor" role="dialog" aria-modal="true" aria-label="Конструктор электрических цепей"
        onPointerDown={e=>e.stopPropagation()}>
        <header className="lektrus-circuit-header">
          <div className="lektrus-circuit-mark">⌁</div>
          <div className="lektrus-circuit-title"><small>ФИЗИКА · ЭЛЕКТРИЧЕСТВО</small>
            <h2>Конструктор электрических цепей</h2></div>
          <div className="lektrus-circuit-header-actions">
            <button type="button" className="lektrus-circuit-icon-button" title="Отменить (Ctrl+Z)"
              aria-label="Отменить" disabled={!history.past.length} onClick={undo}>↶</button>
            <button type="button" className="lektrus-circuit-icon-button" title="Повторить (Ctrl+Y)"
              aria-label="Повторить" disabled={!history.future.length} onClick={redo}>↷</button>
            <button type="button" className="lektrus-circuit-close" aria-label="Закрыть редактор" onClick={close}>×</button>
          </div>
        </header>
        <div className="lektrus-circuit-editor-main">
          <aside className="lektrus-circuit-palette">
            <div className="lektrus-circuit-palette-section">
              <label>Название чертежа
                <input maxLength={100} value={title} onChange={e=>setTitle(e.target.value)}/>
              </label>
              <label>Готовая схема
                <select defaultValue="" onChange={e=>{
                  if(e.target.value)startTemplate(e.target.value as TemplateId);
                  e.target.value="";
                }}>
                  <option value="">Выбрать пример…</option>
                  {templates.map(t=><option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
              </label>
              <p>Примеры внутри одного инструмента. Можно полностью переделать схему.</p>
            </div>
            <div className="lektrus-circuit-palette-heading"><strong>Условные обозначения</strong><span>{circuitSymbols.length-1}</span></div>
            <div className="lektrus-circuit-categories">
              {palettes.map(([key,name])=><button type="button" key={key}
                className={category===key?"active":""} onClick={()=>setCategory(key)}>{name}</button>)}
            </div>
            <div className="lektrus-circuit-parts">
              {groupTypes.map(symbol=><button type="button" key={symbol.id} title={symbol.hint}
                draggable onDragStart={e=>{
                  e.dataTransfer.setData("application/x-lektrus-circuit",symbol.id);
                  e.dataTransfer.effectAllowed="copy";
                }}
                className={tool==="place"&&placing===symbol.id?"active":""}
                onClick={()=>selectPart(symbol.id as CircuitComponent["type"])}>
                <svg viewBox="0 0 92 40" aria-hidden="true"><path d="M7 20H85" stroke="#5b7391" strokeWidth="1.6"/>
                  <ScienceCircuitGlyph type={symbol.id} x={46} y={20}/></svg>
                <span>{symbol.label}</span>
              </button>)}
            </div>
            <div className="lektrus-circuit-palette-note">Щёлкните обозначение, затем место на чертеже. Можно перетаскивать его из списка.</div>
          </aside>
          <div className="lektrus-circuit-work">
            <div className="lektrus-circuit-toolbar">
              <div className="lektrus-circuit-toolgroup">
                <button type="button" className={tool==="select"?"active":""}
                  onClick={()=>changeTool("select")} title="Выделение и перемещение">↖ <span>Выбор</span></button>
                <button type="button" className={tool==="wire"?"active":""}
                  onClick={()=>changeTool("wire")} title="Соединить контакты и узлы">⌁ <span>Провод</span></button>
                <button type="button" className={tool==="junction"?"active":""}
                  onClick={()=>changeTool("junction")} title="Поставить узел соединения">● <span>Узел</span></button>
              </div>
              <div className="lektrus-circuit-toggle">
                <label><input type="checkbox" checked={doc.showGrid} onChange={()=>toggleSetting("showGrid")}/> Сетка</label>
                <label><input type="checkbox" checked={doc.snap} onChange={()=>toggleSetting("snap")}/> Привязка</label>
              </div>
            </div>
            <div className="lektrus-circuit-canvas-container">
              <LektrusCircuitView doc={displayDoc} mode={tool} selection={selection}
                pending={pending} cursor={cursor} onBlank={blank} onAnchor={clickAnchor}
                onSelection={setSelection} onComponentDown={downComponent} onJunctionDown={downJunction}
                onSvgMove={svgMove} onSvgUp={svgUp} onSvgLeave={()=>setCursor(null)} onDrop={drop}/>
            </div>
            <div className="lektrus-circuit-stage-bottom">
              <span>{modeInstruction}</span>
              <span>{doc.components.length} элементов · {doc.wires.length} проводов · {doc.junctions.length} узлов</span>
            </div>
          </div>
          <aside className="lektrus-circuit-inspector">
            <div className="lektrus-circuit-inspector-header"><strong>Свойства</strong><span>{selection?"Выбрано":"Выберите объект"}</span></div>
            {currentComponent&&<>
              <div className="lektrus-circuit-inspector-preview">
                <svg viewBox="0 0 100 65" aria-hidden="true">
                  <path d="M8 32H92" stroke="#455a75" strokeWidth="1.8"/>
                  <ScienceCircuitGlyph type={currentComponent.type} x={50} y={32}
                    closed={currentComponent.closed}/></svg>
                <strong>{elementLabel(currentComponent.type)}</strong>
                <small>{countConnections(doc,currentComponent.id)} соединений</small>
              </div>
              <label>Тип элемента
                <select value={currentComponent.type}
                  onChange={e=>changeComponent({type:e.target.value as CircuitComponent["type"]})}>
                  {palettes.map(([cat])=><optgroup label={cat} key={cat}>
                    {circuitSymbols.filter(s=>s.category===cat&&s.id!=="wire").map(s=>
                      <option key={s.id} value={s.id}>{s.label}</option>)}
                  </optgroup>)}
                </select>
              </label>
              <label>Обозначение <small>например, R1 или L1</small>
                <input maxLength={60} value={currentComponent.label}
                  onChange={e=>changeComponent({label:e.target.value})} placeholder="Без подписи"/>
              </label>
              <label>Значение на схеме <small>не вычисляется</small>
                <input maxLength={60} value={currentComponent.value}
                  onChange={e=>changeComponent({value:e.target.value})} placeholder="Например, 10 Ом"/>
              </label>
              {currentComponent.type==="switch"&&<label className="lektrus-circuit-checkbox">
                <input type="checkbox" checked={currentComponent.closed===true}
                  onChange={e=>changeComponent({closed:e.target.checked})}/> Замкнутый выключатель
              </label>}
              <div className="lektrus-circuit-inspector-subtitle">Ориентация</div>
              <div className="lektrus-circuit-rotate">
                {([0,90,180,270] as const).map(rotation=><button key={rotation}
                  type="button" className={currentComponent.rotation===rotation?"active":""}
                  onClick={()=>changeComponent({rotation})}>{rotation}°</button>)}
              </div>
              <div className="lektrus-circuit-two-fields">
                <label>X<input type="number" min={45} max={855} value={currentComponent.x}
                  onChange={e=>changeComponent({x:clampCircuit(Number(e.target.value)||45,45,855)})}/></label>
                <label>Y<input type="number" min={40} max={540} value={currentComponent.y}
                  onChange={e=>changeComponent({y:clampCircuit(Number(e.target.value)||40,40,540)})}/></label>
              </div>
              <div className="lektrus-circuit-inspector-actions">
                <button type="button" onClick={duplicate}>Дублировать</button>
                <button type="button" className="danger" onClick={deleteSelected}>Удалить</button>
              </div>
            </>}
            {currentJunction&&<>
              <div className="lektrus-circuit-inspector-subtitle">Узел соединения</div>
              <p>Перетащите узел по листу. Подключённые провода останутся на месте соединения.</p>
              <div className="lektrus-circuit-two-fields">
                <label>X<input type="number" min={10} max={890} value={currentJunction.x}
                  onChange={e=>updateJunction({x:clampCircuit(Number(e.target.value)||10,10,890)})}/></label>
                <label>Y<input type="number" min={10} max={570} value={currentJunction.y}
                  onChange={e=>updateJunction({y:clampCircuit(Number(e.target.value)||10,10,570)})}/></label>
              </div>
              <button className="lektrus-circuit-inspector-delete" type="button" onClick={deleteSelected}>Удалить узел и провода</button>
            </>}
            {currentWire&&<>
              <div className="lektrus-circuit-inspector-subtitle">Провод</div>
              <p>Линия автоматически перестраивается при движении элементов.</p>
              <label>Форма прокладки
                <select value={currentWire.route} onChange={e=>update(d=>({...d,wires:d.wires.map(w=>
                  w.id===currentWire.id?{...w,route:e.target.value as typeof w.route}:w)}))}>
                  <option value="hvh">Горизонтально → вертикально</option>
                  <option value="vhv">Вертикально → горизонтально</option>
                  <option value="straight">Прямая линия</option>
                </select>
              </label>
              <button className="lektrus-circuit-inspector-delete" type="button" onClick={deleteSelected}>Удалить провод</button>
            </>}
            {!selection&&<div className="lektrus-circuit-empty-inspector">
              <div className="lektrus-circuit-info-symbol">⌁</div>
              <strong>Схема собирается на листе</strong>
              <p>Выберите условное обозначение слева, разместите его и соедините контакты инструментом «Провод».</p>
              <p>У всех элементов сохраняются положение, поворот, подписи и подключения.</p>
            </div>}
            <div className="lektrus-circuit-inspector-footer">
              <button type="button" onClick={()=>{
                if(!window.confirm("Очистить все элементы и соединения?"))return;
                commit(createCircuitDocument());setSelection(null);setPending(null);setTool("select");
              }}>Очистить чертёж</button>
            </div>
          </aside>
        </div>
        <footer className="lektrus-circuit-footer">
          <span role="status">{notice||"Редактирование на компьютере · без автоматического решения задач"}</span>
          <button type="button" className="secondary" onClick={onCancel}>Отмена</button>
          <button type="button" className="primary" onClick={()=>onSave(normalized())}>Сохранить на доску</button>
        </footer>
      </section>
    </div>,document.body
  );
}
