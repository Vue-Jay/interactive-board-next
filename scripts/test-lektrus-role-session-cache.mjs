import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const source=readFileSync(new URL("../src/accountRoleStore.ts",import.meta.url),"utf8");
const compiled=ts.transpileModule(source,{
 compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}
}).outputText;

const storage=new Map();
const localStorage={
 getItem(key){return storage.has(key)?storage.get(key):null},
 setItem(key,value){storage.set(key,String(value))},
 removeItem(key){storage.delete(key)}
};
let userId="teacher-A",backendEnabled=true;
let requests=[];
const remoteRequest=()=>new Promise((resolve,reject)=>requests.push({resolve,reject,actor:userId}));
const backend={
 getCachedRemoteSession:()=>userId?{user:{id:userId}}:null,
 isRemoteBackendEnabled:()=>backendEnabled,
 remoteRequest
};
const exports={};
new Function("exports","require","localStorage",compiled)(
 exports, name=>{
  if(name==="./backend")return backend;
  if(name==="./lektrusLocalTestMode")return {LEKTRUS_LOCAL_TEST_MODE:false};
  throw new Error("Unexpected import "+name);
 },localStorage
);
const {
 getAccountAccess,getCachedAccountAccess,clearAccountAccessCache,
 setLocalAccountRole,requestTeacherAccess
}=exports;
const teacher={role:"teacher",teacher_status:"approved",is_admin:false,subscription_plan:"free"};
const student={role:"student",teacher_status:"none",is_admin:false,subscription_plan:"free"};

// A slow teacher role lookup must not appear as the newly signed-in pupil's role.
const pendingTeacher=getAccountAccess();
assert.equal(requests.length,1);
assert.equal(requests[0].actor,"teacher-A");
userId="student-B";
assert.equal(getCachedAccountAccess(),null,"Teacher in-memory access must not leak to a pupil");
const pendingStudent=getAccountAccess();
assert.equal(requests.length,2,"Different accounts must not share a pending access RPC");
requests[1].resolve(student);
assert.equal((await pendingStudent).role,"student");
requests[0].resolve(teacher);
await assert.rejects(pendingTeacher,/Аккаунт изменился/,"Old account request must be invalidated");
assert.equal(getCachedAccountAccess().role,"student","Late teacher response cannot replace student's access");
assert.equal(JSON.parse(storage.get("onlinerepetitor.account-access.v244.student-B")).value.role,"student");
assert.equal(storage.has("onlinerepetitor.account-access.v244.teacher-A"),false);

// Same account logs out and in again before its earlier request resolves.
userId="teacher-A";
clearAccountAccessCache();
const oldRequest=getAccountAccess();
assert.equal(requests.length,3);
clearAccountAccessCache();
const newRequest=getAccountAccess();
assert.equal(requests.length,4,"Explicit invalidation must allow a fresh request");
requests[2].resolve(student);
await assert.rejects(oldRequest,/Аккаунт изменился/);
requests[3].resolve(teacher);
assert.equal((await newRequest).role,"teacher");
assert.equal(getCachedAccountAccess().role,"teacher","New generation wins over old response");

// Two consumers asking for the same account may share the request.
clearAccountAccessCache();
const same1=getAccountAccess(),same2=getAccountAccess();
assert.equal(requests.length,5,"Concurrent same-user queries should reuse a request");
requests[4].resolve(teacher);
assert.equal((await same1).role,"teacher");
assert.equal((await same2).role,"teacher");

// No remote user may read a previous account's in-memory access.
userId="";
assert.equal(getCachedAccountAccess(),null);

// Offline accounts preserve their own selected roles.
backendEnabled=false;
localStorage.setItem("lesson-board.auth.session.v1",JSON.stringify({userId:"local-student"}));
setLocalAccountRole("local-student","student");
assert.equal((await getAccountAccess()).role,"student");
localStorage.setItem("lesson-board.auth.session.v1",JSON.stringify({userId:"local-teacher"}));
setLocalAccountRole("local-teacher","teacher");
assert.equal((await getAccountAccess()).role,"teacher");
localStorage.setItem("lesson-board.auth.session.v1",JSON.stringify({userId:"local-student"}));
assert.equal((await getAccountAccess()).role,"student","Switching offline profiles must not carry previous role");
await requestTeacherAccess({phone:"",city:"",organization:"",focusArea:"",experience:"",motivation:""});
assert.equal((await getAccountAccess()).role,"teacher","Local teacher request must update per-user role");
localStorage.setItem("lesson-board.auth.session.v1",JSON.stringify({userId:"local-teacher"}));
assert.equal((await getAccountAccess()).role,"teacher");
console.log("Role cache: account-switch races, same-session reuse and local role isolation OK.");
