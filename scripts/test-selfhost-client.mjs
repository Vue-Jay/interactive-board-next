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
const appSource=readFileSync(new URL("../src/App.tsx",import.meta.url),"utf8");
assert.match(appSource,/const cached=isSelfhostBackendEnabled\(\)\?getCachedCurrentUser\(\):null;\s*setAuthUser\(cached\);setAuthReady\(true\);\s*if\(cached\)retrySession\(cached.id\)/,
  "A temporary session restore failure must not discard the saved account");
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
  let refreshStatus=200,rotations=0,activeRefresh="refresh-first",rejectOldAccess=false;
  let lockTail=Promise.resolve();
  const locks={request(_name,callback){
    const result=lockTail.then(callback);lockTail=result.catch(()=>{});return result;
  }};
  const nativeBoardId="00000000-0000-4000-8000-000000000004";
  let nativeDoc=null,nativeVersion=0,nativeDelta=null,brokenChain=false;
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
      query:u.search,
      body:typeof options.body==="string"?JSON.parse(options.body):
        options.body instanceof Blob?{size:options.body.size,type:options.body.type}:null});
    const ok=(value,status=200)=>Response.json(value,{status});
    if(u.pathname==="/api/v1/auth/login"){
      assert.equal(headers.get("Authorization"),null);
      return ok({access_token:"token-first",refresh_token:"refresh-first",expires_in:expires,user});
    }
    if(u.pathname==="/api/v1/auth/refresh"){
      refreshes++;
      if(refreshStatus!==200)return ok({detail:"Session service unavailable"},refreshStatus);
      if(JSON.parse(options.body).refresh_token!==activeRefresh)return ok({detail:"Already rotated"},401);
      const suffix=++rotations===1?"":"-"+rotations;
      activeRefresh="refresh-refreshed"+suffix;
      return ok({access_token:"token-refreshed"+suffix,refresh_token:activeRefresh,expires_in:900,user});
    }
    if(u.pathname==="/api/v1/admin/users/student-1"&&options.method==="DELETE"){
      assert.deepEqual(JSON.parse(options.body),{email:"student@example.test"});
      return ok({ok:true,files_pending:0});
    }
    if(u.pathname==="/api/v1/admin/feedback-mail/test"&&options.method==="POST"){
      const body=JSON.parse(options.body);
      assert.deepEqual(body,{email:"recipient@example.test",kinds:["password_reset","reply"]});
      return ok({email:body.email,results:[{kind:"password_reset",status:"sent"},{kind:"reply",status:"failed"}]});
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
      assert.equal(body.expected_version,nativeVersion);
      nativeDoc=body.document;nativeVersion++;nativeDelta=null;
      return ok({board_id:nativeBoardId,version:nativeVersion,document:body.document,
        updated_by:user.id,updated_at:"2026-11-14T10:00:00Z"});
    }
    if(u.pathname===`/api/v1/boards/${nativeBoardId}/document`&&options.method==="PATCH"){
      const body=JSON.parse(options.body);
      assert.equal(body.expected_version,nativeVersion);
      nativeDoc=JSON.parse(JSON.stringify(api.applySelfhostDocumentDelta(nativeDoc,body.delta)));
      nativeDelta=body.delta;nativeVersion++;
      return ok({version:nativeVersion});
    }
    if(u.pathname===`/api/v1/boards/${nativeBoardId}/document`&&u.searchParams.get("since_version")===String(nativeVersion))
      return ok({board_id:nativeBoardId,version:nativeVersion,base_version:nativeVersion,document:null,patches:[],updated_by:user.id,updated_at:"2026-11-14T10:00:00Z"});
    if(u.pathname===`/api/v1/boards/${nativeBoardId}/document`&&u.searchParams.get("since_version")===String(nativeVersion-1)&&nativeDelta)
      return ok({board_id:nativeBoardId,document:null,version:nativeVersion,base_version:nativeVersion-1,
        patches:brokenChain?[{items:{order:[]}}]:[nativeDelta],updated_by:user.id,updated_at:"2026-11-14T10:00:00Z"});
    if(u.pathname===`/api/v1/boards/${nativeBoardId}/document`)
      return ok({board_id:nativeBoardId,version:nativeVersion,document:nativeDoc,
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
    if(u.pathname==="/api/v1/boards"){
      if(rejectOldAccess&&headers.get("Authorization")==="Bearer token-first")return ok({detail:"Expired"},401);
      return ok([{id:"board-1",title:"Тест",role:"owner"}]);
    }
    if(u.pathname==="/api/v1/boards/board-1/document"&&options.method==="PUT"){
      assert.equal(u.searchParams.get("version_only"),"true");
      if(JSON.parse(options.body).expected_version!==3)
        return ok({detail:"Версия изменилась."},409);
      return ok({version:4});
    }
    if(u.pathname==="/api/v1/boards/board-1/document"){
      if(u.searchParams.get("version_only")==="true")return ok({version:documentVersion});
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
  const makeContext=(withLocks=true)=>vm.createContext({
    exports:{},fetch,URL,Headers,Response,AbortController,FormData,TextEncoder,queueMicrotask,
    navigator:{onLine:true,locks:withLocks?locks:undefined},WebSocket:Socket,
    localStorage:sessionStorage,sessionStorage,setTimeout,clearTimeout,setInterval,clearInterval,Date,
    window:{location:{origin:"https://pilot.lektrus.example"},
      addEventListener(name,fn){listeners.set(name,fn)},
      removeEventListener(name){listeners.delete(name)}},
  });
  const context=makeContext();
  vm.runInContext(compiled,context);
  const api=context.exports;
  const broadcastSource=readFileSync(new URL("../src/boardBroadcast.ts",import.meta.url),"utf8");
  const broadcastContext=vm.createContext({exports:{},require:name=>name==="./selfhostApi"?api:{isRemoteBackendEnabled:()=>false},setTimeout,clearTimeout,Date,Math,Map,crypto:globalThis.crypto});
  vm.runInContext(ts.transpileModule(broadcastSource,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,broadcastContext);
  return {api,broadcast:broadcastContext.exports,records:record,storage:data,refreshCount:()=>refreshes,sockets,listeners,sessionStorage,changeExpires:v=>{expires=v},changeDocument:(v,failures=0)=>{documentVersion=v;documentFailures=failures},
    forkApi:(withLocks=true)=>{const tab=makeContext(withLocks);vm.runInContext(compiled,tab);return tab.exports},
    setRefreshStatus:v=>{refreshStatus=v},rejectOldAccess:()=>{rejectOldAccess=true},
    remoteNativeEdit:(delta,broken=false)=>{nativeDoc=JSON.parse(JSON.stringify(api.applySelfhostDocumentDelta(nativeDoc,delta)));nativeVersion++;nativeDelta=delta;brokenChain=broken}};
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
  view:{x:0,y:0,zoom:1},items:Array.from({length:1000},(_,i)=>({id:"item-"+i,kind:"text",text:"Пример ".repeat(30),x:i,y:0}))};
const nativeSaved=await api.selfhostSaveDocument(
  nativeBoard.id,0,nativeDocument
);
assert.equal(nativeSaved.version,1);
assert.equal((await api.selfhostReadDocument(nativeBoard.id)).document.title,"Нативная доска");
const nextDoc={...nativeDocument,items:[...nativeDocument.items,{id:"new-ink",kind:"pen",points:[{x:1,y:2}]}]};
const normalizedBase=JSON.parse(JSON.stringify(nativeDocument));
const prepared=api.prepareSmallDocumentDelta(normalizedBase,nextDoc,1);
assert.ok(prepared,"Large boards with small deltas avoid full JSON serialization");
assert.equal(prepared.next.items[0],normalizedBase.items[0],"Reuse an acknowledged detached item");
assert.notEqual(prepared.next.items.at(-1),nextDoc.items.at(-1),"New object belongs to the isolated save snapshot");
assert.deepEqual(JSON.parse(JSON.stringify(prepared.next)),nextDoc);
const unusual={...nextDoc,subject:undefined,items:nextDoc.items.map((item,i)=>i===0?{...item,text:undefined,optional:[undefined,NaN],nested:{toJSON(key){return key}}}:item)};
const normalizedUnusual=api.prepareSmallDocumentDelta(normalizedBase,unusual,1);
assert.deepEqual(JSON.parse(JSON.stringify(normalizedUnusual.next)),JSON.parse(JSON.stringify(unusual)));
assert.deepEqual(JSON.parse(JSON.stringify(api.applySelfhostDocumentDelta(normalizedBase,JSON.parse(normalizedUnusual.body).delta))),JSON.parse(JSON.stringify(unusual)));
assert.equal(api.prepareSmallDocumentDelta(normalizedBase,{...nextDoc,items:nextDoc.items.slice(0,2)},1),null);
assert.equal(api.prepareSmallDocumentDelta(normalizedBase,{...nextDoc,toJSON(){return nextDoc}},1),null);
assert.equal(api.prepareSmallDocumentDelta(normalizedBase,{...nextDoc,title:"x".repeat(20_000)},1),null);
const sampleTimings=fn=>{
  const values=[];
  for(let i=0;i<25;i++){const start=performance.now();fn();values.push(performance.now()-start);}
  return values.sort((a,b)=>a-b)[Math.floor(values.length/2)];
};
const fullMedian=sampleTimings(()=>api.diffSelfhostDocument(normalizedBase,JSON.parse(JSON.stringify(nextDoc))));
const preparedMedian=sampleTimings(()=>api.prepareSmallDocumentDelta(normalizedBase,nextDoc,1));
console.log(`Large-board delta preparation median: ${fullMedian.toFixed(2)} -> ${preparedMedian.toFixed(2)} ms`);
assert.equal((await api.selfhostSaveDocument(nativeBoard.id,1,nextDoc)).version,2);
const patchRequest=records.at(-1);
assert.equal(patchRequest.method,"PATCH");
assert.deepEqual(patchRequest.body.delta,{items:{upsert:[nextDoc.items.at(-1)]}});
const fullBytes=Buffer.byteLength(JSON.stringify({expected_version:1,document:nextDoc}));
const deltaBytes=Buffer.byteLength(JSON.stringify(patchRequest.body));
assert.ok(deltaBytes<fullBytes/100);
console.log(`Board autosave: ${fullBytes} -> ${deltaBytes} bytes (${(100*(1-deltaBytes/fullBytes)).toFixed(2)}% less)`);
const reordered={...nextDoc,title:"Сохранённая",items:[nextDoc.items.at(-1),...nextDoc.items.slice(1,-1)]};
const remoteDelta=JSON.parse(JSON.stringify(api.diffSelfhostDocument(nextDoc,reordered)));
assert.deepEqual(JSON.parse(JSON.stringify(api.applySelfhostDocumentDelta(nextDoc,remoteDelta))),reordered);
env.remoteNativeEdit(remoteDelta);
assert.deepEqual(JSON.parse(JSON.stringify((await api.selfhostReadDocument(nativeBoard.id,undefined,true)).document)),reordered);
assert.equal(records.at(-1).query,"?since_version=2");
env.remoteNativeEdit({set:{subject:"chemistry"}},true);
assert.equal((await api.selfhostReadDocument(nativeBoard.id,undefined,true)).document.subject,"chemistry");
assert.equal(records.at(-2).query,"?since_version=3");
assert.equal(records.at(-1).query,"");
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
assert.equal((await api.selfhostAdminDeleteUser("student-1","student@example.test")).ok,true);
assert.ok(records.some(x=>x.path==="/api/v1/admin/users/student-1"&&x.method==="DELETE"&&x.bearer==="Bearer token-refreshed"&&x.body.email==="student@example.test"));
const testMail=await api.selfhostSendTestMail("recipient@example.test",["password_reset","reply"]);
assert.deepEqual(testMail.results.map(x=>x.status),["sent","failed"]);
assert.ok(records.some(x=>x.path==="/api/v1/admin/feedback-mail/test"&&x.method==="POST"&&x.bearer==="Bearer token-refreshed"));
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
  frame=>{if(frame.type!=="ink_ack")liveEvents.push(frame)},{visible:true});
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
assert.equal(sockets[0].sent[0].compact_ink,true);
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
assert.deepEqual(sockets[0].sent.find(x=>x.stroke_id==="stroke_1").points,stroke.points,"Old server keeps object-form points");
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

// Production board adapter receives cumulative pointer windows, not pilot packets.
const adapterInk=[],adapterStatuses=[];
const channel=env.broadcast.connectBoardCursorChannel("board-1",{userId:"me",name:"Me",role:"owner"},()=>{},true,ink=>adapterInk.push(ink),status=>adapterStatuses.push(status));
await new Promise(resolve=>setTimeout(resolve,0));
const inkSocket=sockets.at(-1);
inkSocket.open();
inkSocket.emit({type:"ready",version:7,compact_ink:true});
const makeInk=(id,points,finished=false)=>({id,kind:"pen",color:"#112233",weight:3,offset:0,points,finished});
const points=Array.from({length:300},(_,i)=>({x:i,y:i}));
for(let i=1;i<=points.length;i++)channel.sendInk(makeInk("stroke_fast",points.slice(0,i)));
channel.sendInk(makeInk("stroke_fast",points,true));
channel.sendInk(makeInk("stroke_next",[{x:400,y:400}],true));
await waitFor(()=>inkSocket.sent.filter(x=>x.type==="live_ink"&&x.finished).length===2);
const packets=inkSocket.sent.filter(x=>x.type==="live_ink");
assert.equal(packets.length,3,"300 cumulative moves must become two chunks plus the next completed stroke");
assert.deepEqual(packets.filter(x=>x.stroke_id==="stroke_fast").flatMap(x=>x.points),points.map(p=>[p.x,p.y]));
const legacyPoints=JSON.stringify(points),compactPoints=JSON.stringify(points.map(p=>[p.x,p.y]));
assert.ok(compactPoints.length<legacyPoints.length*.6);
console.log(`Live ink coordinates: ${legacyPoints.length} -> ${compactPoints.length} bytes`);
assert.deepEqual(packets.map(x=>x.offset),[0,200,0]);
const final=packets.find(x=>x.stroke_id==="stroke_fast"&&x.finished);
inkSocket.emit({type:"ink_ack",client_id:final.client_id,stroke_id:final.stroke_id,offset:final.offset,finished:true});
assert.ok(adapterStatuses.at(-1).includes("сервер 1"));
inkSocket.emit({...final,client_id:"other_tab",user_id:"me",name:"Me",role:"owner",sent_at:Date.now()});
assert.equal(adapterInk.length,1,"A second browser tab must receive the stroke even for the same account");
assert.deepEqual(JSON.parse(JSON.stringify(adapterInk[0].points)),points.slice(200));
const erase={id:"eraser_1",kind:"eraser",color:"#000000",weight:92,offset:0,points:[{x:10,y:10},{x:20,y:20}],finished:false};
channel.sendInk(erase);
await waitFor(()=>inkSocket.sent.some(x=>x.type==="live_erase"&&!x.finished));
const erasePreview=inkSocket.sent.find(x=>x.type==="live_erase");
inkSocket.emit({...erasePreview,client_id:"other_tab",user_id:"me",name:"Me",role:"owner"});
assert.equal(adapterInk.at(-1).kind,"eraser");
assert.equal(adapterInk.at(-1).finished,false,"The other tab receives the eraser before release");
channel.sendInk({...erase,finished:true,cutIds:["stroke_fast"]});
await waitFor(()=>inkSocket.sent.some(x=>x.type==="live_erase"&&x.finished));
const eraseFinal=inkSocket.sent.find(x=>x.type==="live_erase"&&x.finished);
assert.deepEqual(eraseFinal.cut_ids,["stroke_fast"]);
inkSocket.emit({...eraseFinal,client_id:"other_tab",user_id:"me",name:"Me",role:"owner"});
assert.deepEqual(JSON.parse(JSON.stringify(adapterInk.at(-1).cutIds)),["stroke_fast"]);
channel.close();
await Promise.resolve();

// With a blocked WebSocket, lightweight revision polling still catches saved work.
const fallbackVersions=[];
const fallback=api.selfhostWatchDocument("board-1",()=>7,doc=>fallbackVersions.push(doc.version),()=>{});
await new Promise(resolve=>setTimeout(resolve,0));
env.changeDocument(8);
await waitFor(()=>fallbackVersions.length===1);
assert.deepEqual(fallbackVersions,[8]);
assert.ok(records.some(x=>x.query==="?version_only=true"&&x.method==="GET"));
const fullReads=records.filter(x=>x.path==="/api/v1/boards/board-1/document"&&x.method==="GET"&&!x.query).length;
await new Promise(resolve=>setTimeout(resolve,2700));
assert.equal(records.filter(x=>x.path==="/api/v1/boards/board-1/document"&&x.method==="GET"&&!x.query).length,fullReads);
fallback();
await Promise.resolve();

await api.selfhostLogout();
assert.equal(api.cachedSelfhostSession(),null);
assert.equal(storage.get("lesson-board.supabase.session.v1"),"production-must-remain");
assert.ok(records.some(x=>x.path==="/api/v1/auth/logout"&&x.bearer==="Bearer token-refreshed"));
// Independent tabs share storage and only one single-use refresh token.
const multi=await loadSelfhost(true);
await multi.api.selfhostLogin("teacher@example.test","test-password");
const secondTab=multi.forkApi();
const expiredSession=()=>{
 const current=JSON.parse(multi.storage.get("lektrus.selfhost.session.v1"));
 multi.storage.set("lektrus.selfhost.session.v1",JSON.stringify({...current,expires_at:1}));
};
expiredSession();
const both=await Promise.all([multi.api.selfhostSession(),secondTab.selfhostSession()]);
assert.deepEqual(both.map(s=>s.access_token),["token-refreshed","token-refreshed"]);
assert.equal(multi.refreshCount(),1,"Cross-tab rotation must issue only one request");
expiredSession();multi.setRefreshStatus(503);
await assert.rejects(multi.api.selfhostSession(),e=>e.status===503);
assert.equal(multi.api.cachedSelfhostSession().refresh_token,"refresh-refreshed","Do not erase a session during server restart");
multi.setRefreshStatus(200);
assert.equal((await secondTab.selfhostSession()).access_token,"token-refreshed-2");
expiredSession();multi.setRefreshStatus(401);
assert.equal(await multi.api.selfhostSession(),null,"A confirmed rejection still expires the session");
assert.equal(secondTab.cachedSelfhostSession(),null);
const delayed=await loadSelfhost(true);
await delayed.api.selfhostLogin("teacher@example.test","test-password");
delayed.rejectOldAccess();
const delayedTab=delayed.forkApi();
await Promise.all([delayed.api.selfhostBoards(),delayedTab.selfhostBoards()]);
assert.equal(delayed.refreshCount(),1,"Concurrent 401 responses must use the latest access token");
const legacy=await loadSelfhost(true);
await legacy.api.selfhostLogin("teacher@example.test","test-password");
const legacyA=legacy.forkApi(false),legacyB=legacy.forkApi(false);
const legacySession=JSON.parse(legacy.storage.get("lektrus.selfhost.session.v1"));
legacy.storage.set("lektrus.selfhost.session.v1",JSON.stringify({...legacySession,expires_at:1}));
const legacyBoth=await Promise.all([legacyA.selfhostSession(),legacyB.selfhostSession()]);
assert.deepEqual(legacyBoth.map(s=>s.access_token),["token-refreshed","token-refreshed"]);
assert.equal(legacyA.cachedSelfhostSession().refresh_token,"refresh-refreshed");
console.log("Session restoration: two tabs, single-use rotation, transient restart and confirmed revocation OK.");
console.log("Self-hosted Lektrus API: auth, native documents, private assets, students, assignments, schedule, lessons, discussions, presence and realtime events OK.");
