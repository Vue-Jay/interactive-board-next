// Preserve the message handler export for PDF.js's fake-worker fallback.
// Vite compiles this worker with the same build target as the main bundle.
export { WorkerMessageHandler } from "pdfjs-dist/legacy/build/pdf.worker.min.mjs";
