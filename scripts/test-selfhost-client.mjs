// Browser-facing self-hosted client contract, with mocked HTTPS and WS only.
// The production Supabase session and main routes are deliberately untouched.
import assert from "node:assert/strict";
import vm from "node:vm";
import ts from "typescript";
import { readFileSync } from "node:fs";

// Registration must confirm the password before sending credentials to the API.
const registrationForm=readFileSync(new URL("../src/AuthScreen.tsx",import.meta.url),"utf8");
assert.match(registrationForm,/Повторите пароль/);
assert.match(registrationForm,/password!==passwordConfirmation/);
assert.match(registrationForm,/mode==="register"&&!awaitingConfirmation&&password!==passwordConfirmation/);
assert.match(registrationForm,/auth-shell-register/);
const registrationStyles=readFileSync(new URL("../src/lektrusAuthLayout.css",import.meta.url),"utf8");
assert.match(registrationStyles,/\.auth-shell-register \.auth-card/);
assert.match(registrationStyles,/grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
assert.match(registrationStyles,/@media \(min-width: 760px\)/);
assert.match(registrationStyles,/\.auth-shell-register \.auth-form > \.auth-field/);
assert.match(registrationStyles,/\.auth-shell-register \.auth-form > \.auth-submit/);

async function loadSelfhost(enabled) {
  let source=readFileSync(new URL("../src/selfhostApi.ts",import.meta.url),"utf8");
  source=source
    .replaceAll("import.meta.env.VITE_LEKTRUS_BACKEND",JSON.stringify(enabled?"selfhost":""))
    .replaceAll("import.meta.env.VITE_LEKTRUS_API_ORIGIN",JSON.stringify("https://pilot.lektrus.example"))
    .replaceAll("import.meta.env.DEV","false");
  const compiled=ts.transpileModule(source,{
    compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS},
  }).outputText;
  const data=new Map([["lesson-board.supabase.session.v1","production-must-remain"]]);
  const record=[];
  let expires=900,refreshes=0,documentVersion=3,documentFailures=0;
  const nativeBoardId="00000000-0000-4000-8000-000000000004";
  const nativeComment={id:"comment-root",board_id:nativeBoardId,
    author_id:"00000000-0000-4000-8000-000000000001",author_name:"Учитель",
    parent_id:null,body:"Проверьте решение",resolved:false,
    created_at:"2026-11-14T10:00:00Z",updated_at:"2026-11-14T10:00:00Z"};
  const user={
    id:"00000000-0000-4000-8000-000000000001",
    email:"teacher@example.test",user_metadata:{display_name:"Учитель"},
    account_role:"teacher",teacher_status:"approved",is_admin:false,
  };
  const sessionStorage={
    getItem(key){return data.get(key)??null},
    setItem(key,value){data.set(key,String(value))},
    removeItem(key){data.delete(key)},
  };
  const fetch=async(input,options)=>{
    const u=new URL(String(input));
    assert.equal(u.origin,"https://pilot.lektrus.example");
    assert.ok(u.pathname.startsWith("/api/v1/"));
    assert.equal(options.credentials,"omit");
    const headers=new Headers(options.headers);
    record.push({path:u.pathname,method:options.method||"GET",
      bearer:headers.get("Authorization"),
      body:typeof options.body==="string"?JSON.parse(options.body):
        options.body instanceof Blob?{size:options.body.size,type:options.body.type}:null});
    const ok=(value,status=200)=>Response.json(value,{status});
    if(u.pathname==="/api/v1/auth/login"){
      assert.equal(headers.get("Authorization"),null);
      return ok({access_token:"token-first",refresh_token:"refresh-first",expires_in:expires,user});
    }
    if(u.pathname==="/api/v1/auth/refresh"){
      refreshes++;
      return ok({access_token:"token-refreshed",refresh_token:"refresh-refreshed",expires_in:900,user});
    }
    if(u.pathname==="/api/v1/auth/logout")return new Response(null,{status:200});
    if(u.pathname==="/api/v1/boards"&&options.method==="POST"){
      const body=JSON.parse(options.body);
      if(body.is_pilot===false){
        assert.equal(body.title,"Нативная доска");
        return ok({id:nativeBoardId,role:"owner",title:body.title});
      }
      assert.deepEqual(body,{title:"Тест",is_pilot:true});
      return ok({id:"board-1",role:"owner",title:"Тест"});
    }
    if(u.pathname===`/api/v1/boards/${nativeBoardId}/document`&&options.method==="PUT"){
      const body=JSON.parse(options.body);
      assert.equal(body.expected_version,0);
      return ok({board_id:nativeBoardId,version:1,document:body.document,
        updated_by:user.id,updated_at:"2026-11-14T10:00:00Z"});
    }
    if(u.pathname===`/api/v1/boards/${nativeBoardId}/document`)
      return ok({board_id:nativeBoardId,version:1,
        document:{version:1,title:"Нативная доска",view:{x:0,y:0,zoom:1},items:[]},
        updated_by:user.id,updated_at:"2026-11-14T10:00:00Z"});
    const assetBase=`/api/v1/boards/${nativeBoardId}/assets/`;
    if(u.pathname===assetBase+"asset_1"&&options.method==="HEAD")
      return new Response(null,{status:200});
    if(u.pathname===assetBase+"missing"&&options.method==="HEAD")
      return new Response(null,{status:404});
    if(u.pathname===assetBase+"asset_1"&&options.method==="POST"){
      assert.equal(headers.get("Content-Type"),"image/png");
      assert.equal(options.body instanceof Blob,true);
      return ok({name:nativeBoardId+"/asset_1"},201);
    }
    if(u.pathname===assetBase+"asset_1"&&options.method==="GET")
      return new Response(new Blob(["stored asset"],{type:"image/png"}),{
        status:200,headers:{"Content-Type":"image/png"},
      });
    if(u.pathname==="/api/v1/students")return ok([{
      user_id:"student-1",name:"Ученик",email:"student@example.test",
      board_ids:[nativeBoardId],board_titles:["Нативная доска"],last_board_at:"2026-11-14T10:00:00Z",
      note:"Заметка",tags:["математика"],
    }]);
    if(u.pathname==="/api/v1/students/student-1/profile"&&options.method==="PUT"){
      assert.equal(JSON.parse(options.body).note,"Новая заметка");return ok({ok:true});
    }
    if(u.pathname==="/api/v1/students/student-1/sessions")return ok([{
      id:"session-1",student_id:"student-1",board_id:nativeBoardId,
      board_title:"Нативная доска",date:"2026-11-14T10:00:00Z",
      duration_minutes:45,topic:"Алгебра",homework:"№ 5",result:"Готово",
    }]);
    if(u.pathname==="/api/v1/student-sessions/session-1"&&options.method==="PUT"){
      assert.equal(JSON.parse(options.body).duration_minutes,45);return ok({ok:true});
    }
    if(u.pathname==="/api/v1/student-sessions/session-1"&&options.method==="DELETE")return new Response(null,{status:204});
    if(u.pathname==="/api/v1/assignments"&&(options.method||"GET")==="GET")return ok([]);
    if(u.pathname==="/api/v1/assignments"&&options.method==="POST"){
      assert.equal(JSON.parse(options.body).student_id,"student-1");return ok({ok:true,id:"assignment-1"},201);
    }
    if(u.pathname==="/api/v1/assignments/assignment-1"&&options.method==="DELETE")return new Response(null,{status:204});
    if(u.pathname==="/api/v1/assignments/assignment-1/submit"){
      assert.equal(JSON.parse(options.body).content,"Ответ");return ok({ok:true});
    }
    if(u.pathname==="/api/v1/assignments/assignment-1/review"){
      assert.equal(JSON.parse(options.body).score,9);return ok({ok:true});
    }
    if(u.pathname==="/api/v1/schedule"&&(options.method||"GET")==="GET")return ok([]);
    if(u.pathname==="/api/v1/schedule"&&options.method==="POST"){
      assert.equal(JSON.parse(options.body).items.length,1);return ok({ok:true,created:1},201);
    }
    if(u.pathname==="/api/v1/schedule/schedule-1"&&options.method==="PATCH"){
      assert.equal(JSON.parse(options.body).title,"Новое занятие");return ok({ok:true});
    }
    if(u.pathname==="/api/v1/schedule/schedule-1"&&options.method==="DELETE")return new Response(null,{status:204});
    if(u.pathname==="/api/v1/schedule/schedule-1/start")return ok({ok:true});
    if(u.pathname==="/api/v1/schedule/schedule-1/complete")return ok({ok:true});
    if(u.pathname===`/api/v1/boards/${nativeBoardId}/lessons/active`)return ok(null);
    if(u.pathname===`/api/v1/boards/${nativeBoardId}/lessons`&&options.method==="POST"){
      assert.equal(JSON.parse(options.body).student_id,"student-1");
      return ok({id:"lesson-1",board_id:nativeBoardId,student_id:"student-1",
        student_name:"Ученик",topic:"Тема",started_at:"2026-11-14T10:00:00Z",ended_at:null});
    }
    if(u.pathname==="/api/v1/lessons/lesson-1/finish")return ok({ok:true,minutes:45});
    if(u.pathname===`/api/v1/boards/${nativeBoardId}/comments`){
      if(options.method==="POST"){
        const body=JSON.parse(options.body);
        assert.deepEqual(body,{body:"Ответ ученика",parent_id:"comment-root"});
        return ok({...nativeComment,id:"comment-reply",body:body.body,parent_id:body.parent_id},201);
      }
      return ok([nativeComment]);
    }
    if(u.pathname===`/api/v1/boards/${nativeBoardId}/comment-participants`)
      return ok([{user_id:user.id,display_name:"Учитель"}]);
    if(u.pathname==="/api/v1/comments/comment-root"&&options.method==="PATCH"){
      assert.deepEqual(JSON.parse(options.body),{resolved:true});
      return ok({...nativeComment,resolved:true});
    }
    if(u.pathname==="/api/v1/boards")return ok([{id:"board-1",title:"Тест",role:"owner"}]);
    if(u.pathname==="/api/v1/boards/board-1/document"&&options.method==="PUT"){
      assert.equal(u.searchParams.get("version_only"),"true");
      if(JSON.parse(options.body).expected_version!==3)
        return ok({detail:"Версия изменилась."},409);
      return ok({version:4});
    }
    if(u.pathname==="/api/v1/boards/board-1/document"){
      if(documentFailures>0){
        documentFailures--;
        return ok({detail:"Temporary error"},503);
      }
      return ok({board_id:"board-1",version:documentVersion,document:{pilot_schema:1,items:[],ink:[],note:"hi"}});
    }
    if(u.pathname==="/api/v1/boards/board-1/pilot/ink"&&options.method==="POST"){
      assert.equal(options.body!==undefined,true);
      assert.equal(JSON.parse(options.body).stroke_id,"stroke_test");
      return ok({operation_id:"00000000-0000-4000-8000-000000000501",
        stroke_id:"stroke_test",version:5,duplicate:false},201);
    }
    if(u.pathname==="/api/v1/boards/board-1/pilot/ink/undo"&&options.method==="POST")
      return ok({operation_id:"00000000-0000-4000-8000-000000000502",
        stroke_id:"stroke_test",version:6,duplicate:false});
    if(u.pathname==="/api/v1/boards/board-1/pilot/history")
      return ok([{operation_id:"00000000-0000-4000-8000-000000000501",
        actor_id:user.id,type:"ink_append",stroke_id:"stroke_test",version:5}]);
    if(u.pathname==="/api/v1/boards/board-1/pilot/objects"&&options.method==="POST"){
      const body=JSON.parse(options.body);
      assert.equal(body.object_id,"rect_1");
      assert.equal(body.kind,"pilot_rect");
      return ok({operation_id:body.operation_id,object_id:body.object_id,
        object_revision:1,version:7,duplicate:false},201);
    }
    if(u.pathname==="/api/v1/boards/board-1/pilot/objects/rect_1/move"&&options.method==="POST"){
      const body=JSON.parse(options.body);
      assert.equal(body.expected_revision,1);
      assert.equal(body.x,240);
      return ok({operation_id:body.operation_id,object_id:"rect_1",
        object_revision:2,version:8,duplicate:false});
    }
    if(u.pathname==="/api/v1/boards/board-1/invitations")return ok({kind:"invite"});
    if(u.pathname==="/api/v1/invitations/claim")return ok({claimed:1});
    if(u.pathname==="/api/v1/auth/signup")return ok({ok:true,message:"email sent"},202);
    if(u.pathname==="/api/v1/auth/verify-email")return ok({access_token:"token-verified",refresh_token:"refresh-verified",expires_in:900,user});
    throw new Error("Unexpected pilot request "+u.pathname);
  };
  const sockets=[];
  class Socket {
    static OPEN=1;
    readyState=0;
    sent=[];
    constructor(url){this.url=url;sockets.push(this)}
    send(value){this.sent.push(JSON.parse(value))}
    close(){this.readyState=3}
    emit(data){this.onmessage?.({data:JSON.stringify(data)})}
    open(){this.readyState=1;this.onopen?.()}
  }
  const listeners=new Map();
  const context=vm.createContext({
    exports:{},fetch,URL,Headers,Response,AbortController,FormData,queueMicrotask,
    navigator:{onLine:true},WebSocket:Socket,
    localStorage:sessionStorage,sessionStorage,setTimeout,clearTimeout,setInterval,clearInterval,Date,
    window:{location:{origin:"https://pilot.lektrus.example"},
      addEventListener(name,fn){listeners.set(name,fn)},
      removeEventListener(name){listeners.delete(name)}},
  });
  vm.runInContext(compiled,context);
  return {api:context.exports,records:record,storage:data,refreshCount:()=>refreshes,sockets,listeners,sessionStorage,changeExpires:v=>{expires=v},changeDocument:(v,failures=0)=>{documentVersion=v;documentFailures=failures}};
}

