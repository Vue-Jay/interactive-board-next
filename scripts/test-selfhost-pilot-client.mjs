// Browser-facing self-hosted client contract, with mocked HTTPS and WS only.
// The production Supabase session and main routes are deliberately untouched.
import assert from "node:assert/strict";
import vm from "node:vm";
import ts from "typescript";
import { readFileSync } from "node:fs";

async function loadPilot(enabled) {
  let source=readFileSync(new URL("../src/selfhostPilotApi.ts",import.meta.url),"utf8");
  source=source
    .replaceAll("import.meta.env.VITE_LEKTRUS_SELFHOST_PILOT",JSON.stringify(enabled?"true":"false"))
    .replaceAll("import.meta.env.VITE_LEKTRUS_SELFHOST_API_ORIGIN",JSON.stringify("https://pilot.lektrus.example"))
    .replaceAll("import.meta.env.DEV","false");
  const compiled=ts.transpileModule(source,{
    compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS},
  }).outputText;
  const data=new Map([["lesson-board.supabase.session.v1","production-must-remain"]]);
  const record=[];
  let expires=900,refreshes=0;
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
      bearer:headers.get("Authorization"),body:options.body?JSON.parse(options.body):null});
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
      assert.equal(options.body,JSON.stringify({title:"Тест"}));
      return ok({id:"board-1",role:"owner",title:"Тест"});
    }
    if(u.pathname==="/api/v1/boards")return ok([{id:"board-1",title:"Тест",role:"owner"}]);
    if(u.pathname==="/api/v1/boards/board-1/document"&&options.method==="PUT"){
      if(JSON.parse(options.body).expected_version!==3)
        return ok({detail:"Версия изменилась."},409);
      return ok({board_id:"board-1",version:4,document:{pilot_schema:1,note:"hello",items:[],ink:[]}});
    }
    if(u.pathname==="/api/v1/boards/board-1/document")
      return ok({board_id:"board-1",version:3,document:{pilot_schema:1,items:[],ink:[],note:"hi"}});
    if(u.pathname==="/api/v1/boards/board-1/invitations")return ok({kind:"invite"});
    if(u.pathname==="/api/v1/invitations/claim")return ok({claimed:1});
    if(u.pathname==="/api/v1/auth/signup")return ok({ok:true,message:"email sent"},202);
    if(u.pathname==="/api/v1/auth/verify-email")return ok({ok:true,message:"confirmed"});
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
    exports:{},fetch,URL,Headers,Response,AbortController,FormData,
    navigator:{onLine:true},WebSocket:Socket,
    sessionStorage,setTimeout,clearTimeout,setInterval,clearInterval,Date,
    window:{location:{origin:"https://pilot.lektrus.example"},
      addEventListener(name,fn){listeners.set(name,fn)},
      removeEventListener(name){listeners.delete(name)}},
  });
  vm.runInContext(compiled,context);
  return {api:context.exports,records:record,storage:data,refreshCount:()=>refreshes,sockets,listeners,sessionStorage,changeExpires:v=>{expires=v}};
}

const disabled=await loadPilot(false);
assert.equal(disabled.api.SELFHOST_PILOT_ENABLED,false);
assert.throws(()=>disabled.api.pilotOrigin(),/выключен/);
assert.equal(disabled.storage.get("lesson-board.supabase.session.v1"),"production-must-remain");

const env=await loadPilot(true);
const {api,storage,records,sockets}=env;
assert.equal(api.SELFHOST_PILOT_ENABLED,true);
assert.equal(api.pilotOrigin(),"https://pilot.lektrus.example");
const session=await api.pilotLogin(" Teacher@Example.Test ","test-password");
assert.equal(session.user.account_role,"teacher");
assert.equal(api.cachedPilotSession().user.id,session.user.id);
assert.equal(storage.get("lesson-board.supabase.session.v1"),"production-must-remain");
assert.equal(records[0].body.email,"teacher@example.test");
assert.equal((await api.pilotBoards()).length,1);
assert.equal((await api.pilotCreateBoard("Тест")).id,"board-1");
assert.equal((await api.pilotReadDocument("board-1")).version,3);
const saved=await api.pilotSaveDocument("board-1",3,{pilot_schema:1,items:[],ink:[],note:"hello"});
assert.equal(saved.version,4);
await assert.rejects(api.pilotSaveDocument("board-1",2,{items:[],ink:[]}),e=>e.status===409);
assert.equal((await api.pilotInvite("board-1","future@example.test","viewer")).kind,"invite");
assert.equal((await api.pilotClaimInvitations()).claimed,1);
assert.equal((await api.pilotSignup({
  name:"Ученик",email:"new@example.test",password:"test-password",
  first_name:"",last_name:"",role:"student",
})).ok,true);
assert.equal((await api.pilotVerifyEmail("test-code")).ok,true);

const old=JSON.parse(storage.get("lektrus.selfhost.pilot.session.v1"));
old.expires_at=1;
storage.set("lektrus.selfhost.pilot.session.v1",JSON.stringify(old));
assert.equal((await api.pilotSession()).access_token,"token-refreshed");
assert.equal(env.refreshCount(),1);
const revisions=[];
const statuses=[];
const unsubscribe=api.pilotSubscribeBoard("board-1",
  version=>revisions.push(version),status=>statuses.push(status));
await new Promise(resolve=>setTimeout(resolve,0));
assert.equal(sockets.length,1);
assert.ok(sockets[0].url.startsWith("wss://pilot.lektrus.example/api/v1/boards/board-1/events"));
sockets[0].open();
assert.equal(sockets[0].sent[0].type,"auth");
assert.equal(sockets[0].sent[0].token,"token-refreshed");
sockets[0].emit({type:"ready",version:3});
sockets[0].emit({type:"document_changed",version:4});
sockets[0].emit({type:"document_changed",version:4});
sockets[0].emit({type:"document_changed",version:2});
assert.deepEqual(revisions,[3,4],"Repeated/old revisions must not re-fetch entire documents");
assert.ok(statuses.includes("online"));
unsubscribe();
assert.equal(sockets[0].readyState,3);
assert.equal(env.listeners.size,0);
await api.pilotLogout();
assert.equal(api.cachedPilotSession(),null);
assert.equal(storage.get("lesson-board.supabase.session.v1"),"production-must-remain");
assert.ok(records.some(x=>x.path==="/api/v1/auth/logout"&&x.bearer==="Bearer token-refreshed"));
console.log("Self-hosted pilot: gated route, isolated token, login, refresh, boards, conflicts, invitations, WS and logout OK.");
