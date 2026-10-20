import type {SchoolDiagram,CellOrganelle} from "./lektrusSchoolDiagramModel";
import {months,organelleTitles,prettyYear} from "./lektrusSchoolDiagramModel";
import LektrusNextSchoolView from "./LektrusNextSchoolView";
import LektrusFurtherSchoolView from "./LektrusFurtherSchoolView";
import LektrusApprovedSchoolView from "./LektrusApprovedSchoolView";
import LektrusRussianSchoolView from "./LektrusRussianSchoolView";

type Props={diagram:SchoolDiagram};
const trim=(s:string,n=20)=>s.length>n?s.slice(0,n-1)+"…":s;
const labelText=(s:string,max=19)=>{
 const words=s.split(/\s+/),lines:string[]=[];let line="";
 for(const word of words){
  if((line+" "+word).trim().length>max&&line){lines.push(line);line=word}
  else line=(line+" "+word).trim();
 }
 if(line)lines.push(line);
 return lines.slice(0,2).map((part,i)=>i===1&&lines.length>2?trim(part,max-1)+"…":trim(part,max));
};
function CellGraphic({diagram:d}:{diagram:Extract<SchoolDiagram,{kind:"cell"}>}){
 const plant=d.cell==="plant",show=(name:CellOrganelle)=>d.visible.includes(name);
 const sites:{id:CellOrganelle;x:number;y:number;lx:number;ly:number}[]=plant?[
  {id:"wall",x:135,y:98,lx:52,ly:62},{id:"membrane",x:151,y:125,lx:34,ly:140},
  {id:"cytoplasm",x:190,y:207,lx:36,ly:219},{id:"nucleus",x:296,y:236,lx:35,ly:316},
  {id:"vacuole",x:494,y:244,lx:700,ly:120},{id:"chloroplast",x:630,y:181,lx:695,ly:209},
  {id:"mitochondria",x:604,y:348,lx:696,ly:353}
 ]:[
  {id:"membrane",x:692,y:190,lx:711,ly:115},{id:"cytoplasm",x:555,y:160,lx:711,ly:194},
  {id:"nucleus",x:375,y:254,lx:66,ly:144},{id:"mitochondria",x:588,y:309,lx:701,ly:349}
 ];
 return <svg viewBox="0 0 900 500" role="img" aria-label={d.title} className="lektrus-school-svg">
  <rect width="900" height="500" rx="20" fill="#fcfdff"/>
  <text x="450" y="38" textAnchor="middle" fontSize="24" fontWeight="750" fill="#244567">{d.title}</text>
  {plant?<>
   {show("wall")&&<rect x="120" y="83" width="550" height="355" rx="50" fill="#eff9e1" stroke="#73a852" strokeWidth="12"/>}
   {show("membrane")&&<rect x="140" y="103" width="510" height="315" rx="40" fill="#eef8eb" stroke="#4c9b79" strokeWidth="4"/>}
   {show("cytoplasm")&&<rect x="148" y="111" width="494" height="299" rx="38" fill="#d7f2cf" opacity=".78"/>}
   {show("vacuole")&&<path d="M387 150C420 122 553 129 594 160C637 189 609 332 552 369C484 398 399 359 377 323C350 280 360 172 387 150Z"
      fill="#d1edfc" stroke="#7bb8d6" strokeWidth="3"/>}
   {show("chloroplast")&&[[218,166,-20],[596,183,25],[545,375,0],[205,335,40]].map(([x,y,r],i)=>
    <g key={i} transform={`translate(${x} ${y}) rotate(${r})`}>
     <ellipse rx="27" ry="14" fill="#8acb78" stroke="#438657" strokeWidth="2"/>
     {[-11,-4,4,11].map(off=><path key={off} d={`M${off-4} -8h8v16h-8z`} rx="3" fill="#4b9365" opacity=".8"/>)}
    </g>)}
   {show("mitochondria")&&[[580,330,25],[256,364,-12]].map(([x,y,r],i)=>
    <g key={i} transform={`translate(${x} ${y}) rotate(${r})`}>
     <ellipse rx="25" ry="13" fill="#ffd3b6" stroke="#d17e66" strokeWidth="2"/>
     <path d="M-16 0q5-16 11 0t11 0t12 0" fill="none" stroke="#b96553" strokeWidth="2"/>
    </g>)}
   {show("nucleus")&&<g><ellipse cx="297" cy="252" rx="64" ry="56" fill="#e9d9f5" stroke="#9064a8" strokeWidth="3"/>
    <circle cx="300" cy="251" r="17" fill="#9869ac"/><path d="M265 224q24-15 39 3t17-1" fill="none" stroke="#b58ec7" strokeWidth="3"/></g>}
  </>:<>
   <ellipse cx="450" cy="253" rx="308" ry="185" fill={show("cytoplasm")?"#e6f2f9":"#ffffff"} stroke={show("membrane")?"#609dc4":"#d4e2ec"} strokeWidth="5"/>
   {show("nucleus")&&<g><ellipse cx="363" cy="257" rx="89" ry="78" fill="#e4d7f5" stroke="#9872bb" strokeWidth="4"/>
    <circle cx="377" cy="257" r="22" fill="#9b6eb3"/><path d="M316 229q29-14 43 2t31-3" fill="none" stroke="#c4a5dc" strokeWidth="4"/></g>}
   {show("mitochondria")&&[[568,160,-10],[578,334,27],[232,306,50]].map(([x,y,r],i)=>
    <g key={i} transform={`translate(${x} ${y}) rotate(${r})`}>
     <ellipse rx="39" ry="20" fill="#ffddc7" stroke="#c98968" strokeWidth="2"/>
     <path d="M-28 0q8-24 15 0t15 0t15 0t14 0" fill="none" stroke="#bd8064" strokeWidth="2.8"/>
    </g>)}
  </>}
  {d.showLabels&&sites.filter(site=>show(site.id)).map(site=>{
   const right=site.lx>450,anchor=right?"start":"end",endX=right?site.lx-7:site.lx+7;
   return <g key={site.id}>
    <path d={`M${site.x} ${site.y} L${site.x+(right?30:-30)} ${site.ly-7} L${endX} ${site.ly-7}`}
     fill="none" stroke="#7494b1" strokeWidth="1.5"/>
    <circle cx={site.x} cy={site.y} r="3" fill="#356a9c"/>
    <text x={site.lx} y={site.ly} textAnchor={anchor} fontSize="16" fill="#294967" fontWeight="550">{organelleTitles[site.id]}</text>
   </g>
  })}
  <text x="450" y="474" textAnchor="middle" fontSize="13" fill="#72869c">Схематическое изображение · размеры органоидов условны</text>
 </svg>;
}
function ChainGraphic({diagram:d}:{diagram:Extract<SchoolDiagram,{kind:"food-chain"}>}){
 const count=d.organisms.length,space=25,boxW=(850-space*(count-1))/count,x0=25;
 const palettes:{[key:string]:[string,string,string]}={
  producer:["#e5f5e5","#65aa74","Продуцент"],
  consumer:["#e4efff","#658dc9","Консумент"],
  decomposer:["#f3e9db","#ad885e","Редуцент"]
 };
 return <svg viewBox="0 0 900 500" role="img" aria-label={d.title} className="lektrus-school-svg">
  <rect width="900" height="500" rx="20" fill="#fcfdff"/>
  <text x="450" y="52" textAnchor="middle" fontSize="25" fontWeight="750" fill="#244567">{d.title}</text>
  <text x="450" y="102" textAnchor="middle" fontSize="15" fill="#6a8399">Направление передачи вещества и энергии</text>
  {d.organisms.map((node,i)=>{
   const x=x0+i*(boxW+space),y=178,h=135,[fill,stroke,role]=palettes[node.role];
   return <g key={node.id}>
    <rect x={x} y={y} width={boxW} height={h} rx="15" fill={fill} stroke={stroke} strokeWidth="2"/>
    <circle cx={x+boxW/2} cy={y+33} r="17" fill={stroke} opacity=".18"/>
    <text x={x+boxW/2} y={y+39} fontSize="18" textAnchor="middle" fill={stroke}>{i+1}</text>
    {labelText(node.name,Math.max(11,Math.floor(boxW/10))).map((line,j)=>
     <text key={j} x={x+boxW/2} y={y+74+j*19} fill="#28496b" textAnchor="middle" fontSize={count>4?"15":"18"} fontWeight="700">{line}</text>)}
    {d.showRoles&&<text x={x+boxW/2} y={y+119} textAnchor="middle" fill="#64809b" fontSize="12">{role}</text>}
    {i<count-1&&<g stroke="#4676ac" strokeWidth="3.5" fill="none" strokeLinecap="round">
     <path d={`M${x+boxW+4} ${y+68}H${x+boxW+space-5}`}/>
     <path d={`M${x+boxW+space-12} ${y+61}l7 7-7 7`}/>
    </g>}
   </g>
  })}
  <text x="450" y="375" textAnchor="middle" fontSize="14" fill="#65819b">Стрелка направлена от пищи к тому, кто её потребляет</text>
  <text x="450" y="420" textAnchor="middle" fontSize="13" fill="#8a9eaf">Организмы и последовательность задаёт учитель</text>
 </svg>;
}
function ClimateGraphic({diagram:d}:{diagram:Extract<SchoolDiagram,{kind:"climate"}>}){
 const plot={x:79,y:97,w:745,h:324},temps=d.months.map(v=>v.temperature),rain=d.months.map(v=>v.precipitation);
 const minT=Math.min(-10,Math.floor(Math.min(...temps)/10)*10),maxT=Math.max(10,Math.ceil(Math.max(...temps)/10)*10);
 const maxR=Math.max(50,Math.ceil(Math.max(...rain)/50)*50),stepX=plot.w/12;
 const yyT=(t:number)=>plot.y+plot.h-(t-minT)/(maxT-minT)*plot.h;
 const yyR=(p:number)=>plot.y+plot.h-p/maxR*plot.h;
 const points=temps.map((t,i)=>`${plot.x+(i+.5)*stepX},${yyT(t)}`).join(" ");
 return <svg viewBox="0 0 900 500" role="img" aria-label={d.title} className="lektrus-school-svg">
  <rect width="900" height="500" rx="20" fill="#fcfdff"/>
  <text x="450" y="42" textAnchor="middle" fontSize="23" fontWeight="750" fill="#284968">{trim(d.title,56)}</text>
  <text x="48" y="82" fontSize="15" fill="#c35a4c">°C</text><text x="846" y="82" fontSize="15" fill="#457db2">мм</text>
  {Array.from({length:5},(_,i)=>{
   const y=plot.y+i*plot.h/4,t=maxT-i*(maxT-minT)/4,r=maxR-i*maxR/4;
   return <g key={i}><line x1={plot.x} x2={plot.x+plot.w} y1={y} y2={y} stroke="#dce6ef" strokeWidth="1"/>
    <text x={plot.x-9} y={y+5} fill="#c0645b" fontSize="13" textAnchor="end">{Number(t.toFixed(1))}</text>
    <text x={plot.x+plot.w+9} y={y+5} fill="#508ab8" fontSize="13">{Math.round(r)}</text>
   </g>
  })}
  <line x1={plot.x} y1={yyT(0)} x2={plot.x+plot.w} y2={yyT(0)} stroke="#a3adbb" strokeDasharray="5 4"/>
  {d.months.map((m,i)=>{
   const cx=plot.x+(i+.5)*stepX,y=yyR(m.precipitation);
   return <g key={i}>
    <rect x={cx-stepX*.28} y={y} width={stepX*.56} height={Math.max(0,plot.y+plot.h-y)}
     fill="#80bde8" opacity=".78" stroke="#4689c1" strokeWidth=".65"/>
    <text x={cx} y="447" textAnchor="middle" fill="#5c7087" fontSize="13">{months[i]}</text>
   </g>;
  })}
  <polyline points={points} fill="none" stroke="#dc6d54" strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round"/>
  {temps.map((t,i)=><circle key={i} cx={plot.x+(i+.5)*stepX} cy={yyT(t)} r="3.8" fill="#dc6d54" stroke="#fff" strokeWidth="1.5"/>)}
  {d.showLegend&&<g fontSize="13">
   <line x1="280" y1="479" x2="309" y2="479" stroke="#dc6d54" strokeWidth="3"/>
   <text x="319" y="483" fill="#6d7986">Температура, °C</text>
   <rect x="480" y="473" width="23" height="10" fill="#80bde8"/>
   <text x="513" y="483" fill="#6d7986">Осадки, мм</text>
  </g>}
 </svg>;
}
function TimelineGraphic({diagram:d}:{diagram:Extract<SchoolDiagram,{kind:"timeline"}>}){
 const list=[...d.events].sort((a,b)=>a.year-b.year),n=list.length,spacing=785/Math.max(1,n-1);
 return <svg viewBox="0 0 900 500" role="img" aria-label={d.title} className="lektrus-school-svg">
  <rect width="900" height="500" rx="20" fill="#fcfdff"/>
  <text x="450" y="42" textAnchor="middle" fontSize="24" fontWeight="750" fill="#284968">{trim(d.title,52)}</text>
  <path d="M55 250H851l-13-8m13 8-13 8" stroke="#6086bd" strokeWidth="4" fill="none" strokeLinecap="round"/>
  {list.map((event,i)=>{
   const x=58+i*spacing,upper=i%2===0,dy=upper?-92:90;
   return <g key={event.id}>
    <path d={`M${x} 250V${250+dy*.75}`} stroke="#769bc6" strokeDasharray="4 4" strokeWidth="2"/>
    <circle cx={x} cy="250" r="7" fill="#4675b8" stroke="white" strokeWidth="2"/>
    <text x={x} y={250+dy*.75+(upper?-11:22)} textAnchor="middle" fontWeight="800" fontSize="18" fill="#284968">
     {prettyYear(event.year,d.showEra)}
    </text>
    {labelText(event.label,n>5?13:17).map((line,j)=>
     <text key={j} x={x} y={250+dy+(upper?-20+j*19:32+j*19)}
      textAnchor="middle" fill="#54708d" fontSize={n>5?"13":"15"}>{line}</text>)}
   </g>;
  })}
  <text x="450" y="463" textAnchor="middle" fontSize="13" fill="#8193a4">События расположены по порядку. Промежутки между датами не в масштабе.</text>
 </svg>;
}
export default function LektrusSchoolDiagramView({diagram}:Props){
 switch(diagram.kind){
  case "cell":return <CellGraphic diagram={diagram}/>;
  case "food-chain":return <ChainGraphic diagram={diagram}/>;
  case "climate":return <ClimateGraphic diagram={diagram}/>;
  case "timeline":return <TimelineGraphic diagram={diagram}/>;
  case "syntax":case "flowchart":case "place-value":return <LektrusNextSchoolView diagram={diagram}/>;
  case "organs":case "relief":return <LektrusFurtherSchoolView diagram={diagram}/>;
  case "morphemes":case "family-tree":case "flashcards":return <LektrusApprovedSchoolView diagram={diagram}/>;
  case "morphology":case "phonetics":case "orthography":return <LektrusRussianSchoolView diagram={diagram}/>;
 }
}
