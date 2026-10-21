import type {SchoolDiagram} from "./lektrusSchoolDiagramModel";

type Division=Extract<SchoolDiagram,{kind:"division"}>;
const stages=["interphase","prophase","metaphase","anaphase","telophase"] as const;
const descriptions={
 interphase:["Интерфаза","ДНК реплицируется до начала митоза"],
 prophase:["Профаза","Хромосомы конденсируются; формируется веретено"],
 metaphase:["Метафаза","Хромосомы выстраиваются в экваториальной плоскости"],
 anaphase:["Анафаза","Сестринские хроматиды разделяются и движутся к полюсам"],
 telophase:["Телофаза","Восстанавливаются ядерные оболочки; начинается разделение клетки"]
} as const;
function Chromosome({x,y}:{x:number;y:number}){
 return <g stroke="#8352ae" strokeWidth="7" strokeLinecap="round">
  <path d={"M"+(x-12)+" "+(y-15)+"L"+(x+12)+" "+(y+15)}/>
  <path d={"M"+(x+12)+" "+(y-15)+"L"+(x-12)+" "+(y+15)}/>
  <circle cx={x} cy={y} r="3" fill="#d3b1ea" stroke="none"/>
 </g>;
}
function Chromatin({x,y}:{x:number;y:number}){
 return <g transform={"translate("+x+" "+y+")"} stroke="#ae83c5" strokeWidth="4" fill="none" strokeLinecap="round">
  <path d="M-33 -20q22-24 33 0t35-3"/>
  <path d="M-35 14q20-18 34 4t35 0"/>
 </g>;
}
export default function LektrusMitosisView({diagram:d}:{diagram:Division}){
 const phase=d.phase,meta=phase==="metaphase",ana=phase==="anaphase";
 const spindle=phase==="prophase"||meta||ana;
 const caption=descriptions[phase];
 return <svg viewBox="0 0 900 500" className="lektrus-school-svg" role="img" aria-label={d.title}>
  <rect width="900" height="500" fill="#fcfdff" rx="18"/>
  <text x="450" y="41" textAnchor="middle" fontSize="25" fontWeight="700" fill="#294b6e">{d.title}</text>
  <text x="450" y="70" textAnchor="middle" fontSize="13" fill="#6986a0">
   Этап {stages.indexOf(phase)+1} из 5 · условная модель животной клетки
  </text>
  {phase==="telophase"?
   <path d="M178 250C178 123 275 93 380 102C423 106 444 139 450 171C456 139 477 106 520 102C625 93 722 123 722 250C722 365 625 401 520 392C477 388 456 352 450 323C444 352 423 388 380 392C275 401 178 365 178 250Z"
    fill="#e5f3fc" stroke="#6b9fc2" strokeWidth="5"/>:
   <ellipse cx="450" cy="248" rx="274" ry="157" fill="#e5f3fc" stroke="#6b9fc2" strokeWidth="5"/>}
  {(phase==="interphase"||phase==="prophase")&&<g>
   <ellipse cx="450" cy="248" rx="118" ry="117" fill="#e9dcf8"
    stroke="#9b7cb9" strokeWidth="3" strokeDasharray={phase==="prophase"?"7 7":undefined}/>
   {phase==="interphase"&&<><Chromatin x={411} y={203}/><Chromatin x={472} y={291}/>
    <circle cx="466" cy="245" r="15" fill="#be96d2"/></>}
   {phase==="prophase"&&[[400,218],[463,208],[424,285],[490,281]].map(([x,y],i)=>
    <Chromosome key={i} x={x} y={y}/>)}
  </g>}
  {spindle&&<g>
   {[260,640].map(x=><g key={x}>
    <circle cx={x} cy="248" r="11" fill="#e2a274" stroke="#aa724b" strokeWidth="2"/>
    {[-1,0,1].map(i=><line key={i} x1={x} y1="248" x2={x+(x<450?-1:1)*14} y2={248+i*19} stroke="#c89462" strokeWidth="2"/>)}
   </g>)}
   {[185,220,255,290,325].map(y=><g key={y} stroke="#b8a9c2" strokeWidth="2">
    <line x1="271" y1="248" x2={ana?355:450} y2={y}/>
    <line x1="629" y1="248" x2={ana?545:450} y2={y}/>
   </g>)}
  </g>}
  {meta&&[183,226,269,312].map((y,i)=><Chromosome key={i} x={450} y={y}/>)}
  {ana&&[178,220,264,306].map((y,i)=><g key={i} fill="none" stroke="#8352ae"
   strokeWidth="7" strokeLinecap="round" strokeLinejoin="round">
   <path d={"M348 "+y+"l33 -15m-33 15 33 15"}/>
   <path d={"M552 "+y+"l-33 -15m33 15 -33 15"}/>
  </g>)}
  {phase==="telophase"&&[332,568].map(x=><g key={x}>
   <ellipse cx={x} cy="247" rx="88" ry="95" fill="#e9dcf8" stroke="#9b7cb9" strokeWidth="3"/>
   <Chromatin x={x} y={247}/>
  </g>)}
  {d.showLabels&&<g>
   <text x="450" y="440" textAnchor="middle" fontSize="20" fontWeight="700" fill="#284969">{caption[0]}</text>
   <text x="450" y="466" textAnchor="middle" fontSize="14" fill="#5e7e98">{caption[1]}</text>
  </g>}
 </svg>;
}
