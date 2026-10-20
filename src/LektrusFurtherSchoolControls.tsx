import type {FurtherDiagram,OrganSystem} from "./lektrusFurtherSchoolModel";
import {organOptions} from "./lektrusFurtherSchoolModel";
type Props={diagram:FurtherDiagram;onChange:(diagram:FurtherDiagram)=>void};
export default function LektrusFurtherSchoolControls({diagram:d,onChange}:Props){
 if(d.kind==="organs"){
  const options=organOptions[d.system];
  return <>
   <label className="lektrus-school-field">Система органов
    <select value={d.system} onChange={e=>{
     const system=e.target.value as OrganSystem;
     onChange({...d,system,title:system==="digestive"?"Пищеварительная система человека":"Дыхательная система человека",
      labels:organOptions[system].map(v=>v.id)});
    }}><option value="digestive">Пищеварительная система</option>
     <option value="respiratory">Дыхательная система</option></select>
   </label>
   <div className="lektrus-school-controls-heading">Подписи органов на схеме</div>
   <div className="lektrus-school-checks">{options.map(part=><label key={part.id}>
    <input type="checkbox" checked={d.labels.includes(part.id)} onChange={e=>
     onChange({...d,labels:e.target.checked?[...d.labels,part.id]:d.labels.filter(value=>value!==part.id)})}/>
    {part.label}
   </label>)}</div>
   <div className="lektrus-school-inspector-quick">
    <button type="button" onClick={()=>onChange({...d,labels:options.map(part=>part.id)})}>Показать все подписи</button>
    <button type="button" onClick={()=>onChange({...d,labels:[]})}>Скрыть все</button>
   </div>
   <p className="lektrus-school-hint">Подписи можно скрыть для самостоятельного задания. Это схема основных органов, а не анатомический атлас: расположение и размеры упрощены. При пищеварении печень и поджелудочная железа участвуют в процессе, но пища через них не проходит.</p>
  </>;
 }
 const points=[...d.points].sort((a,b)=>a.distance-b.distance);
 const setPoint=(id:string,values:Partial<(typeof d.points)[number]>)=>
  onChange({...d,points:d.points.map(p=>p.id===id?{...p,...values}:p)});
 const duplicate=new Set(d.points.map(p=>p.distance)).size!==d.points.length;
 return <>
  <div className="lektrus-school-controls-heading">Точки профиля</div>
  <p className="lektrus-school-hint">Введите расстояние вдоль маршрута в километрах и абсолютную высоту в метрах. Данные не берутся из карты автоматически. Точки будут выстроены по расстоянию.</p>
  <div className="lektrus-school-climate-head lektrus-relief-head">
   <span>Точка</span><span>Расст., км</span><span>Высота, м</span><span/>
  </div>
  {points.map((p,i)=><div className="lektrus-relief-row" key={p.id}>
   <label className="lektrus-relief-label"><span className="sr-only">Название точки {i+1}</span>
    <input value={p.label} maxLength={40} aria-label={"Название точки "+(i+1)}
     onChange={e=>setPoint(p.id,{label:e.target.value})}/></label>
   <input type="number" min="0" max="5000" step="0.1" value={p.distance}
    aria-label={"Расстояние до точки "+(i+1)+" в км"}
    onChange={e=>setPoint(p.id,{distance:Math.min(5000,Math.max(0,Number(e.target.value)||0))})}/>
   <input type="number" min="-500" max="9000" step="1" value={p.height}
    aria-label={"Высота точки "+(i+1)+" в метрах"}
    onChange={e=>setPoint(p.id,{height:Math.min(9000,Math.max(-500,Number(e.target.value)||0))})}/>
   <button type="button" title="Удалить точку" disabled={d.points.length<=2}
    onClick={()=>onChange({...d,points:d.points.filter(item=>item.id!==p.id)})}>×</button>
  </div>)}
  {duplicate&&<p role="alert" className="lektrus-school-input-error">
   Две точки имеют одинаковое расстояние. Укажите разные значения перед сохранением.
  </p>}
  <button type="button" className="lektrus-school-add" disabled={d.points.length>=10}
   onClick={()=>{
    const last=points[points.length-1];
    onChange({...d,points:[...d.points,{
     id:crypto.randomUUID(),distance:Math.min(5000,(last?.distance??0)+5),
     height:last?.height??0,label:"Новая точка"}]});
   }}>+ Добавить точку ({d.points.length}/10)</button>
  <label className="lektrus-school-toggle"><input type="checkbox" checked={d.showGrid}
   onChange={e=>onChange({...d,showGrid:e.target.checked})}/> Сетка измерений</label>
  <label className="lektrus-school-toggle"><input type="checkbox" checked={d.showLabels}
   onChange={e=>onChange({...d,showLabels:e.target.checked})}/> Подписи точек</label>
  <p className="lektrus-school-hint">Оси имеют независимые масштабы: горизонтальная в километрах, вертикальная в метрах. Отрицательная высота допускается для участков ниже уровня моря. Исходный профиль демонстрационный, не представляет конкретную местность.</p>
 </>;
}