const disabled=await loadSelfhost(false);
assert.equal(disabled.api.SELFHOST_BACKEND_ENABLED,false);
assert.throws(()=>disabled.api.selfhostOrigin(),/не подключён/);
assert.equal(disabled.storage.get("lesson-board.supabase.session.v1"),"production-must-remain");

const env=await loadSelfhost(true);
const {api,storage,records,sockets}=env;
assert.equal(api.SELFHOST_BACKEND_ENABLED,true);
assert.equal(api.selfhostOrigin(),"https://pilot.lektrus.example");
const session=await api.selfhostLogin(" Teacher@Example.Test ","test-password");
assert.equal(session.user.account_role,"teacher");
assert.equal(api.cachedSelfhostSession().user.id,session.user.id);
assert.equal(storage.get("lesson-board.supabase.session.v1"),"production-must-remain");
assert.equal(records[0].body.email,"teacher@example.test");
assert.equal((await api.selfhostBoards()).length,1);
assert.equal((await api.selfhostCreateBoard("Тест",true)).id,"board-1");
assert.equal((await api.selfhostReadDocument("board-1")).version,3);
const nativeBoard=await api.selfhostCreateBoard("Нативная доска",false);
const expectedComment={id:"comment-root",board_id:nativeBoard.id,
  author_id:session.user.id,author_name:"Учитель",parent_id:null,
  body:"Проверьте решение",resolved:false,
  created_at:"2026-11-14T10:00:00Z",updated_at:"2026-11-14T10:00:00Z"};
