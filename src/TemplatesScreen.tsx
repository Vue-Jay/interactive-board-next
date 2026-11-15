import { useEffect,useMemo,useState } from "react";
import type { AuthUser } from "./authStore";
import { boardStorageKey,createBoard,type BoardSummary } from "./boardStore";
import type { DocumentData } from "./boardModel";
import { copyTemplateAssets,deleteTemplate,listTemplates,markTemplateUsed,type BoardTemplate } from "./templatesStore";
function TemplateCanvas({document}:{document:DocumentData}){
 const items=document.items.slice(0,16);
 const maxX=Math.max(1200,...items.map(i=>i.x+i.width+60)),maxY=Math.max(700,...items.map(i=>i.y+i.height+60));
 return <div className="lektrus-template-canvas" aria-hidden="true"><div className="lektrus-template-canvas-content">{items.map(item=><div key={item.id} className={`lektrus-template-object kind-${item.kind}`} style={{left:`${Math.max(0,item.x)/maxX*100}%`,top:`${Math.max(0,item.y)/maxY*100}%`,width:`${Math.min(95,item.width/maxX*100)}%`,height:`${Math.min(90,item.height/maxY*100)}%`,background:item.color&&item.kind==="sticky"?item.color:undefined}}><span>{item.text?.slice(0,75)||item.name||item.kind}</span></div>)}</div>{items.length===0&&<span className="lektrus-template-empty-preview">Чистая доска</span>}</div>;
}
type Props={user:AuthUser;onBack:()=>void;onOpenBoard:(b:BoardSummary)=>void};
export default function TemplatesScreen({user,onBack,onOpenBoard}:Props){

 const [rows,setRows]=useState<BoardTemplate[]>([]),[q,setQ]=useState(""),[cat,setCat]=useState("all"),[notice,setNotice]=useState(""),[busy,setBusy]=useState(false);
 const [loading,setLoading]=useState(true);
 useEffect(()=>{let active=true;setLoading(true);setRows([]);setNotice("");void listTemplates(user.id).then(data=>{if(active)setRows(data)}).catch(e=>{if(active)setNotice(e instanceof Error?e.message:"Не удалось загрузить шаблоны")}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[user.id]);
 const cats=useMemo(()=>[...new Set(rows.map(x=>x.category).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"ru")),[rows]);
 const visible=rows.filter(x=>(cat==="all"||x.category===cat)&&(!q.trim()||`${x.title} ${x.description} ${x.category}`.toLowerCase().includes(q.toLowerCase())));
 const use=async(t:BoardTemplate)=>{if(busy)return;setBusy(true);setNotice("");try{
   const b=await createBoard(user,`${t.title} — копия`,false);
   await copyTemplateAssets(t,b.id);
   sessionStorage.setItem("onlinerepetitor.template.apply",JSON.stringify({boardId:b.id,templateId:t.id,document:t.document}));
   localStorage.setItem(boardStorageKey(b.id),JSON.stringify({...t.document,title:b.title}));
   void markTemplateUsed(t.id).catch(()=>{});onOpenBoard(b);
 }catch(e){setNotice(e instanceof Error?e.message:"Не удалось создать доску")}finally{setBusy(false)}};
 const remove=async(t:BoardTemplate)=>{
   if(busy||!confirm(`Удалить шаблон «${t.title}»? Созданные по нему доски останутся.`))return;
   setBusy(true);setNotice("");try{await deleteTemplate(t.id);setRows(rows=>rows.filter(r=>r.id!==t.id));setCat("all")}catch(e){setNotice(e instanceof Error?e.message:"Не удалось удалить шаблон")}finally{setBusy(false)}
 };
 return <main className="templates-shell"><header className="students-header"><div><button className="boards-secondary" onClick={onBack}>← Доски</button><div><strong>Шаблоны</strong><span>Ваши сохранённые заготовки для занятий</span></div></div></header><section className="templates-content">
 {notice&&<div className="access-notice" role="alert">{notice}</div>}
 <div className="templates-toolbar"><input type="search" placeholder="Поиск шаблонов" value={q} onChange={e=>setQ(e.target.value)}/><select value={cat} onChange={e=>setCat(e.target.value)}><option value="all">Все категории</option>{cats.map(x=><option key={x}>{x}</option>)}</select><span>{visible.length} шаблонов</span></div>
 {loading?<div className="boards-empty"><strong>Загрузка шаблонов…</strong></div>:visible.length===0?<div className="boards-empty"><strong>{rows.length?"Ничего не найдено":notice?"Шаблоны недоступны":"Шаблонов пока нет"}</strong><span>{rows.length?"Измените фильтры.":notice?"Попробуйте открыть раздел снова.":"Откройте свою доску и выберите «Сохранить как шаблон» в дополнительных действиях."}</span>{!rows.length&&<button className="boards-secondary" onClick={onBack}>Перейти к доскам</button>}</div>:<div className="templates-grid">{visible.map(t=><article className="template-card" key={t.id}><div className="template-preview lektrus-template-preview"><TemplateCanvas document={t.document}/><span className="lektrus-template-preview-tag">{t.document.items.length} объектов</span></div><div><strong>{t.title}</strong><span>{t.category||"Без категории"} · использован {t.useCount} раз</span><p>{t.description||"Без описания"}</p><div><button className="students-primary" disabled={busy} onClick={()=>void use(t)}>Создать доску</button><button className="danger" disabled={busy} onClick={()=>void remove(t)}>Удалить</button></div></div></article>)}</div>}
 </section></main>
}
