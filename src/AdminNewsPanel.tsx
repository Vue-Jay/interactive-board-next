import {useEffect,useState} from "react";
import {EMPTY_NEWS_DRAFT,loadAdminNews,NEWS_CATEGORIES,newsDate,saveAdminNews,type NewsArticle,type NewsCategory,type NewsDraft} from "./siteNews";
import "./lektrusAdminNews.css";
import AdminTelegramPanel from "./AdminTelegramPanel";

const PAGE_SIZE=30;
const fromArticle=(article:NewsArticle):NewsDraft=>({category:article.category,title:article.title,summary:article.summary,body:article.body,version:article.version,published:Boolean(article.published_at)});

export default function AdminNewsPanel(){
  const [mode,setMode]=useState<"site"|"telegram">("site");
  const [articles,setArticles]=useState<NewsArticle[]>([]),[offset,setOffset]=useState(0),[revision,setRevision]=useState(0);
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[notice,setNotice]=useState(""),[error,setError]=useState("");
  const [editing,setEditing]=useState<string|undefined>(),[draft,setDraft]=useState<NewsDraft>({...EMPTY_NEWS_DRAFT});
  useEffect(()=>{let active=true;setLoading(true);void loadAdminNews(offset,PAGE_SIZE+1).then(rows=>{if(active)setArticles(rows)}).catch(e=>{if(active)setError(e instanceof Error?e.message:"Не удалось загрузить новости.")}).finally(()=>{if(active)setLoading(false)});return ()=>{active=false}},[offset,revision]);
  const patch=(value:Partial<NewsDraft>)=>setDraft(v=>({...v,...value}));
  const fresh=()=>{setEditing(undefined);setDraft({...EMPTY_NEWS_DRAFT});setNotice("");setError("")};
  const open=(article:NewsArticle)=>{setEditing(article.id);setDraft(fromArticle(article));setNotice("");setError("")};
  const save=async(published:boolean)=>{
    if(busy||!draft.title.trim()||(published&&(!draft.summary.trim()||!draft.body.trim())))return;
    setBusy(true);setNotice("");setError("");
    try{const saved=await saveAdminNews({...draft,published},editing);setEditing(saved.id);setDraft(fromArticle(saved));setNotice(published?"Публикация сохранена и видна посетителям сайта.":"Запись сохранена в черновиках.");setOffset(0);setRevision(v=>v+1)}
    catch(e){setError(e instanceof Error?e.message:"Не удалось сохранить запись.")}finally{setBusy(false)}
  };
  return <section className="admin-news-panel" aria-label="Управление новостями">
    <header className="admin-news-heading"><div><h2>Новости и обновления</h2><p>Пишите новости, сообщайте о новых функциях и анонсируйте будущие изменения.</p></div><a href="https://lektrus.ru/#news" target="_blank" rel="noopener noreferrer" className="boards-secondary">На сайт ↗</a></header>
    <div className="telegram-tabs"><button type="button" className={mode==="site"?"students-primary":"boards-secondary"} onClick={()=>setMode("site")}>Новости сайта</button><button type="button" className={mode==="telegram"?"students-primary":"boards-secondary"} onClick={()=>setMode("telegram")}>Telegram · @lektrus</button></div>
    {mode==="telegram"?<AdminTelegramPanel/>:<div className="admin-news-layout"><div className="admin-news-list">
      <div className="admin-news-list-head"><strong>Публикации</strong><button type="button" className="students-primary" disabled={busy} onClick={fresh}>+ Новая запись</button></div>
      {loading?<p className="admin-news-placeholder">Загружаем публикации…</p>:articles.length===0?<p className="admin-news-placeholder">Записей пока нет.</p>:articles.slice(0,PAGE_SIZE).map(article=><button key={article.id} type="button" disabled={busy} aria-pressed={editing===article.id} className="admin-news-list-item" onClick={()=>open(article)}><span className="admin-news-list-meta"><span>{NEWS_CATEGORIES[article.category]}</span><span className={article.published_at?"is-published":"is-draft"}>{article.published_at?"Опубликовано":"Черновик"}</span></span><strong>{article.title}</strong><small>{newsDate(article.published_at||article.updated_at||null)}</small></button>)}
      {!loading&&(offset>0||articles.length>PAGE_SIZE)&&<div className="admin-news-pager"><button type="button" className="boards-secondary" disabled={!offset||busy} onClick={()=>setOffset(v=>v-PAGE_SIZE)}>←</button><span>{offset/PAGE_SIZE+1}</span><button type="button" className="boards-secondary" disabled={articles.length<=PAGE_SIZE||busy} onClick={()=>setOffset(v=>v+PAGE_SIZE)}>→</button></div>}
    </div><div className="admin-news-editor">
      <div className="admin-news-editor-top"><h3>{editing?"Редактирование записи":"Новая публикация"}</h3><span className={draft.published?"is-published":"is-draft"}>{draft.published?"На сайте":"Черновик"}</span></div>
      {notice&&<p className="admin-news-notice" role="status">{notice}</p>}{error&&<p className="admin-news-error" role="alert">{error}</p>}
      <div className="admin-news-editor-row"><label>Категория<select value={draft.category} disabled={busy} onChange={e=>patch({category:e.target.value as NewsCategory})}>{Object.entries(NEWS_CATEGORIES).map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></label><label>Версия (необязательно)<input maxLength={40} disabled={busy} value={draft.version} onChange={e=>patch({version:e.target.value})} placeholder="Например, 1.2.0"/></label></div>
      <label>Заголовок<input maxLength={160} disabled={busy} value={draft.title} onChange={e=>patch({title:e.target.value})} placeholder="Что нового в Lektrus?"/></label>
      <label>Краткое описание<textarea rows={3} maxLength={500} disabled={busy} value={draft.summary} onChange={e=>patch({summary:e.target.value})} placeholder="Короткое описание для карточки новости"/></label>
      <label>Полный текст<textarea rows={9} maxLength={12000} disabled={busy} value={draft.body} onChange={e=>patch({body:e.target.value})} placeholder="Расскажите подробнее о возможности или обновлении…"/></label>
      <div className="admin-news-actions"><button type="button" disabled={busy||!draft.title.trim()} className="boards-secondary" onClick={()=>void save(false)}>{draft.published?"Снять с публикации":"Сохранить черновик"}</button><button type="button" disabled={busy||!draft.title.trim()||!draft.summary.trim()||!draft.body.trim()} className="students-primary" onClick={()=>void save(true)}>{busy?"Сохраняем…":draft.published?"Сохранить изменения":"Опубликовать"}</button></div>
      <small className="admin-news-editor-hint">Черновики не видны посетителям. Опубликованные записи появляются на сайте, без пересборки приложения.</small>
    </div></div>}
  </section>;
}
