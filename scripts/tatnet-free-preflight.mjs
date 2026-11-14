/**
 * Prevent a TatNet Free trial from quietly falling back to local-only mode
 * or being pointed at the existing production Supabase.
 *
 * Values are validated only; no key or URL is logged or committed.
 */
import {fileURLToPath} from "node:url";

export function checkTatnetFreeEnvironment(env){
 const errors=[];
 const rawUrl=(env.VITE_SUPABASE_URL??"").trim();
 const publicKey=(env.VITE_SUPABASE_ANON_KEY??"").trim();
 if(!rawUrl)errors.push("VITE_SUPABASE_URL is required for a real TatNet Supabase trial.");
 else {
  try{
   const parsed=new URL(rawUrl);
   if(parsed.protocol!=="https:"||parsed.username||parsed.password||parsed.search||parsed.hash)
    errors.push("VITE_SUPABASE_URL must be a plain HTTPS API base URL.");
   if(parsed.hostname==="localhost"||parsed.hostname==="127.0.0.1")
    errors.push("TatNet staging must use a remotely accessible Supabase API.");
   // A separate TatNet database is mandatory: the official Supabase
   // project currently used by Lektrus must never receive test writes.
   if(parsed.hostname==="supabase.co"||parsed.hostname.endsWith(".supabase.co"))
    errors.push("TatNet staging must use a separate TatNet-managed Supabase database, not production Supabase.");
   if(/\/(?:rest|auth|realtime|storage|functions)\/v1\/?$/.test(parsed.pathname))
    errors.push("Provide the Supabase API base URL, not an individual service endpoint.");
  }catch{errors.push("VITE_SUPABASE_URL must be a valid HTTPS URL.");}
 }
 if(!publicKey)errors.push("VITE_SUPABASE_ANON_KEY is required for remote Auth, Storage and Realtime.");
 else if(publicKey.startsWith("sb_secret_")||/^service_role(?:_|$)/i.test(publicKey))
  errors.push("Only an anon/publishable key may be embedded in Vite.");
 else if(publicKey.startsWith("sb_publishable_")){
  if(publicKey.length<24)errors.push("The public Supabase key looks incomplete.");
 }else{
  const parts=publicKey.split(".");
  if(parts.length!==3)errors.push("Use the public anon JWT or sb_publishable_ key from the TatNet Supabase Studio.");
  else try{
   const payload=JSON.parse(Buffer.from(parts[1],"base64url").toString("utf8"));
   if(payload.role!=="anon")errors.push("Only the anon role is allowed in the browser bundle.");
  }catch{errors.push("VITE_SUPABASE_ANON_KEY has an invalid JWT payload.");}
 }
 if(env.VITE_LEKTRUS_LOCAL_TEST==="true")
  errors.push("VITE_LEKTRUS_LOCAL_TEST must not be enabled when testing the real TatNet backend.");
 if(env.VITE_LECTRIS_ORG_SYNC==="true")
  errors.push("Keep VITE_LECTRIS_ORG_SYNC=false until the isolated TatNet database migrations have been verified.");
 return errors;
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
 const errors=checkTatnetFreeEnvironment(process.env);
 if(errors.length){
  console.error("TatNet Free staging preflight failed:\n"+errors.map(e=>"  - "+e).join("\n"));
  process.exitCode=1;
 }else console.log("TatNet Free staging preflight passed (credentials not printed).");
}
