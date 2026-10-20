import type {SchoolDiagram} from "./lektrusSchoolDiagramModel";
type DataChart=Extract<SchoolDiagram,{kind:"data-chart"}>;
type Props={diagram:DataChart;onChange?:(v:SchoolDiagram)=>void};
const palette=["#5d8ac5","#76ac91","#d9a35f","#a78bc7","#cd858e","#85adb0","#c5ba78","#8ea7d7"];
const uid=()=>crypto.randomUUID();
/** Diagram values are authored by the user, never example values or invented percentages. */
export default function LektrusDataChart({diagram:d,onChange}:Props){
 const values=d.points.map(p=>p.value);
 const max=Math.max(1,...values);
 const sum=values.reduce((v,n)=>v+n,0);
 const width=730/Math.max(1,d.points.length),baseline=415;
 const dots=d.points.map((point,i)=>[85+(i+.5)*width,baseline-point.value/max*285] as const);
 let progress=0;
 const arcs=d.points.map((p,i)=>{
  const start=progress;
  const fraction=sum>0?p.value/sum:0;
  progress+=fraction;
  const a=start*2*Math.PI-Math.PI/2,b=progress*2*Math.PI-Math.PI/2;
  const r=140,cx=345,cy=260;
  return {id:p.id,color:palette[i%palette.length],value:p.value,
   d:fraction>0&&fraction<1?
    `M${cx} ${cy}L${cx+Math.cos(a)*r} ${cy+Math.sin(a)*r}A${r} ${r} 0 ${fraction>.5?1:0} 1 ${cx+Math.cos(b)*r} ${cy+Math.sin(b)*r}Z`:"",
   whole:fraction===1};
 });
 return <div className="lektrus-data-chart"
  onPointerDown={e=>e.stopPropagation()} onPointerUp={e=>e.stopPropagation()}
  onClick={e=>e.stopPropagation()}>
  {onChange&&<div className="lektrus-data-chart-editor">
   <div className="lektrus-data-chart-types">
    {([{id:"bar",name:"Столбцы"},{id:"line",name:"Линия"},{id:"pie",name:"Круговая"}] as const)
     .map(t=><button type="button" key={t.id} aria-pressed={d.variant===t.id}
      className={d.variant===t.id?"active":""}
      onClick={()=>onChange({...d,variant:t.id})}>{t.name}</button>)}
   </div>
   <div className="lektrus-data-chart-fields">
    {d.points.map(point=><div key={point.id}>
     <input aria-label="Подпись" maxLength={50} value={point.label}
      onChange={e=>onChange({...d,points:d.points.map(p=>p.id===point.id?{...p,label:e.target.value}:p)})}/>
     <input aria-label="Значение" type="number" min="0" max="1000000000" value={point.value}
      onChange={e=>onChange({...d,points:d.points.map(p=>p.id===point.id?
       {...p,value:Math.max(0,Math.min(1000000000,Number(e.target.value)||0))}:p)})}/>
     <button type="button" title="Удалить" onClick={()=>onChange({...d,points:d.points.filter(p=>p.id!==point.id)})}>×</button>
    </div>)}
    <button type="button" disabled={d.points.length>=12} onClick={()=>onChange({...d,
     points:[...d.points,{id:uid(),label:"",value:0}]})}>+ Добавить данные</button>
   </div>
  </div>}
  <svg viewBox="0 0 900 500" className="lektrus-school-svg" role="img" aria-label={d.title}>
   <rect width="900" height="500" fill="#fbfdff" rx="15"/>
   <text x="450" y="43" textAnchor="middle" fontSize="25" fontWeight="700" fill="#304f70">{d.title}</text>
   {!d.points.length&&<text x="450" y="265" textAnchor="middle" fontSize="17" fill="#7892ab">
    Добавьте названия и значения для диаграммы
   </text>}
   {d.points.length>0&&d.variant!=="pie"&&<g>
    {Array.from({length:5},(_,i)=>{
     const y=baseline-i*285/4;
     return <g key={i}><path d={`M72 ${y}H837`} stroke="#d7e4f1"/>
      <text x="65" y={y+5} textAnchor="end" fill="#7190ac" fontSize="12">{(i*max/4).toLocaleString("ru-RU",{maximumFractionDigits:1})}</text>
     </g>;
    })}
    {d.variant==="bar"?d.points.map((point,i)=>{
     const h=point.value/max*285,x=85+i*width+width*.15;
     return <g key={point.id}><rect x={x} y={baseline-h} width={width*.7} height={h}
      rx="3" fill={palette[i%palette.length]}/>
      <text x={85+(i+.5)*width} y="440" textAnchor="middle" fontSize={Math.min(13,Math.max(8,width/6))} fill="#486783">
       {point.label.slice(0,Math.max(4,Math.floor(width/8)))}
      </text></g>;
    }):
    <><polyline fill="none" stroke="#557fb7" strokeWidth="3" points={dots.map(p=>p.join(",")).join(" ")}/>
     {dots.map((dot,i)=><g key={d.points[i].id}><circle cx={dot[0]} cy={dot[1]} r="4" fill="#557fb7" stroke="#fff" strokeWidth="1.3"/>
      <text x={dot[0]} y="440" textAnchor="middle" fontSize="12" fill="#486783">{d.points[i].label.slice(0,10)}</text></g>)}
    </>}
   </g>}
   {d.points.length>0&&d.variant==="pie"&&
    <g>{sum===0?<text x="450" y="250" textAnchor="middle" fill="#7b90aa">Все значения равны нулю</text>:
     <>{arcs.map(arc=>arc.whole?<circle key={arc.id} cx="345" cy="260" r="140" fill={arc.color}/>:
      <path key={arc.id} d={arc.d} fill={arc.color} stroke="#fff" strokeWidth="1.2"/>)}
      {d.points.map((p,i)=><g key={p.id}>
       <rect x="590" y={99+i*27} width="11" height="11" rx="2" fill={palette[i%palette.length]}/>
       <text x="608" y={109+i*27} fontSize="12" fill="#385a7c">
        {p.label.slice(0,16)}: {(sum?p.value/sum*100:0).toFixed(1)}%
       </text>
      </g>)}</>}
    </g>}
  </svg>
 </div>;
}
