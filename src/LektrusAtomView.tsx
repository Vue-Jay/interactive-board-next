import {useRef,useState,type PointerEvent} from "react";
import {atomShells,elementByNumber,orbitalSublevels,type AtomModel} from "./lektrusAtomModel";
import {elementFacts} from "./lektrusElementFacts";
type Props={model:AtomModel;onLabelMove?:(x:number,y:number)=>void};
const cx=350,cy=207;
const rotationPoint=(radius:number,angle:number)=>({x:cx+radius*Math.cos(angle),y:cy+radius*Math.sin(angle)});
export default function LektrusAtomView({model,onLabelMove}:Props){
 const element=elementByNumber(model.atomicNumber);
 const shells=atomShells(model.atomicNumber);
 const config=elementFacts[model.atomicNumber-1]?.electronConfiguration??"—";
 const [selectedLabel,setSelectedLabel]=useState(false);
 const dragging=useRef<{pointerId:number;startX:number;startY:number;originX:number;originY:number}|null>(null);
 const labelX=cx+model.labelX,labelY=(model.mode==="orbital"||model.mode==="lewis"?Math.max(460,90+orbitalSublevels(element.number).length*29)-33:423)+model.labelY;
 const begin=(event:PointerEvent<SVGGElement>)=>{
  if(!onLabelMove)return;
  event.preventDefault();event.stopPropagation();
  setSelectedLabel(true);
  const svg=event.currentTarget.ownerSVGElement;if(!svg)return;
  dragging.current={pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,
    originX:model.labelX,originY:model.labelY};
  svg.setPointerCapture(event.pointerId);
 };
 const move=(event:PointerEvent<SVGSVGElement>)=>{
  const drag=dragging.current;if(!drag||drag.pointerId!==event.pointerId)return;
  const rect=event.currentTarget.getBoundingClientRect();
  const unit=Math.min(rect.width/700,rect.height/460)||1;
  onLabelMove?.(Math.max(-235,Math.min(235,drag.originX+(event.clientX-drag.startX)/unit)),
    Math.max(-90,Math.min(20,drag.originY+(event.clientY-drag.startY)/unit)));
 };
 const end=(event:PointerEvent<SVGSVGElement>)=>{
  if(dragging.current?.pointerId!==event.pointerId)return;
  dragging.current=null;
  if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
 };
 const ringMax=45+(shells.length-1)*23;
 const orbital= model.mode==="orbital"||model.mode==="lewis";
 const orbitalRows=orbital?orbitalSublevels(element.number).length:0;
 const orbitalCanvasHeight=Math.max(460,90+orbitalRows*29);
 const mass=Number((elementFacts[element.number-1]?.atomicMass??"").replace(/[^0-9.]/g,""));
 const neutronCount=Number.isFinite(mass)?Math.max(0,Math.round(mass)-element.number):null;
 const nucleus=<g pointerEvents="none">
  <circle cx={cx} cy={cy} r={model.mode==="nucleus"?58:20}
    fill="#f1f5fd" stroke="#9fb8d8" strokeWidth="1.2"/>
  <text x={cx} y={cy-3} textAnchor="middle" fontSize={model.mode==="nucleus"?16:11}
    fontWeight="700" fill="#355a8a">{element.symbol}</text>
  <text x={cx} y={cy+12} textAnchor="middle" fontSize="10"
    fill="#68829f">Z={element.number}</text>
 </g>;
 return <svg className={"lektrus-atom-svg"+(orbital?" orbital":"")} viewBox={"0 0 700 "+orbitalCanvasHeight}
    role="img" aria-label={"Строение атома "+element.name}
    onPointerMove={move} onPointerUp={end} onPointerCancel={end}>
  <rect width="700" height="460" rx="12" fill="#fff" onClick={()=>setSelectedLabel(false)}/>
  {model.mode==="shell"&&<>
    {shells.map((count,i)=>{
      const radius=45+i*23;
      return <g key={i}>
       <circle cx={cx} cy={cy} r={radius} stroke="#b8cee8" strokeWidth="1.15" fill="none"/>
       {Array.from({length:count},(_,j)=>{
        const p=rotationPoint(radius,-Math.PI/2+j/count*Math.PI*2);
        return <circle key={j} cx={p.x} cy={p.y} r={Math.max(2,Math.min(3.1,22/(i+4)))}
          fill="#4e86c5" stroke="#fff" strokeWidth=".5"/>;
       })}
      </g>;
    })}
    {nucleus}
  </>}
  {model.mode==="orbit"&&<>
    <g transform={"translate("+cx+" "+cy+")"} fill="none" stroke="#aec7e4" strokeWidth="1.2">
      <ellipse rx="165" ry="62" transform="rotate(-33)"/>
      <ellipse rx="165" ry="62" transform="rotate(30)"/>
      <ellipse rx="145" ry="85" transform="rotate(90)"/>
    </g>
    {[-33,30,90].map((angle,i)=>{
      const rad=angle*Math.PI/180,t=i*2.25;
      const x=cx+Math.cos(t)*165*Math.cos(rad)-Math.sin(t)*62*Math.sin(rad);
      const y=cy+Math.cos(t)*165*Math.sin(rad)+Math.sin(t)*62*Math.cos(rad);
      return <circle key={angle} cx={x} cy={y} r="3.2" fill="#4c85c1"/>;
    })}
    {nucleus}
    <text x="350" y="355" textAnchor="middle" fontSize="12" fill="#7e90aa">Орбиты условные, не масштабные</text>
  </>}
  {(model.mode==="orbital"||model.mode==="lewis")&&(()=>{
    const subs=orbitalSublevels(element.number);
    const step=29;
    const yBottom=orbitalCanvasHeight-108;
    const locations=subs.map((sub,index)=>({
      x:156+(sub.n-1)*24+({s:0,p:48,d:106,f:166,g:214}[sub.letter]),
      y:yBottom-index*step,
      sub
    }));
    const stair=locations.map(p=>(p.x-20)+","+(p.y+3)).join(" ");
    return <g>
      <rect x="65" y="22" width="570" height={orbitalCanvasHeight-58} rx="11"
        fill="#fbfdff" stroke="#e6edf7"/>
      <text x="84" y="47" fontSize="13" fontWeight="700" fill="#3c638b">
        Орбитальная диаграмма · {element.symbol}
      </text>
      <text x="84" y="66" fontSize="10.5" fill="#8194ae">
        Уровни по энергии снизу вверх · ↑↓ направления спинов
      </text>
      <path d="M100 "+(orbitalCanvasHeight-79)+"V100m-5 8l5-8 5 8" stroke="#8fa8c9" strokeWidth="1.5"
        strokeLinecap="round" fill="none"/>
      <text x="83" y="97" fontSize="10" textAnchor="middle" fill="#7391b4">E</text>
      {stair&&<polyline points={stair} stroke="#cfdaeb" strokeWidth="1.2"
        strokeDasharray="4 4" fill="none" pointerEvents="none"/>}
      {locations.map(({x,y,sub})=><g key={sub.name}>
        <text x={x-13} y={y+4.2} textAnchor="end" fontSize="12.5"
          fontWeight="700" fill="#41638b">{sub.name}</text>
        {sub.spins.map((arrows,j)=>{
          const left=x+j*18.5;
          return <g key={j}>
           <rect x={left} y={y-11} width="17" height="18" rx="1"
             fill="#fff" stroke="#8fa9cd" strokeWidth="1.05"/>
           {arrows.map((spin,k)=><text key={k}
             x={left+(arrows.length===1?8.5:k===0?5:12)}
             y={y+3} textAnchor="middle" fontSize={arrows.length===1?16:12.8}
             fontWeight="650" fill={spin==="↑"?"#2465b3":"#c16d47"}>
             {spin}
           </text>)}
          </g>;
        })}
        <text x={x+sub.orbitals*18.5+6} y={y+3.5} fontSize="10" fill="#8196aa">
          {sub.electrons}
        </text>
      </g>)}
      <g fontSize="10" fill="#6d84a0">
        <text x="164" y={orbitalCanvasHeight-47}>Правило Хунда: сначала ↑ в разные орбитали, затем ↓.</text>
      </g>
      {subs.length===0&&<text x="350" y="225" textAnchor="middle"
        fontSize="13" fill="#aa6b57">Нет достоверной конфигурации для построения</text>}
    </g>;
  })()}
  {model.mode==="nucleus"&&<>
    <circle cx={cx} cy={cy} r="150" stroke="#b9cee7" strokeWidth="1.2" fill="none" strokeDasharray="5 6"/>
    {Array.from({length:Math.min(element.number,24)},(_,i)=>{
      const angle=i*2.39996,r=Math.sqrt(i/24)*49;
      return <circle key={"p"+i} cx={cx+r*Math.cos(angle)} cy={cy+r*Math.sin(angle)} r="3"
        fill="#d17a7a" opacity=".66"/>;
    })}
    {Array.from({length:Math.min(neutronCount??0,24)},(_,i)=>{
      const angle=i*2.39996+1.2,r=Math.sqrt(i/24)*46;
      return <circle key={"n"+i} cx={cx+r*Math.cos(angle)} cy={cy+r*Math.sin(angle)} r="2.7"
        fill="#7797b9" opacity=".66"/>;
    })}
    <rect x="238" y="334" width="224" height="45" rx="9" fill="#f5f8fd" stroke="#e4ebf5"/>
    <text x="350" y="353" textAnchor="middle" fontSize="12" fill="#486687">
      Протоны: {element.number} · нейтроны: {neutronCount??"—"}
    </text>
    <text x="350" y="370" textAnchor="middle" fontSize="10" fill="#8196ac">
      Электроны: {element.number} · нуклоны изображены условно
    </text>
  </>}
  {selectedLabel&&onLabelMove&&<>
    <path d={"M"+cx+" "+(cy+Math.min(ringMax,120))+" L"+labelX+" "+(labelY-22)}
      stroke="#83a6d5" strokeDasharray="4 4" strokeWidth="1.2" fill="none" pointerEvents="none"/>
    <rect x={labelX-130} y={labelY-21} width="260" height={model.showElectronConfiguration?42:24}
      rx="6" fill="none" stroke="#5a87cb" strokeWidth="1.1" strokeDasharray="4 3" pointerEvents="none"/>
  </>}
  <g onPointerDown={begin} onClick={e=>{e.stopPropagation();setSelectedLabel(true)}}
    style={{cursor:onLabelMove?"grab":"default"}}>
    <rect x={labelX-132} y={labelY-22} width="264" height={model.showElectronConfiguration?43:26}
      rx="5" fill="transparent"/>
    <text x={labelX} y={labelY-6} textAnchor="middle" fontSize="14" fontWeight="620"
      fill="#426080" pointerEvents="none">{element.name} ({element.symbol})</text>
    {model.showElectronConfiguration&&<text x={labelX} y={labelY+12} textAnchor="middle"
      fontSize="10.5" fill="#7890ab" pointerEvents="none">
      {config.length>65?config.slice(0,62)+"…":config}
    </text>}
  </g>
 </svg>;
}
