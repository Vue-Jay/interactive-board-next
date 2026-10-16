import { useEffect,useMemo,useState } from "react";
import type { AuthUser } from "./authStore";
import { createBoard,type BoardSummary } from "./boardStore";
import type { DocumentData, Item } from "./boardModel";
import { deleteTemplate,listTemplates,markTemplateUsed,type BoardTemplate } from "./templatesStore";
export const starterTemplates=[
 {id:"plan",title:"План урока",category:"Планирование",description:"Тема, цели, ход урока и домашнее задание",labels:["ТЕМА И ЦЕЛЬ","ПРОВЕРКА ЗНАНИЙ","НОВЫЙ МАТЕРИАЛ","ПРАКТИКА","ДОМАШНЕЕ ЗАДАНИЕ"]},
 {id:"notes",title:"Конспект занятия",category:"Обучение",description:"Структура конспекта с ключевыми понятиями",labels:["ТЕМА","ОСНОВНЫЕ ПОНЯТИЯ","ПРИМЕРЫ","ВЫВОДЫ"]},
 {id:"brainstorm",title:"Мозговой штурм",category:"Совместная работа",description:"Область для идей, вопросов и решений",labels:["ИДЕИ","ВОПРОСЫ","ВАРИАНТЫ","РЕШЕНИЕ"]},
 {id:"compare",title:"Сравнение двух понятий",category:"Анализ",description:"Свойства, сходства и различия",labels:["ПОНЯТИЕ А","ОБЩЕЕ","ПОНЯТИЕ Б"]},
 {id:"practice",title:"Практическая работа",category:"Упражнения",description:"Задание, решение, проверка, вывод",labels:["УСЛОВИЕ","РЕШЕНИЕ","ПРОВЕРКА","ОТВЕТ"]},
 {id:"reflection",title:"Итоги занятия",category:"Рефлексия",description:"Что узнали, что осталось непонятным",labels:["ЧТО УЗНАЛИ","ЧТО ПОЛУЧИЛОСЬ","ВОПРОСЫ","СЛЕДУЮЩИЙ ШАГ"]},
];
export function starterDocument(t:typeof starterTemplates[number]):DocumentData{
 const items:Item[]=t.labels.map((text,index)=>({id:crypto.randomUUID(),kind:"sticky",x:80+(index%3)*350,y:100+Math.floor(index/3)*240,width:300,height:190,text,color:["#e9f0ff","#e7f6ef","#fff2df","#f3ebff"][index%4],fontSize:25}));
 return {version:1,title:t.title,view:{x:0,y:0,zoom:1},items,background:{mode:"dots",color:"#f7f7f8",opacity:100}};
}

