import { getDocument, GlobalWorkerOptions } from "pdfjs-dist/legacy/build/pdf.mjs";
import workerUrl from "./pdfWorker.ts?worker&url";

// Read the actual page tree, including compressed object streams. The parser
// and worker are loaded only when someone selects a PDF, not on board startup.
// The legacy PDF engine supplies runtime fallbacks; the bundled worker also
// receives the native Vite syntax target instead of being copied as raw JS.
GlobalWorkerOptions.workerSrc = workerUrl;

export async function getPdfPageCount(blob: Blob): Promise<number> {
  const task = getDocument({data: new Uint8Array(await blob.arrayBuffer()), isEvalSupported: false});
  try {
    const pdf = await task.promise;
    return Math.min(10000, pdf.numPages);
  } finally {
    await task.destroy();
  }
}
