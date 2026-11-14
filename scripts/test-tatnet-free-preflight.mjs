import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {checkTatnetFreeEnvironment} from "./tatnet-free-preflight.mjs";

const key="sb_publishable_"+"t".repeat(34);
const good={
 VITE_SUPABASE_URL:"https://trial-db.tatnet.cloud",
 VITE_SUPABASE_ANON_KEY:key,
 VITE_LEKTRUS_LOCAL_TEST:"false",
 VITE_LECTRIS_ORG_SYNC:"false"
};
assert.deepEqual(checkTatnetFreeEnvironment(good),[],
 "TatNet HTTPS + public key must pass");
for(const [override,needle] of [
 [{VITE_SUPABASE_URL:""},/VITE_SUPABASE_URL is required/],
 [{VITE_SUPABASE_URL:"https://old-project.supabase.co"},/not production Supabase/],
 [{VITE_SUPABASE_URL:"http://trial-db.tatnet.cloud"},/plain HTTPS/],
 [{VITE_SUPABASE_URL:"https://trial-db.tatnet.cloud/auth/v1"},/API base URL/],
 [{VITE_SUPABASE_ANON_KEY:""},/ANON_KEY is required/],
 [{VITE_SUPABASE_ANON_KEY:"sb_secret_"+"x".repeat(32)},/Only an anon\/publishable/],
 [{VITE_LEKTRUS_LOCAL_TEST:"true"},/must not be enabled/],
 [{VITE_LECTRIS_ORG_SYNC:"true"},/Keep .*false/]
]){
 const issues=checkTatnetFreeEnvironment({...good,...override});
 assert.ok(issues.some(message=>needle.test(message)),
  "The staging guard did not reject "+Object.keys(override)[0]);
}
const jwt=role=>{
 const enc=obj=>Buffer.from(JSON.stringify(obj)).toString("base64url");
 return enc({alg:"HS256",typ:"JWT"})+"."+enc({role})+".signature";
};
assert.deepEqual(checkTatnetFreeEnvironment({...good,VITE_SUPABASE_ANON_KEY:jwt("anon")}),[]);
assert.ok(checkTatnetFreeEnvironment({...good,VITE_SUPABASE_ANON_KEY:jwt("service_role")})
 .some(s=>s.includes("anon role")));

const repoRoot=new URL("../",import.meta.url);
const json=JSON.parse(readFileSync(new URL("tatnet.json",repoRoot),"utf8"));
assert.deepEqual(json.rewrites,[{source:"/(.*)",destination:"/index.html"}],
 "TatNet must rewrite direct SPA routes to index.html");
const packageJson=JSON.parse(readFileSync(new URL("package.json",repoRoot),"utf8"));
assert.equal(packageJson.scripts["build:tatnet-free"],
 "node scripts/tatnet-free-preflight.mjs && npm run build",
 "TatNet must validate its credentials and run the same typechecked build");
const backend=readFileSync(new URL("src/backend.ts",repoRoot),"utf8");
assert.ok(backend.includes("VITE_SUPABASE_URL")&&backend.includes("VITE_SUPABASE_ANON_KEY"),
 "The real board backend must read TatNet-injected build environment");
assert.ok(backend.includes("getRealtimeSocketUrl"),
 "Realtime must use the chosen Supabase URL");
console.log("TatNet Free: statically routed, publishable keys only, production Supabase isolated, typechecked build guarded.");
