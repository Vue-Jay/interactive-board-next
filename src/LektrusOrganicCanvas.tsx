import {useRef,useState,type PointerEvent as ReactPointerEvent} from "react";
import type {Item} from "./boardModel";
import {analyzeOrganicStructure,organicAtomColor} from "./lektrusOrganicFormula";

type Point=NonNullable<Item["graphPoints"]>[number];
type Bond=NonNullable<Item["graphSegments"]>[number];
type Tool="select"|"single"|"double"|"triple"|"C"|"N"|"O"|"H"|"S"|"erase"|"ring5"|"ring6";
type Props={item:Item;onChange:(updater:(item:Item)=>Item)=>void};
const W=560,H=390,UNIT=32;
const toSvg=(p:{x:number;y:number})=>({x:W/2+p.x*UNIT,y:H/2-p.y*UNIT});
const toGraph=(p:{x:number;y:number})=>({x:(p.x-W/2)/UNIT,y:(H/2-p.y)/UNIT});
const clamp=(x:number,min:number,max:number)=>Math.min(max,Math.max(min,x));
const bond=(a:number,b:number,order:1|2|3):Bond=>({a,b,kind:"segment",label:"",measure:false,bondOrder:order});
const positions:Record<string,number>={C:4,N:3,O:2,H:1,S:2};
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
 const [draftEnd,setDraftEnd]=useState<{x:number;y:number}|null>(null);
 const pointer=useRef<{id:number;start:{x:number;y:number};from:number|null;moving:boolean}|null>(null);
 const svg=useRef<SVGSVGElement>(null);
 const points=item.graphPoints??[],segments=item.graphSegments??[];
 const info=analyzeOrganicStructure(item);
 const selectedBond=(tool==="single"||tool==="double"||tool==="triple")?({single:1,double:2,triple:3} as const)[tool]:1;
 const svgPoint=(e:ReactPointerEvent<SVGElement>)=>{
  const r=svg.current?.getBoundingClientRect()??e.currentTarget.getBoundingClientRect();
  return toGraph({x:(e.clientX-r.left)*W/Math.max(1,r.width),y:(e.clientY-r.top)*H/Math.max(1,r.height)});
 };
 const mutate=(points:Point[],segments:Bond[])=>onChange(old=>({...old,graphPoints:points,graphSegments:segments}));
 const addConnection=(from:number,target:{x:number;y:number},existing:number|null)=>{
  if(points.length>=80)return;
  const snap=snapAngle(target,points[from]);
  let matched=existing;
  if(matched===null){matched=points.findIndex((p,i)=>i!==from&&Math.hypot(p.x-snap.x,p.y-snap.y)<.45);if(matched<0)matched=null;}
  const nextPts=matched===null?[...points,{...snap,label:"C",color:organicAtomColor("C")}]:points;
  const to=matched??points.length;
  if(from===to)return;
  const existingIndex=segments.findIndex(b=>b.a===from&&b.b===to||b.b===from&&b.a===to);
  const nextBonds=existingIndex>=0?segments.map((b,i)=>i===existingIndex?{...b,bondOrder:selectedBond}:b):[...segments,bond(from,to,selectedBond)];
  if(!possible(nextPts,nextBonds,from,to,selectedBond))return;
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
 const addRing=(size:5|6,origin?:{x:number;y:number},attachment:number|null=null)=>{
  if(points.length+size>80)return;
  const center=origin??{x:0,y:0},radius=2.15;
  const vertices=Array.from({length:size},(_,i)=>({x:center.x+radius*Math.cos(-Math.PI/2+i*Math.PI*2/size),
   y:center.y+radius*Math.sin(-Math.PI/2+i*Math.PI*2/size)}));
  const old=attachment!=null?points[attachment]:null;
  if(old){const dx=old.x-vertices[0].x,dy=old.y-vertices[0].y;for(const p of vertices){p.x+=dx;p.y+=dy;}}
  const ringPts=[...points,...vertices.slice(old?1:0).map(p=>({...p,label:"C",color:organicAtomColor("C")}))];
  const ids=vertices.map((_,i)=>old&&i===0?attachment!:points.length+i-(old?1:0));
  const ringBonds=Array.from({length:size},(_,i)=>bond(ids[i],ids[(i+1)%size],1));
  mutate(ringPts,[...segments,...ringBonds]);setSelected(ids[0]);
 };
 const handleBlank=(e:ReactPointerEvent<SVGElement>)=>{
  const pos=svgPoint(e);
  if(tool==="ring5"||tool==="ring6"){addRing(tool==="ring5"?5:6,pos);return;}
  if(tool==="select"){setSelected(null);return;}
  if(tool==="erase")return;
  if(points.length>=80)return;
  const symbol=(["C","N","O","H","S"] as Tool[]).includes(tool)?tool:"C";
  if(tool==="single"||tool==="double"||tool==="triple"){
   const from=points.length;const end={x:clamp(pos.x+2.15,-8.2,8.2),y:pos.y};
   mutate([...points,{...pos,label:"C",color:organicAtomColor("C")},
     {...end,label:"C",color:organicAtomColor("C")}],[...segments,bond(from,from+1,selectedBond)]);
   setSelected(from+1);
  }else{mutate([...points,{...pos,label:symbol,color:organicAtomColor(symbol)}],segments);setSelected(points.length)}
 };
 const handleAtom=(e:ReactPointerEvent<SVGGElement>,index:number)=>{
  e.stopPropagation();e.preventDefault();
  const p=toGraph({x:(e.clientX-(svg.current?.getBoundingClientRect().left??0))*W/Math.max(1,svg.current?.getBoundingClientRect().width??W),
   y:(e.clientY-(svg.current?.getBoundingClientRect().top??0))*H/Math.max(1,svg.current?.getBoundingClientRect().height??H)});
  const el=e.currentTarget.ownerSVGElement;if(!el)return;
  pointer.current={id:e.pointerId,start:p,from:index,moving:false};
  el.setPointerCapture(e.pointerId);setSelected(index);
 };
 const onMove=(e:ReactPointerEvent<SVGSVGElement>)=>{
  const ptr=pointer.current;if(!ptr||ptr.id!==e.pointerId)return;
  const pos=svgPoint(e);
  if(Math.hypot(pos.x-ptr.start.x,pos.y-ptr.start.y)>.2)ptr.moving=true;
  if(tool==="select"&&ptr.from!==null&&ptr.moving){
   const moving=ptr.from;
   onChange(old=>({...old,graphPoints:(old.graphPoints??[]).map((p,i)=>i===moving?{...p,...pos}:p)}));
  }else if(ptr.from!==null&&(tool==="single"||tool==="double"||tool==="triple"))setDraftEnd(pos);
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
  if((["C","N","O","H","S"] as Tool[]).includes(tool)){
   mutate(points.map((v,i)=>i===index?{...v,label:tool,color:organicAtomColor(tool)}:v),segments);return;
  }
  if(tool==="ring5"||tool==="ring6"){addRing(tool==="ring5"?5:6,undefined,index);return;}
  if(tool==="single"||tool==="double"||tool==="triple"){
   const endIndex=points.findIndex((v,i)=>i!==index&&Math.hypot(v.x-p.x,v.y-p.y)<.55);
   extend(index,ptr.moving?p:undefined,endIndex>=0?endIndex:null);
  }
 };
 const clickBond=(e:React.PointerEvent<SVGLineElement>,index:number)=>{
  e.preventDefault();e.stopPropagation();
  const link=segments[index];
  if(tool==="erase"){mutate(points,segments.filter((_,i)=>i!==index));return;}
  if(tool!=="single"&&tool!=="double"&&tool!=="triple")return;
  const next=(link.bondOrder??1)%3+1 as 1|2|3;
  const order=next;
  if(possible(points,segments,link.a,link.b,order))
   mutate(points,segments.map((b,i)=>i===index?{...b,bondOrder:order}:b));
 };
 const labels:{value:Tool;name:string}[]=[
  {value:"select",name:"Выбор"},{value:"single",name:"—"},{value:"double",name:"="},
  {value:"triple",name:"≡"},{value:"C",name:"C"},{value:"N",name:"N"},
  {value:"O",name:"O"},{value:"H",name:"H"},{value:"S",name:"S"},
  {value:"ring5",name:"Пятиугольник"},{value:"ring6",name:"Шестиугольник"},
  {value:"erase",name:"Удалить"}
 ];
 return <div className="lektrus-organic-editor">
  <div className="lektrus-organic-editor-toolbar" role="toolbar" aria-label="Органический конструктор">
   {labels.map(o=><button type="button" key={o.value} aria-pressed={tool===o.value}
    onClick={()=>setTool(o.value)}>{o.name}</button>)}
   <label><input type="checkbox" checked={carbonLabels} onChange={e=>setCarbonLabels(e.target.checked)}/> Показывать C</label>
  </div>
  <div className="lektrus-organic-canvas-scroll">
   <svg ref={svg} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Конструктор органических молекул"
    onPointerDown={e=>{if(e.target===e.currentTarget){e.preventDefault();handleBlank(e)}}}
    onPointerMove={onMove} onPointerUp={onEnd} onPointerCancel={onEnd}
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
    {draftEnd!==null&&pointer.current?.from!=null&&(()=>{
     const from=points[pointer.current.from];if(!from)return null;
     const p=toSvg(from),q=toSvg(snapAngle(draftEnd,from));
     return <line x1={p.x} y1={p.y} x2={q.x} y2={q.y}
      stroke="#7aa3d8" strokeWidth="2" strokeDasharray="6 5" pointerEvents="none"/>;
    })()}
    {points.map((atom,index)=>{
     const p=toSvg(atom),carbon=atom.label==="C";
     return <g key={index} onPointerDown={e=>handleAtom(e,index)} style={{cursor:tool==="select"?"grab":"crosshair"}}>
      {(selected===index||!carbon||carbonLabels)&&<circle cx={p.x} cy={p.y} r="13"
       fill={selected===index?"#e5effe":"#fff"} stroke={selected===index?"#8cafe6":"transparent"}/>}
      {(carbonLabels||!carbon)&&<text x={p.x} y={p.y+5} textAnchor="middle"
        fill={organicAtomColor(atom.label)} fontSize="16" fontWeight="750"
        pointerEvents="none">{atom.label}</text>}
      {selected===index&&<circle cx={p.x} cy={p.y} r="5" fill="#93b6e4" pointerEvents="none"/>}
      <circle cx={p.x} cy={p.y} r="17" fill="transparent"/>
     </g>;
    })}
   </svg>
  </div>
  <div className="lektrus-organic-footer">
   <div><strong>Формула: {info.valid?info.formula:"Проверьте валентности"}</strong>
    <small>{info.note}</small></div>
   <small>Коснитесь атома выбранной связью, чтобы продолжить цепь. Нажмите на связь, чтобы изменить кратность. Перетаскивайте атом в режиме «Выбор».</small>
  </div>
 </div>;
}
