import {useMemo,useState} from "react";
import type {BioOrganism} from "./lektrusBioMicroscopeModel";
import {BIO_TAXA,BIO_TAXONOMY_SOURCES,bioTaxaFor,searchBioTaxa,type BioKingdom,type BioTaxon} from "./lektrusBioTaxonomy";

type Props={onExplore:(organism:BioOrganism)=>void;onBack:()=>void};
const symbols:Record<string,string>={
 Porifera:"🪸",Cnidaria:"🪼",Platyhelminthes:"〰️",Nematoda:"🪱",Annelida:"🪱",Mollusca:"🐚",
 Arthropoda:"🦋",Echinodermata:"⭐",Chordata:"🐾",Chlorophyta:"🌊",Bryophyta:"🌱",
 Marchantiophyta:"🍃",Anthocerotophyta:"🌿",Lycopodiophyta:"🌿",
 "Polypodiopsida (broad)":"🌿",Gymnosperms:"🌲",Angiosperms:"🌸"
};
export default function LektrusBioTaxonomyBrowser({onExplore,onBack}:Props){
 const [kingdom,setKingdom]=useState<BioKingdom>("animal");
 const [query,setQuery]=useState("");
 const [selectedId,setSelectedId]=useState("mammalia");
 const taxa=useMemo(()=>searchBioTaxa(query,kingdom),[query,kingdom]);
 const selected=taxa.find(t=>t.id===selectedId)??taxa[0];
 const groups=[...new Set(taxa.map(t=>t.section))];
 const anatomyCount=bioTaxaFor(kingdom).flatMap(t=>t.representatives).filter(r=>r.anatomy).length;
 const setGroup=(next:BioKingdom)=>{setKingdom(next);setQuery("");setSelectedId(next==="animal"?"mammalia":"eudicots");};
 return <div className="lektrus-bio-atlas" aria-label="Систематический атлас животных и растений">
  <div className="lektrus-bio-atlas-top">
   <button type="button" className="lektrus-bio-atlas-return" onClick={onBack}>← К микроскопу</button>
   <span className="lektrus-bio-atlas-kicker">LEKTRUS · ЖИВАЯ ПРИРОДА</span>
   <h2>Атлас жизни</h2>
   <p>От крупных эволюционных ветвей до отдельных организмов и их клеток. Классификация и анатомические схемы показаны отдельно, чтобы не подменять один вид другим.</p>
   <div className="lektrus-bio-atlas-tabs" role="group" aria-label="Царство">
    <button type="button" aria-pressed={kingdom==="animal"} className={kingdom==="animal"?"is-active":""} onClick={()=>setGroup("animal")}>🐾 Животные <small>{bioTaxaFor("animal").length}</small></button>
    <button type="button" aria-pressed={kingdom==="plant"} className={kingdom==="plant"?"is-active":""} onClick={()=>setGroup("plant")}>🌱 Растения <small>{bioTaxaFor("plant").length}</small></button>
   </div>
  </div>
  <div className="lektrus-bio-atlas-search">
   <label htmlFor="lektrus-bio-atlas-query">Найти класс, группу или вид</label>
   <input id="lektrus-bio-atlas-query" type="search" autoComplete="off"
    placeholder="Название на русском или латыни" value={query} onChange={e=>setQuery(e.target.value)}/>
   <span>{taxa.length} групп · {anatomyCount} анатомических атласа</span>
  </div>
  <div className="lektrus-bio-atlas-columns">
   <nav className="lektrus-bio-atlas-list" aria-label="Классы и группы">
    {groups.map(group=><section key={group} aria-label={group}>
     <h3><span>{symbols[taxa.find(t=>t.section===group)?.sectionLatin??""]??"🧬"}</span>{group}</h3>
     <div className="lektrus-bio-atlas-grid">
      {taxa.filter(t=>t.section===group).map(t=><button type="button" key={t.id}
       aria-pressed={selected?.id===t.id} className={"lektrus-bio-atlas-taxon"+(selected?.id===t.id?" is-active":"")}
       onClick={()=>setSelectedId(t.id)}>
       <strong>{t.name}</strong><em>{t.scientific}</em>
       <small>{t.rank}</small>
      </button>)}
     </div>
    </section>)}
    {!taxa.length&&<p className="lektrus-bio-atlas-empty">По этому запросу групп не найдено. Попробуйте другое название.</p>}
   </nav>
   <article className="lektrus-bio-atlas-detail" aria-live="polite">
    {selected?<TaxonDetail taxon={selected} onExplore={onExplore}/>:<p>Выберите класс или измените поисковый запрос.</p>}
   </article>
  </div>
  <div className="lektrus-bio-atlas-sources">
   <strong>Научная основа каталога</strong>
   <p>Это проверяемый школьный указатель основных групп, а не полный мировой реестр видов. Таксономические ранги и границы некоторых групп могут различаться в разных системах. Иллюстрации клеток доступны только там, где подготовлена отдельная схема конкретного организма.</p>
   <div>{BIO_TAXONOMY_SOURCES.map(s=><a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer">{s.label} ↗</a>)}</div>
  </div>
 </div>;
}
function TaxonDetail({taxon,onExplore}:{taxon:BioTaxon;onExplore:(organism:BioOrganism)=>void}){
 return <>
  <div className="lektrus-bio-atlas-detail-hero">
   <span className="lektrus-bio-atlas-detail-symbol">{symbols[taxon.sectionLatin]??"🧬"}</span>
   <span className="lektrus-bio-atlas-kicker">{taxon.section} · {taxon.rank}</span>
   <h3>{taxon.name}</h3>
   <em>{taxon.scientific}</em>
  </div>
  <p className="lektrus-bio-atlas-summary">{taxon.summary}</p>
  <h4>Отличительные особенности</h4>
  <ul>{taxon.traits.map(trait=><li key={trait}>{trait}</li>)}</ul>
  {taxon.caution&&<p className="lektrus-bio-atlas-caution">Важно о классификации: {taxon.caution}</p>}
  <h4>Представители</h4>
  <div className="lektrus-bio-atlas-species">
   {taxon.representatives.map(r=><div className="lektrus-bio-atlas-species-card" key={r.scientific}>
    <div><strong>{r.name}</strong><em>{r.scientific}</em></div>
    {r.anatomy?<button type="button" onClick={()=>onExplore(r.anatomy!)}>Изучить строение ↗</button>:
     <span title="Для этого вида пока нет проверенной анатомической схемы">Карточка вида · анатомия готовится</span>}
   </div>)}
  </div>
  <p className="lektrus-bio-atlas-disclaimer">Представители показывают разнообразие группы, но не заменяют её полную классификацию. Не все структуры одного вида присутствуют у остальных представителей.</p>
 </>;
}
