import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = path => readFileSync(new URL("../"+path,import.meta.url),"utf8");

const form=read("src/AuthScreen.tsx");
const store=read("src/authStore.ts");
const api=read("src/backend.ts");
const access=read("src/accountRoleStore.ts");
const style=read("src/lektrusAuthLayout.css");
const entry=read("src/appEntry.tsx");
const html=read("index.html");
const migration=read("supabase/v260_self_selected_registration_roles.sql");

assert.match(form,/Кем вы регистрируетесь\?/,"Role question must be visible at signup");
for(const role of ["teacher","student"]) {
  assert.match(form,new RegExp('value="'+role+'" required checked='),"Role "+role+" must be a required radio");
}
assert.match(form,/Я учитель/);
assert.match(form,/Я ученик/);
assert.match(form,/registrationRole!\s*\}/,"Role must reach signup store");
assert.match(store,/role:AccountRole/,"Signup role is required");
assert.match(store,/role:input\.role/,"Chosen role must reach backend signup");
assert.match(store,/setLocalAccountRole\(user\.id,input\.role\)/,"Local signup must remember role per user");
assert.match(api,/registration_role:details\.role/,"Signup request must contain registration_role metadata");
assert.match(access,/LOCAL_ROLE_PREFIX\+id/,"Local roles must be tied to user IDs");
assert.match(access,/teacherStatus:role==="teacher"\?"approved":"none"/,"Local test permissions follow selected role");
assert.match(entry,/import "\.\/lektrusAuthLayout\.css";/);
assert.match(style,/\.auth-role-grid/);
assert.match(style,/@media \(max-width: 480px\)/);
assert.match(html,/__LEKTRUS_PUBLIC_BACKEND__/,"Timeweb runtime public config must load before entry");
assert.ok(html.indexOf("__LEKTRUS_PUBLIC_BACKEND__")<html.indexOf('src="/src/main.tsx"'),"Public config must precede main script");
assert.match(api,/runtimeBackendConfig\?\.anonKey/,"Built app must read public config at runtime");
assert.match(migration,/after insert on auth\.users for each row/i,"Only registration may assign a new role");
assert.match(migration,/new\.raw_user_meta_data->>'registration_role' = 'teacher'/);
assert.match(migration,/selected_role\s+text\s*:=\s*'student'/,"Default role must be student");
assert.match(migration,/case when selected_role='teacher' then 'approved' else 'none' end/);
assert.match(migration,/on conflict \(id\) do update set/,"Migration must preserve existing account rows");
assert.doesNotMatch(migration,/set\s+account_role\s*=/i,"Conflict must not rewrite existing role");
assert.doesNotMatch(migration,/\bapp_admins\b|\bsubscription_plan\b/,"Signup may not grant admin or subscription");
console.log("Registration role flow and Timeweb frontend contract verified.");
