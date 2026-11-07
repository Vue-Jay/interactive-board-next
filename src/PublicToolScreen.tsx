import {lazy,Suspense,useState} from "react";
import type {Item} from "./boardModel";
import {createAtlasDocument,type AtlasDocument} from "./lektrusAtlasModel";
import {defaultLabBench} from "./lektrusChemistryBenchModel";

const LektrusMapAtlas=lazy(()=>import("./LektrusMapAtlas"));
const LektrusChemistryBenchEditor=lazy(()=>import("./LektrusChemistryBenchEditor"));

type Props={tool:"atlas"|"laboratory";onBack:()=>void};

export default function PublicToolScreen({tool,onBack}:Props){
 const [atlas,setAtlas]=useState<AtlasDocument>(()=>createAtlasDocument());
 const [labItem,setLabItem]=useState<Item>(()=>({
  id:"public-laboratory",kind:"graph",x:0,y:0,width:960,height:560,text:"Химическая лаборатория",
  graphFigureId:"chem-experiment-free",scienceLabBench:defaultLabBench()
 }));
 if(tool==="laboratory")return <Suspense fallback={<main className="lektrus-tool-loading" role="status">Открываем лабораторию…</main>}>
  <LektrusChemistryBenchEditor item={labItem} onChange={setLabItem} onSave={onBack} onCancel={onBack}/>
 </Suspense>;
 return <main className="lektrus-public-tool">
  <header className="lektrus-public-tool-header">
   <a className="lektrus-public-tool-brand" href="/" aria-label="На сайт Lektrus"><img src="/lektrus-icon-192.png" alt=""/><strong>Lektrus</strong></a>
   <div className="lektrus-public-tool-title"><span>ИНСТРУМЕНТ · ГЕОГРАФИЯ И ИСТОРИЯ</span><h1>Интерактивный атлас</h1></div>
   <button type="button" className="lektrus-public-tool-back" onClick={onBack}>На сайт <span aria-hidden="true">↗</span></button>
  </header>
  <section className="lektrus-public-tool-workspace" aria-label="Рабочая область атласа">
   <Suspense fallback={<div className="lektrus-tool-loading" role="status">Загружаем карту…</div>}>
    <LektrusMapAtlas diagram={atlas} onChange={setAtlas} editorMode userId="public-tool"/>
   </Suspense>
  </section>
 </main>;
}
