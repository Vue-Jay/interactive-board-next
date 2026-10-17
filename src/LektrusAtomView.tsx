import {useRef,useState,type PointerEvent} from "react";
import {atomShells,elementByNumber,orbitalSublevels,exampleIsotope,type AtomModel} from "./lektrusAtomModel";
import {elementFacts} from "./lektrusElementFacts";

type Props={model:AtomModel;onLabelMove?:(x:number,y:number)=>void;labelScale?:number;compactInPanel?:boolean};
const cx=250,cy=230;
const shellRadius=(index:number)=>45+index*27;
const sublevelX=(n:number,letter:string)=>118+(n-1)*10+({s:0,p:28,d:53,f:76,g:92}[letter]??0);

export default function LektrusAtomView({model,onLabelMove,labelScale=1,compactInPanel=false}:Props){
 const element=elementByNumber(model.atomicNumber);
 const shells=atomShells(element.number);
 const subs=orbitalSublevels(element.number);
 const isotope=exampleIsotope(element.number);
 const config=elementFacts[element.number-1]?.electronConfiguration??"Не установлена";
 const orbital=model.mode==="orbital"||model.mode==="lewis";
 const [selectedLabel,setSelectedLabel]=useState(false);
 const dragging=useRef<{id:number;startX:number;startY:number;originX:number;originY:number}|null>(null);
 const rows=orbital?[...subs].reverse():[];
 const rowHeight=compactInPanel?40:38;
 const orbitalHeight=Math.max(260,102+rows.length*rowHeight+62);
 const boxWidth=21,boxStep=23;
 const viewBox=orbital?`0 0 500 ${orbitalHeight}`:"0 0 500 510";
 const labelX=cx+model.labelX,labelY=465+model.labelY;
 const moveLabel=(event:PointerEvent<SVGSVGElement>)=>{
  const d=dragging.current;
  if(!d||d.id!==event.pointerId)return;
  const rect=event.currentTarget.getBoundingClientRect();
  const scale=rect.width/500||1;
  onLabelMove?.(Math.max(-150,Math.min(150,d.originX+(event.clientX-d.startX)/scale)),
   Math.max(-24,Math.min(22,d.originY+(event.clientY-d.startY)/scale)));
 };
 const endLabel=(event:PointerEvent<SVGSVGElement>)=>{
  if(dragging.current?.id!==event.pointerId)return;
  dragging.current=null;
  if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
 };
 const beginLabel=(event:PointerEvent<SVGGElement>)=>{
  if(!onLabelMove)return;
  event.preventDefault();event.stopPropagation();
  setSelectedLabel(true);
  dragging.current={id:event.pointerId,startX:event.clientX,startY:event.clientY,
   originX:model.labelX,originY:model.labelY};
  event.currentTarget.ownerSVGElement?.setPointerCapture(event.pointerId);
 };
 const svgText=(value:string,y:number,size:number,color="#48678c")=>
  <text x="250" y={y} textAnchor="middle" fontSize={size*labelScale}
    fill={color}>{value}</text>;

 const nucleus=<g>
  <circle cx={cx} cy={cy} r="24" fill="#edf4fd" stroke="#9fb9df" strokeWidth="1.5"/>
  {svgText(element.symbol,cy-2,16,"#245c9e")}
  {svgText("Z="+element.number,cy+13,11)}
 </g>;
 return <svg className={"lektrus-atom-svg"+(orbital?" orbital":"")}
   viewBox={viewBox} role="img" aria-label={"Модель "+element.name}
   onPointerMove={moveLabel} onPointerUp={endLabel} onPointerCancel={endLabel}>
  <rect x="0" y="0" width="500" height={orbital?orbitalHeight:510} fill="white"/>
  {orbital?<>
   <text x="18" y="30" fontSize={19*labelScale} fontWeight="750" fill="#2e527e">
    Подуровни · {element.symbol} · Z={element.number}
   </text>
   <text x="18" y="53" fontSize={12*labelScale} fill="#637e9c">
    Условный порядок заполнения · энергия ↑
   </text>
   <path d={`M30 ${orbitalHeight-61} V85 l-5 9 m5-9 l5 9`}
     stroke="#82a6d5" strokeWidth="1.6" fill="none"/>
   {rows.map((sub,index)=>{
    const x=sublevelX(sub.n,sub.letter),y=99+index*rowHeight;
    return <g key={sub.name}>
     <rect x="56" y={y-19} width="426" height={rowHeight-2} rx="6"
       fill={index%2===0?"#f7faff":"#fff"} stroke="#eaf0f8"/>
     <text x={x-13} y={y+6} textAnchor="end" fontSize={15*labelScale}
       fontWeight="750" fill="#365f92">{sub.name}</text>
     {sub.spins.map((arrows,slot)=><g key={slot}>
      <rect x={x+slot*boxStep} y={y-14} width={boxWidth} height="27"
       rx="2" stroke="#83a6d3" fill="#fff" strokeWidth="1.2"/>
      {arrows.map((spin,k)=><text key={k}
       x={x+slot*boxStep+(arrows.length===1?10.5:k===0?6:15)}
       y={y+6.5} fontSize={arrows.length===1?18:15}
       fontWeight="750" fill={spin==="↑"?"#276bb9":"#ba6e4b"}
       textAnchor="middle">{spin}</text>)}
     </g>)}
     <text x={Math.min(466,x+sub.orbitals*boxStep+9)} y={y+5}
       fontSize={11*labelScale} fill="#6982a0">{sub.electrons}e⁻</text>
    </g>;
   })}
   <text x="50" y={orbitalHeight-22} fontSize={11*labelScale} fill="#577392">
    ↑ и ↓: спины · сначала один электрон в орбиталь, затем пара
   </text>
   {rows.length===0&&svgText("Конфигурация подуровней не установлена",130,14)}
  </>:model.mode==="shell"?<>
   {shells.map((count,index)=>{
    const radius=shellRadius(index);
    return <g key={index}>
     <circle cx={cx} cy={cy} r={radius} fill="none" stroke="#b6cee9" strokeWidth="1.5"/>
     {Array.from({length:count},(_,j)=>{
      const angle=-Math.PI/2+j/count*Math.PI*2;
      return <circle key={j} cx={cx+radius*Math.cos(angle)}
       cy={cy+radius*Math.sin(angle)} r="3.7" fill="#4c83bd"
       stroke="white" strokeWidth=".7"/>;
     })}
    </g>;
   })}
   {nucleus}
   {svgText("Оболочки: "+shells.join(" · ")+" e⁻",28,13)}
  </>:model.mode==="orbit"?<>
   <g transform={`translate(${cx} ${cy})`} stroke="#a4bfe2" strokeWidth="1.7" fill="none">
    <ellipse rx="162" ry="65" transform="rotate(-32)"/>
    <ellipse rx="162" ry="65" transform="rotate(31)"/>
    <ellipse rx="147" ry="90" transform="rotate(90)"/>
   </g>
   {[[-32,1.1],[31,2.4],[90,4.4]].map(([angle,t],i)=>{
    const rad=angle*Math.PI/180;
    return <circle key={i}
      cx={cx+Math.cos(t)*162*Math.cos(rad)-Math.sin(t)*65*Math.sin(rad)}
      cy={cy+Math.cos(t)*162*Math.sin(rad)+Math.sin(t)*65*Math.cos(rad)}
      r="4" fill="#477fbd"/>;
   })}
   {nucleus}
   {svgText("Планетарная схема условна и не показывает реальные траектории электронов",32,10)}
  </>:model.mode==="nucleus"?<>
   {svgText("Состав нейтрального атома",42,18,"#315d91")}
   <circle cx={cx} cy={221} r="155" fill="#f7faff" stroke="#b5cbea"
     strokeWidth="1.5" strokeDasharray="5 5"/>
   <circle cx={cx} cy="221" r="112" fill="#eff4fb" stroke="#d6e3f1"/>
   <circle cx="203" cy="201" r="44" fill="#fde8e6" stroke="#dca5a4"/>
   <circle cx="297" cy="201" r="44" fill="#e0efff" stroke="#9ec3e8"/>
   <text x="203" y="195" textAnchor="middle" fontSize={16*labelScale}
     fill="#98555b" fontWeight="750">p⁺</text>
   <text x="203" y="219" textAnchor="middle" fontSize={23*labelScale}
     fill="#874750">{element.number}</text>
   <text x="297" y="195" textAnchor="middle" fontSize={16*labelScale}
     fill="#346eab" fontWeight="750">n⁰</text>
   <text x="297" y="219" textAnchor="middle" fontSize={21*labelScale}
     fill="#315d94">{isotope?isotope.neutrons:"?"}</text>
   <text x="250" y="300" textAnchor="middle" fontSize={14*labelScale}
     fill="#48678c">Электроны нейтрального атома: {element.number}</text>
   {isotope?<>
    {svgText("Пример изотопа: "+element.symbol+"-"+isotope.massNumber,391,15)}
    {svgText("A = "+isotope.massNumber+"; Z = "+element.number+"; N = "+isotope.neutrons,417,13)}
   </>:<>
    {svgText("Число нейтронов зависит от выбранного изотопа",391,12)}
    {svgText("Относительная атомная масса не равна массовому числу",416,10)}
   </>}
   {svgText("Схема ядра условна: размеры и расположение нуклонов не показаны",446,10)}
  </>:null}
  {!orbital&&model.mode!=="nucleus"&&<g
    onPointerDown={beginLabel}
    onClick={e=>{e.stopPropagation();setSelectedLabel(true)}}
    style={{cursor:onLabelMove?"grab":"default"}}>
   {selectedLabel&&onLabelMove&&<rect x={labelX-195} y={labelY-23} width="390" height="43"
     rx="6" fill="none" stroke="#5885c5" strokeDasharray="4 3"/>}
   <rect x={labelX-196} y={labelY-24} width="392" height="46" fill="transparent"/>
   <text x={labelX} y={labelY-6} textAnchor="middle"
     fontSize={17*labelScale} fontWeight="700" fill="#2c5485">
     {element.name} ({element.symbol})
   </text>
   {model.showElectronConfiguration&&<text x={labelX} y={labelY+13}
     fontSize={11*labelScale} fill="#607d9d" textAnchor="middle">
     <title>{config}</title>
     {config.length>50?config.slice(0,47)+"…":config}
   </text>}
  </g>}
 </svg>;
}
