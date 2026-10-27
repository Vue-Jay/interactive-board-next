import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import ts from "typescript";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const compile=path=>ts.transpileModule(read(path),{compilerOptions:{
 target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext
}}).outputText.replace(/^import[\s\S]*?from ["'][^"']+["'];\s*$/gm,"").replace(/^export /gm,"");
const edit=new Function(compile("src/lektrusLiveEditorMerge.ts")+
 "\nreturn {mergeEditedValue};")();
const sync=new Function("expandDocumentInk","packDocumentInk","mergeEditedValue",
 compile("src/lektrusBoardThreeWayMerge.ts")+
 "\nreturn {mergeBoardItems,mergeBoardDocumentEdits};")(
 data=>[...data.items,...(data.ink??[])],
 data=>({...data,items:data.items,ink:[]}),
 edit.mergeEditedValue
);
const item=(id,x=0,y=0,kind="shape")=>({id,x,y,width:100,height:100,kind,text:"",color:"#000"});
const base=[item("box"),item("pen",10,10,"pen"),item("eraserTarget",20,20,"pen")];
// A pen stroke added during another user's object movement must not disappear.
const local=[...base,item("newStroke",31,32,"pen")];
const remote=[{...base[0],x:300},base[1],base[2]];
let result=sync.mergeBoardItems(base,local,remote);
assert.equal(result.find(v=>v.id==="box").x,300);
assert.ok(result.some(v=>v.id==="newStroke"),"Local stroke survives remote move");
// Simultaneous new strokes from distinct participants are both kept.
result=sync.mergeBoardItems(base,[...base,item("localStroke",13,12,"pen")],
 [...base,item("remoteStroke",32,12,"pen")]);
assert.ok(result.some(v=>v.id==="localStroke")&&result.some(v=>v.id==="remoteStroke"));
// Eraser deletes a stroke locally; another user's update must not recreate it.
result=sync.mergeBoardItems(base,base.filter(v=>v.id!=="eraserTarget"),
 [...base,item("remoteShape",53,32)]);
assert.ok(!result.some(v=>v.id==="eraserTarget"),"Erased stroke cannot reappear");
assert.ok(result.some(v=>v.id==="remoteShape"),"Unrelated remote objects preserved");
// Dragging and resizing a shared object while another participant changes its
// color must combine all independent fields, without teleporting the object.
result=sync.mergeBoardItems(base,[{...base[0],x:140,y:60,width:200},base[1],base[2]],
 [{...base[0],color:"#fa0"},base[1],base[2]]);
assert.deepEqual(result.find(v=>v.id==="box"),{...base[0],x:140,y:60,width:200,color:"#fa0"});
// A remote deletion must be retained if the local object remained unchanged.
result=sync.mergeBoardItems(base,base,base.slice(1));
assert.ok(!result.some(v=>v.id==="box"));
// A local modification before a remote deletion is not silently lost.
result=sync.mergeBoardItems(base,[{...base[0],x:24},...base.slice(1)],base.slice(1));
assert.equal(result.find(v=>v.id==="box").x,24);
// Independent shared metadata edits are rebased too.
const doc=(items,title="Lesson",background="#fff")=>({
 version:1,title,subject:"Химия",background,backgroundShared:true,
 view:{x:0,y:0,zoom:1},items,ink:[],
});
const merged=sync.mergeBoardDocumentEdits(doc(base),
 doc(local,"Locally renamed"),doc(remote,"Lesson","#abc"));
assert.ok(merged.items.some(v=>v.id==="newStroke"));
assert.equal(merged.title,"Locally renamed");
assert.equal(merged.background,"#abc");
assert.equal(merged.items.find(v=>v.id==="box").x,300);

const code=read("src/App.tsx"),roles=read("src/lektrusBoardRolePreview.ts");
const roleModule=new Function(compile("src/lektrusBoardRolePreview.ts")+
 "\nreturn {boardRoleCapabilities,isStudentProtectedBoardObject,canTransformStudentBoardObject,canUseBoardCreationTool};")();
const student=roleModule.boardRoleCapabilities({
 preview:"student",boardRole:"editor",accountRole:"student",isAppAdmin:false,adminMaintenance:false
});
const guest=roleModule.boardRoleCapabilities({
 preview:"actual",boardRole:"editor",accountRole:"student",isAppAdmin:false,adminMaintenance:false,isGuest:true
});
assert.ok(student.canEdit&&guest.canEdit);
for(const caps of [student,guest]){
 for(const kind of ["graph","formula","table"]){
  assert.equal(roleModule.isStudentProtectedBoardObject(kind,caps),false,
   "Existing "+kind+" editor is available to pupils");
 }
 for(const kind of ["graph","formula","quiz","frame","table","image","pdf","checklist"]){
  assert.ok(roleModule.canTransformStudentBoardObject(kind,caps),
   "A pupil must be able to move and resize an unlocked "+kind);
 }
 assert.ok(roleModule.isStudentProtectedBoardObject("quiz",caps),
  "Answer key remains teacher-only");
 assert.equal(roleModule.canUseBoardCreationTool("quiz",caps),false,
  "Students cannot author new graded assignments");
}
assert.ok(code.includes("mergeBoardDocumentEdits(acknowledgedBoardData.current,local,remote)"));
assert.ok(code.includes("acknowledgedBoardData.current = data;"));
assert.ok(code.includes("acknowledgedBoardData.current = remote;"));
assert.ok(!code.includes("applyDocument(merged, true)"),"No destructive UI reset during remote conflict");
assert.ok(!code.includes("applyDocument(data, true)"),"No destructive UI reset on clean revisions");
assert.ok(code.includes("if (queued && !deferred)"),"Stale snapshot not sent while rebasing");
assert.ok(code.includes("items: editing\n        ? itemsRef.current"),"Autosave uses synchronous model during RAF");
assert.ok(code.includes("const canTransformBoardObject="));
assert.ok(code.includes("const live=remoteLiveItems[entry.item.id]"),"Realtime preview must not teleport object");
assert.ok(code.includes("openGraphEditor(item);"),"Student can open subject editors");
const appAST=ts.createSourceFile("App.tsx",code,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
assert.equal(appAST.parseDiagnostics.length,0);
console.log("Board collaboration: pen/eraser, simultaneous ink, move/resize, student/guest transforms and open editors: OK");
