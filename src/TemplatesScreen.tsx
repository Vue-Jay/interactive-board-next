import { useEffect,useMemo,useState } from "react";
import type { AuthUser } from "./authStore";
import { boardStorageKey,createBoard,type BoardSummary } from "./boardStore";
import type { DocumentData, Item } from "./boardModel";
import { deleteTemplate,listTemplates,markTemplateUsed,type BoardTemplate } from "./templatesStore";
type StarterTemplate={
 id:string;title:string;category:string;description:string;labels:string[];
 tool?:
  |{kind:"checklist";title:string;items:string[]}
  |{kind:"quiz";title:string;options:string[];correct:number;explanation:string}
  |{kind:"table";title:string;rows:number;cols:number;cells:string[]}
  |{kind:"graph";title:string;a:number;b:number};
};
export const starterTemplates:StarterTemplate[]=[
 {id:"plan",title:"План урока",category:"Планирование",description:"Цели, этапы, проверка понимания и следующий шаг",labels:["ТЕМА И ЦЕЛЬ","ПРОВЕРКА ЗНАНИЙ","НОВЫЙ МАТЕРИАЛ","ПРАКТИКА","ДОМАШНЕЕ ЗАДАНИЕ"],tool:{kind:"checklist",title:"Ход занятия",items:["Сформулировать цель урока","Проверить исходные знания","Показать новый материал","Дать время на практику","Подвести итог и назначить домашнюю работу"]}},
 {id:"notes",title:"Конспект занятия",category:"Обучение",description:"Ключевые понятия, примеры и выводы по теме",labels:["ТЕМА","ОСНОВНЫЕ ПОНЯТИЯ","ПРИМЕРЫ","ВОПРОСЫ","ВЫВОДЫ"]},
 {id:"brainstorm",title:"Мозговой штурм",category:"Совместная работа",description:"Сбор идей, уточняющие вопросы и выбор решения",labels:["ИДЕИ","ВОПРОСЫ","ВАРИАНТЫ","ЧТО ПРОВЕРИТЬ","РЕШЕНИЕ"]},
 {id:"compare",title:"Сравнение двух понятий",category:"Анализ",description:"Сравните признаки, найдите сходства и сформулируйте вывод",labels:["ПОНЯТИЕ А","ОБЩЕЕ","ПОНЯТИЕ Б","ВЫВОД"],tool:{kind:"table",title:"Таблица сравнения",rows:4,cols:3,cells:["Признак","Понятие А","Понятие Б","Определение","","","Пример","","","Главное отличие","",""]}},
 {id:"practice",title:"Практическая работа",category:"Упражнения",description:"Условие, решение, проверка и готовый ответ",labels:["УСЛОВИЕ","ПЛАН РЕШЕНИЯ","ПРОВЕРКА","ОТВЕТ"],tool:{kind:"checklist",title:"Проверка решения",items:["Я записал все данные условия","Показал ход решения","Проверил вычисления или доказательство","Записал ответ с единицами измерения"]}},
 {id:"reflection",title:"Итоги занятия",category:"Рефлексия",description:"Зафиксируйте результат, вопросы и следующий шаг",labels:["ЧТО УЗНАЛИ","ЧТО ПОЛУЧИЛОСЬ","ВОПРОСЫ","СЛЕДУЮЩИЙ ШАГ"],tool:{kind:"checklist",title:"Самопроверка",items:["Могу объяснить главную мысль своими словами","Могу привести пример","Понимаю, что нужно повторить"]}},
 {id:"function",title:"Исследование функции",category:"Математика",description:"Постройте график, заполните точки и объясните зависимость",labels:["ВОПРОС","ТАБЛИЦА ЗНАЧЕНИЙ","НАБЛЮДЕНИЯ","ВЫВОД"],tool:{kind:"graph",title:"График функции",a:2,b:1}},
 {id:"quiz",title:"Мини-тест с разбором",category:"Проверка знаний",description:"Готовая карточка вопроса с вариантами и объяснением",labels:["ТЕМА","ЧТО ПРОВЕРЯЕМ","КРИТЕРИЙ УСПЕХА"],tool:{kind:"quiz",title:"Как изменится значение выражения 2x + 1, если x увеличить на 1?",options:["Увеличится на 1","Увеличится на 2","Не изменится","Уменьшится на 2"],correct:1,explanation:"Коэффициент при x равен 2, поэтому при увеличении x на 1 значение выражения растёт на 2."}},
 {id:"lab",title:"Отчёт по эксперименту",category:"Естественные науки",description:"Цель, гипотеза, ход опыта, наблюдения и вывод",labels:["ЦЕЛЬ","ГИПОТЕЗА","ОБОРУДОВАНИЕ","ХОД ОПЫТА","НАБЛЮДЕНИЯ","ВЫВОД"],tool:{kind:"checklist",title:"Безопасность и ход опыта",items:["Подготовить оборудование","Проверить технику безопасности","Записать наблюдения по ходу опыта","Сопоставить результат с гипотезой"]}},
 {id:"project",title:"Групповой проект",category:"Совместная работа",description:"Роли, план работы, промежуточная проверка и презентация",labels:["ЦЕЛЬ ПРОЕКТА","РОЛИ","ПЛАН","МАТЕРИАЛЫ","ПРЕЗЕНТАЦИЯ","ОБРАТНАЯ СВЯЗЬ"],tool:{kind:"checklist",title:"План команды",items:["Распределить роли","Согласовать срок и этапы","Проверить источники и материалы","Подготовить общий результат","Получить обратную связь"]}},
];
export function starterDocument(t:typeof starterTemplates[number]):DocumentData{
 const items:Item[]=t.labels.map((text,index)=>({id:`starter-${t.id}-${index}`,kind:"sticky",x:80+(index%3)*330,y:90+Math.floor(index/3)*220,width:290,height:180,text,color:["#e9f0ff","#e7f6ef","#fff2df","#f3ebff"][index%4],fontSize:23}));
 // Put the main interactive tool below the prompt blocks on the same left
 // column, so a starter board remains easy to follow on phone screens.
 const toolY=90+Math.ceil(t.labels.length/3)*220+30;
 if(t.tool?.kind==="checklist")items.push({id:`starter-${t.id}-checklist`,kind:"checklist",x:80,y:toolY,width:400,height:330,text:t.tool.title,fontSize:15,color:"#315bd4",checklistItems:t.tool.items,checklistDone:t.tool.items.map(()=>false)});
 if(t.tool?.kind==="quiz")items.push({id:`starter-${t.id}-quiz`,kind:"quiz",x:80,y:toolY,width:410,height:330,text:t.tool.title,fontSize:15,color:"#315bd4",quizOptions:t.tool.options,quizCorrect:t.tool.correct,quizRevealed:false,quizExplanation:t.tool.explanation});
 if(t.tool?.kind==="table")items.push({id:`starter-${t.id}-table`,kind:"table",x:80,y:toolY,width:980,height:300,text:t.tool.title,fontSize:14,color:"#315bd4",tableRows:t.tool.rows,tableCols:t.tool.cols,tableCells:t.tool.cells,tableHeader:true,tableStripe:true});
 if(t.tool?.kind==="graph")items.push({id:`starter-${t.id}-graph`,kind:"graph",x:80,y:toolY,width:500,height:420,text:t.tool.title,fontSize:15,color:"#315bd4",graphPurpose:"function",graphType:"linear",graphA:t.tool.a,graphB:t.tool.b,graphC:0,graphGrid:true,graphShowCurve:true,graphExpression:`y = ${t.tool.a}x + ${t.tool.b}`,graphXMin:-5,graphXMax:5,graphYMin:-10,graphYMax:12,graphPoints:[]});
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
 const useStarter=async(t:typeof starterTemplates[number])=>{if(busy)return;setBusy(true);try{const b=await createBoard(user,t.title,false);sessionStorage.setItem("onlinerepetitor.template.apply",JSON.stringify({boardId:b.id,templateId:"builtin:"+t.id,document:starterDocument(t)}));localStorage.setItem(boardStorageKey(b.id),JSON.stringify({...starterDocument(t),title:b.title}));onOpenBoard(b)}catch(e){setNotice(e instanceof Error?e.message:"Не удалось создать доску")}finally{setBusy(false)}};
 const visibleStarters=starterTemplates.filter(t=>(cat==="all"||t.category===cat)&&(!q.trim()||`${t.title} ${t.description} ${t.category}`.toLowerCase().includes(q.toLowerCase())));
 const use=async(t:BoardTemplate)=>{if(busy)return;setBusy(true);try{const b=await createBoard(user,`${t.title} — копия`,false);sessionStorage.setItem("onlinerepetitor.template.apply",JSON.stringify({boardId:b.id,templateId:t.id,document:t.document}));localStorage.setItem(boardStorageKey(b.id),JSON.stringify({...t.document,title:b.title}));await markTemplateUsed(t.id);onOpenBoard(b)}catch(e){setNotice(e instanceof Error?e.message:"Не удалось создать доску")}finally{setBusy(false)}};
 return <main className="templates-shell"><header className="students-header"><div><button className="boards-secondary" onClick={onBack}>← Доски</button><div><strong>Шаблоны</strong><span>Готовые макеты для уроков и ваши сохранённые шаблоны</span></div></div></header><section className="templates-content">
 
 {notice&&<div className="access-notice">{notice}</div>}<div className="templates-toolbar"><input type="search" placeholder="Поиск шаблонов" value={q} onChange={e=>setQ(e.target.value)}/><select value={cat} onChange={e=>setCat(e.target.value)}><option value="all">Все категории</option>{cats.map(x=><option key={x}>{x}</option>)}</select><span>{visible.length+visibleStarters.length} шаблонов</span></div>
 {visible.length===0&&visibleStarters.length===0?<div className="boards-empty"><strong>{rows.length?"Ничего не найдено":"Шаблонов пока нет"}</strong><span>Откройте готовую доску и выберите «Шаблон».</span></div>:<div className="templates-grid">{visibleStarters.map(t=><article className="template-card lektrus-starter-template" key={t.id}><div className="template-preview lektrus-template-preview"><TemplateCanvas document={starterDocument(t)}/><span className="lektrus-template-preview-tag">{t.labels.length} блоков</span></div><div><strong>{t.title}</strong><span>{t.category} · базовый шаблон</span><p>{t.description}</p><div><button className="students-primary" disabled={busy} onClick={()=>void useStarter(t)}>Создать доску</button></div></div></article>)}{visible.map(t=><article className="template-card" key={t.id}><div className="template-preview lektrus-template-preview"><TemplateCanvas document={t.document}/><span className="lektrus-template-preview-tag">{t.document.items.length} объектов</span></div><div><strong>{t.title}</strong><span>{t.category||"Без категории"} · использован {t.useCount} раз</span><p>{t.description||"Без описания"}</p><div><button className="students-primary" disabled={busy} onClick={()=>void use(t)}>Создать доску</button><button className="danger" onClick={async()=>{if(confirm(`Удалить шаблон «${t.title}»?`)){await deleteTemplate(t.id);await load()}}}>Удалить</button></div></div></article>)}</div>}
 </section></main>
}