function TemplateCanvas({document}:{document:DocumentData}){
 const items=document.items.slice(0,16);
 const maxX=Math.max(1200,...items.map(i=>i.x+i.width+60)),maxY=Math.max(700,...items.map(i=>i.y+i.height+60));
 return <div className="lektrus-template-canvas" aria-hidden="true"><div className="lektrus-template-canvas-content">{items.map(item=><div key={item.id} className={`lektrus-template-object kind-${item.kind}`} style={{left:`${Math.max(0,item.x)/maxX*100}%`,top:`${Math.max(0,item.y)/maxY*100}%`,width:`${Math.min(95,item.width/maxX*100)}%`,height:`${Math.min(90,item.height/maxY*100)}%`,background:item.color&&item.kind==="sticky"?item.color:undefined}}><span>{item.text?.slice(0,75)||item.name||item.kind}</span></div>)}</div>{items.length===0&&<span className="lektrus-template-empty-preview">Чистая доска</span>}</div>;
}
type Props={user:AuthUser;onBack:()=>void;onOpenBoard:(b:BoardSummary)=>void};
export default function TemplatesScreen({user,onBack,onOpenBoard}:Props){

 const [rows,setRows]=useState<BoardTemplate[]>([]),[q,setQ]=useState(""),[cat,setCat]=useState("all"),[notice,setNotice]=useState(""),[busy,setBusy]=useState(false);
 const load=async()=>{try{setRows(await listTemplates(user.id))}catch(e){setNotice(e instanceof Error?e.message:"Не удалось загрузить шаблоны")}};useEffect(()=>{void load()},[user.id]);
 const cats=useMemo(()=>[...new Set([...rows.map(x=>x.category).filter(Boolean),...starterTemplates.map(t=>t.category)])].sort((a,b)=>a.localeCompare(b,"ru")),[rows]);
 const visible=rows.filter(x=>(cat==="all"||x.category===cat)&&(!q.trim()||`${x.title} ${x.description} ${x.category}`.toLowerCase().includes(q.toLowerCase())));
 const useStarter=async(t:typeof starterTemplates[number])=>{if(busy)return;setBusy(true);try{const b=await createBoard(user,t.title,false);sessionStorage.setItem("onlinerepetitor.template.apply",JSON.stringify({templateId:"builtin:"+t.id,document:starterDocument(t)}));onOpenBoard(b)}catch(e){setNotice(e instanceof Error?e.message:"Не удалось создать доску")}finally{setBusy(false)}};
 const visibleStarters=starterTemplates.filter(t=>(cat==="all"||t.category===cat)&&(!q.trim()||`${t.title} ${t.description} ${t.category}`.toLowerCase().includes(q.toLowerCase())));
 const use=async(t:BoardTemplate)=>{if(busy)return;setBusy(true);try{const b=await createBoard(user,`${t.title} — копия`,false);sessionStorage.setItem("onlinerepetitor.template.apply",JSON.stringify({templateId:t.id,document:t.document}));await markTemplateUsed(t.id);onOpenBoard(b)}catch(e){setNotice(e instanceof Error?e.message:"Не удалось создать доску")}finally{setBusy(false)}};
 return <main className="templates-shell"><header className="students-header"><div><button className="boards-secondary" onClick={onBack}>← Доски</button><div><strong>Шаблоны</strong><span>Готовые макеты для уроков и ваши сохранённые шаблоны</span></div></div></header><section className="templates-content">
 
 {notice&&<div className="access-notice">{notice}</div>}<div className="templates-toolbar"><input type="search" placeholder="Поиск шаблонов" value={q} onChange={e=>setQ(e.target.value)}/><select value={cat} onChange={e=>setCat(e.target.value)}><option value="all">Все категории</option>{cats.map(x=><option key={x}>{x}</option>)}</select><span>{visible.length+visibleStarters.length} шаблонов</span></div>
 {visible.length===0&&visibleStarters.length===0?<div className="boards-empty"><strong>{rows.length?"Ничего не найдено":"Шаблонов пока нет"}</strong><span>Откройте готовую доску и выберите «Шаблон».</span></div>:<div className="templates-grid">{visibleStarters.map(t=><article className="template-card lektrus-starter-template" key={t.id}><div className="template-preview lektrus-template-preview"><TemplateCanvas document={starterDocument(t)}/><span className="lektrus-template-preview-tag">{t.labels.length} блоков</span></div><div><strong>{t.title}</strong><span>{t.category} · базовый шаблон</span><p>{t.description}</p><div><button className="students-primary" disabled={busy} onClick={()=>void useStarter(t)}>Создать доску</button></div></div></article>)}{visible.map(t=><article className="template-card" key={t.id}><div className="template-preview lektrus-template-preview"><TemplateCanvas document={t.document}/><span className="lektrus-template-preview-tag">{t.document.items.length} объектов</span></div><div><strong>{t.title}</strong><span>{t.category||"Без категории"} · использован {t.useCount} раз</span><p>{t.description||"Без описания"}</p><div><button className="students-primary" disabled={busy} onClick={()=>void use(t)}>Создать доску</button><button className="danger" onClick={async()=>{if(confirm(`Удалить шаблон «${t.title}»?`)){await deleteTemplate(t.id);await load()}}}>Удалить</button></div></div></article>)}</div>}
 </section></main>
}