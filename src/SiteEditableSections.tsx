import type {CSSProperties} from "react";
import type {SiteBlock,SitePage} from "./marketingSiteConfig";
import {DEFAULT_SITE_BLOCK_STYLE,safeSiteUrl} from "./marketingSiteConfig";

const splitPair=(value:string):[string,string]=>{
 const at=value.indexOf(" | ");
 return at<0?[value,""]:[value.slice(0,at),value.slice(at+3)];
};
function SiteBlockView({block}:{block:SiteBlock}){
 const href=safeSiteUrl(block.href),style=block.style??DEFAULT_SITE_BLOCK_STYLE;
 const classes=["site-block","site-block-tone-"+style.tone,"site-block-align-"+style.align,"site-block-spacing-"+style.spacing];
 const columns={"--site-block-columns":style.columns} as CSSProperties;
 const label=block.buttonLabel||"Перейти";
 if(block.kind==="divider")return <div className="site-block-divider" aria-hidden="true"/>;
 if(block.kind==="text")return <section className={classes.join(" ")+" site-block-text"}><div className="marketing-container"><h2>{block.title}</h2>{block.text&&<p>{block.text}</p>}</div></section>;
 if(block.kind==="image")return <section className={classes.join(" ")}><div className={"marketing-container site-block-image site-block-image-"+style.imageSide}>
   <img src={safeSiteUrl(block.image)} alt={block.title} loading="lazy"/>
   <div><h2>{block.title}</h2>{block.text&&<p>{block.text}</p>}{block.href&&href!=="#"&&<a href={href} className="marketing-secondary">{label} ↗</a>}</div>
 </div></section>;
 if(block.kind==="gallery")return <section className={classes.join(" ")}><div className="marketing-container"><h2>{block.title}</h2>{block.text&&<p>{block.text}</p>}
  <div className="site-block-gallery" style={columns}>{block.items.map((url,i)=><img key={i} src={safeSiteUrl(url)} alt={block.title+" "+(i+1)} loading="lazy"/>)}</div>
 </div></section>;
 if(block.kind==="cards")return <section className={classes.join(" ")}><div className="marketing-container"><h2>{block.title}</h2>{block.text&&<p>{block.text}</p>}
  <div className="site-block-cards" style={columns}>{block.items.map((item,i)=><article key={i}><span className="marketing-number">{String(i+1).padStart(2,"0")}</span><h3>{item}</h3></article>)}</div>
 </div></section>;
 if(block.kind==="stats")return <section className={classes.join(" ")}><div className="marketing-container"><h2>{block.title}</h2>{block.text&&<p>{block.text}</p>}
  <div className="site-block-stats" style={columns}>{block.items.map((item,i)=>{
   const [metric,description]=splitPair(item);
   return <article key={i}><strong>{metric}</strong>{description&&<span>{description}</span>}</article>;
  })}</div>
 </div></section>;
 if(block.kind==="faq")return <section className={classes.join(" ")}><div className="marketing-container site-block-faq"><h2>{block.title}</h2>{block.text&&<p>{block.text}</p>}
  <div className="site-block-faq-list">{block.items.map((item,i)=>{
   const [question,answer]=splitPair(item);
   return <details key={i}><summary>{question}</summary>{answer&&<p>{answer}</p>}</details>;
  })}</div>
 </div></section>;
 if(block.kind==="quote")return <section className={classes.join(" ")}><figure className="marketing-container site-block-quote">
  <span aria-hidden="true" className="site-block-quote-icon">“</span>
  <blockquote>{block.text}</blockquote>{block.title&&<figcaption>{block.title}</figcaption>}
 </figure></section>;
 return <section className={classes.join(" ")}><div className="marketing-container site-block-cta"><h2>{block.title}</h2><p>{block.text}</p>
  {href!=="#"&&<a className="marketing-primary" href={href}>{label} ↗</a>}</div></section>;
}
export function SiteEditableBlocks({blocks,selectedId}:{blocks:SiteBlock[];selectedId?:string|null}){
 return <>{blocks.map(block=><div className="site-editable-block" data-site-block-id={block.id} data-site-selected={selectedId===block.id?"true":undefined} key={block.id}><SiteBlockView block={block}/></div>)}</>;
}
export function SiteCustomPage({page,selectedId}:{page:SitePage;selectedId?:string|null}){return <>
 <section className="marketing-page-hero marketing-container site-custom-hero" data-site-page-hero><span className="marketing-eyebrow">{page.eyebrow||"LEKTRUS"}</span><h1>{page.heading||page.title}</h1>{page.lead&&<p>{page.lead}</p>}</section>
 <SiteEditableBlocks blocks={page.blocks} selectedId={selectedId}/>
 </>}
