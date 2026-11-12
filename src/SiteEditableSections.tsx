import type {CSSProperties} from "react";
import type {SiteBlock,SitePage} from "./marketingSiteConfig";
import {DEFAULT_SITE_BLOCK_STYLE,safeSiteUrl} from "./marketingSiteConfig";
import {SiteDropZone,putSiteCanvasTransfer} from "./SiteCanvasDnD";

const splitPair=(value:string):[string,string]=>{
 const at=value.indexOf(" | ");
 return at<0?[value,""]:[value.slice(0,at),value.slice(at+3)];
};
const safeVideoEmbed=(value:string):string=>{
 try{
  const url=new URL(value);
  if(url.protocol!=="https:")return "";
  const host=url.hostname.toLowerCase();
  if(host==="youtu.be"||host==="www.youtube.com"||host==="youtube.com"||host==="www.youtube-nocookie.com"||host==="youtube-nocookie.com"){
   const id=(host==="youtu.be"?url.pathname.slice(1):url.searchParams.get("v")||url.pathname.match(/^\/(?:embed|shorts)\/([\w-]{11})/)?.[1]||"");
   return /^[\w-]{11}$/.test(id)?"https://www.youtube-nocookie.com/embed/"+id:"";
  }
  if(host==="vimeo.com"||host==="www.vimeo.com"||host==="player.vimeo.com"){
   const id=url.pathname.match(/(?:\/video)?\/([0-9]{3,12})\/?$/)?.[1];
   return id?"https://player.vimeo.com/video/"+id:"";
  }
 }catch{/* invalid or unsupported media URL */}
 return "";
};
function SiteBlockView({block}:{block:SiteBlock}){
 const href=safeSiteUrl(block.href),style=block.style??DEFAULT_SITE_BLOCK_STYLE;
 const classes=["site-block","site-block-tone-"+style.tone,"site-block-align-"+style.align,"site-block-spacing-"+style.spacing];
 const columns={"--site-block-columns":style.columns} as CSSProperties;
 const label=block.buttonLabel||"Перейти";
 if(block.kind==="divider")return <div className="site-block-divider" aria-hidden="true"/>;
 if(block.kind==="spacer")return <div className={"site-block-spacer site-block-spacing-"+style.spacing} aria-hidden="true"/>;
 if(block.kind==="text")return <section className={classes.join(" ")+" site-block-text"}><div className="marketing-container"><h2>{block.title}</h2>{block.text&&<p>{block.text}</p>}</div></section>;
 if(block.kind==="image")return <section className={classes.join(" ")}><div className={"marketing-container site-block-image site-block-image-"+style.imageSide}>
   <img src={safeSiteUrl(block.image)} alt={block.title} loading="lazy"/>
   <div><h2>{block.title}</h2>{block.text&&<p>{block.text}</p>}{block.href&&href!=="#"&&<a href={href} className="marketing-secondary">{label} ↗</a>}</div>
 </div></section>;
 if(block.kind==="gallery"||block.kind==="logos")return <section className={classes.join(" ")}><div className="marketing-container"><h2>{block.title}</h2>{block.text&&<p>{block.text}</p>}
  <div className={block.kind==="gallery"?"site-block-gallery":"site-block-logos"} style={columns}>{block.items.map((url,i)=><img key={i} src={safeSiteUrl(url)} alt={block.title+" "+(i+1)} loading="lazy"/>)}</div>
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
 if(block.kind==="video"){
  const embed=safeVideoEmbed(block.href);
  return <section className={classes.join(" ")}><div className="marketing-container site-block-video"><div><h2>{block.title}</h2>{block.text&&<p>{block.text}</p>}</div>
   {embed?<iframe src={embed} loading="lazy" title={block.title||"Видео"} allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin"/>:
    <div className="site-block-video-placeholder">Добавь ссылку YouTube или Vimeo в настройках блока</div>}
  </div></section>;
 }
 if(block.kind==="timeline")return <section className={classes.join(" ")}><div className="marketing-container"><h2>{block.title}</h2>{block.text&&<p>{block.text}</p>}
  <ol className="site-block-timeline">{block.items.map((item,i)=>{
   const [heading,detail]=splitPair(item);
   return <li key={i}><span>{String(i+1).padStart(2,"0")}</span><div><h3>{heading}</h3>{detail&&<p>{detail}</p>}</div></li>;
  })}</ol></div></section>;
 if(block.kind==="comparison")return <section className={classes.join(" ")}><div className="marketing-container"><h2>{block.title}</h2>{block.text&&<p>{block.text}</p>}
  <div className="site-block-comparison">{block.items.slice(0,4).map((item,i)=>{
   const [heading,detail]=splitPair(item);
   return <article key={i}><span className="marketing-eyebrow">Вариант {i+1}</span><h3>{heading}</h3>{detail&&<p>{detail}</p>}</article>;
  })}</div></div></section>;
 if(block.kind==="checklist")return <section className={classes.join(" ")}><div className="marketing-container"><h2>{block.title}</h2>{block.text&&<p>{block.text}</p>}
  <ul className="site-block-checklist">{block.items.map((item,i)=><li key={i}><span aria-hidden="true">✓</span>{item}</li>)}</ul></div></section>;
 if(block.kind==="button-row")return <section className={classes.join(" ")}><div className="marketing-container"><h2>{block.title}</h2>{block.text&&<p>{block.text}</p>}
  <div className="site-block-button-row">{block.items.map((item,i)=>{
   const [title,url]=splitPair(item),destination=safeSiteUrl(url);
   return destination!=="#"?<a key={i} href={destination} className={i===0?"marketing-primary":"marketing-secondary"}>{title} ↗</a>:null;
  })}</div></div></section>;
 }
 return <section className={classes.join(" ")}><div className="marketing-container site-block-cta"><h2>{block.title}</h2><p>{block.text}</p>
  {href!=="#"&&<a className="marketing-primary" href={href}>{label} ↗</a>}</div></section>;
}
export function SiteEditableBlocks({blocks,selectedId,page,anchor="end",preview=false}:{blocks:SiteBlock[];selectedId?:string|null;page?:string;anchor?:string;preview?:boolean}){
 return <>{page&&<SiteDropZone page={page} anchor={anchor} index={0} preview={preview}/>}
  {blocks.map((block,index)=><div className="site-editable-block" data-site-block-id={block.id} data-site-selected={selectedId===block.id?"true":undefined} key={block.id}
   draggable={preview} onDragStart={event=>{if(preview)putSiteCanvasTransfer(event,{type:"move",id:block.id})}}>
   <SiteBlockView block={block}/>
   </div>)}
  {page&&blocks.map((block,index)=><SiteDropZone key={block.id+"-after"} page={page} anchor={anchor} index={index+1} preview={preview}/>)}
 </>;
}
export function SiteAnchorSlot({page,anchor,blocks,selectedId,preview}:{page:string;anchor:string;blocks:SiteBlock[];selectedId?:string|null;preview:boolean}){
 const placed=blocks.filter(block=>(block.anchor||"end")===anchor);
 if(!preview&&!placed.length)return null;
 return <div className="site-canvas-slot" data-site-anchor={anchor}><SiteEditableBlocks page={page} anchor={anchor} preview={preview} blocks={placed} selectedId={selectedId}/></div>;
}
export function SiteCustomPage({page,selectedId,preview=false}:{page:SitePage;selectedId?:string|null;preview?:boolean}){return <>
 <section className="marketing-page-hero marketing-container site-custom-hero" data-site-page-hero data-site-section-id="custom-hero"><span className="marketing-eyebrow">{page.eyebrow||"LEKTRUS"}</span><h1>{page.heading||page.title}</h1>{page.lead&&<p>{page.lead}</p>}</section>
 <SiteAnchorSlot page={page.id} anchor="end" blocks={page.blocks} selectedId={selectedId} preview={preview}/>
 </>}
