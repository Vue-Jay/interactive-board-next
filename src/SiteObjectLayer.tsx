import {useLayoutEffect} from "react";
import type {SiteDocument,SiteObjectPatch} from "./marketingSiteConfig";

export type SiteObjectInfo={id:string;tag:string;label:string;text:string;src:string;alt:string;href:string;canText:boolean};
const tags=new Set(["H1","H2","H3","H4","H5","P","SPAN","SMALL","STRONG","B","A","BUTTON","IMG","SECTION","ARTICLE","FIGURE","BLOCKQUOTE","SUMMARY","LI","DT","DD","DIV","NAV","FOOTER","HEADER"]);
const friendly:Record<string,string>={H1:"Главный заголовок",H2:"Заголовок",H3:"Подзаголовок",P:"Текст",SPAN:"Фрагмент текста",SMALL:"Подпись",A:"Ссылка",BUTTON:"Кнопка",IMG:"Изображение",SECTION:"Секция",ARTICLE:"Карточка",FIGURE:"Иллюстрация",DIV:"Контейнер",NAV:"Навигация",LI:"Пункт списка",STRONG:"Выделенный текст",SUMMARY:"Вопрос",BLOCKQUOTE:"Цитата",FOOTER:"Подвал",HEADER:"Шапка"};
const directText=(element:Element):Text|null=>
 Array.from(element.childNodes).find((node):node is Text=>node.nodeType===Node.TEXT_NODE&&Boolean(node.textContent?.trim()))??null;
