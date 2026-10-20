import type {FurtherDiagram,OrganSystem} from "./lektrusFurtherSchoolModel";
import {organOptions} from "./lektrusFurtherSchoolModel";
type Props={diagram:FurtherDiagram};
const trim=(v:string,n:number)=>v.length>n?v.slice(0,n-1)+"…":v;
function OrganView({d}:{d:Extract<FurtherDiagram,{kind:"organs"}>}){
 const digestive=d.system==="digestive";
 const positions:Record<OrganSystem,Record<string,[number,number,number,number]>>={
  digestive:{
   mouth:[450,92,700,96],esophagus:[450,173,700,172],
   stomach:[517,241,700,237],liver:[385,209,181,200],
   pancreas:[464,269,700,283], "small-intestine":[454,340,700,351],
   "large-intestine":[391,327,180,340]
  },
  respiratory:{
   "nasal-cavity":[452,85,700,95],larynx:[450,144,700,144],
   trachea:[453,207,700,206],bronchi:[490,258,700,273],
   lungs:[392,330,180,319],diaphragm:[456,401,700,414]
  }
 };
 return <svg viewBox="0 0 900 500" className="lektrus-school-svg" role="img" aria-label={d.title}>
  <rect width="900" height="500" rx="20" fill="#fcfdff"/>
  <text x="450" y="37" textAnchor="middle" fontSize="23" fontWeight="750" fill="#284969">{trim(d.title,56)}</text>
  <g opacity=".48" fill="#eff4f9" stroke="#c6d6e7" strokeWidth="2">
   <circle cx="450" cy="85" r="33"/>
   <path d="M431 114V130L372 143Q355 154 351 178L331 318L347 328L378 214L393 405H506L521 214L554 328L569 318L550 178Q545 153 527 144L469 130V114Z"/>
  </g>
  {digestive?<g>
   <path d="M435 92Q450 102 466 92" fill="none" stroke="#c98489" strokeWidth="5" strokeLinecap="round"/>
   <path d="M450 113V205" stroke="#d99598" strokeWidth="17" strokeLinecap="round" fill="none"/>
   <path d="M451 117V206" stroke="#fff1e7" strokeWidth="7" fill="none"/>
   <path d="M450 201Q488 190 512 200Q548 214 539 242Q530 277 503 267Q481 253 471 245Q452 242 450 201Z"
    fill="#f4c2b8" stroke="#c77e7a" strokeWidth="3"/>
   <path d="M375 190Q423 172 451 196L445 228Q421 244 365 226Z"
    fill="#b96c71" stroke="#98555a" strokeWidth="2.7"/>
   <path d="M437 257Q476 263 520 257" stroke="#dfbc80" strokeWidth="10" strokeLinecap="round" fill="none"/>
   <path d="M403 289Q379 287 379 313V363Q380 380 399 380H498Q521 380 523 360V318Q521 291 499 290"
    stroke="#d89478" strokeWidth="16" fill="none" strokeLinecap="round"/>
   <g stroke="#c9a17e" strokeWidth="8" fill="none" strokeLinecap="round">
    <path d="M417 299Q448 281 479 301Q508 317 478 327Q424 338 417 351Q423 369 481 353"/>
    <path d="M418 322Q444 311 470 327Q489 341 456 343Q434 342 448 362"/>
   </g>
  </g>:<g>
   <path d="M450 68Q469 88 452 110L451 136" fill="none" stroke="#b77b94" strokeWidth="9" strokeLinecap="round"/>
   <rect x="438" y="133" width="26" height="30" rx="11" fill="#c993aa" stroke="#ac6b8d" strokeWidth="2"/>
   <path d="M451 159V246" stroke="#cd9bb0" strokeWidth="17" strokeLinecap="round"/>
   {Array.from({length:8},(_,i)=><path key={i} d={`M441 ${170+i*10}H460`} stroke="#976582" strokeWidth="2.1"/>)}
   <path d="M450 241Q425 252 408 275M452 241Q480 252 498 275" fill="none"
    stroke="#ae7895" strokeWidth="12" strokeLinecap="round"/>
   <path d="M425 261Q400 239 373 267Q348 294 354 347Q357 381 389 395Q410 406 425 382Z"
    fill="#cde6f9" stroke="#77a9ce" strokeWidth="3"/>
   <path d="M473 261Q503 239 525 267Q549 293 546 347Q545 381 510 395Q485 406 476 379Z"
    fill="#cde6f9" stroke="#77a9ce" strokeWidth="3"/>
   <path d="M404 277Q389 310 384 348M495 277Q510 312 515 351"
    stroke="#a9d0e9" fill="none" strokeWidth="4"/>
   <path d="M354 415Q450 382 546 415" stroke="#b67897" strokeWidth="6" fill="none" strokeLinecap="round"/>
  </g>}
  {organOptions[d.system].filter(o=>d.labels.includes(o.id)).map(o=>{
   const [x,y,lx,ly]=positions[d.system][o.id],right=lx>450;
   const anchor=right?"start":"end",endX=right?lx-8:lx+8;
   return <g key={o.id}>
    <circle cx={x} cy={y} r="4.2" fill="#446d98" stroke="#fff" strokeWidth="1.8"/>
    <path d={`M${x} ${y}L${right?x+34:x-34} ${ly-7}H${endX}`}
     fill="none" stroke="#688eaf" strokeWidth="1.5"/>
    <text x={lx} y={ly} textAnchor={anchor} fontSize={o.label.length>19?14:16} fill="#36597a" fontWeight="600">{o.label}</text>
   </g>;
  })}
  <text x="450" y="466" textAnchor="middle" fontSize="13" fill="#738a9e">
   Упрощённая учебная схема · расположение и размеры органов условны
  </text>
  {digestive&&<text x="450" y="484" textAnchor="middle" fontSize="11" fill="#8ca0af">
   Печень и поджелудочная железа участвуют в пищеварении, но пища через них не проходит
  </text>}
 </svg>;
}
function ReliefView({d}:{d:Extract<FurtherDiagram,{kind:"relief"}>}){
 const points=[...d.points].sort((a,b)=>a.distance-b.distance);
 const minDist=points[0]?.distance??0,maxDist=points[points.length-1]?.distance??1;
 const heights=points.map(p=>p.height);
 const minH=Math.floor(Math.min(0,...heights)/100)*100;
 const maxH=Math.ceil(Math.max(100,...heights)/100)*100;
 const plot={x:94,y:82,w:725,h:315};
 const sx=(x:number)=>plot.x+(x-minDist)/Math.max(.001,maxDist-minDist)*plot.w;
 const sy=(y:number)=>plot.y+plot.h-(y-minH)/Math.max(1,maxH-minH)*plot.h;
 const line=points.map(p=>`${sx(p.distance)},${sy(p.height)}`).join(" ");
 const fill=`M${sx(minDist)} ${plot.y+plot.h}L${line.replaceAll(" "," L")}L${sx(maxDist)} ${plot.y+plot.h}Z`;
 return <svg viewBox="0 0 900 500" className="lektrus-school-svg" role="img" aria-label={d.title}>
  <rect width="900" height="500" rx="20" fill="#fcfdff"/>
  <text x="450" y="43" textAnchor="middle" fontSize="23" fill="#274969" fontWeight="750">{trim(d.title,58)}</text>
  <text x="32" y="85" fontSize="14" fill="#5f809c">м</text>
  {Array.from({length:5},(_,i)=>{
   const y=plot.y+i*plot.h/4,value=maxH-i*(maxH-minH)/4;
   return <g key={i}>
    {d.showGrid&&<line x1={plot.x} x2={plot.x+plot.w} y1={y} y2={y} stroke="#d8e4ef"/>}
    <text x={plot.x-13} y={y+5} textAnchor="end" fill="#6c8499" fontSize="13">{Math.round(value)}</text>
   </g>;
  })}
  {Array.from({length:5},(_,i)=>{
   const x=plot.x+i*plot.w/4,value=minDist+i*(maxDist-minDist)/4;
   return <g key={i}>
    {d.showGrid&&<line x1={x} x2={x} y1={plot.y} y2={plot.y+plot.h} stroke="#e0e9f1"/>}
    <text x={x} y="417" textAnchor="middle" fontSize="13" fill="#698398">{Number(value.toFixed(1))}</text>
   </g>;
  })}
  <line x1={plot.x} y1={plot.y} x2={plot.x} y2={plot.y+plot.h} stroke="#687f9c" strokeWidth="1.8"/>
  <line x1={plot.x} y1={plot.y+plot.h} x2={plot.x+plot.w} y2={plot.y+plot.h} stroke="#687f9c" strokeWidth="1.8"/>
  <path d={fill} fill="#cce9d2" fillOpacity=".8" stroke="none"/>
  <polyline points={line} fill="none" stroke="#458d71" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round"/>
  {points.map((p,i)=><g key={p.id}>
   <circle cx={sx(p.distance)} cy={sy(p.height)} r="5" fill="#4a9774" stroke="#fff" strokeWidth="2"/>
   {d.showLabels&&<>
    <text x={sx(p.distance)} y={sy(p.height)-18} fontSize="12" textAnchor="middle" fontWeight="700"
     fill="#356b5a">{trim(p.label||"Точка "+(i+1),19)}</text>
    <text x={sx(p.distance)} y={sy(p.height)-6} fontSize="11" textAnchor="middle" fill="#668b7d">{p.height} м</text>
   </>}
  </g>)}
  <text x="450" y="455" textAnchor="middle" fontSize="15" fill="#5b768e">Расстояние, км</text>
  <text x="450" y="482" textAnchor="middle" fontSize="12" fill="#8297a8">
   Высоты и расстояния заданы пользователем; промежутки между точками соединены условными отрезками
  </text>
 </svg>;
}
export default function LektrusFurtherSchoolView({diagram:d}:Props){
 return d.kind==="organs"?<OrganView d={d}/>:<ReliefView d={d}/>;
}