assert.equal(nativeBoard.id,"00000000-0000-4000-8000-000000000004");
const nativeDocument={version:1,title:"Нативная доска",
  view:{x:0,y:0,zoom:1},items:[]};
const nativeSaved=await api.selfhostSaveDocument(
  nativeBoard.id,0,nativeDocument
);
assert.equal(nativeSaved.version,1);
assert.equal((await api.selfhostReadDocument(nativeBoard.id)).document.title,"Нативная доска");
assert.equal(await api.selfhostAssetExists(nativeBoard.id,"asset_1"),true);
assert.equal(await api.selfhostAssetExists(nativeBoard.id,"missing"),false);
await api.selfhostUploadAsset(
  nativeBoard.id,"asset_1",new Blob(["asset bytes"],{type:"image/png"})
);
const nativeAsset=await api.selfhostDownloadAsset(nativeBoard.id,"asset_1");
assert.equal(await nativeAsset.text(),"stored asset");
const saved=await api.selfhostSaveDocument("board-1",3,{pilot_schema:1,items:[],ink:[],note:"hello"});
assert.equal(saved.version,4);
await assert.rejects(api.selfhostSaveDocument("board-1",2,{items:[],ink:[]}),e=>e.status===409);
const expired=JSON.parse(storage.get("lektrus.selfhost.session.v1"));
expired.expires_at=1;
storage.set("lektrus.selfhost.session.v1",JSON.stringify(expired));
assert.equal((await api.selfhostSession()).access_token,"token-refreshed");
assert.equal(env.refreshCount(),1);
assert.equal((await api.selfhostStudents())[0].user_id,"student-1");
await api.selfhostSaveStudentProfile("student-1",{note:"Новая заметка"});
assert.equal((await api.selfhostStudentSessions("student-1"))[0].topic,"Алгебра");
await api.selfhostSaveStudentSession({
  id:"session-1",studentId:"student-1",boardId:nativeBoard.id,
  date:"2026-11-14T10:00:00Z",durationMinutes:45,topic:"Алгебра",homework:"№ 5",result:"Готово",
});
await api.selfhostDeleteStudentSession("session-1");
assert.deepEqual(await api.selfhostAssignments(),[]);
await api.selfhostCreateAssignment({
  id:"assignment-1",studentId:"student-1",boardId:nativeBoard.id,
  title:"Задание",description:"Описание",dueAt:null,maxScore:10,
});
await api.selfhostSubmitAssignment("assignment-1","Ответ");
await api.selfhostReviewAssignment("assignment-1",9,"Хорошо");
await api.selfhostDeleteAssignment("assignment-1");
assert.deepEqual(await api.selfhostSchedule(),[]);
await api.selfhostCreateSchedule([{
  id:"schedule-1",studentId:"student-1",boardId:nativeBoard.id,title:"Занятие",
  startsAt:"2026-11-16T10:00:00Z",durationMinutes:60,recurrence:"none",
  recurrenceGroupId:null,note:"",
}]);
await api.selfhostUpdateSchedule("schedule-1",{title:"Новое занятие"});
await api.selfhostMarkScheduleStarted("schedule-1");
await api.selfhostCompleteSchedule("schedule-1");
await api.selfhostDeleteSchedule("schedule-1");
assert.equal(await api.selfhostActiveLesson(nativeBoard.id),null);
assert.equal((await api.selfhostStartLesson(nativeBoard.id,"student-1","Тема")).id,"lesson-1");
assert.equal((await api.selfhostFinishLesson("lesson-1","Итог","ДЗ")).minutes,45);
assert.deepEqual(await api.selfhostBoardComments(nativeBoard.id),[expectedComment]);
assert.deepEqual(await api.selfhostBoardCommentParticipants(nativeBoard.id),[
  {user_id:session.user.id,display_name:"Учитель"},
]);
assert.equal((await api.selfhostCreateBoardComment(nativeBoard.id,"Ответ ученика","comment-root")).parent_id,"comment-root");
assert.equal((await api.selfhostResolveBoardComment("comment-root",true)).resolved,true);
const revisions=[];
const statuses=[];
const liveEvents=[];
const unsubscribe=api.selfhostSubscribeBoard("board-1",
  version=>revisions.push(version),status=>statuses.push(status),
  frame=>liveEvents.push(frame),{visible:true});
