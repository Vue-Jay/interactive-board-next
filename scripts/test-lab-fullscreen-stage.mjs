import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";

// Execute the actual shared stage calculation with controlled viewport facts.
// No copied implementation and no brittle assertion on variable declaration style.
export function assertFullscreenStage(){
 const source=readFileSync(new URL("../src/LektrusChemistryBenchEditor.tsx",import.meta.url),"utf8");
 const ast=ts.createSourceFile("editor.tsx",source,ts.ScriptTarget.ES2022,true,ts.ScriptKind.TSX);
 const helper=ast.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text==="fullscreenStage");
 assert.ok(helper,"Shared first-frame and resize stage calculator is required");
 const compiled=ts.transpileModule(helper.getText(ast),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
 const call=(w,h,{native=false,coarse=false}={})=>{
  const document={documentElement:{classList:{contains:name=>name==="lektrus-native-app"&&native}}};
  const window={matchMedia:query=>({matches:query==="(pointer:coarse) and (max-width:1100px)"?coarse&&w<=1100:query==="(max-width:650px)"?w<=650:false})};
  return new Function("document","window",compiled+"\nreturn fullscreenStage;")(document,window)(w,h);
 };
 for(const [w,h,device] of [[915,412,{native:true}],[390,844,{}],[1024,768,{coarse:true}],[1100,650,{native:true}]]){
  assert.deepEqual(call(w,h,device),{width:w,height:h,scale:1,compact:true},"Compact laboratory uses unscaled native pixels");
 }
 const desktop=call(1440,900);
 assert.equal(desktop.compact,false);
 assert.equal(desktop.height,1000);
 assert.equal(desktop.scale,.9);
 assert.equal(desktop.width*desktop.scale,1440);
 assert.match(source,/useState\(\(\)=>fullscreenStage\(/,"Initial frame uses the shared stage calculator");
 assert.match(source,/fullscreenStage\(w,h\)/,"Resize uses the same stage calculator");
}
