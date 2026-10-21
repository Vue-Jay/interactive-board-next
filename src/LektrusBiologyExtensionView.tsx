import type {BiologyExtensionDiagram} from "./lektrusBiologyExtensionModel";
import {dnaComplement,taxonomyRankLabels} from "./lektrusBiologyExtensionModel";

const colors:Record<string,string>={A:"#b7dcff",T:"#f7d5ac",G:"#c9e8c5",C:"#eed2f3"};
function DnaView({diagram:d}:{diagram:Extract<BiologyExtensionDiagram,{kind:"dna"}>}){
 const complement=dnaComplement(d.sequence);
 const first=[...d.sequence];
 return <svg viewBox="0 0 900 500" className="lektrus-school-svg" role="img" aria-label={d.title}>
  <rect width="900" height="500" rx="18" fill="#fcfdff"/>
  <text x="450" y="40" textAnchor="middle" fill="#294969" fontSize="24" fontWeight="700">{d.title}</text>
  <text x="450" y="65" textAnchor="middle" fill="#68859d" fontSize="13">Комплементарные пары A–T и G–C</text>
  {first.map((base,i)=>{
   const col=i%12,row=Math.floor(i/12),x=96+col*64,y=104+row*183;
   return <g key={i}>
    <rect x={x-22} y={y} width="44" height="48" rx="9" stroke="#a6bdd3" fill={colors[base]}/>
    <text x={x} y={y+30} textAnchor="middle" fontSize="20" fontWeight="700" fill="#314b66">{base}</text>
    <line x1={x} y1={y+48} x2={x} y2={y+78} stroke="#849db5" strokeDasharray="4 4" strokeWidth="2"/>
    <rect x={x-22} y={y+78} width="44" height="48" rx="9"
     stroke="#a6bdd3" fill={d.showComplement?colors[complement[i]]:"#f0f4fa"}/>
    <text x={x} y={y+108} textAnchor="middle" fontSize="20" fontWeight="700" fill="#314b66">
     {d.showComplement?complement[i]:"?"}
    </text>
   </g>
  })}
  {d.showDirection&&[0,1].filter(row=>row*12<first.length).map(row=>
   <g key={row} fontSize="14" fontWeight="650" fill="#67809a">
    <text x="45" y={133+row*183}>5′</text><text x="843" y={133+row*183}>3′</text>
    <text x="45" y={210+row*183}>3′</text><text x="843" y={210+row*183}>5′</text>
   </g>)}
  <text x="450" y="482" fontSize="12" fill="#7d92a7" textAnchor="middle">
   Линейная учебная схема двух антипараллельных цепей, не пространственная модель двойной спирали
  </text>
 </svg>;
}
function TaxonomyView({diagram:d}:{diagram:Extract<BiologyExtensionDiagram,{kind:"taxonomy"}>}){
 const labels=taxonomyRankLabels[d.group];
 return <svg viewBox="0 0 900 500" className="lektrus-school-svg" role="img" aria-label={d.title}>
  <rect width="900" height="500" rx="18" fill="#fcfdff"/>
  <text x="450" y="43" textAnchor="middle" fontSize="24" fontWeight="700" fill="#28496b">{d.title}</text>
  {d.rows.map((entry,i)=>{
   const y=70+i*55;return <g key={entry.rank}>
    <rect x="125" y={y} width="650" height="45" rx="11" fill={i%2?"#f0f6fd":"#e6f1ff"} stroke="#aac3df"/>
    {d.showRanks&&<text x="146" y={y+27} fontSize="15" fontWeight="650" fill="#5480a4">
     {labels[entry.rank]}
    </text>}
    <text x={d.showRanks?520:450} y={y+27} fontSize="18" textAnchor="middle" fill="#2a4b6e" fontWeight="700">
     {entry.name.length>42?entry.name.slice(0,41)+"…":entry.name}
     <title>{entry.name}</title>
    </text>
    {i<d.rows.length-1&&<path d="M450 115v10l-5-5m5 5 5-5" transform={"translate(0 "+i*55+")"} fill="none" stroke="#668fb5" strokeWidth="2"/>}
   </g>;
  })}
  <text x="450" y="479" textAnchor="middle" fill="#8096a8" fontSize="12">
   Учебная классификация; названия таксонов редактируются преподавателем
  </text>
 </svg>;
}
export default function LektrusBiologyExtensionView({diagram}:{diagram:BiologyExtensionDiagram}){
 return diagram.kind==="dna"?<DnaView diagram={diagram}/>:<TaxonomyView diagram={diagram}/>;
}
