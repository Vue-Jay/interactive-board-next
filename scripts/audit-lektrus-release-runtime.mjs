import {readFileSync,readdirSync,statSync} from "node:fs";
import {join,relative,extname} from "node:path";

// Static inventory, not runtime profiling or a dead-code detector.
// Emitting file/line evidence allows reviewers to decide which hot paths
// deserve browser traces before touching working legacy functionality.
const root=new URL("../",import.meta.url).pathname;
const files=[];
function walk(directory){
 for(const entry of readdirSync(directory,{withFileTypes:true})){
  if(entry.name==="node_modules"||entry.name===".git")continue;
  const full=join(directory,entry.name);
  if(entry.isDirectory())walk(full);
  else if([".ts",".tsx",".css"].includes(extname(full))){
   const source=readFileSync(full,"utf8");
   files.push({file:relative(root,full).replaceAll("\\","/"),size:Buffer.byteLength(source),lines:source.split(/\r?\n/)});
  }
 }
}
walk(join(root,"src"));
const categories=[
 ["serializations",/\bJSON\.(?:stringify|parse)\s*\(/g],
 ["async-loops",/\b(?:setInterval|setTimeout)\s*\(/g],
 ["network",/\b(?:fetch|remoteRequest|remoteAssetRequest|remoteStorageRequest|remoteFunctionRequest)\s*(?:<[^>]+>)?\s*\(/g],
 ["realtime",/\b(?:WebSocket|subscribe|broadcast|sendCursor|postgres_changes)\b/g],
 ["renders",/\b(?:requestAnimationFrame|ResizeObserver|useMemo|useLayoutEffect|useEffect)\s*\(/g],
 ["logging",/\bconsole\.(?:log|warn|error|debug|info)\s*\(/g],
 ["storage",/\b(?:localStorage|indexedDB|sessionStorage)\b/g],
];
console.log("## Static release runtime inventory (not an FPS or egress measurement)");
console.log(`Source files: ${files.length}; total source size: ${(files.reduce((n,f)=>n+f.size,0)/1048576).toFixed(2)} MiB (uncompressed, not bundle size).`);
console.log("\n### Largest source modules");
console.log("| File | Source KiB |");
console.log("|---|---:|");
for(const f of [...files].sort((a,b)=>b.size-a.size).slice(0,14))
 console.log(`| \`${f.file}\` | ${(f.size/1024).toFixed(1)} |`);
console.log("\n### Review candidates by pattern (raw matches include comments; verify each site)");
for(const [name,re] of categories){
 const rows=files.map(f=>{
  let count=0,first=[];
  for(let i=0;i<f.lines.length;i++){
   const hits=f.lines[i].match(re);if(!hits)continue;
   count+=hits.length;if(first.length<3)first.push(i+1);
  }
  return {file:f.file,count,first};
 }).filter(r=>r.count>0).sort((a,b)=>b.count-a.count).slice(0,10);
 console.log(`#### ${name}`);
 console.log("| File | Matches | Sample lines |");
 console.log("|---|---:|---|");
 for(const row of rows)console.log(`| \`${row.file}\` | ${row.count} | ${row.first.join(", ")} |`);
}
console.log("\nCandidates are NOT automatically dead code, duplicates, bugs or remote traffic. Validate with traces, network captures and functional tests.");
