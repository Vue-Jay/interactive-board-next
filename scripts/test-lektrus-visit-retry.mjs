import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const exports={};
new Function('exports',ts.transpileModule(readFileSync(new URL('../src/lektrusVisitRetry.ts',import.meta.url),'utf8'),{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText)(exports);
const {retryVisitRequest}=exports;
const gateway=Object.assign(new Error('HTTP 503'),{status:503});
const waits=[],attempts=[];
const session='stable-session-id';
const result=await retryVisitRequest(async()=>{
 attempts.push(session);
 if(attempts.length<3)throw gateway;
 return {ok:true};
},async ms=>{waits.push(ms)});
assert.deepEqual(result,{ok:true});
assert.deepEqual(attempts,[session,session,session]);
assert.deepEqual(waits,[400,1200]);
for(const status of [401,403,404]){
 let calls=0;
 await assert.rejects(retryVisitRequest(async()=>{calls++;throw Object.assign(new Error('HTTP '+status),{status})},async()=>{}));
 assert.equal(calls,1);
}
let calls=0;
await assert.rejects(retryVisitRequest(async()=>{calls++;throw gateway},async()=>{}));
assert.equal(calls,3);
assert.equal(await retryVisitRequest(async()=>true,async()=>assert.fail('Successful request must not be retried')),true);
console.log('Visit requests: stable session, bounded gateway recovery, no authorization retries.');
