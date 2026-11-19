import { getDocument, GlobalWorkerOptions } from "pdfjs-dist/legacy/build/pdf.mjs";
import type { PDFPageProxy } from "pdfjs-dist";
import workerUrl from "./pdfWorker.ts?worker&url";

// Read the actual page tree, including compressed object streams. The parser
// and worker are loaded only when someone selects a PDF, not on board startup.
// The legacy PDF engine supplies runtime fallbacks; the bundled worker also
// receives the native Vite syntax target instead of being copied as raw JS.
GlobalWorkerOptions.workerSrc = workerUrl;

export function openPdfDocument(data: Uint8Array) {
  return getDocument({data, isEvalSupported:false});
}

export function beginPdfPageRender(page:PDFPageProxy,canvas:HTMLCanvasElement,maxPixels:number) {
  const natural=page.getViewport({scale:1});
  const scale=Math.min(3,Math.sqrt(maxPixels/(natural.width*natural.height)),2400/Math.max(natural.width,natural.height));
  const viewport=page.getViewport({scale});
  canvas.width=Math.max(1,Math.floor(viewport.width));canvas.height=Math.max(1,Math.floor(viewport.height));
  const context=canvas.getContext("2d");
  if(!context)throw new Error("Canvas unavailable");
  return page.render({canvasContext:context,viewport,background:"#ffffff"});
}

export async function renderPdfPageCanvas(blob:Blob,pageNumber:number,maxPixels=1_500_000):Promise<HTMLCanvasElement> {
  const task=openPdfDocument(new Uint8Array(await blob.arrayBuffer()));
  try {
    const pdf=await task.promise;
    const page=await pdf.getPage(Math.max(1,Math.min(pdf.numPages,Math.round(pageNumber))));
    const canvas=document.createElement("canvas");
    await beginPdfPageRender(page,canvas,maxPixels).promise;
    return canvas;
  }finally{await task.destroy();}
}

export async function getPdfPageCount(blob: Blob): Promise<number> {
  const task = openPdfDocument(new Uint8Array(await blob.arrayBuffer()));
  try {
    const pdf = await task.promise;
    return Math.min(10000, pdf.numPages);
  } finally {
    await task.destroy();
  }
}