const commentEvents=[];
const stopComments=api.selfhostSubscribeBoard("board-1",()=>{},()=>{},frame=>commentEvents.push(frame.type));
await new Promise(resolve=>setTimeout(resolve,0));
assert.equal(sockets.length,1);
assert.ok(sockets[0].url.startsWith("wss://pilot.lektrus.example/api/v1/boards/board-1/events"));
sockets[0].open();
assert.equal(sockets[0].sent[0].type,"auth");
assert.equal(sockets[0].sent[0].token,"token-refreshed");
assert.equal(sockets[0].sent[0].presence,true);
assert.equal(sockets[0].sent[0].visible,true);
sockets[0].emit({type:"ready",version:3});
assert.equal(unsubscribe.sendCursor("pilot_client",10,20),true);
await new Promise(resolve=>setTimeout(resolve,70));
assert.ok(sockets[0].sent.some(x=>x.type==="cursor"&&x.x===10&&x.y===20));
const stroke={
  type:"live_ink",client_id:"pilot_client",stroke_id:"stroke_1",
  kind:"pen",color:"#275ec7",weight:3,offset:0,
  points:[{x:10,y:20},{x:12,y:22}],finished:true,
};
assert.equal(unsubscribe.sendInk(stroke),true);
assert.ok(sockets[0].sent.some(x=>x.type==="live_ink"&&x.finished&&x.stroke_id==="stroke_1"));
sockets[0].emit({type:"ink_ack",client_id:"pilot_client",stroke_id:"stroke_1",offset:0,finished:true});
assert.equal(unsubscribe.sendObjectPreview({
  type:"object_preview",client_id:"pilot_client",object_id:"rect_1",
  gesture_id:"gesture_1",seq:1,object_revision:1,x:240,y:260,
}),true);
await new Promise(resolve=>setTimeout(resolve,70));
assert.ok(sockets[0].sent.some(x=>x.type==="object_preview"&&x.object_id==="rect_1"&&x.x===240));
sockets[0].emit({
  type:"cursor",client_id:"other",user_id:"user_2",name:"Ученик",
  role:"viewer",x:100,y:200,sent_at:Date.now()
});
sockets[0].emit({
  ...stroke,client_id:"other",stroke_id:"remote_1",
  user_id:"user_2",name:"Ученик",role:"editor",sent_at:Date.now()
});
sockets[0].emit({
  type:"object_preview",client_id:"other",user_id:"user_2",name:"Ученик",
  role:"editor",object_id:"rect_1",gesture_id:"gesture_2",
  seq:3,object_revision:1,x:260,y:280,sent_at:Date.now()
});
assert.equal(liveEvents.length,3);
assert.deepEqual(liveEvents.map(x=>x.type),["cursor","live_ink","object_preview"]);
const presenceUser={user_id:"user_2",name:"Ученик",role:"viewer",online_at:"123"};
sockets[0].emit({type:"presence_state",users:[presenceUser]});
sockets[0].emit({type:"presence_diff",joins:[presenceUser],leaves:[]});
sockets[0].emit({
  type:"work_state",user_id:"user_2",name:"Ученик",role:"viewer",
  selected_ids:["item_1"],editing_id:null,sent_at:Date.now(),
});
sockets[0].emit({
  type:"editor_mutation",user_id:"user_2",name:"Ученик",role:"editor",
  id:"client_1:1",item_id:"graph_1",client_id:"client_1",ops:[],sent_at:Date.now(),
});
sockets[0].emit({
  type:"object_transform",user_id:"user_2",name:"Ученик",role:"editor",
  client_id:"client_1",seq:1,finished:false,items:[],sent_at:Date.now(),
});
assert.deepEqual(liveEvents.slice(3).map(x=>x.type),[
  "presence_state","presence_diff","work_state","editor_mutation","object_transform"
]);
assert.equal(unsubscribe.sendEvent({type:"work_state",selected_ids:["item_1"],editing_id:null}),true);
assert.ok(sockets[0].sent.some(x=>x.type==="work_state"&&x.selected_ids[0]==="item_1"));
assert.equal(unsubscribe.sendEvent({type:"x",payload:"a".repeat(120_001)}),false);
sockets[0].emit({type:"document_changed",version:4});
sockets[0].emit({type:"document_changed",version:4});
sockets[0].emit({type:"document_changed",version:2});
assert.deepEqual(revisions,[3,4],"Repeated/old revisions must not re-fetch entire documents");
assert.ok(statuses.includes("online"));
sockets[0].emit({type:"comments_changed"});
assert.equal(commentEvents.at(-1),"comments_changed");
sockets[0].emit({type:"pong",version:5});
assert.deepEqual(revisions,[3,4,5]);
stopComments();
await Promise.resolve();
assert.equal(sockets[0].readyState,1,"Closing a feature must keep the board connection");
unsubscribe();
await Promise.resolve();
assert.equal(sockets[0].readyState,3);
assert.equal(env.listeners.size,0);
const handleDocumentVersions=[];
const documentStatuses=[];
const openedBoard=api.selfhostWatchDocument("board-1",()=>3,
  doc=>handleDocumentVersions.push(doc.version),status=>documentStatuses.push(status));
