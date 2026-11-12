import type {DragEvent} from "react";
import type {SiteBlock} from "./marketingSiteConfig";

export const SITE_CANVAS_MIME="application/x-lektrus-site-block";

export type SiteCanvasTransfer=
 |{type:"block";kind:SiteBlock["kind"]}
 |{type:"kit";id:string}
 |{type:"move";id:string};

export const encodeSiteCanvasTransfer=(data:SiteCanvasTransfer)=>JSON.stringify(data);
export function decodeSiteCanvasTransfer(value:string):SiteCanvasTransfer|null{
 try{
  const x=JSON.parse(value) as Record<string,unknown>;
  if(x.type==="block"&&typeof x.kind==="string"&&/^[a-z-]{2,24}$/.test(x.kind))
   return {type:"block",kind:x.kind as SiteBlock["kind"]};
  if(x.type==="kit"&&typeof x.id==="string"&&/^[a-z-]{2,24}$/.test(x.id))
   return {type:"kit",id:x.id};
  if(x.type==="move"&&typeof x.id==="string"&&/^[a-z0-9-]{8,100}$/i.test(x.id))
   return {type:"move",id:x.id};
 }catch{/* ignore untrusted drag payload */}
 return null;
}
export function putSiteCanvasTransfer(event:DragEvent,transfer:SiteCanvasTransfer){
 const value=encodeSiteCanvasTransfer(transfer);
 event.dataTransfer.setData(SITE_CANVAS_MIME,value);
 event.dataTransfer.setData("text/plain",value);
 event.dataTransfer.effectAllowed=transfer.type==="move"?"move":"copy";
}
export function SiteDropZone({page,anchor,index,preview}:{page:string;anchor:string;index:number;preview:boolean}){
 if(!preview)return null;
 const drop=(event:DragEvent<HTMLDivElement>)=>{
  event.preventDefault();event.stopPropagation();
  event.currentTarget.classList.remove("is-over");
  const value=event.dataTransfer.getData(SITE_CANVAS_MIME)||event.dataTransfer.getData("text/plain");
  const transfer=decodeSiteCanvasTransfer(value);
  if(!transfer)return;
  window.parent.postMessage({type:"lektrus:site-canvas-drop",page,anchor,index,transfer},window.location.origin);
 };
 return <div className="site-canvas-drop-zone" data-site-dropzone={anchor+"/"+index}
   role="presentation" aria-label="Место для вставки блока"
   onDragOver={event=>{event.preventDefault();event.dataTransfer.dropEffect="copy";event.currentTarget.classList.add("is-over")}}
   onDragEnter={event=>{event.preventDefault();event.currentTarget.classList.add("is-over")}}
   onDragLeave={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node|null))event.currentTarget.classList.remove("is-over")}}
   onDrop={drop}>
   <span>＋ Перетащи сюда блок</span>
 </div>;
}
