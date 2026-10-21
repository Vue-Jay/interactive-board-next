import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const path=new URL("../src/cryptoUuidCompatibility.ts",import.meta.url);
const source=fs.readFileSync(path,"utf8");
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,
 target:ts.ScriptTarget.ES2022}}).outputText;
const uuidV4=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function load(crypto){
 const exports={};
 vm.runInNewContext(js,{exports,globalThis:crypto?{crypto}:{},Uint8Array,Math,Object});
 return exports;
}
const insecureCrypto={
 getRandomValues(bytes){for(let i=0;i<bytes.length;i++)bytes[i]=Math.floor(Math.random()*256);return bytes}
};
const compatibility=load(insecureCrypto);
assert.equal(typeof insecureCrypto.randomUUID,"function","compatibility installed on insecure HTTP crypto");
const ids=new Set(Array.from({length:1000},()=>insecureCrypto.randomUUID()));
assert.equal(ids.size,1000);
for(const id of ids)assert.match(id,uuidV4);
assert.match(compatibility.compatibleRandomUUID(),uuidV4);
const nativeCrypto={randomUUID:()=>"native-uuid"};
assert.equal(load(nativeCrypto).compatibleRandomUUID(),"native-uuid");
assert.equal(nativeCrypto.randomUUID(),"native-uuid","native crypto must not be overwritten");
const locked=Object.preventExtensions({
 getRandomValues(bytes){bytes.fill(3);return bytes}
});
const lockedApi=load(locked);
assert.equal(locked.randomUUID,undefined);
assert.match(lockedApi.compatibleRandomUUID(),uuidV4,"explicit fallback for sealed crypto");
assert.match(load(null).compatibleRandomUUID(),uuidV4,"legacy environments retain ID support");
const main=fs.readFileSync(new URL("../src/main.tsx",import.meta.url),"utf8");
assert.match(main,/^import "\.\/cryptoUuidCompatibility";/,"shim must load before app imports");
for(const path of ["LektrusProgrammingView.tsx","LektrusSchoolDiagramEditor.tsx","LektrusProgrammingControls.tsx"]){
 const code=fs.readFileSync(new URL("../src/"+path,import.meta.url),"utf8");
 assert.match(code,/compatibleRandomUUID\(\)/,"critical board path must not call a missing crypto API: "+path);
}
console.log("HTTP LAN crypto.randomUUID compatibility and critical render paths verified.");