await new Promise(resolve=>setTimeout(resolve,0));
const boardSocket=sockets.at(-1);
boardSocket.open();
boardSocket.emit({type:"ready",version:3});
const countReads=()=>records.filter(x=>x.path==="/api/v1/boards/board-1/document"&&x.method==="GET").length;
const previousReads=countReads();
env.changeDocument(6,1);
for(const version of [4,5,6])boardSocket.emit({type:"document_changed",version});
const waitFor=async predicate=>{
  for(let attempt=0;attempt<80&&!predicate();attempt++)
    await new Promise(resolve=>setTimeout(resolve,50));
  assert.ok(predicate(),"Timed out waiting for board sync");
};
await waitFor(()=>handleDocumentVersions.length===1);
assert.deepEqual(handleDocumentVersions,[6],"Only the newest saved revision should be applied");
assert.equal(countReads()-previousReads,2,"Coalesced notices should require one request plus one retry");
assert.ok(documentStatuses.includes("reconnecting"));
assert.equal(documentStatuses.at(-1),"online");
env.changeDocument(7);
boardSocket.onclose();
await waitFor(()=>sockets.at(-1)!==boardSocket);
const reconnectedSocket=sockets.at(-1);
reconnectedSocket.open();
reconnectedSocket.emit({type:"ready",version:7});
await waitFor(()=>handleDocumentVersions.length===2);
assert.deepEqual(handleDocumentVersions,[6,7],"A reconnect should recover a revision missed while offline");
openedBoard();
await Promise.resolve();

await api.selfhostLogout();
assert.equal(api.cachedSelfhostSession(),null);
assert.equal(storage.get("lesson-board.supabase.session.v1"),"production-must-remain");
assert.ok(records.some(x=>x.path==="/api/v1/auth/logout"&&x.bearer==="Bearer token-refreshed"));
console.log("Self-hosted Lektrus API: auth, native documents, private assets, students, assignments, schedule, lessons, discussions, presence and realtime events OK.");
