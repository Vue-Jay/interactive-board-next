import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import ts from 'typescript';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs';

const assets = new URL('../dist/assets/', import.meta.url);
const worker = readdirSync(assets).find(name => /^pdfWorker-.*\.js$/.test(name));
assert.ok(worker, 'Missing transpiled native PDF worker');
const url = new URL(worker, assets);
const ast = ts.createSourceFile(worker, readFileSync(url,'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
assert.equal(ast.parseDiagnostics.length, 0);
const unsupported = new Set([ts.SyntaxKind.AmpersandAmpersandEqualsToken,
  ts.SyntaxKind.BarBarEqualsToken, ts.SyntaxKind.QuestionQuestionEqualsToken]);
function visit(node) {
  assert.ok(!ts.isBinaryExpression(node) || !unsupported.has(node.operatorToken.kind),
    'Android 11 WebView cannot parse logical assignment in PDF worker');
  ts.forEachChild(node, visit);
}
visit(ast);

GlobalWorkerOptions.workerSrc = url.href;
const module = await import(url.href);
assert.equal(typeof module.WorkerMessageHandler,'function', 'PDF fake-worker fallback export missing');
function pdfBytes(count) {
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Count '+count+' /Kids ['+Array.from({length:count},(_,i)=>(i+3)+' 0 R').join(' ')+'] >>',
    ...Array.from({length:count},()=> '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] >>')];
  let pdf='%PDF-1.4\n'; const offsets=[0];
  objects.forEach((body,i)=>{offsets.push(pdf.length);pdf+=(i+1)+' 0 obj\n'+body+'\nendobj\n'});
  const xref=pdf.length;
  pdf+='xref\n0 '+offsets.length+'\n0000000000 65535 f \n'+offsets.slice(1).map(v=>String(v).padStart(10,'0')+' 00000 n \n').join('')+
    'trailer\n<< /Size '+offsets.length+' /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF\n';
  return new TextEncoder().encode(pdf);
}
for (const count of [1,3]) {
  const task=getDocument({data:pdfBytes(count),isEvalSupported:false});
  try { assert.equal((await task.promise).numPages,count); }
  finally { await task.destroy(); }
}
console.log('Native PDF worker: compatible syntax, fallback export and real 1/3-page PDFs verified.');
