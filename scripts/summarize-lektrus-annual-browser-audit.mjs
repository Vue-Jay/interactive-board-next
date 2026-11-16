// Validate the full set of individual year reports, even if one shard fails.
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
const root=process.argv[2],output=process.argv[3];
if(!root||!output)throw Error('Usage: summarize-lektrus-annual-browser-audit.mjs REPORT_DIRECTORY OUTPUT_DIRECTORY');
fs.mkdirSync(output,{recursive:true});
function findFiles(dir){
 if(!fs.existsSync(dir))return [];
 return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?findFiles(path.join(dir,e.name)):e.name.endsWith('.jsonl')?[path.join(dir,e.name)]:[]);
}
const years=new Map(),duplicates=[],parseErrors=[],issues=[],facts=[];
const totals={expected:0,clicked:0,verified:0,issues:0,candidates:0,coverageGaps:0,rejected:0};
for(const file of findFiles(root)){
 const rl=readline.createInterface({input:fs.createReadStream(file),crlfDelay:Infinity});
 for await(const line of rl){
  if(!line.trim())continue;
  let row;try{row=JSON.parse(line)}catch(error){parseErrors.push({file,message:error.message});continue;}
  if(years.has(row.year)){duplicates.push(row.year);continue;}
  const summary={year:row.year,source:row.source,coverageStatus:row.coverageStatus,completed:row.completed,...row.summary};
  years.set(row.year,summary);
  for(const key of Object.keys(totals))totals[key]+=row.summary?.[key]??0;
  if(row.issues.length||row.pageErrors.length||row.layers.some(l=>l.issues.length||l.results.some(r=>r.errors.length)))issues.push({year:row.year,issues:row.issues,pageErrors:row.pageErrors,layers:row.layers.map(l=>({mode:l.mode,issues:l.issues,cards:l.results.filter(r=>r.errors.length).map(r=>({id:r.id,sourceIndex:r.sourceIndex,sourceName:r.sourceName,cardTitle:r.cardTitle,errors:r.errors}))}))});
  for(const gap of row.gaps)facts.push({year:row.year,kind:'coverage-gap',...gap});
  for(const rejected of row.rejected)facts.push({year:row.year,kind:'rejected-source-contour',...rejected});
 }
}
const expected=Array.from({length:5427},(_,i)=>2026-i).filter(y=>y!==0),annual=[...years.values()].sort((a,b)=>b.year-a.year);
const missing=expected.filter(y=>!years.has(y)),unexpected=[...years.keys()].filter(y=>!expected.includes(y));
const incomplete=annual.filter(y=>!y.completed||y.expected!==y.clicked||y.issues>0).map(y=>y.year);
const result={expectedYears:expected.length,reportedYears:years.size,missing,unexpected,duplicates,parseErrors,incomplete,totals,annual,scope:'Real Chromium SVG click and card checks. Historical correctness independently unverified; 2025 and 2026 coverage gaps remain.'};
fs.writeFileSync(path.join(output,'annual-browser-summary.json'),JSON.stringify(result,null,2));
fs.writeFileSync(path.join(output,'annual-browser-issues.json'),JSON.stringify(issues,null,2));
fs.writeFileSync(path.join(output,'annual-browser-coverage-findings.json'),JSON.stringify(facts,null,2));
console.log(JSON.stringify({...result,annual:undefined}));
if(missing.length||unexpected.length||duplicates.length||parseErrors.length||incomplete.length)process.exitCode=1;
