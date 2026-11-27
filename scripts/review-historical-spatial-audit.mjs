import assert from "node:assert/strict";
import fs from "node:fs";
const base=new URL("../",import.meta.url);
const fetchJson=p=>JSON.parse(fs.readFileSync(new URL(p,base),"utf8"));
const data=fetchJson("docs/historical-atlas-spatial-findings-20261124.json");
const current=fetchJson("docs/historical-atlas-spatial-adjudications-20261127.json");
const old=fetchJson("docs/historical-atlas-spatial-adjudications-20261126.json");
const norm=x=>x.normalize("NFKC").toLocaleLowerCase("en").trim().replace(/\s+/g," ");
assert.equal(data.findings.length,476);
assert.equal(old.counts.totalComparabilityCasesExplained,5);
const byId=new Map(data.findings.map(f=>[f.id,f]));
const mismatches=data.findings.filter(f=>f.candidates.length&&f.candidates.every(c=>norm(c.name)!==norm(f.archiveName)));
assert.equal(mismatches.length,13);
const classes=new Map(),seen=new Set();
for(const r of current.cases){
 assert.ok(!seen.has(r.id));seen.add(r.id);
 const f=byId.get(r.id);assert.ok(f,"Unknown archival result "+r.id);
 const c=f.candidates.find(c=>c.geometryId===r.candidateGeometryId);assert.ok(c);
 assert.equal(r.archiveName,f.archiveName);assert.equal(r.archiveSha256,f.archiveSha256);
 assert.equal(r.year,f.year);assert.equal(r.iou,c.iou);
 assert.equal(r.geometryHistoricallyConfirmed,false);
 assert.ok(r.sources.length>0&&r.sources.every(s=>s.startsWith("https://")));
 if(r.classification==="retrospective-source-name-not-exact-historical-label")
  assert.notEqual(norm(f.archiveName),norm(c.name));
 if(r.classification==="nonlike-for-like-metropolitan-denmark-vs-danish-realm")assert.equal(r.archiveName,"Denmark");
 if(r.classification==="noncomparable-archaeological-or-polycentric-aggregate")
  assert.ok(["Greek city-states","Indus valley civilization"].includes(r.archiveName));
 if(r.classification==="incomplete-archipelago-source-outline"){
  assert.equal(r.archiveName,"Netherlands Antilles");
  assert.ok([1994,2000].includes(r.year));
 }
 if(r.classification==="archaeological-influence-not-verified-sovereign-frontier")assert.equal(r.archiveName,"Teotihuacan");
 if(r.classification==="polycentric-principalities-not-one-state")assert.equal(r.archiveName,"Shan states");
 classes.set(r.classification,(classes.get(r.classification)??0)+1);
}
for(const f of mismatches)assert.ok(seen.has(f.id));
assert.equal(classes.get("retrospective-source-name-not-exact-historical-label"),13);
assert.equal(classes.get("nonlike-for-like-metropolitan-denmark-vs-danish-realm"),13);
assert.equal(classes.get("wartime-control-vs-recognized-sovereignty"),2);
assert.equal(classes.get("noncomparable-archaeological-or-polycentric-aggregate"),9);
assert.equal(classes.get("incomplete-archipelago-source-outline"),2);
assert.equal(classes.get("archaeological-influence-not-verified-sovereign-frontier"),8);
assert.equal(classes.get("polycentric-principalities-not-one-state"),1);
assert.equal(seen.size,48);assert.equal(current.counts.newlyExplained,43);
assert.equal(current.counts.remainingWithoutExplanation,428);
assert.equal(current.counts.historicallyVerifiedGeometries,0);
assert.equal(current.counts.territorialComponentYearsStillOpenExpected,769);
const source=fs.readFileSync(new URL("scripts/audit-historical-unique-geometries.py",base),"utf8");
assert.ok(source.includes("name_key(name) == name_key(r['name'])"));
assert.ok(!source.includes("name_key(r['name']), name_key(r['sourceName'])"));
console.log("Atlas spatial comparison: 13 false historical name matches corrected, 48 mismatches explained, 428 awaiting review; geometry unverified.");