const stateFields=["color","background","font-size","font-weight","text-align","padding","border-radius","opacity","width","display"] as const;
type Saved={initialText:string|null;initialSrc:string|null;initialAlt:string|null;initialHref:string|null;styles:Record<string,string>;previous:string};
const originals=new WeakMap<Element,Saved>();
function objectDetails(element:Element,id:string):SiteObjectInfo{
 const tag=element.tagName;
 const text=directText(element)?.textContent?.trim()??"";
 const image=element instanceof HTMLImageElement;
 const anchor=element instanceof HTMLAnchorElement;
 return {id,tag,label:friendly[tag]??tag.toLowerCase(),text:text.slice(0,250),
  src:image?element.getAttribute("src")||"":"",alt:image?element.alt:"",
  href:anchor?element.getAttribute("href")||"":"",canText:!image&&Boolean(directText(element))};
}
function applyObjectPatch(element:Element,patch:SiteObjectPatch|undefined){
 if(!(element instanceof HTMLElement||element instanceof SVGElement))return;
 let saved=originals.get(element);
 if(!saved){
  const styles:Record<string,string>={};
  for(const field of stateFields)styles[field]=element.style.getPropertyValue(field);
  saved={initialText:directText(element)?.textContent??null,initialSrc:element.getAttribute("src"),initialAlt:element.getAttribute("alt"),initialHref:element.getAttribute("href"),styles,previous:""};
  originals.set(element,saved);
 }
 const serialized=JSON.stringify(patch||{});
 if(saved.previous===serialized)return;
 // Restore the original values before applying the new patch, including when reset.
 const text=directText(element);
 if(text&&saved.initialText!==null&&text.textContent!==saved.initialText)text.textContent=saved.initialText;
 if(element instanceof HTMLImageElement){
  if(saved.initialSrc!==null&&element.getAttribute("src")!==saved.initialSrc)element.setAttribute("src",saved.initialSrc);
  if(saved.initialAlt!==null)element.alt=saved.initialAlt;
 }
 if(element instanceof HTMLAnchorElement&&saved.initialHref!==null)element.setAttribute("href",saved.initialHref);
 for(const field of stateFields){
  if(saved.styles[field])element.style.setProperty(field,saved.styles[field]);
  else element.style.removeProperty(field);
 }
 if(patch){
  const t=directText(element);
  if(t&&patch.text!==undefined)t.textContent=patch.text;
  if(element instanceof HTMLImageElement){
   if(patch.src)element.src=patch.src;
   if(patch.alt!==undefined)element.alt=patch.alt;
  }
  if(element instanceof HTMLAnchorElement&&patch.href)element.href=patch.href;
  const st=patch.style;
  if(st?.color)element.style.color=st.color;
  if(st?.background)element.style.backgroundColor=st.background;
  if(st?.fontSize!==undefined)element.style.fontSize=st.fontSize+"px";
  if(st?.fontWeight)element.style.fontWeight=st.fontWeight==="medium"?"500":st.fontWeight==="bold"?"700":"400";
  if(st?.textAlign)element.style.textAlign=st.textAlign;
  if(st?.padding!==undefined)element.style.padding=st.padding+"px";
  if(st?.radius!==undefined)element.style.borderRadius=st.radius+"px";
  if(st?.opacity!==undefined)element.style.opacity=String(st.opacity);
  if(st?.width!==undefined)element.style.width=st.width+"%";
  if(patch.hidden===true)element.style.display="none";
 }
 saved.previous=serialized;
}
function collect(root:Element,scope:string):Array<{element:Element;info:SiteObjectInfo}>{
 const result:Array<{element:Element;info:SiteObjectInfo}>=[];
 const visit=(node:Element,path:string)=>{
  if(tags.has(node.tagName)&&!node.closest(".site-canvas-drop-zone")){
   const id=scope+"/"+path;
   node.setAttribute("data-site-object-id",id);
   result.push({element:node,info:objectDetails(node,id)});
  }
  Array.from(node.children).forEach((child,index)=>{
   if(child!==node&&child.hasAttribute("data-site-block-id")&&child!==root)return;
   if(child.hasAttribute("data-site-dropzone"))return;
   visit(child,path+"/"+index);
  });
 };
 visit(root,"root");
 return result;
}
function scanSiteObjects(page:string,doc:SiteDocument,selected:string|null,preview:boolean):SiteObjectInfo[]{
 const site=document.querySelector(".marketing-site"),main=site?.querySelector("#marketing-main");
 if(!site||!main)return [];
 const items:Array<{element:Element;info:SiteObjectInfo}>=[];
 const header=site.querySelector(":scope > header"),footer=site.querySelector(":scope > footer");
 if(header)items.push(...collect(header,"global:header"));
 if(footer)items.push(...collect(footer,"global:footer"));
 const segments=main.querySelectorAll("[data-site-section-id],[data-site-block-id],[data-site-page-hero]");
 segments.forEach(section=>{
  if(section.closest("[data-site-section-id],[data-site-block-id],[data-site-page-hero]")!==section)return;
  const sectionId=section.getAttribute("data-site-section-id")||section.getAttribute("data-site-block-id")||"custom-hero";
  items.push(...collect(section,page+":"+sectionId));
 });
 for(const {element,info} of items){
  const patch=doc.objects?.[info.id];
  applyObjectPatch(element,patch);
  if(preview){
   element.setAttribute("data-site-object-selected",selected===info.id?"true":"false");
  }
 }
 return items.map(x=>x.info);
}
export function SiteObjectLayer({siteDocument,page,preview,selected,interactive}:{siteDocument:SiteDocument;page:string;preview:boolean;selected:string|null;interactive:boolean}){
 useLayoutEffect(()=>{
  if(!preview&&!Object.keys(siteDocument.objects||{}).length)return;
  let raf=0,report="";
  const run=()=>{
   raf=0;
   const infos=scanSiteObjects(page,siteDocument,selected,preview);
   if(!preview)return;
   const summary=infos.map(info=>[info.id,info.label,info.text.slice(0,70),info.src.slice(0,70)]);
   const next=JSON.stringify(summary);
   if(next!==report){
    report=next;
    window.parent.postMessage({type:"lektrus:site-object-list",page,objects:infos},window.location.origin);
   }
  };
  const schedule=()=>{if(!raf)raf=requestAnimationFrame(run)};
  run();
  const root=document.getElementById("marketing-main");
  const observer=new MutationObserver(schedule);
  if(root)observer.observe(root,{childList:true,subtree:true});
  const click=(event:MouseEvent)=>{
   if(!preview||interactive)return;
   const target=event.target;
   if(!(target instanceof Element)||target.closest(".site-canvas-drop-zone"))return;
   const element=target.closest("[data-site-object-id]");
   if(!element)return;
   const id=element.getAttribute("data-site-object-id");
   if(!id)return;
   event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
   window.parent.postMessage({type:"lektrus:site-select-object",info:objectDetails(element,id)},window.location.origin);
  };
  document.addEventListener("click",click,true);
  return ()=>{observer.disconnect();document.removeEventListener("click",click,true);if(raf)cancelAnimationFrame(raf)};
 },[siteDocument,page,preview,selected,interactive]);
 return null;
}
