import { useCallback, useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { beginPdfPageRender, openPdfDocument } from "./pdfPagination";
import "./lektrusPdfPreview.css";

type Props = { src: string; page?: number; title?: string; maxPixels?: number; onPageCount?: (count: number) => void };

/** Render the actual PDF page on platforms that cannot display PDF iframes. */
export default function PdfPageCanvas({ src, page = 1, title = "PDF", maxPixels = 1_500_000, onPageCount }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  useEffect(() => {
    let current = true;
    const abort = new AbortController();
    let task: ReturnType<typeof openPdfDocument> | undefined;
    setPdf(null); setStatus("loading");
    void (async () => {
      try {
        const response = await fetch(src, { signal: abort.signal });
        if (!response.ok) throw new Error("PDF недоступен");
        const data = new Uint8Array(await response.arrayBuffer());
        if (!current) return;
        task = openPdfDocument(data);
        const document = await task.promise;
        if (current) setPdf(document);
      } catch { if (current) setStatus("error"); }
    })();
    return () => { current = false; abort.abort(); void task?.destroy().catch(() => {}); };
  }, [src]);
  useEffect(() => { if (pdf) onPageCount?.(pdf.numPages); }, [pdf, onPageCount]);
  useEffect(() => {
    if (!pdf || !canvas.current) return;
    const target = canvas.current;
    let current = true;
    let render: RenderTask | undefined;
    setStatus("loading");
    void (async () => {
      try {
        const documentPage = await pdf.getPage(Math.max(1, Math.min(pdf.numPages, Math.round(page))));
        if (!current) return;
        render = beginPdfPageRender(documentPage,target,maxPixels);
        await render.promise;
        if (current) setStatus("ready");
      } catch { if (current) setStatus("error"); }
    })();
    return () => { current = false; render?.cancel(); };
  }, [pdf, page, maxPixels]);
  return <div className="lektrus-pdf-canvas-stage" data-pdf-status={status}>
    <canvas key={`${src}:${page}`} ref={canvas} className="lektrus-pdf-canvas" role="img" aria-label={`${title}, страница ${page}`} hidden={status!=="ready"}/>
    {status!=="ready"&&<span role="status">{status==="loading"?"Загрузка страницы PDF…":"Не удалось открыть страницу PDF"}</span>}
  </div>;
}

export function PdfDocumentViewer({src,title,initialPage=1}:{src:string;title:string;initialPage?:number}) {
  const [page,setPage]=useState(initialPage);
  const [count,setCount]=useState(0);
  useEffect(()=>{setPage(initialPage);setCount(0);},[src,initialPage]);
  const updateCount=useCallback((value:number)=>{setCount(value);setPage(p=>Math.max(1,Math.min(value,p)));},[]);
  return <div className="lektrus-pdf-document-viewer">
    <div className="lektrus-pdf-page-controls"><button type="button" aria-label="Предыдущая страница PDF" disabled={page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))}>‹</button><span>{page} / {count||"…"}</span><button type="button" aria-label="Следующая страница PDF" disabled={!count||page>=count} onClick={()=>setPage(p=>Math.min(count,p+1))}>›</button></div>
    <PdfPageCanvas src={src} title={title} page={page} maxPixels={3_000_000} onPageCount={updateCount}/>
  </div>;
}
