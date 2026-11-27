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

async function loadSelfhost(enabled, platform="web") {
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
  let expires=900,refreshes=0,documentVersion=3,documentFailures=0,healthStatus=200,healthBody={ok:true,service:'lektrus-selfhost'};
  let refreshStatus=200,rotations=0,activeRefresh="refresh-first",rejectOldAccess=false,transientRefresh401=false;
  let boardAccess=200,boardResponseOverride=null;
  let lockTail=Promise.resolve();
  const locks={request(_name,callback){
    const result=lockTail.then(callback);lockTail=result.catch(()=>{});return result;
  }};
  const nativeBoardId="00000000-0000-4000-8000-000000000004";
  let nativeDoc=null,nativeVersion=0,nativeDelta=null,brokenChain=false;let pointCapability=false;
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
    if(u.pathname==="/api/v1/health"){
      assert.equal(headers.get("Authorization"),null);
      return ok(healthBody,healthStatus);
    }
    if(u.pathname==="/api/v1/auth/login"){
      assert.equal(headers.get("Authorization"),null);
      return ok({access_token:"token-first",refresh_token:"refresh-first",expires_in:expires,user});
    }
    if(u.pathname==="/api/v1/auth/refresh"){
      refreshes++;
      if(transientRefresh401){transientRefresh401=false;return ok({detail:"Update in progress"},401);}
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
    if(u.pathname==="/api/v1/auth/me"){
      if(!headers.get("Authorization")?.startsWith("Bearer "))return ok({detail:"Unauthorized"},401);
      return ok(user);
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
        ...(pointCapability?{ink_point_deltas:true}:{}),updated_by:user.id,updated_at:"2026-11-14T10:00:00Z"});
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
      if(boardAccess!==200)return ok({detail:"Board temporarily unavailable"},boardAccess);
      if(u.searchParams.get("version_only")==="true")return ok({version:documentVersion});
      if(boardResponseOverride)return ok(boardResponseOverride);
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
    if(u.pathname.endsWith("/sync-journal"))return ok({ok:true});
    throw new Error("Unexpected pilot request "+u.pathname);
  };
  const nativeRequests=[];
  let nativeFailure=null,claimFailure=false,loginFailure=false;
  const bridge={Capacitor:{getPlatform:()=>platform,isPluginAvailable:name=>name==="CapacitorHttp"},CapacitorHttp:{
    async request(options){
      nativeRequests.push(options);
      assert.equal(options.disableRedirects,true);
      assert.equal(options.headers["cache-control"],"no-store");
      if(nativeFailure)throw {code:nativeFailure};
      const pathname=new URL(options.url).pathname;
      if(pathname==="/api/v1/auth/login"&&loginFailure)return loginFailure===429?{status:429,data:{detail:"Слишком много попыток. Попробуйте позже."}}:{status:401,data:{detail:"Неверный email или пароль."}};
      if(pathname==="/api/v1/invitations/claim"&&claimFailure)return {status:503,data:{detail:"Unavailable"}};
      const response=await fetch(options.url,{method:options.method,headers:options.headers,body:options.data,credentials:"omit"});
      const raw=await response.text();
      return {status:response.status,data:raw?JSON.parse(raw):""};
    },
  }};
  const sockets=[];
  class Socket {
    static OPEN=1;
    readyState=0;
    sent=[];
    constructor(url){this.url=url;sockets.push(this)}
    send(value){this.sent.push(JSON.parse(value))}
    close(){this.readyState=3}
    emit(data){this.onmessage?.({data:JSON.stringify(data)})}
    reject(code=4401){this.readyState=3;this.onclose?.({code})}
    open(){this.readyState=1;this.onopen?.()}
  }
  const listeners=new Map();
  const makeContext=(withLocks=true)=>vm.createContext({
    exports:{},require:name=>{if(name==="./boardIdle"){const out={};new Function("exports",ts.transpileModule(readFileSync(new URL("../src/boardIdle.ts",import.meta.url),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(out);return out;}assert.equal(name,"@capacitor/core");return bridge;},fetch,URL,Headers,Response,AbortController,DOMException,FormData,TextEncoder,queueMicrotask,
    navigator:{onLine:true,locks:withLocks?locks:undefined},
    document:{hidden:false,visibilityState:"visible",addEventListener(){},removeEventListener(){}},
    WebSocket:Socket,
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
  return {api,broadcast:broadcastContext.exports,records:record,storage:data,refreshCount:()=>refreshes,sockets,listeners,nav:context.navigator,sessionStorage,nativeRequests,setHealth:(status,body)=>{healthStatus=status;healthBody=body;},setNativeFailure:value=>{nativeFailure=value;},setClaimFailure:value=>{claimFailure=value;},setLoginFailure:value=>{loginFailure=value;},changeExpires:v=>{expires=v},changeDocument:(v,failures=0)=>{documentVersion=v;documentFailures=failures},
    setBoardAccess:v=>{boardAccess=v},setBoardResponse:v=>{boardResponseOverride=v},
    forkApi:(withLocks=true)=>{const tab=makeContext(withLocks);vm.runInContext(compiled,tab);return tab.exports},
    setRefreshStatus:v=>{refreshStatus=v},setTransientRefresh401:()=>{transientRefresh401=true},rejectOldAccess:()=>{rejectOldAccess=true},
    enablePointCapability:()=>{pointCapability=true},remoteNativeEdit:(delta,broken=false)=>{nativeDoc=JSON.parse(JSON.stringify(api.applySelfhostDocumentDelta(nativeDoc,delta)));nativeVersion++;nativeDelta=delta;brokenChain=broken}};
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
assert.equal(env.nativeRequests.length,0,"The regular browser must keep its own Fetch transport");

// Simulate the actual Android HTTP bridge, checking the transport boundary,
// HTTP statuses, signed-in requests, cancellation, and no accidental retries.
const android=await loadSelfhost(true,"android");
android.setLoginFailure(true);
await assert.rejects(android.api.selfhostLogin("fake@example.test","invalid"),e=>e.status===401&&e.message==="Неверный email или пароль.");
assert.equal(android.api.cachedSelfhostSession(),null);
assert.equal(android.nativeRequests.length,1);
assert.equal(android.nativeRequests[0].connectTimeout,30000);
assert.equal(JSON.parse(android.nativeRequests[0].data).email,"fake@example.test");
android.setLoginFailure(429);
await assert.rejects(android.api.selfhostLogin("fake@example.test","invalid"),e=>e.status===429&&e.message==="Слишком много попыток. Попробуйте позже.");
assert.equal(android.nativeRequests.length,2,"Rate-limited login must not be automatically replayed");
assert.equal(android.api.cachedSelfhostSession(),null);
android.setLoginFailure(false);
const authSource=readFileSync(new URL("../src/authStore.ts",import.meta.url),"utf8");
const authContext=vm.createContext({exports:{},require:name=>name==="./selfhostApi"?android.api:{},localStorage:android.sessionStorage});
vm.runInContext(ts.transpileModule(authSource,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,authContext);
android.setClaimFailure(true);
const androidUser=await authContext.exports.loginUser({email:"teacher@example.test",password:"test-password"});
assert.equal(androidUser.id,android.api.cachedSelfhostSession().user.id,"Claim failure must not fail a completed login");
assert.equal(android.nativeRequests.at(-1).connectTimeout,5000);
android.setClaimFailure(false);
await authContext.exports.retrySelfhostInvitations(androidUser.id);
assert.equal(android.nativeRequests.at(-1).headers.authorization,"Bearer token-first");
assert.equal((await android.api.selfhostBoards()).length,1);
const nativeCount=android.nativeRequests.length;
await android.api.selfhostAssetExists("00000000-0000-4000-8000-000000000004","missing");
assert.equal(android.nativeRequests.length,nativeCount,"Binary asset requests must not use the JSON bridge");
android.setNativeFailure("UnknownHostException");
const attempts=android.nativeRequests.length;
const webFallbacks=android.records.length;
await assert.rejects(android.api.selfhostLogin("fake@example.test","invalid"),/DNS/);
assert.equal(android.nativeRequests.length,attempts+1,"Do not replay authentication on network failure");
assert.equal(android.records.length,webFallbacks,"Do not fall back to Fetch after native POST may have arrived");
android.setNativeFailure("SSLHandshakeException");
await assert.rejects(android.api.selfhostBoards(),/TLS/);
android.setNativeFailure("SocketTimeoutException");
await assert.rejects(android.api.selfhostBoards(),/вовремя/);
console.log("Android JSON transport: 401, session, invitation recovery, bearer, binary isolation, DNS/TLS/timeout and no replay OK.");
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
// Permanent ink: compact a translated prefix and revised tail losslessly.
const inkPoints=Array.from({length:200},(_,i)=>({x:i/10,y:i%5}));
const inkItem={id:"ink",kind:"pen",x:10,y:20,width:25,height:10,points:inkPoints,createdBy:"owner"};
const inkBase={version:1,items:[inkItem,{id:"other"}]};
const extended={...inkItem,x:9,y:18,width:27,height:12,points:[
  ...inkPoints.slice(0,199).map(p=>({x:Math.round((p.x+1)*100)/100,y:p.y+2})),{x:0,y:0},{x:1,y:1}]};
const inkNext={...inkBase,items:[extended,{id:"other"}]};
const fullInkDelta=api.diffSelfhostDocument(inkBase,inkNext);
const compactInkDelta=api.compactInkPointDelta(inkBase,fullInkDelta,"ink");
assert.equal(compactInkDelta.items.point_edits[0].keep,199);
assert.deepEqual(JSON.parse(JSON.stringify(api.applySelfhostDocumentDelta(inkBase,compactInkDelta))),inkNext);
assert.ok(JSON.stringify(compactInkDelta).length<JSON.stringify(fullInkDelta).length/10);
assert.throws(()=>api.applySelfhostDocumentDelta({...inkBase,items:[]},compactInkDelta));
assert.throws(()=>api.applySelfhostDocumentDelta(inkBase,{items:{point_edits:[{...compactInkDelta.items.point_edits[0],count:201}]}}));
assert.deepEqual(api.compactInkPointDelta(inkBase,fullInkDelta,"erase:ink"),fullInkDelta);
const stickerStroke={id:"attached",kind:"marker",points:inkPoints,weight:.1};
const note={id:"note",kind:"sticky",stickerInk:[stickerStroke,{id:"other-stroke",kind:"pen",points:[{x:0,y:0}]}]};
const noteBase={version:1,items:[note]};
const noteNext={version:1,items:[{...note,stickerInk:[{...stickerStroke,points:[...inkPoints,{x:.123456,y:-.987654}]},note.stickerInk[1]]}]};
const noteDelta=api.compactInkPointDelta(noteBase,api.diffSelfhostDocument(noteBase,noteNext),"attached");
assert.equal(noteDelta.items.point_edits[0].stroke_id,"attached");
assert.deepEqual(JSON.parse(JSON.stringify(api.applySelfhostDocumentDelta(noteBase,noteDelta))),noteNext);
const remoteDelta=JSON.parse(JSON.stringify(api.diffSelfhostDocument(nextDoc,reordered)));
assert.deepEqual(JSON.parse(JSON.stringify(api.applySelfhostDocumentDelta(nextDoc,remoteDelta))),reordered);
env.remoteNativeEdit(remoteDelta);
assert.deepEqual(JSON.parse(JSON.stringify((await api.selfhostReadDocument(nativeBoard.id,undefined,true)).document)),reordered);
assert.equal(records.at(-1).query,"?ink_point_deltas=true&since_version=2");
env.remoteNativeEdit({set:{subject:"chemistry"}},true);
assert.equal((await api.selfhostReadDocument(nativeBoard.id,undefined,true)).document.subject,"chemistry");
assert.equal(records.at(-2).query,"?ink_point_deltas=true&since_version=3");
assert.equal(records.at(-1).query,"?ink_point_deltas=true");
// The real save queue negotiates support; a legacy server receives only
// the established complete upsert format.
const wireBase={...reordered,subject:"chemistry",items:[...reordered.items,inkItem]};
let wireVersion=(await api.selfhostSaveDocument(nativeBoard.id,4,wireBase,"ink")).version;
const wireNext={...wireBase,items:[...wireBase.items.slice(0,-1),extended]};
wireVersion=(await api.selfhostSaveDocument(nativeBoard.id,wireVersion,wireNext,"ink")).version;
assert.ok(records.at(-1).body.delta.items.upsert);
env.enablePointCapability();
await api.selfhostReadDocument(nativeBoard.id,undefined,false);
const wireFinal={...wireNext,items:[...wireNext.items.slice(0,-1),{...extended,points:[...extended.points,{x:2,y:3}]}]};
wireVersion=(await api.selfhostSaveDocument(nativeBoard.id,wireVersion,wireFinal,"ink")).version;
assert.equal(records.at(-1).body.delta.items.point_edits[0].points.length,1);
assert.deepEqual(JSON.parse(JSON.stringify((await api.selfhostReadDocument(nativeBoard.id,undefined,false)).document)),wireFinal);
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
assert.equal(unsubscribe.canCommitInk(),false,"Legacy server keeps HTTP saves");
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
let appliedVersion=3;
const openedBoard=api.selfhostWatchDocument("board-1",()=>appliedVersion,
  doc=>{appliedVersion=doc.version;handleDocumentVersions.push(doc.version)},status=>documentStatuses.push(status));
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
reconnectedSocket.emit({type:"ready",version:7,durable_ink_commits:true,ink_commit_chain:true});
await waitFor(()=>handleDocumentVersions.length===2);
assert.deepEqual(handleDocumentVersions,[6,7],"A reconnect should recover a revision missed while offline");
const beforePushReads=countReads();
env.changeDocument(8);
reconnectedSocket.emit({type:"document_changed",version:8,base_version:7,
  delta:{items:{upsert:[{id:"durable-ink",kind:"pen",points:[{x:1,y:2}]}]}},
  updated_at:"2026-11-26T00:00:00Z",updated_by:"peer"});
await waitFor(()=>handleDocumentVersions.length===3);
assert.deepEqual(handleDocumentVersions,[6,7,8]);
assert.equal(countReads(),beforePushReads,"Committed socket delta must not trigger an HTTP read");
const commitChannel=api.selfhostSubscribeBoard("board-1",()=>{},()=>{});
await Promise.resolve();
assert.equal(commitChannel.canCommitInk(),true);
const commitPromise=commitChannel.commitInk({expected_version:8,ink_gesture:"durable-ink",
  delta:{items:{remove:["durable-ink"]}},cursor:{client_id:"pilot_client",x:1,y:2}});
const committedFrame=reconnectedSocket.sent.at(-1);
assert.equal(committedFrame.type,"ink_commit");
assert.equal(committedFrame.cursor.x,1);
reconnectedSocket.emit({type:"ink_commit_ack",request_id:committedFrame.request_id,version:9});
assert.equal((await commitPromise).version,9);
const rejected=commitChannel.commitInk({expected_version:8,ink_gesture:"durable-ink",delta:{items:{remove:["durable-ink"]}}});
reconnectedSocket.emit({type:"ink_commit_ack",request_id:reconnectedSocket.sent.at(-1).request_id,status:409,detail:"version conflict"});
await assert.rejects(rejected,error=>error.status===409);
assert.equal(commitChannel.canPipelineInk(),true);
const chainRequest={expected_version:9,ink_gesture:"chain",delta:{items:{upsert:[{id:"chain",kind:"pen",points:[{x:0,y:0}]}]}}};
const firstFrame=commitChannel.commitInk(chainRequest);
const secondFrame=commitChannel.commitInk({...chainRequest,expected_version:10,after_request_id:firstFrame.requestId});
const thirdFrame=commitChannel.commitInk({...chainRequest,expected_version:11,after_request_id:secondFrame.requestId});
assert.ok(firstFrame&&secondFrame&&thirdFrame,"Three permanent frames may be in flight before the first ACK");
assert.equal(commitChannel.commitInk({...chainRequest,expected_version:12,after_request_id:thirdFrame.requestId}),null,"Bound the in-flight window");
assert.equal(commitChannel.commitInk({...chainRequest,expected_version:12,after_request_id:firstFrame.requestId}),null,"Reject an unrelated predecessor");
const chainResults=Promise.allSettled([firstFrame,secondFrame,thirdFrame]);
reconnectedSocket.emit({type:"ink_commit_ack",request_id:firstFrame.requestId,version:10});
reconnectedSocket.emit({type:"ink_commit_ack",request_id:secondFrame.requestId,status:409,detail:"conflict"});
reconnectedSocket.emit({type:"ink_commit_ack",request_id:thirdFrame.requestId,status:409,detail:"failed predecessor"});
assert.deepEqual((await chainResults).map(x=>x.status),["fulfilled","rejected","rejected"]);
commitChannel();
openedBoard();
await Promise.resolve();

// A successful WebSocket handshake does not guarantee delivery or application.
let recoveredVersion=8,rejectOnce=true,deliveryAttempts=0;
const recoveryCursors=[];
const recovery=api.selfhostWatchDocument("board-1",()=>recoveredVersion,doc=>{
  deliveryAttempts++;
  recoveryCursors.push(doc.ink_cursors?.map(cursor=>cursor.user_id)??[]);
  if(rejectOnce){rejectOnce=false;return false;}
  recoveredVersion=doc.version;
},()=>{});
await new Promise(resolve=>setTimeout(resolve,0));
const recoverySocket=sockets.at(-1);
recoverySocket.open();
recoverySocket.emit({type:"ready",version:8});
env.changeDocument(9);
recoverySocket.emit({type:"document_changed",version:9,base_version:8,
  delta:{items:{upsert:[{id:"pupil-stroke",kind:"pen",points:[{x:2,y:3}]}]}},
  updated_at:"2026-11-26T00:00:00Z",updated_by:"student",
  ink_cursor:{type:"cursor",user_id:"student",client_id:"student_client",x:2,y:3}});
await waitFor(()=>recoveredVersion===9);
assert.ok(deliveryAttempts>=2,"Rejected revision must be read again, not marked delivered");
assert.ok(recoveryCursors[0].includes("student"),"Initial rejected revision carries its committed cursor");
assert.ok(recoveryCursors.at(-1).includes("student"),"Retry preserves the committed cursor until the revision is accepted");
assert.ok(records.some(x=>x.path==="/api/v1/boards/board-1/document"&&x.query==="?ink_point_deltas=true"),
  "Rejected delta must recover through a full document read");
env.changeDocument(10);
for(let i=0;i<160&&recoveredVersion!==10;i++)await new Promise(resolve=>setTimeout(resolve,50));
assert.equal(recoveredVersion,10,"Quiet but online socket must recover a missed student revision");
assert.equal(recoverySocket.readyState,1);
env.changeDocument(11);
const readsBeforeInvalidPatch=records.length;
recoverySocket.emit({type:"document_changed",version:11,base_version:10,
  delta:{items:{order:["missing-object"]}},updated_at:"2026-11-26T00:00:00Z",updated_by:"student"});
await waitFor(()=>recoveredVersion===11);
assert.ok(records.slice(readsBeforeInvalidPatch).some(x=>x.path==="/api/v1/boards/board-1/document"&&x.query==="?ink_point_deltas=true"),
  "An invalid socket delta must recover through a full snapshot, not the rejected chain");
// The HTTP snapshot boundary must reject an unrelated board or malformed revision.
for(const invalid of [
 {board_id:"different-board",version:11,document:{items:[]}},
 {board_id:"board-1",version:-1,document:{items:[]}},
 {board_id:"board-1",version:12,document:[]},
 {board_id:"board-1",version:12,document:null}
]){
 env.setBoardResponse(invalid);
 await assert.rejects(api.selfhostReadDocument("board-1",undefined,false),/Invalid board snapshot/);
}
env.setBoardResponse(null);
// Access can recover while the socket remains open. Permission failure must
// never freeze the revision watcher for the rest of the lesson.
env.setBoardAccess(403);
env.changeDocument(12);
recoverySocket.emit({type:"document_changed",version:12});
await waitFor(()=>records.some(x=>x.path==="/api/v1/boards/board-1/document"&&x.method==="GET"&&x.query.includes("since_version=11")));
await new Promise(resolve=>setTimeout(resolve,100));
assert.equal(recoveredVersion,11,"Denied document has not been applied");
env.setBoardAccess(200);
for(let i=0;i<220&&recoveredVersion!==12;i++)await new Promise(resolve=>setTimeout(resolve,50));
assert.equal(recoveredVersion,12,"Version watchdog recovers without socket reconnect");
assert.equal(recoverySocket.readyState,1);
recovery();
await Promise.resolve();
env.changeDocument(8);

// Production board adapter receives cumulative pointer windows, not pilot packets.
const adapterInk=[],adapterStatuses=[],adapterCursors=[];
const channel=env.broadcast.connectBoardCursorChannel("board-1",{userId:"me",name:"Me",role:"owner"},cursor=>adapterCursors.push(cursor),true,ink=>adapterInk.push(ink),status=>adapterStatuses.push(status));
await new Promise(resolve=>setTimeout(resolve,0));
const inkSocket=sockets.at(-1);
inkSocket.open();
inkSocket.emit({type:"ready",version:8,compact_ink:true});
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
const erase={id:"eraser_1",kind:"eraser",color:"#000000",weight:92,offset:0,points:[{x:10,y:10},{x:20,y:20}],finished:false,eraserMode:"stroke"};
channel.sendInk(erase);
for(let i=0;i<100;i++)channel.sendCursor(i,i+1);
await waitFor(()=>inkSocket.sent.some(x=>x.type==="live_erase"&&!x.finished));
await waitFor(()=>inkSocket.sent.some(x=>x.type==="cursor"&&x.x===99&&x.y===100));
const cursorFrames=inkSocket.sent.filter(x=>x.type==="cursor");
assert.equal(cursorFrames.length,1,"Rapid eraser moves use the existing coalesced cursor relay");
inkSocket.emit({...cursorFrames[0],client_id:"other_tab",user_id:"user_2",name:"Student",role:"editor",sent_at:Date.now()});
assert.deepEqual([adapterCursors.at(-1)?.x,adapterCursors.at(-1)?.y],[99,100],"The observer receives the collaborator cursor during erasing");
const erasePreview=inkSocket.sent.find(x=>x.type==="live_erase");
assert.equal(erasePreview.erase_mode,"stroke");
inkSocket.emit({...erasePreview,client_id:"other_tab",user_id:"me",name:"Me",role:"owner"});
assert.equal(adapterInk.at(-1).kind,"eraser");
assert.equal(adapterInk.at(-1).eraserMode,"stroke");
assert.equal(adapterInk.at(-1).finished,false,"The other tab receives the eraser before release");
channel.sendInk({...erase,finished:true,cutIds:["stroke_fast"]});
await waitFor(()=>inkSocket.sent.some(x=>x.type==="live_erase"&&x.finished));
const eraseFinal=inkSocket.sent.find(x=>x.type==="live_erase"&&x.finished);
assert.deepEqual(eraseFinal.cut_ids,["stroke_fast"]);
assert.equal(eraseFinal.erase_mode,"stroke");
inkSocket.emit({...eraseFinal,client_id:"other_tab",user_id:"me",name:"Me",role:"owner"});
assert.deepEqual(JSON.parse(JSON.stringify(adapterInk.at(-1).cutIds)),["stroke_fast"]);
channel.close();
await Promise.resolve();

// With a blocked WebSocket, lightweight revision polling still catches saved work.
const fallbackVersions=[];
const fallback=api.selfhostWatchDocument("board-1",()=>8,doc=>fallbackVersions.push(doc.version),()=>{});
await new Promise(resolve=>setTimeout(resolve,0));
env.changeDocument(9);
await waitFor(()=>fallbackVersions.length===1);
assert.deepEqual(fallbackVersions,[9]);
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
// A deliberate exit retains one server-authenticated, one-click last account.
const quick=await loadSelfhost(true);
const quickSession=await quick.api.selfhostLogin("teacher@example.test","test-password");
quick.api.leaveSelfhostAccountRemembered();
assert.equal(quick.api.cachedSelfhostSession(),null,"Exit must end the active session");
assert.equal(quick.api.getRememberedSelfhostAccount().email,"teacher@example.test");
const restarted=quick.forkApi();
assert.equal(restarted.cachedSelfhostSession(),null,"Reload must not silently log in");
assert.equal(restarted.getRememberedSelfhostAccount().name,"Учитель");
const restored=await restarted.resumeRememberedSelfhostAccount();
assert.equal(restored.user.id,quickSession.user.id,"One click restores the prior account");
assert.equal(restarted.getRememberedSelfhostAccount(),null,"Remembered token moves to active session");
restarted.leaveSelfhostAccountRemembered();
await restarted.forgetRememberedSelfhostAccount();
assert.equal(restarted.getRememberedSelfhostAccount(),null,"Forget removes the last account button");
assert.equal(quick.storage.get("lektrus.selfhost.remembered.v1"),undefined);
const temporary=await loadSelfhost(true);
await temporary.api.selfhostLogin("teacher@example.test","test-password");
temporary.api.leaveSelfhostAccountRemembered();
temporary.setRefreshStatus(503);
const savedQuickSession=JSON.parse(temporary.storage.get("lektrus.selfhost.remembered.v1"));
temporary.storage.set("lektrus.selfhost.remembered.v1",JSON.stringify({...savedQuickSession,expires_at:1}));
await assert.rejects(temporary.api.resumeRememberedSelfhostAccount(),e=>e.status===503);
assert.equal(temporary.api.cachedSelfhostSession(),null,"Temporary outage must not cause automatic login");
assert.equal(temporary.api.getRememberedSelfhostAccount().email,"teacher@example.test",
 "Transient update failure must keep the last-account quick-login button");
temporary.setRefreshStatus(200);
assert.equal((await temporary.api.resumeRememberedSelfhostAccount()).user.id,quickSession.user.id);
console.log("Last account quick login, manual forget, reload and transient refresh recovery OK.");

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
const duringUpdate=await loadSelfhost(true);
await duringUpdate.api.selfhostLogin("teacher@example.test","test-password");
const beforeUpdate=JSON.parse(duringUpdate.storage.get("lektrus.selfhost.session.v1"));
duringUpdate.storage.set("lektrus.selfhost.session.v1",JSON.stringify({...beforeUpdate,expires_at:1}));
duringUpdate.setTransientRefresh401();
assert.equal((await duringUpdate.api.selfhostSession()).user.id,beforeUpdate.user.id,
 "A single temporary auth rejection during an update must not sign out the user");
assert.equal(duringUpdate.api.cachedSelfhostSession()?.user.id,beforeUpdate.user.id);
assert.equal(duringUpdate.refreshCount(),2,"Refresh must retry only once after transient 401");
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

for(const platform of ["web","android","ios"]){
  const health=await loadSelfhost(true,platform);
  assert.equal(await health.api.selfhostServiceHealthy(),true);
  health.setHealth(503,{detail:"Database unavailable"});
  assert.equal(await health.api.selfhostServiceHealthy(),false);
  health.setHealth(200,{ok:true,service:"unrelated"});
  assert.equal(await health.api.selfhostServiceHealthy(),false);
  assert.equal(health.api.cachedSelfhostSession(),null);
  assert.equal(health.refreshCount(),0);
  assert.ok(health.records.every(r=>r.path==="/api/v1/health"&&r.bearer===null));
  if(platform==="android")assert.ok(health.nativeRequests.every(r=>r.connectTimeout===20000&&r.readTimeout===20000),
    "Health probes must tolerate slower VPN connections on native Android");
}
console.log("Public health probe: browser, Android transport and iOS, no auth or session mutation.");

// A background health failure must not remove the native auth view or reload
// its input state on recovery. Full-page browser/connected-workspace recovery
// is still required. Drive the actual hook using isolated events and timers.
const availabilitySource=readFileSync(new URL("../src/useServiceAvailability.ts",import.meta.url),"utf8");
const availabilityCode=ts.transpileModule(availabilitySource,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
function availabilityFixture(preserveView,initialProbe){
  const win=new EventTarget(),doc=new EventTarget(),nav={onLine:true};
  doc.visibilityState="visible";
  let reason=null,checking=false,reloads=0,reads=0,healthy=false,cleanup;
  win.location={reload(){reloads++}};
  let stateIndex=0;const timers=new Map();let timerId=0;
  const react={useState(initial){const index=stateIndex++;return [initial,value=>{if(index===0)reason=value;else checking=value}]},useRef(current){return {current}},useEffect(effect){cleanup=effect()}};
  const exports={};
  vm.runInNewContext(availabilityCode,{exports,require(name){
    if(name==="react")return react;
    if(name==="@capacitor/core")return {Capacitor:{isNativePlatform:()=>false}};
    if(name==="@capacitor/app")return {App:{}};
    if(name==="./selfhostApi")return {selfhostServiceHealthy:async()=>{reads++;return reads===1&&initialProbe?initialProbe:healthy}};
    throw Error(name);
  },window:win,document:doc,navigator:nav,Date,setTimeout(fn,delay){const id=++timerId;timers.set(id,{fn,delay});return id},clearTimeout(id){timers.delete(id)}});
  const hook=exports.useServiceAvailability(true,preserveView);
  return {hook,cleanup,win,doc,nav,timers,setHealthy(value){healthy=value},state(){return {reason,checking,reloads,reads}},
    tick(delay){const next=[...timers].find(([,timer])=>timer.delay===delay);assert.ok(next,`Missing ${delay}ms retry`);timers.delete(next[0]);next[1].fn()}};
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
for(const preserve of [true,false]){
  const f=availabilityFixture(preserve);
  await flush();
  assert.deepEqual(f.state(),{reason:null,checking:false,reloads:0,reads:1},"One transient failure must not hide Lektrus");
  f.setHealthy(true);f.tick(1000);await flush();
  assert.deepEqual(f.state(),{reason:null,checking:false,reloads:0,reads:2},"VPN recovery before confirmation must not reload the page");
  assert.equal(f.timers.size,0);
  f.setHealthy(false);f.hook.check();await flush();
  assert.equal(f.state().reason,null,"A successful check resets the failure count");
  f.cleanup();assert.equal(f.timers.size,0);
}
for(const preserve of [true,false]){
  const f=availabilityFixture(preserve);
  await flush();
  assert.equal(f.state().reason,null);
  f.tick(1000);await flush();
  assert.deepEqual(f.state(),{reason:"server", checking:false,reloads:0,reads:2});
  assert.equal(f.timers.size,1,"Unavailable service must retain its automatic retry");
  f.setHealthy(true);f.tick(15000);await flush();
  assert.equal(f.state().reloads,preserve?0:1,"Native auth must recover without destroying input state; full-screen route must restore");
  if(preserve){
    assert.equal(f.state().reason,null);
    f.nav.onLine=false;f.win.dispatchEvent(new Event("offline"));
    assert.equal(f.state().reason,"offline");
    f.nav.onLine=true;f.win.dispatchEvent(new Event("online"));await flush();
    assert.equal(f.state().reason,null);assert.equal(f.state().reloads,0);
  }
  f.cleanup();assert.equal(f.timers.size,0);
}
// Switching Wi-Fi/VPN while a probe is pending must cause a new probe, not
// let the old network's result count as a failure on the new network.
let finishOldProbe;
const switched=availabilityFixture(true,new Promise(resolve=>{finishOldProbe=resolve}));
switched.nav.onLine=false;switched.win.dispatchEvent(new Event("offline"));
assert.equal(switched.state().reason,"offline");
switched.setHealthy(true);switched.nav.onLine=true;switched.win.dispatchEvent(new Event("online"));
assert.equal(switched.state().reads,1,"Do not overlap health probes on network change");
finishOldProbe(false);await flush();
assert.deepEqual(switched.state(),{reason:null,checking:false,reloads:0,reads:2});
switched.cleanup();assert.equal(switched.timers.size,0);
const stale=availabilityFixture(true);await flush();
stale.nav.onLine=false;stale.win.dispatchEvent(new Event("offline"));
stale.setHealthy(true);stale.tick(15000);await flush();
assert.equal(stale.state().reason,null,"A successful real response overrides a stale browser offline flag");
stale.cleanup();assert.equal(stale.timers.size,0);
const hidden=availabilityFixture(true);
hidden.doc.visibilityState="hidden";await flush();
assert.equal(hidden.timers.size,0,"Do not poll hidden views");
hidden.doc.visibilityState="visible";hidden.doc.dispatchEvent(new Event("visibilitychange"));await flush();
assert.equal(hidden.state().reason,"server","Resume pending confirmation when the tab becomes visible");
hidden.cleanup();assert.equal(hidden.timers.size,0);
assert.match(appSource,/serviceAvailability\.reason&&!activeBoard&&!preserveNativeAuth/);
assert.match(appSource,/connectionIssue=\{preserveNativeAuth&&serviceAvailability\.reason\?/);
assert.match(registrationForm,/auth-connection-notice/);
assert.match(registrationForm,/onClick=\{connectionIssue\.onRetry\}/);
console.log("Native authentication: connection warning, preserved form, automatic recovery without reload; browser outage recovery unchanged.");

{
const streamEnv=await loadSelfhost(true);
const streamApi=streamEnv.api;
await streamApi.selfhostLogin("teacher@example.test","test-password");
const streamBoard=await streamApi.selfhostCreateBoard("Нативная доска");
const streamBase={version:1,title:"Нативная доска",view:{x:0,y:0,zoom:1},items:[]};
let streamVersion=(await streamApi.selfhostSaveDocument(streamBoard.id,0,streamBase)).version;
streamEnv.enablePointCapability();
await streamApi.selfhostReadDocument(streamBoard.id,undefined,false);
const streamChannel=streamApi.selfhostSubscribeBoard(streamBoard.id,()=>{},()=>{});
await new Promise(resolve=>setTimeout(resolve,0));
const streamSocket=streamEnv.sockets.at(-1);
streamSocket.open();streamSocket.emit({type:"ready",version:streamVersion,durable_ink_commits:true,ink_commit_chain:true});
const streamDocument=n=>({...streamBase,items:[{id:"pipeline-pen",kind:"pen",x:0,y:0,width:100,height:10,
  text:"",color:"#008080",weight:2,points:Array.from({length:n},(_,i)=>({x:i,y:i%2}))}]});
const streamAcks=[];
const stream=streamApi.selfhostStartInkPipeline(streamBoard.id,streamVersion,streamDocument(1),"pipeline-pen",undefined,v=>streamAcks.push(v));
assert.ok(stream,"Negotiated permanent ink pipeline starts from exact committed base");
assert.ok(stream.offer(streamDocument(2),undefined,v=>streamAcks.push(v)));
assert.ok(stream.offer(streamDocument(3),undefined,v=>streamAcks.push(v)));
assert.equal(stream.offer(streamDocument(4),undefined,v=>streamAcks.push(v)),false);
assert.deepEqual(streamAcks,[],"Geometry does not become acknowledged merely because it was sent");
const sentFrames=streamSocket.sent.filter(frame=>frame.type==="ink_commit");
assert.equal(sentFrames.length,3,"No network round trip is required before sending the next frame");
assert.equal(sentFrames[1].after_request_id,sentFrames[0].request_id);
assert.equal(sentFrames[2].after_request_id,sentFrames[1].request_id);
assert.deepEqual(sentFrames.map(x=>x.expected_version),[streamVersion,streamVersion+1,streamVersion+2]);
streamSocket.emit({type:"ink_commit_ack",request_id:sentFrames[0].request_id,version:streamVersion+1});
await Promise.resolve();await Promise.resolve();
assert.ok(stream.offer(streamDocument(4),undefined,v=>streamAcks.push(v)),"One ACK frees one slot");
assert.equal(stream.offer({...streamDocument(4),title:"unrelated edit"},undefined,()=>{}),false);
const failed=stream.done.then(()=>null,error=>error);
const fourthFrame=streamSocket.sent.at(-1);
streamSocket.emit({type:"ink_commit_ack",request_id:sentFrames[1].request_id,status:409,detail:"peer changed the version"});
streamSocket.emit({type:"ink_commit_ack",request_id:sentFrames[2].request_id,status:409,detail:"predecessor rejected"});
streamSocket.emit({type:"ink_commit_ack",request_id:fourthFrame.request_id,status:409,detail:"predecessor rejected"});
assert.equal((await failed).status,409);
assert.deepEqual(streamAcks,[streamVersion+1],"Only durable acknowledged frames advance the editor merge base");
assert.equal(stream.offer(streamDocument(5),undefined,()=>{}),false,"Never replay an ambiguous or conflicted chain");
const fragment=id=>({...streamDocument(1).items[0],id});
const erasePartial={...streamBase,items:[fragment("left-cut"),fragment("right-cut")]};
const eraseFinal={...streamBase,items:[erasePartial.items[1]]};
const eraseAcks=[];
const eraseStream=streamApi.selfhostStartInkPipeline(streamBoard.id,streamVersion+1,erasePartial,"erase:test",undefined,v=>eraseAcks.push(v));
assert.ok(eraseStream,"Partial eraser fragment replacement can be pipelined");
assert.ok(eraseStream.offer(eraseFinal,undefined,v=>eraseAcks.push(v)));
const eraseFrames=streamSocket.sent.filter(frame=>frame.type==="ink_commit").slice(-2);
assert.deepEqual(eraseFrames[0].delta.items.remove,["pipeline-pen"]);
assert.deepEqual(eraseFrames[1].delta.items.remove,["left-cut"]);
for(const [i,frame] of eraseFrames.entries())
  streamSocket.emit({type:"ink_commit_ack",request_id:frame.request_id,version:streamVersion+2+i});
assert.equal((await eraseStream.done).version,streamVersion+3);
assert.deepEqual(eraseAcks,[streamVersion+2,streamVersion+3]);
streamChannel();await Promise.resolve();
console.log("Durable ink pipeline: three unacknowledged frames, bounded coalescing, predecessor and conflict recovery passed.");

}


// Exercise the negotiated idle lease with an advanced wall clock, without a ten-minute real wait.
{
 const idleEnv=await loadSelfhost(true);
 const idleApi=idleEnv.api;
 await idleApi.selfhostLogin("teacher@example.test","test-password");
 const notices=[];
 const originalNow=Date.now;
 let clock=originalNow();
 Date.now=()=>clock;
 let stop;
 try {
   stop=idleApi.selfhostSubscribeBoard("board-1",()=>{},()=>{},frame=>notices.push(frame.type),{visible:true,idle:true});
   await new Promise(resolve=>setTimeout(resolve,0));
   const first=idleEnv.sockets.at(-1);
   first.open();
   assert.equal(first.sent[0].idle_age_ms,0);
   assert.equal(first.sent[0].background_idle,true);
   assert.equal(first.sent[0].background,false);
   first.emit({type:"ready",version:1,idle_lease:true,background_idle:true});
   assert.equal(first.sent.at(-1).type,"activity");
   assert.equal(first.sent.at(-1).background,false);
   clock+=3600000;
   idleApi.selfhostSetBoardBackground("board-1",clock);
   assert.equal(first.sent.at(-1).background,true);
   assert.equal(first.sent.at(-1).idle_age_ms,0);
   clock+=599999;
   idleApi.selfhostSetBoardBackground("board-1",null);
   assert.equal(first.sent.at(-1).background,false);
   assert.equal(idleEnv.sockets.length,1,"Short background return must preserve the socket");
   assert.equal(first.readyState,1);
   idleApi.selfhostSetBoardBackground("board-1",clock);
   clock+=600000;
   first.onclose({code:4410});
   assert.ok(notices.includes("idle_timeout"));
   assert.equal(first.readyState,3);
   await new Promise(resolve=>setTimeout(resolve,350));
   assert.equal(idleEnv.sockets.length,1,"Idle closure must not reconnect in background");
   idleApi.selfhostSetBoardBackground("board-1",null);
   await new Promise(resolve=>setTimeout(resolve,0));
   assert.equal(idleEnv.sockets.length,2,"Foreground return must reconnect without a click");
   const second=idleEnv.sockets.at(-1);
   second.open();
   assert.equal(second.sent[0].idle_age_ms,0);
   assert.equal(second.sent[0].background,false);
   second.emit({type:"ready",version:2,idle_lease:true,background_idle:true});
 } finally {stop?.();Date.now=originalNow;await Promise.resolve();}
 console.log("Background-only lease: unlimited foreground, uninterrupted short return, automatic wake after ten minutes.");
}

// Simulate false offline network state, stale WebSocket auth and the room
// presence handshake without relying on real network or 10-minute timers.
{
 const recovery=await loadSelfhost(true);
 await recovery.api.selfhostLogin("teacher@example.test","test-password");
 recovery.nav.onLine=false;
 const states=[];
 const stop=recovery.api.selfhostSubscribeBoard("board-1",()=>{},status=>states.push(status),()=>{},
   {visible:true,idle:true});
 await new Promise(resolve=>setTimeout(resolve,0));
 assert.equal(recovery.sockets.length,1,"False browser offline must not suppress an attempted WS");
 const first=recovery.sockets[0];first.open();
 first.emit({type:"ready",version:1,idle_lease:true});
 assert.notEqual(states.at(-1),"online","Wait for room presence after WS ready");
 first.emit({type:"presence_state",users:[{user_id:"teacher",name:"Teacher",role:"owner"}]});
 assert.equal(states.at(-1),"online");
 first.reject(4401);
 await new Promise(resolve=>setTimeout(resolve,0));
 assert.equal(recovery.refreshCount(),1,"Reject a bearer only once");
 assert.equal(recovery.sockets.length,2,"Renewed auth reconnects despite navigator.onLine=false");
 const second=recovery.sockets[1];second.open();
 assert.equal(second.sent[0].token,"token-refreshed");
 second.emit({type:"ready",version:1,idle_lease:true});
 second.emit({type:"presence_state",users:[{user_id:"teacher",name:"Teacher",role:"owner"}]});
 assert.equal(states.at(-1),"online");
 second.reject(1006);
 assert.equal(states.at(-1),"reconnecting");
 await new Promise(resolve=>setTimeout(resolve,350));
 assert.equal(recovery.sockets.length,3,"Automatic retry must survive a false offline flag");
 const third=recovery.sockets[2];third.open();
 third.emit({type:"ready",version:2,idle_lease:true});
 third.emit({type:"presence_state",users:[]});
 assert.equal(states.at(-1),"online","Empty but valid room snapshot is connected");
 stop();await Promise.resolve();
 assert.equal(third.readyState,3);
 console.log("Reconnect regression: false offline, bearer refresh, room readiness and retry passed.");
}

/** A student's ordinary object creation must not reserialize a teacher's
 * legacy default fields, and moving an object must preserve unknown metadata. */
{
 const raw={version:1,title:"Lesson",items:[{id:"teacher",kind:"shape",x:1,y:2,unknown:"keep"}]};
 const canonical={version:1,title:"Lesson",subject:"",items:[{id:"teacher",kind:"shape",x:1,y:2,shapeType:"rounded"}]};
 const next={...canonical,subject:"unrelated subject",items:[{...canonical.items[0],x:5},{id:"pupil",kind:"sticky",createdBy:"student"}]};
 const projected=api.projectStudentDocument(raw,canonical,next);
 assert.deepEqual(JSON.parse(JSON.stringify(projected.items)),[{id:"teacher",kind:"shape",x:5,y:2,unknown:"keep"},{id:"pupil",kind:"sticky",createdBy:"student"}]);
 assert.equal(projected.subject,undefined);
 const delta=api.diffSelfhostDocument(raw,projected);
 assert.equal(delta.items.upsert.length,2);
 const addedOnly=api.projectStudentDocument(raw,canonical,{...canonical,items:[canonical.items[0],next.items[1]]});
 assert.deepEqual(JSON.parse(JSON.stringify(api.diffSelfhostDocument(raw,addedOnly).items.upsert)),[next.items[1]]);
}

{
 const boardModelSource=readFileSync(new URL("../src/boardModel.ts",import.meta.url),"utf8");
 const block=boardModelSource.slice(boardModelSource.indexOf("const persistedGraphKeys"),boardModelSource.indexOf("function persistedGraphData"));
 assert.match(block,/"subjectBoardStandalone"/,"Standalone subject object must survive parsing and remote reload");
}
