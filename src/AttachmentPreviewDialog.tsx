import { lazy, Suspense, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { saveExport } from "./nativeFileExport";
import "./lektrusPdfPreview.css";

const PdfDocumentViewer=lazy(()=>import("./PdfPageCanvas").then(m=>({default:m.PdfDocumentViewer})));
export type AttachmentPreview={blob:Blob;name:string;kind:"pdf"|"image";page?:number};

export default function AttachmentPreviewDialog({preview,onClose}:{preview:AttachmentPreview;onClose:()=>void}) {
  const [url,setUrl]=useState("");
  const [notice,setNotice]=useState("");
  const [saving,setSaving]=useState(false);
  useEffect(()=>{const next=URL.createObjectURL(preview.blob);setUrl(next);return()=>URL.revokeObjectURL(next);},[preview.blob]);
  useEffect(()=>{
    const close=(event:Event)=>{event.preventDefault();event.stopImmediatePropagation();onClose();};
    const key=(event:KeyboardEvent)=>{if(event.key==="Escape")close(event);};
    window.addEventListener("lektrus:board-native-back",close,true);
    window.addEventListener("keydown",key,true);
    return()=>{window.removeEventListener("lektrus:board-native-back",close,true);window.removeEventListener("keydown",key,true);};
  },[onClose]);
  return createPortal(<section className="lektrus-attachment-preview" role="dialog" aria-modal="true" aria-label="Предпросмотр вложения">
    <header><strong>{preview.name}</strong><div className="lektrus-attachment-preview-actions"><button type="button" disabled={saving} onClick={()=>{setSaving(true);void saveExport(preview.blob,preview.name).then(saved=>setNotice(saved?"Файл сохранён":"Сохранение отменено")).catch(()=>setNotice("Не удалось сохранить файл")).finally(()=>setSaving(false));}}>Скачать</button><button type="button" onClick={onClose}>Закрыть</button></div></header>
    <div className="lektrus-attachment-preview-body">{url&&(preview.kind==="pdf"?<Suspense fallback={<span>Открываем PDF…</span>}><PdfDocumentViewer src={url} title={preview.name} initialPage={preview.page}/></Suspense>:<img src={url} alt={preview.name}/>)}</div>
    {notice&&<p className="lektrus-attachment-preview-notice" role="status">{notice}</p>}
  </section>,document.body);
}
