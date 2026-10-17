import {periodicElements,periodicFamilies,type ElementFamily} from "./lektrusPeriodicElements";

type Props={
  selected?:number[];
  active?:number|null;
  showNames?:boolean;
  familyFilter?:ElementFamily|"all";
  onPick?:(number:number)=>void;
};

const baseX=52,baseY=84,step=54,cell=49;
const familyColors=Object.fromEntries(periodicFamilies.map(item=>[item.id,item.color])) as Record<ElementFamily,string>;

/** The same SVG is used in the editor and by the board's saved graph object. */
export default function LektrusPeriodicTableView({
  selected=[],active=null,showNames=true,familyFilter="all",onPick
}:Props){
  const highlighted=new Set(selected);
  return <svg className="lektrus-periodic-svg" viewBox="0 0 1080 640"
    preserveAspectRatio="xMidYMid meet" role="img"
    aria-label="Периодическая таблица химических элементов с 118 элементами">
    <rect width="1080" height="640" fill="#f8fbff" rx="12"/>
    <text x={baseX} y="28" className="lektrus-periodic-heading">Периодическая система химических элементов</text>
    {Array.from({length:18},(_,i)=><text className="lektrus-periodic-index"
      key={"col"+i} x={baseX+i*step+cell/2} y="69" textAnchor="middle">{i+1}</text>)}
    {Array.from({length:7},(_,i)=><text key={"period"+i} className="lektrus-periodic-index"
      x="25" y={baseY+i*step+31} textAnchor="middle">{i+1}</text>)}
    <text className="lektrus-periodic-lanthanoid-label" x="52" y="474">Лантаноиды</text>
    <text className="lektrus-periodic-lanthanoid-label" x="52" y="538">Актиноиды</text>
    {[{period:6,label:"57–71"},{period:7,label:"89–103"}].map(item=>{
      const x=baseX+2*step,y=baseY+(item.period-1)*step;
      return <g key={item.period} opacity=".62">
        <rect x={x} y={y} width={cell} height={cell} rx="6" fill="#f0e2f2" stroke="#d9c2e2"/>
        <text x={x+cell/2} y={y+29} className="lektrus-periodic-placeholder" textAnchor="middle">{item.label}</text>
      </g>;
    })}
    {periodicElements.map(el=>{
      const left=baseX+(el.col-1)*step;
      const top=el.row<=7?baseY+(el.row-1)*step:el.row===9?487:542;
      const isSelected=highlighted.has(el.number);
      const isFocused=active===el.number;
      const muted=familyFilter!=="all"&&el.family!==familyFilter;
      const label=el.name.length>11?el.name.slice(0,10)+"…":el.name;
      const description=el.number+". "+el.name+" ("+el.symbol+")";
      return <g key={el.number} className={"lektrus-periodic-cell "+(onPick?"interactive":"")+
        (isSelected?" selected":"")+(isFocused?" focused":"")+(muted?" dimmed":"")}
        role={onPick?"button":undefined}
        tabIndex={onPick?0:undefined}
        aria-label={description+(isSelected?", выделен":"")}
        onClick={onPick?()=>onPick(el.number):undefined}
        onKeyDown={onPick?e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();onPick(el.number)}}:undefined}>
        <title>{description+", период "+el.period+(el.family!=="lanthanoid"&&el.family!=="actinoid"?", группа "+el.group:"")}</title>
        <rect x={left} y={top} width={cell} height={cell} rx="6"
          fill={familyColors[el.family]} stroke={isSelected?"#245bd2":isFocused?"#3a679f":"#c1d0e2"}
          strokeWidth={isSelected?3:isFocused?2:1.1}/>
        <text className="lektrus-periodic-number" x={left+5} y={top+11}>{el.number}</text>
        <text className="lektrus-periodic-symbol" x={left+cell/2} y={top+31}
          textAnchor="middle">{el.symbol}</text>
        {showNames&&<text className="lektrus-periodic-name" x={left+cell/2} y={top+43}
          textAnchor="middle">{label}</text>}
        {isSelected&&<circle cx={left+cell-6} cy={top+6} r="3" fill="#1f56c8"/>}
      </g>;
    })}
    <text x="52" y="623" className="lektrus-periodic-footnote">
      Выделенные элементы отмечены синим. Значения и расчёты не подставляются автоматически.
    </text>
  </svg>;
}
