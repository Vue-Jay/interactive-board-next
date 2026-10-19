import {useEffect,useRef,useState,type PointerEvent as ReactPointerEvent} from "react";
import type {Item} from "./boardModel";
import {analyzeOrganicStructure,organicAtomColor,organicAtomCaption} from "./lektrusOrganicFormula";
import LektrusOrganicHandwriting from "./LektrusOrganicHandwriting";

type Point=NonNullable<Item["graphPoints"]>[number];
type Bond=NonNullable<Item["graphSegments"]>[number];
type Tool="select"|"single"|"double"|"triple"|"C"|"N"|"O"|"H"|"S"|"F"|"Cl"|"Br"|"erase"|"ring5"|"ring6"|"benzene"|"chain"|"OH"|"NH2"|"COOH";
type Props={item:Item;onChange:(updater:(item:Item)=>Item)=>void};
const W=560,H=390,UNIT=32;
const toSvg=(p:{x:number;y:number})=>({x:W/2+p.x*UNIT,y:H/2-p.y*UNIT});
const toGraph=(p:{x:number;y:number})=>({x:(p.x-W/2)/UNIT,y:(H/2-p.y)/UNIT});
const clamp=(x:number,min:number,max:number)=>Math.min(max,Math.max(min,x));
const bond=(a:number,b:number,order:1|2|3):Bond=>({a,b,kind:"segment",label:"",measure:false,bondOrder:order});
const positions:Record<string,number>={C:4,N:3,O:2,H:1,S:2,F:1,Cl:1,Br:1};
const possible=(pts:Point[],edges:Bond[],a:number,b:number,order:1|2|3):boolean=>{
 const degree=pts.map(()=>0);
 for(const link of edges){if(link.a===a&&link.b===b||link.a===b&&link.b===a)continue;
  degree[link.a]+=(link.bondOrder??1);degree[link.b]+=(link.bondOrder??1);}
 return (degree[a]+order<=(positions[pts[a]?.label]??6))&&(degree[b]+order<=(positions[pts[b]?.label]??6));
};
const snapAngle=(p:{x:number;y:number},origin:{x:number;y:number})=>{
 const angle=Math.atan2(p.y-origin.y,p.x-origin.x);
 const target=Math.round(angle/(Math.PI/6))*Math.PI/6;
 return {x:clamp(origin.x+2.15*Math.cos(target),-8.2,8.2),y:clamp(origin.y+2.15*Math.sin(target),-5.2,5.2)};
};
export default function LektrusOrganicCanvas({item,onChange}:Props){
 const [tool,setTool]=useState<Tool>("single");
 const [selected,setSelected]=useState<number|null>(null);
 const [carbonLabels,setCarbonLabels]=useState(false);
 const [handwriting,setHandwriting]=useState(false);
 const [draftEnd,setDraftEnd]=useState<{x:number;y:number}|null>(null);
 const [hoverPoint,setHoverPoint]=useState<{x:number;y:number}|null>(null);
 const [status,setStatus]=useState("");
 const undoStack=useRef<{points:Point[];segments:Bond[];notes:NonNullable<Item["scienceOrganicAnnotations"]>}[]>([]);
 const remember=()=>{undoStack.current.push({points:structuredClone(points),segments:structuredClone(segments),notes:structuredClone(item.scienceOrganicAnnotations??[])});
    if(undoStack.current.length>35)undoStack.current.shift();};
 const undo=()=>{const previous=undoStack.current.pop();if(previous){
    onChange(old=>({...old,graphPoints:previous.points,graphSegments:previous.segments,scienceOrganicAnnotations:previous.notes}));
    setSelected(null);setStatus("");
 }};

 const pointer=useRef<{id:number;start:{x:number;y:number};from:number|null;moving:boolean}|null>(null);
 const svg=useRef<SVGSVGElement>(null);
 const points=item.graphPoints??[],segments=item.graphSegments??[];
 const info=analyzeOrganicStructure(item);
 const selectedBond=(tool==="single"||tool==="double"||tool==="triple")?({single:1,double:2,triple:3} as const)[tool]:1;
 const svgPoint=(e:ReactPointerEvent<SVGElement>)=>{
  const r=svg.current?.getBoundingClientRect()??e.currentTarget.getBoundingClientRect();
  return toGraph({x:(e.clientX-r.left)*W/Math.max(1,r.width),y:(e.clientY-r.top)*H/Math.max(1,r.height)});
 };
 const mutate=(nextPoints:Point[],nextSegments:Bond[])=>{remember();onChange(old=>({...old,graphPoints:nextPoints,graphSegments:nextSegments}));};
 // Add to the nearest atom with available valence; never start a second molecule.
 const nearestAttachment=(pos:{x:number;y:number},required=1)=>{
  let best=-1,distance=Infinity;
  for(let i=0;i<points.length;i++){
   const used=segments.reduce((sum,e)=>sum+(e.a===i||e.b===i?(e.bondOrder??1):0),0);
   if(used+required>(positions[points[i].label]??0))continue;
   const d=Math.hypot(pos.x-points[i].x,pos.y-points[i].y);
   if(d<distance){distance=d;best=i;}
  }
  return best;
 };
 const addConnection=(from:number,target:{x:number;y:number},existing:number|null,symbol="C")=>{
  if(points.length>=80&&existing===null)return;
  const snap=snapAngle(target,points[from]);
  let matched=existing;
  if(matched===null){matched=points.findIndex((p,i)=>i!==from&&Math.hypot(p.x-snap.x,p.y-snap.y)<.45);if(matched<0)matched=null;}
  const nextPts=matched===null?[...points,{...snap,label:symbol,color:organicAtomColor(symbol)}]:points;
  const to=matched??points.length;
  if(from===to)return;
  const existingIndex=segments.findIndex(b=>b.a===from&&b.b===to||b.b===from&&b.a===to);
  const nextBonds=existingIndex>=0?segments.map((b,i)=>i===existingIndex?{...b,bondOrder:selectedBond}:b):[...segments,bond(from,to,selectedBond)];
  if(!possible(nextPts,nextBonds,from,to,selectedBond)){setStatus("Слишком много связей для выбранного атома");return;}
  mutate(nextPts,nextBonds);setSelected(to);
 };
 const extend=(index:number,target?:{x:number;y:number},existing:number|null=null)=>{
  const base=points[index];if(!base||points.length>=80)return;
  const neighbor=segments.filter(b=>b.a===index||b.b===index)
    .map(b=>points[b.a===index?b.b:b.a]).filter(Boolean);
  let next=target;
  if(!next){
   const baseAngle=neighbor.length?Math.atan2(base.y-neighbor[0].y,base.x-neighbor[0].x):0;
   const angle=neighbor.length?baseAngle+(points.length%2===0?Math.PI/3:-Math.PI/3):0;
   next={x:base.x+2.15*Math.cos(angle),y:base.y+2.15*Math.sin(angle)};
  }
  addConnection(index,next,existing);
 };
 const addRing=(size:5|6,origin?:{x:number;y:number},attachment:number|null=null,aromatic=false)=>{
  if(points.length+size-(attachment===null?0:1)>80)return;
  const center=origin??{x:0,y:0},radius=2.15;
  const vertices=Array.from({length:size},(_,i)=>({x:center.x+radius*Math.cos(-Math.PI/2+i*Math.PI*2/size),
   y:center.y+radius*Math.sin(-Math.PI/2+i*Math.PI*2/size)}));
  const old=attachment!=null?points[attachment]:null;
  if(old){
   // Place the ring toward the pointer so it does not simply overlap its parent.
   const direction=Math.atan2((origin?.y??old.y)-old.y,(origin?.x??(old.x+radius))-old.x);
   const center={x:old.x+radius*Math.cos(direction),y:old.y+radius*Math.sin(direction)};
   for(let i=0;i<size;i++){
    vertices[i]={x:center.x+radius*Math.cos(direction+Math.PI+i*2*Math.PI/size),
     y:center.y+radius*Math.sin(direction+Math.PI+i*2*Math.PI/size)};
   }
  }
  const ringPts=[...points,...vertices.slice(old?1:0).map(p=>({...p,label:"C",color:organicAtomColor("C")}))];
  const ids=vertices.map((_,i)=>old&&i===0?attachment!:points.length+i-(old?1:0));
  const ringBonds=Array.from({length:size},(_,i)=>bond(ids[i],ids[(i+1)%size],aromatic&&i%2===0?2:1));
  const combined=[...segments,...ringBonds];
  const degrees=ringPts.map(()=>0);
  combined.forEach(edge=>{degrees[edge.a]+=(edge.bondOrder??1);degrees[edge.b]+=(edge.bondOrder??1)});
  if(degrees.some((value,i)=>value>(positions[ringPts[i]?.label]??6))){
    setStatus("Кольцо нарушает валентность атома. Выберите другое место присоединения.");return;
  }
  mutate(ringPts,combined);setStatus("");setSelected(ids[0]);
 };
 const attachFunctionalGroup=(from:number,kind:"OH"|"NH2"|"COOH",target?:{x:number;y:number})=>{
   const point=points[from],degree=segments.filter(e=>e.a===from||e.b===from)
     .reduce((v,e)=>v+(e.bondOrder??1),0);
   if(!point||degree+1>(positions[point.label]??6))return setStatus("Недостаточно свободной валентности");
   const neighbors=segments.filter(e=>e.a===from||e.b===from)
     .map(e=>points[e.a===from?e.b:e.a]).filter(Boolean);
   const theta=neighbors.length?Math.atan2(point.y-neighbors[0].y,point.x-neighbors[0].x)+Math.PI/3:0;
   const at=(center:{x:number;y:number},r:number,t:number)=>({x:center.x+r*Math.cos(t),y:center.y+r*Math.sin(t)});
   const next=target?snapAngle(target,point):at(point,2.15,theta);
   if(points.some(p=>Math.hypot(p.x-next.x,p.y-next.y)<.9))return setStatus("Здесь уже есть атом");
   const add=(pos:{x:number;y:number},label:string)=>({...pos,label,color:organicAtomColor(label)});
   const index=points.length;
   if(kind==="OH"||kind==="NH2"){
     if(index+1>80)return;
     mutate([...points,add(next,kind==="OH"?"O":"N")],[...segments,bond(from,index,1)]);
   }else{
     if(index+3>80)return;
     const ox=at(next,2.05,theta+Math.PI/2);
     const oh=at(next,2.05,theta-Math.PI/2);
     const more=[add(next,"C"),add(ox,"O"),add(oh,"O")];
     mutate([...points,...more],[...segments,bond(from,index,1),
       bond(index,index+1,2),bond(index,index+2,1)]);
   }
   setSelected(index);setStatus("");
 };
 const handleBlank=(e:ReactPointerEvent<SVGElement>)=>{
  const pos=svgPoint(e);
  if(tool==="select"){setSelected(null);return;}
  if(tool==="erase")return;
  const ring=tool==="ring5"||tool==="ring6"||tool==="benzene";
  const functional=tool==="OH"||tool==="NH2"||tool==="COOH";
  if(!points.length){
   if(functional){setStatus("Сначала добавьте атом углерода");return;}
   if(ring){addRing(tool==="ring5"?5:6,pos,null,tool==="benzene");return;}
   const symbol=(["C","N","O","H","S","F","Cl","Br"] as Tool[]).includes(tool)?tool:"C";
   if(tool==="single"||tool==="double"||tool==="triple"||tool==="chain"){
    const end={x:clamp(pos.x+2.15,-8.2,8.2),y:pos.y};
    mutate([{...pos,label:"C",color:organicAtomColor("C")},{...end,label:"C",color:organicAtomColor("C")}],
     [bond(0,1,selectedBond)]);setSelected(1);
   }else{mutate([{...pos,label:symbol,color:organicAtomColor(symbol)}],[]);setSelected(0);}
   setStatus("");return;
  }
  const from=nearestAttachment(pos,ring?2:tool==="double"?2:tool==="triple"?3:1);
  if(from<0){setStatus("Нет свободных валентностей для присоединения");return;}
  if(ring){addRing(tool==="ring5"?5:6,pos,from,tool==="benzene");return;}
  if(functional){attachFunctionalGroup(from,tool,pos);return;}
  const symbol=(["C","N","O","H","S","F","Cl","Br"] as Tool[]).includes(tool)?tool:"C";
  if(points.length>=80){setStatus("Достигнут предел в 80 атомов");return;}
  addConnection(from,pos,null,symbol);
  setStatus("");
 };
 const handleAtom=(e:ReactPointerEvent<SVGGElement>,index:number)=>{
  e.stopPropagation();e.preventDefault();
  const p=toGraph({x:(e.clientX-(svg.current?.getBoundingClientRect().left??0))*W/Math.max(1,svg.current?.getBoundingClientRect().width??W),
   y:(e.clientY-(svg.current?.getBoundingClientRect().top??0))*H/Math.max(1,svg.current?.getBoundingClientRect().height??H)});
  const el=e.currentTarget.ownerSVGElement;if(!el)return;
  pointer.current={id:e.pointerId,start:p,from:index,moving:false};
  if(tool==="select")remember();
  el.setPointerCapture(e.pointerId);setSelected(index);
 };
 const onMove=(e:ReactPointerEvent<SVGSVGElement>)=>{
  const pos=svgPoint(e);
  if(!pointer.current){setHoverPoint(pos);return;}
  const ptr=pointer.current;if(ptr.id!==e.pointerId)return;
  setHoverPoint(null);
  if(Math.hypot(pos.x-ptr.start.x,pos.y-ptr.start.y)>.2)ptr.moving=true;
  if(tool==="select"&&ptr.from!==null&&ptr.moving){
   const moving=ptr.from;
   onChange(old=>({...old,graphPoints:(old.graphPoints??[]).map((p,i)=>i===moving?{...p,...pos}:p)}));
  }else if(ptr.from!==null&&(tool==="single"||tool==="double"||tool==="triple"||tool==="chain"))setDraftEnd(pos);
 };
 const onEnd=(e:ReactPointerEvent<SVGSVGElement>)=>{
  const ptr=pointer.current;if(!ptr||ptr.id!==e.pointerId)return;
  pointer.current=null;setDraftEnd(null);
  if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);
  if(ptr.from===null)return;
  const p=svgPoint(e),index=ptr.from;
  if(tool==="erase"){
   const kept=segments.filter(l=>l.a!==index&&l.b!==index).map(l=>({...l,
    a:l.a>index?l.a-1:l.a,b:l.b>index?l.b-1:l.b}));
   mutate(points.filter((_,i)=>i!==index),kept);setSelected(null);return;
  }
  if(tool==="OH"||tool==="NH2"||tool==="COOH"){
   attachFunctionalGroup(index,tool);return;
  }
  if((["C","N","O","H","S","F","Cl","Br"] as Tool[]).includes(tool)){
   mutate(points.map((v,i)=>i===index?{...v,label:tool,color:organicAtomColor(tool)}:v),segments);return;
  }
  if(tool==="ring5"||tool==="ring6"||tool==="benzene"){addRing(tool==="ring5"?5:6,undefined,index,tool==="benzene");return;}
  if(tool==="single"||tool==="double"||tool==="triple"||tool==="chain"){
   const endIndex=points.findIndex((v,i)=>i!==index&&Math.hypot(v.x-p.x,v.y-p.y)<.55);
   extend(index,ptr.moving?p:undefined,endIndex>=0?endIndex:null);
   if(tool==="chain")setStatus("Цепь продлена. Коснитесь крайнего атома для следующего звена.");
  }
 };
 const clickBond=(e:React.PointerEvent<SVGLineElement>,index:number)=>{
  e.preventDefault();e.stopPropagation();
  const link=segments[index];
  if(tool==="erase"){mutate(points,segments.filter((_,i)=>i!==index));return;}
  if(tool!=="single"&&tool!=="double"&&tool!=="triple"&&tool!=="chain")return;
  const next=(link.bondOrder??1)%3+1 as 1|2|3;
  const order=next;
  if(possible(points,segments,link.a,link.b,order))
   mutate(points,segments.map((b,i)=>i===index?{...b,bondOrder:order}:b));
 };
 useEffect(()=>{
  const key=(e:KeyboardEvent)=>{
    const active=e.target;
    if(active instanceof HTMLElement&&active.closest("input, textarea, select, [contenteditable='true']"))return;
    const shortcut:Record<string,Tool>={"v":"select","1":"single","2":"double","3":"triple",
      "c":"C","n":"N","o":"O","h":"H","s":"S","f":"F","b":"Br","l":"Cl",
      "t":"ring6","g":"benzene","e":"erase"};
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="z"){
      e.preventDefault();undo();return;
    }
    if(e.ctrlKey||e.metaKey||e.altKey)return;
    const next=shortcut[e.key.toLowerCase()];
    if(next){e.preventDefault();setTool(next);}
    if((e.key==="Delete"||e.key==="Backspace")&&selected!==null){
      e.preventDefault();
      const kept=segments.filter(edge=>edge.a!==selected&&edge.b!==selected)
        .map(edge=>({...edge,a:edge.a>selected?edge.a-1:edge.a,b:edge.b>selected?edge.b-1:edge.b}));
      mutate(points.filter((_,i)=>i!==selected),kept);setSelected(null);
    }
  };
  window.addEventListener("keydown",key);
  return()=>window.removeEventListener("keydown",key);
 },[selected,points,segments,tool]);
 const labels:{value:Tool;name:string}[]=[
  {value:"select",name:"Выбор"},{value:"single",name:"—"},{value:"double",name:"="},
  {value:"triple",name:"≡"},{value:"C",name:"C"},{value:"N",name:"N"},
  {value:"O",name:"O"},{value:"H",name:"H"},{value:"S",name:"S"},
  {value:"F",name:"F"},{value:"Cl",name:"Cl"},{value:"Br",name:"Br"},
  {value:"ring5",name:"Цикл C₅"},{value:"ring6",name:"Цикл C₆"},
  {value:"benzene",name:"Бензол"},{value:"chain",name:"Цепь"},
  {value:"OH",name:"–OH"},{value:"NH2",name:"–NH₂"},{value:"COOH",name:"–COOH"},
  {value:"erase",name:"Удалить"}
 ];
 return <div className="lektrus-organic-editor">
  <div className="lektrus-organic-editor-toolbar" role="toolbar" aria-label="Органический конструктор">
   {labels.map(o=><button type="button" key={o.value} aria-pressed={tool===o.value}
    onClick={()=>setTool(o.value)}>{o.name}</button>)}
   <button type="button" onClick={undo} disabled={!undoStack.current.length}
      aria-label="Отменить построение" title="Отменить предыдущее изменение">↶ Отменить</button>
   <button type="button" aria-pressed={handwriting} onClick={()=>setHandwriting(v=>!v)}>✍ Рисовать и распознать</button>
   <label><input type="checkbox" checked={carbonLabels} onChange={e=>setCarbonLabels(e.target.checked)}/> Показывать C</label>
  </div>
  <div className="lektrus-organic-canvas-scroll">
   {handwriting&&<LektrusOrganicHandwriting item={item} onChange={update=>{remember();onChange(update)}} onExit={()=>setHandwriting(false)}/>}
   <svg ref={svg} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Конструктор органических молекул"
    onPointerDown={e=>{if(e.target===e.currentTarget){e.preventDefault();handleBlank(e)}}}
    onPointerMove={onMove} onPointerLeave={()=>setHoverPoint(null)} onPointerUp={onEnd} onPointerCancel={e=>{
      if(pointer.current?.id===e.pointerId)pointer.current=null;
      setDraftEnd(null);
      if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);
    }}
    style={{touchAction:"none"}}>
    <rect width={W} height={H} fill="#fff" onPointerDown={e=>{
     e.preventDefault();e.stopPropagation();handleBlank(e);}}/>
    {segments.map((edge,index)=>{
     const a=points[edge.a],b=points[edge.b];if(!a||!b)return null;
     const p=toSvg(a),q=toSvg(b),length=Math.hypot(q.y-p.y,q.x-p.x)||1;
     return <g key={index}>
      {Array.from({length:edge.bondOrder??1},(_,k)=>{
       const offset=(k-((edge.bondOrder??1)-1)/2)*5;
       const dx=-(q.y-p.y)/length*offset,dy=(q.x-p.x)/length*offset;
       return <line key={k} x1={p.x+dx} y1={p.y+dy} x2={q.x+dx} y2={q.y+dy}
        stroke="#36516c" strokeWidth="2.5" strokeLinecap="round" pointerEvents="none"/>;
      })}
      <line x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke="transparent" strokeWidth="23"
       onPointerDown={e=>clickBond(e,index)} style={{cursor:"pointer"}}/>
     </g>;
    })}
    {hoverPoint!==null&&points.length>0&&tool!=="select"&&tool!=="erase"&&(()=>{
     const required=(tool==="ring5"||tool==="ring6"||tool==="benzene")?2:tool==="double"?2:tool==="triple"?3:1;
     const fromIndex=nearestAttachment(hoverPoint,required);
     if(fromIndex<0)return null;
     const from=toSvg(points[fromIndex]),to=toSvg(snapAngle(hoverPoint,points[fromIndex]));
     return <g pointerEvents="none" aria-hidden="true">
      <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="#3986d2" strokeWidth="2.4" strokeDasharray="6 5"/>
      <circle cx={from.x} cy={from.y} r="20" fill="none" stroke="#3986d2" strokeWidth="1.6" strokeDasharray="4 4"/>
      <circle cx={to.x} cy={to.y} r="10" fill="#dcecff" stroke="#3986d2" strokeDasharray="3 3"/>
     </g>;
    })()}
    {draftEnd!==null&&pointer.current?.from!=null&&(()=>{
     const from=points[pointer.current.from];if(!from)return null;
     const p=toSvg(from),q=toSvg(snapAngle(draftEnd,from));
     return <line x1={p.x} y1={p.y} x2={q.x} y2={q.y}
      stroke="#7aa3d8" strokeWidth="2" strokeDasharray="6 5" pointerEvents="none"/>;
    })()}
    {(item.scienceOrganicAnnotations??[]).map((entry,index)=>{
      const at=toSvg(entry);
      return <text key={"note"+index} x={at.x} y={at.y}
       textAnchor="middle" fill="#335e96" fontSize="18" fontWeight="730"
       pointerEvents="none">{entry.text}</text>;
    })}
    {points.map((atom,index)=>{
     const p=toSvg(atom),carbon=atom.label==="C";
     return <g key={index} onPointerDown={e=>handleAtom(e,index)} style={{cursor:tool==="select"?"grab":"crosshair"}}>
      {(selected===index||!carbon||carbonLabels)&&<circle cx={p.x} cy={p.y} r="13"
       fill={selected===index?"#e5effe":"#fff"} stroke={selected===index?"#8cafe6":"transparent"}/>}
      {(()=>{const degree=segments.reduce((total,link)=>total+(link.a===index||link.b===index?(link.bondOrder??1):0),0);
       const caption=organicAtomCaption(atom.label,degree,carbonLabels);
       return caption?<text x={p.x} y={p.y+5} textAnchor="middle"
        fill={organicAtomColor(atom.label)} fontSize="16" fontWeight="750"
        pointerEvents="none">{caption}</text>:null;})()}
      {selected===index&&<circle cx={p.x} cy={p.y} r="5" fill="#93b6e4" pointerEvents="none"/>}
      <circle cx={p.x} cy={p.y} r="17" fill="transparent"/>
     </g>;
    })}
   </svg>
  </div>
  <div className="lektrus-organic-footer">
   {status&&<span role="status" className="lektrus-organic-status">{status}</span>}
   <div><strong>Формула: {info.valid?info.formula:"Проверьте валентности"}</strong>
    <small>{info.note}</small></div>
   <small>Новый атом или группа присоединяются к ближайшему свободному атому. Пунктир показывает место соединения до вставки. Для продолжения цепи касайтесь атомов.</small>
  </div>
 </div>;
}
