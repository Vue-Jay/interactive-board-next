import {useEffect,useMemo,useState} from "react";
import type {ReactNode} from "react";
import {BIO_ALTERNATIVE_SPECIES,BIO_ALT_KIND_LABELS,bioAltChildren,bioAltPath,
 type BioAlternativeOrganism,type BioAltNode,type BioAlternativeSpecies} from "./lektrusBioAlternativeAtlas";

type Props={speciesId:BioAlternativeOrganism;onBack:()=>void};
const c={ink:"#416855",teal:"#558e76",leaf:"#88b879",gold:"#d8b36a",plum:"#997ea8",pale:"#eef5e5"};
function DrawSponge({node}:{node:BioAltNode}){
 const cell=node.kind==="cell"||node.id.includes("choanocyte");
 if(cell)return <g>
  <ellipse cx="238" cy="224" rx="77" ry="55" fill="#ebd2b1" stroke="#9c846e" strokeWidth="7"/>
  <ellipse cx="240" cy="236" rx="27" ry="22" fill="#bda3c7"/>
  <path d="M238 182Q230 110 239 51" fill="none" stroke="#719fa5" strokeWidth="10" strokeLinecap="round"/>
  {Array.from({length:15},(_,i)=>{const a=Math.PI*(1+i/16);return <path key={i}
   d={`M${238+Math.cos(a)*52} ${193+Math.sin(a)*43}l${Math.cos(a)*11} ${Math.sin(a)*15}`}
   stroke="#699d90" strokeWidth="6" strokeLinecap="round"/>})}
  <path d="M165 278H315" stroke="#85b1a1" strokeWidth="8" strokeLinecap="round"/>
 </g>;
 return <g>
  <path d="M103 278Q82 186 126 106Q152 78 182 110Q214 28 251 71Q277 38 319 83Q391 95 368 185L356 279Z" fill="#d6c4a7" stroke="#967c68" strokeWidth="7"/>
  <path d="M175 260Q164 164 215 114Q258 101 301 144Q322 194 286 261Z" fill="#f1e7d3" stroke="#b59d81" strokeWidth="5"/>
  {Array.from({length:24},(_,i)=>{const x=118+i%6*44,y=130+Math.floor(i/6)*37;return <circle key={i} cx={x} cy={y} r={5+i%3} fill="#c1a587" stroke="#8d7762" strokeWidth="2"/>})}
  <path d="M241 144V54" stroke="#72adbd" strokeWidth="10" strokeLinecap="round" fill="none"/>
  <path d="M240 53l-20 25m20-25 22 25" stroke="#72adbd" strokeWidth="6" fill="none"/>
 </g>;
}
function DrawHydra({node}:{node:BioAltNode}){
 const stinging=node.id.includes("cnidocyte")||node.id.includes("nematocyst");
 if(stinging)return <g>
  <path d="M166 282Q126 162 186 91Q240 53 290 93Q356 163 309 279Z" fill="#e9c4af" stroke="#ab887d" strokeWidth="8"/>
  <ellipse cx="241" cy="174" rx="65" ry="83" fill="#f5ecda" stroke="#bc9e8f" strokeWidth="6"/>
  <path d="M240 201q-60-52 0-100q51 37-9 75q-38 29 12 52" stroke="#9d6d98" fill="none" strokeWidth="12" strokeLinecap="round"/>
  <path d="M236 91V45" stroke="#8879ad" strokeWidth="7" strokeLinecap="round"/>
  <circle cx="237" cy="90" r="12" fill="#9278b0"/>
 </g>;
 return <g>
  <path d="M218 293Q193 205 205 135Q214 117 236 115Q263 116 273 137Q285 198 264 293Z" fill="#b4d7aa" stroke="#66936f" strokeWidth="6"/>
  {[-95,-59,-25,25,59,95].map((offset,i)=><path key={i}
   d={`M${235+offset*.20} 124Q${235+offset*1.15} 48 ${235+offset} 33`}
   stroke="#80b78d" strokeWidth="12" fill="none" strokeLinecap="round"/>)}
  <path d="M237 133V286" stroke="#d2edc7" strokeWidth="32" strokeLinecap="round"/>
  <path d="M268 231Q326 192 335 241Q335 282 293 268" fill="#b4d7aa" stroke="#679771" strokeWidth="6"/>
  <path d="M191 295H290" stroke="#658c68" strokeWidth="10" strokeLinecap="round"/>
 </g>;
}
function DrawMoss({node}:{node:BioAltNode}){
 const sporo=node.id.includes("sporophyte")||node.id.includes("spore")&&!node.id.includes("gametophyte");
 if(sporo)return <g>
  <path d="M235 279Q236 178 239 109" stroke="#a98955" strokeWidth="12" fill="none" strokeLinecap="round"/>
  <path d="M209 110Q198 47 241 44Q290 41 275 112Z" fill="#d3b279" stroke="#8e7655" strokeWidth="8"/>
  <path d="M209 71Q240 24 275 71" stroke="#b29569" fill="none" strokeWidth="10"/>
  {Array.from({length:17},(_,i)=>{const a=i*2.399,r=Math.sqrt(i)*8;return <circle key={i} cx={240+Math.cos(a)*r} cy={83+Math.sin(a)*r} r="5" fill="#e9d7a2" stroke="#a88d57" strokeWidth="1.5"/>})}
  <path d="M228 279l-48 32m70-30 41 31" stroke="#668761" strokeWidth="7"/>
 </g>;
 if(node.id.includes("leaf")||node.id.includes("lamella"))return <g>
  <path d="M96 276Q66 103 342 74Q376 255 96 276Z" fill="#91bd74" stroke="#578a57" strokeWidth="8"/>
  <path d="M96 276L330 87" stroke="#5a9464" strokeWidth="8" />
  {Array.from({length:8},(_,i)=><path key={i} d={`M${146+i*20} ${235-i*17}l-32 -44`} stroke="#6a9d67" strokeWidth="4"/>)}
 </g>;
 return <g>
  <path d="M240 307V64" stroke="#5b8b62" strokeWidth="10" strokeLinecap="round"/>
  {Array.from({length:9},(_,i)=>{const y=81+i*23,s=46+i*6;return <g key={i}>
   <path d={`M239 ${y}Q${240-s} ${y-51} ${240-s} ${y-19}Q${240-s*.6} ${y+8} 239 ${y+9}`} fill="#82ac78" stroke="#538361" strokeWidth="3"/>
   <path d={`M241 ${y}Q${240+s} ${y-51} ${240+s} ${y-19}Q${240+s*.6} ${y+8} 241 ${y+9}`} fill="#82ac78" stroke="#538361" strokeWidth="3"/>
  </g>})}
  <path d="M234 294l-49 33m53-33 6 35m4-35 54 32" stroke="#9c865b" strokeWidth="5" strokeLinecap="round"/>
  {node.id==="moss"&&<g><path d="M305 254L315 100" stroke="#a78e62" strokeWidth="8"/><ellipse cx="320" cy="90" rx="27" ry="46" fill="#d8b883" stroke="#9a825f" strokeWidth="5"/></g>}
 </g>;
}
function DrawChlamydomonas({node}:{node:BioAltNode}){
 const emph=node.id.split("/")[1];
 return <g>
  <path d="M213 103Q189 63 179 28M258 102Q285 65 291 24" fill="none" stroke="#83b59c" strokeWidth="8" strokeLinecap="round"/>
  <ellipse cx="237" cy="187" rx="112" ry="116" fill="#c2dca7" stroke="#5d986a" strokeWidth="9"/>
  <path d="M158 160Q149 258 239 278Q326 257 322 166Q284 207 235 217Q185 207 158 160" fill={emph==="chloroplast"?"#72b174":"#8fc287"} stroke="#548e5d" strokeWidth="5"/>
  <ellipse cx="241" cy="175" rx="34" ry="28" fill="#bdadd2" stroke="#957eae" strokeWidth="5"/>
  <circle cx="291" cy="171" r="14" fill="#df8f4b" stroke="#b2784a" strokeWidth="4"/>
  <circle cx="247" cy="249" r="22" fill="#639c72" stroke="#366d53" strokeWidth="5"/>
  <circle cx="202" cy="126" r="13" fill="#e0efca" stroke="#87b49a" strokeWidth="4"/>
  <circle cx="276" cy="126" r="13" fill="#e0efca" stroke="#87b49a" strokeWidth="4"/>
 </g>;
}
function DrawSpirogyra({node}:{node:BioAltNode}){
 const isConjugation=node.id.includes("conjugation")||node.id.includes("zygospore");
 return <g>
  {Array.from({length:isConjugation?2:1},(_,row)=><g key={row} transform={`translate(0 ${row*120-(isConjugation?56:0)})`}>
   <rect x="62" y="107" width="354" height="120" rx="12" fill="#d2e7b8" stroke="#75a772" strokeWidth="8"/>
   {Array.from({length:4},(_,i)=><g key={i} transform={`translate(${i*88} 0)`}>
    {i>0&&<path d="M62 111V223" stroke="#75a772" strokeWidth="6"/>}
    <path d="M75 125Q106 110 129 133Q146 155 107 178Q77 192 121 208Q141 216 143 207" fill="none" stroke="#69ab67" strokeWidth="13" strokeLinecap="round"/>
    <circle cx="110" cy="170" r="13" fill="#c9add0" stroke="#9c8cb0" strokeWidth="3"/>
   </g>)}
  </g>)}
  {isConjugation&&<g><path d="M150 180V230M243 180V230M336 180V230" stroke="#7bb179" strokeWidth="16"/>
   {node.id.includes("zygospore")&&<ellipse cx="240" cy="197" rx="33" ry="24" fill="#bd9a63" stroke="#806d46" strokeWidth="8"/>}</g>}
 </g>;
}
function BioAlternativeIllustration({species,node,children,onSelect}:{
 species:BioAlternativeSpecies;node:BioAltNode;children:BioAltNode[];onSelect:(node:BioAltNode)=>void
}){
 const illustration:ReactNode=species.id==="sponge"?<DrawSponge node={node}/>:
  species.id==="hydra"?<DrawHydra node={node}/>:
  species.id==="moss"?<DrawMoss node={node}/>:
  species.id==="chlamydomonas"?<DrawChlamydomonas node={node}/>:<DrawSpirogyra node={node}/>;
 return <svg className="lektrus-bio-alternative-scene" viewBox="0 0 480 340" role="group"
  aria-label={"Схематическая иллюстрация: "+node.name}>
  <rect width="480" height="340" rx="16" fill="#f1f7eb"/>
  <g>{illustration}</g>
  {children.map((child,i)=>{
   const spot=child.spot??{x:100+(i%3)*145,y:120+Math.floor(i/3)*95};
   return <g key={child.id} transform={`translate(${spot.x} ${spot.y})`}
    role="button" tabIndex={0} className="lektrus-bio-alt-marker" data-bio-alt-node={child.id}
    aria-label={"Изучить: "+child.name} onClick={()=>onSelect(child)}
    onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();onSelect(child);}}}>
    <circle r="26" fill="#e3f4e7" fillOpacity=".65" stroke="#42886c" strokeWidth="2.5"/>
    <circle r="13" fill="#fffdf3" stroke="#367758" strokeWidth="3.5"/>
    <circle r="4" fill="#367758"/>
    <title>{child.name}</title>
   </g>;
  })}
  <text x="466" y="325" textAnchor="end" fill="#6b886b" fontSize="10">Учебная схема · не в масштабе</text>
 </svg>;
}
export default function LektrusBioAlternativeView({speciesId,onBack}:Props){
 const species=BIO_ALTERNATIVE_SPECIES[speciesId];
 const [currentId,setCurrentId]=useState(speciesId);
 useEffect(()=>setCurrentId(speciesId),[speciesId]);
 const node=useMemo(()=>species.nodes.find(n=>n.id===currentId)??species.nodes[0],[species,currentId]);
 const children=bioAltChildren(species,node.id);
 const path=bioAltPath(species,node.id);
 const open=(next:BioAltNode)=>setCurrentId(next.id);
 return <section className="lektrus-bio-alternative" aria-label={"Атлас: "+species.name}>
  <div className="lektrus-bio-alt-hero">
   <button type="button" className="lektrus-bio-alt-back" onClick={onBack}>← К каталогу</button>
   <div className="lektrus-bio-alt-badge">{species.badge}</div>
   <h2>{species.name}</h2>
   <em>{species.scientific}</em>
   <p>{species.intro}</p>
  </div>
  <nav className="lektrus-bio-alt-path" aria-label="Путь изучения">
   {path.map((p,i)=><button key={p.id} type="button" aria-current={i===path.length-1?"step":undefined}
    onClick={()=>setCurrentId(p.id)}>{p.name}</button>)}
  </nav>
  <div className="lektrus-bio-alt-main">
   <div className="lektrus-bio-alt-figure">
    <BioAlternativeIllustration species={species} node={node} children={children} onSelect={open}/>
    <small>Нажмите на подсвеченную структуру или выберите её ниже. Переходы показаны схематично.</small>
   </div>
   <div className="lektrus-bio-alt-info">
    <div className="lektrus-bio-alt-kind">{BIO_ALT_KIND_LABELS[node.kind]}{node.ploidy?" · "+node.ploidy:""}</div>
    <h3>{node.name}</h3><p>{node.description}</p>
    {children.length>0&&<div className="lektrus-bio-alt-parts">
     <strong>Изучить подробнее</strong>
     {children.map(child=><button type="button" key={child.id} onClick={()=>open(child)}>
      <span><b>{child.name}</b><small>{BIO_ALT_KIND_LABELS[child.kind]}{child.ploidy?" · "+child.ploidy:""}</small></span>
      <span aria-hidden="true">＋</span>
     </button>)}
    </div>}
    {children.length===0&&<p className="lektrus-bio-alt-end">Конечная структура этой ветви. Можно вернуться по пути и изучить другие части.</p>}
   </div>
  </div>
  {species.cycle&&<section className="lektrus-bio-alt-cycle" aria-label="Жизненный цикл">
   <h3>Жизненный цикл</h3>
   <p>Этапы перечислены по ходу развития. Указаны стадии с разным набором хромосом.</p>
   <div className="lektrus-bio-alt-cycle-grid">{species.cycle.map((step,i)=><button type="button"
    key={step.id} className={currentId===step.nodeId?"is-active":""}
    onClick={()=>setCurrentId(step.nodeId)}>
    <small>{String(i+1).padStart(2,"0")} {step.ploidy?"· "+step.ploidy:""}</small>
    <strong>{step.title}</strong><span>{step.description}</span>
   </button>)}</div>
  </section>}
  <div className="lektrus-bio-alt-warning"><strong>Научная точность</strong><p>{species.warning}</p></div>
  <footer className="lektrus-bio-alt-footer">
   <span>Источник для проверки структуры: </span>
   <a href={species.source.url} target="_blank" rel="noopener noreferrer">{species.source.title}</a>
   <small>Иллюстрации авторские, условные, не являются микрофотографиями.</small>
  </footer>
 </section>;
}
