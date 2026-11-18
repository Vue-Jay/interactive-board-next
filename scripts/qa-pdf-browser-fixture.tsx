import { createRoot } from "react-dom/client";
import { PdfDocumentViewer } from "../src/PdfPageCanvas";

// A genuine three-page PDF: each page paints a different solid color. This
// detects a blank renderer, wrong page, or a placeholder masquerading as PDF.
export function mountPdfFixture() {
  const streams=["1 0 0 rg", "0 1 0 rg", "0 0 1 rg"].map(color=>`${color}\n0 0 300 200 re f\n`);
  const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R 4 0 R 5 0 R] /Count 3 >>',
    ...streams.map((_,i)=>`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Resources << >> /Contents ${6+i} 0 R >>`),
    ...streams.map(stream=>`<< /Length ${stream.length} >>\nstream\n${stream}endstream`)];
  let pdf='%PDF-1.4\n';const offsets=[0];
  objects.forEach((body,i)=>{offsets.push(pdf.length);pdf+=`${i+1} 0 obj\n${body}\nendobj\n`;});
  const xref=pdf.length;pdf+=`xref\n0 ${offsets.length}\n0000000000 65535 f \n${offsets.slice(1).map(v=>`${String(v).padStart(10,'0')} 00000 n \n`).join('')}trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  const url=URL.createObjectURL(new Blob([pdf],{type:'application/pdf'}));
  const host=document.createElement('div');host.id='pdf-fixture';host.dataset.source=url;host.style.cssText='position:fixed;inset:10px;z-index:2147483647;background:white;display:flex;min-height:0';document.body.append(host);
  const root=createRoot(host);root.render(<PdfDocumentViewer src={url} title="QA PDF"/>);
  return ()=>{root.unmount();host.remove();URL.revokeObjectURL(url);};
}
