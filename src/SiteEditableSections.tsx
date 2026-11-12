import type {SiteBlock,SitePage} from "./marketingSiteConfig";
import {safeSiteUrl} from "./marketingSiteConfig";

function SiteBlockView({block}:{block:SiteBlock}){
 const href=safeSiteUrl(block.href);
 if(block.kind==="divider")return <div className="site-block-divider" aria-hidden="true"/>;
 if(block.kind==="text")return <section className="site-block site-block-text"><div className="marketing-container"><h2>{block.title}</h2>{block.text&&<p>{block.text}</p>}</div></section>;
 if(block.kind==="image")return <section className="site-block"><div className="marketing-container site-block-image">
   <img src={safeSiteUrl(block.image)} alt={block.title} loading="lazy"/>
   <div><h2>{block.title}</h2><p>{block.text}</p>{block.href&&href!=="#"&&<a href={href} className="marketing-secondary">Подробнее ↗</a>}</div>
 </div></section>;
 if(block.kind==="gallery")return <section className="site-block"><div className="marketing-container"><h2>{block.title}</h2><p>{block.text}</p>
  <div className="site-block-gallery">{block.items.map((url,i)=><img key={i} src={safeSiteUrl(url)} alt={block.title+" "+(i+1)} loading="lazy"/>)}</div>
 </div></section>;
 if(block.kind==="cards")return <section className="site-block"><div className="marketing-container"><h2>{block.title}</h2><p>{block.text}</p>
  <div className="site-block-cards">{block.items.map((item,i)=><article key={i}><span className="marketing-number">{String(i+1).padStart(2,"0")}</span><h3>{item}</h3></article>)}</div>
 </div></section>;
 return <section className="site-block"><div className="marketing-container site-block-cta"><h2>{block.title}</h2><p>{block.text}</p>
  {href!=="#"&&<a className="marketing-primary" href={href}>Перейти ↗</a>}</div></section>;
}
export function SiteEditableBlocks({blocks}:{blocks:SiteBlock[]}){return <>{blocks.map(block=><div className="site-editable-block" data-site-block-id={block.id} key={block.id}><SiteBlockView block={block}/></div>)}</>}
export function SiteCustomPage({page}:{page:SitePage}){return <>
 <section className="marketing-page-hero marketing-container site-custom-hero"><span className="marketing-eyebrow">{page.eyebrow||"LEKTRUS"}</span><h1>{page.heading||page.title}</h1>{page.lead&&<p>{page.lead}</p>}</section>
 <SiteEditableBlocks blocks={page.blocks}/>
 </>}
