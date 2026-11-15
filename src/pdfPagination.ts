import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

// Read the actual page tree, including compressed object streams. The parser
// and worker are loaded only when someone selects a PDF, not on board startup.
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
