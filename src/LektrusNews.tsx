import {useEffect,useState} from "react";
import {loadPublicNews,NEWS_CATEGORIES,newsDate,type NewsArticle,type NewsFilter} from "./siteNews";

const PAGE_SIZE=12;
const FILTERS:ReadonlyArray<[NewsFilter,string]>=[["all","Все записи"],["update","Обновления"],["feature","Новые функции"],["announcement","Анонсы"]];
function NewsSymbol({category}:{category:NewsArticle["category"]}){
  return <svg width="24" height="24" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" fill="none" aria-hidden="true">{category==="update"?<><path d="M20 7v5h-5M4 17v-5h5"/><path d="M5.5 8a7.5 7.5 0 0 1 12.7-2L20 8M4 16l1.8 2A7.5 7.5 0 0 0 18.5 16"/></>:category==="feature"?<><path d="m12 2 2.2 6.8L21 11l-6.8 2.2L12 20l-2.2-6.8L3 11l6.8-2.2L12 2ZM20 2v4M18 4h4"/></>:<><path d="M4 10v4a2 2 0 0 0 2 2h3l9 4V4l-9 4H6a2 2 0 0 0-2 2ZM9 16l2 5H7l-2-5M21 9v6"/></>}</svg>;
}
export default function LektrusNews(){
  const [filter,setFilter]=useState<NewsFilter>("all"),[offset,setOffset]=useState(0),[revision,setRevision]=useState(0);
  const [articles,setArticles]=useState<NewsArticle[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(false);
  useEffect(()=>{
    const controller=new AbortController();setLoading(true);setError(false);setArticles([]);
    void loadPublicNews(filter,offset,PAGE_SIZE+1,controller.signal).then(rows=>{if(!controller.signal.aborted)setArticles(rows)}).catch(()=>{if(!controller.signal.aborted)setError(true)}).finally(()=>{if(!controller.signal.aborted)setLoading(false)});
    return ()=>controller.abort();
  },[filter,offset,revision]);
  return <section data-site-section-id="native-1" className="marketing-container marketing-news-layout" aria-label="Журнал новостей Lektrus">
    <div className="marketing-news-main">
      <div className="marketing-news-toolbar" role="group" aria-label="Категории новостей">{FILTERS.map(([value,label])=><button type="button" data-site-editor-control key={value} aria-pressed={filter===value} onClick={()=>{setFilter(value);setOffset(0)}}>{label}</button>)}</div>
      <div className="marketing-news-feed" aria-busy={loading}>
        {loading?<div className="marketing-news-state" role="status">Загружаем публикации…</div>:error?<div className="marketing-news-state" role="alert"><strong>Новости временно недоступны</strong><p>Попробуйте ещё раз немного позже.</p><button type="button" onClick={()=>setRevision(v=>v+1)}>Повторить</button></div>:articles.length===0?<div className="marketing-news-state"><NewsSymbol category="announcement"/><strong>Пока нет публикаций</strong><p>Здесь появятся свежие записи о развитии Lektrus.</p></div>:articles.slice(0,PAGE_SIZE).map(article=><article className={`marketing-news-card news-category-${article.category}`} key={article.id}>
          <div className="marketing-news-card-top"><span className="marketing-news-icon"><NewsSymbol category={article.category}/></span><div className="marketing-news-meta"><span className="marketing-news-kind">{NEWS_CATEGORIES[article.category]}</span>{article.category==="announcement"&&<span className="marketing-news-soon">Скоро</span>}{article.version&&<span className="marketing-news-version">{article.version}</span>}<time dateTime={article.published_at||undefined}>{newsDate(article.published_at)}</time></div></div>
          <h2>{article.title}</h2><p>{article.summary}</p>
          <details className="marketing-news-detail"><summary data-site-editor-control>Подробнее <span aria-hidden="true">→</span></summary><div className="marketing-news-body">{article.body}</div></details>
        </article>)}
      </div>
      {!loading&&!error&&(offset>0||articles.length>PAGE_SIZE)&&<nav className="marketing-news-pagination" aria-label="Страницы новостей"><button type="button" disabled={offset===0} onClick={()=>setOffset(v=>Math.max(0,v-PAGE_SIZE))}>← Назад</button><span>Страница {offset/PAGE_SIZE+1}</span><button type="button" disabled={articles.length<=PAGE_SIZE} onClick={()=>setOffset(v=>v+PAGE_SIZE)}>Далее →</button></nav>}
    </div>
    <aside className="marketing-news-side" aria-label="Социальные сети Lektrus"><div className="marketing-news-social"><span className="marketing-news-social-label">Оставайтесь на связи</span><div className="marketing-news-telegram-head"><span className="marketing-news-telegram-icon"><svg viewBox="0 0 24 24" width="27" height="27" aria-hidden="true"><path fill="currentColor" d="m20.8 4.2-3.1 15.2c-.2 1.1-.9 1.3-1.7.8l-4.7-3.5-2.3 2.2c-.3.3-.5.5-1 .5l.4-4.8 8.7-7.9c.4-.4-.1-.6-.6-.3L5.7 13.2 1.1 11.8c-1-.3-1-1 .2-1.5l18.1-7c.8-.3 1.6.2 1.4.9Z"/></svg></span><div><h3>Мы в Telegram</h3><span>@lektrus</span></div></div><p>Новости проекта, анонсы и полезные материалы — в нашем канале.</p><a href="https://t.me/lektrus" target="_blank" rel="noopener noreferrer" className="marketing-news-social-link">Перейти в канал <span aria-hidden="true">↗</span></a></div></aside>
  </section>;
}
