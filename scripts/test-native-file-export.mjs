import assert from 'node:assert/strict';
import { safeExportFilename,writeNativeBlob } from '../src/nativeFileExport.ts';

const bytes=Uint8Array.from({length:600_000},(_,i)=>i%251);
const blob=new Blob([bytes],{type:'application/pdf'});
const calls=[];
const writer={
  async begin(options){calls.push(['begin',options]);return {token:'QA'};},
  async append(options){calls.push(['append',options]);},
  async finish(options){calls.push(['finish',options]);return {saved:true};},
  async cancel(options){calls.push(['cancel',options]);}
};
assert.equal(await writeNativeBlob(writer,blob,'../../доска.pdf'),true);
assert.equal(calls[0][1].mime,'application/pdf');
assert.equal(calls[0][1].size,bytes.length);
const chunks=calls.filter(c=>c[0]==='append').map(c=>c[1]);
assert.deepEqual(chunks.map(c=>c.offset),[0,262144,524288]);
assert.deepEqual(Buffer.concat(chunks.map(c=>Buffer.from(c.data,'base64'))),Buffer.from(bytes));
assert.equal(calls.at(-1)[0],'finish');
assert.ok(new TextEncoder().encode(safeExportFilename('📝'.repeat(200)+'.orboard')).length<=240);
assert.ok(safeExportFilename('📝'.repeat(200)+'.orboard').endsWith('.orboard'));
assert.equal(safeExportFilename(' '),'lektrus-file');
assert.equal(await writeNativeBlob({...writer,finish:async()=>({saved:false})},blob,'file.pdf'),false);
await assert.rejects(writeNativeBlob({...writer,append:async()=>{throw new Error('disk full');}},blob,'file.pdf'),/disk full/);
assert.equal(calls.at(-1)[0],'cancel');
console.log('✓ Native export: exact binary chunks, filename limits, user cancellation and failure cleanup');
