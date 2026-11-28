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
 if(r.classification==="ethnonym-not-single-sovereign-state")assert.equal(r.archiveName,"Saxons");
 if(r.classification==="personal-union-not-single-sovereign-country")assert.equal(r.archiveName,"Kalmar Union");
 if(r.classification==="mac-dynasty-anachronistic-unqualified-dai-viet")assert.ok(r.archiveName==="Đại Việt"&&r.year===1530);
 if(r.classification==="divided-dai-viet-multiple-effective-rulers")assert.ok(r.archiveName==="Đại Việt"&&r.year>1530);
 if(r.classification==="late-golden-horde-successor-confusion")assert.ok(r.archiveName==="Golden Horde"&&[1492,1500].includes(r.year));
 if(r.classification==="coastal-colonial-footprint-versus-entire-island")assert.equal(r.archiveName,"Greenland");
 if(r.classification==="compound-danish-norwegian-monarchy-scope")assert.equal(r.archiveName,"Denmark-Norway");
 if(r.classification==="1920-tartu-treaty-eastern-border-not-retrojected")assert.equal(r.archiveName,"Estonia");
 if(r.classification==="unsettled-chaco-frontier-before-1938")assert.equal(r.archiveName,"Paraguay");
 if(r.classification==="bolivian-pacific-coast-and-chaco-dated-disputes")assert.equal(r.archiveName,"Bolivia");
 if(r.classification==="anglo-french-condominium-not-independent")assert.equal(r.archiveName,"New Hebrides");
 if(r.classification==="1938-munich-intra-year-border-transition")assert.equal(r.archiveName,"Czechoslovakia");
 if(r.classification==="siam-tributary-claims-versus-direct-borders")assert.equal(r.archiveName,"Rattanakosin Kingdom");
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
assert.equal(classes.get("ethnonym-not-single-sovereign-state"),3);
assert.equal(classes.get("personal-union-not-single-sovereign-country"),1);
assert.equal(classes.get("mac-dynasty-anachronistic-unqualified-dai-viet"),1);
assert.equal(classes.get("divided-dai-viet-multiple-effective-rulers"),6);
assert.equal(classes.get("late-golden-horde-successor-confusion"),2);
assert.equal(classes.get("coastal-colonial-footprint-versus-entire-island"),3);
assert.equal(classes.get("compound-danish-norwegian-monarchy-scope"),7);
assert.equal(classes.get("1920-tartu-treaty-eastern-border-not-retrojected"),3);
assert.equal(classes.get("unsettled-chaco-frontier-before-1938"),7);
assert.equal(classes.get("bolivian-pacific-coast-and-chaco-dated-disputes"),6);
assert.equal(classes.get("anglo-french-condominium-not-independent"),1);
assert.equal(classes.get("1938-munich-intra-year-border-transition"),1);
assert.equal(classes.get("siam-tributary-claims-versus-direct-borders"),6);
assert.equal(classes.get("historical-uk-proper-vs-imperial-source-scope-not-like-for-like"),3);
assert.equal(classes.get("dated-political-status-or-composite-scope-noncomparable-to-single-year-sovereign-outline"),14);
assert.equal(classes.get("modern-independent-island-coastline-candidate-reconstructed-pending-yearly-geometric-acceptance"),12);
assert.equal(seen.size,124);assert.equal(current.counts.newlyExplained,119);
assert.equal(current.counts.remainingWithoutExplanation,352);
assert.equal(current.counts.historicallyVerifiedGeometries,0);
assert.equal(current.counts.territorialComponentYearsStillOpenExpected,769);
const source=fs.readFileSync(new URL("scripts/audit-historical-unique-geometries.py",base),"utf8");
assert.ok(source.includes("name_key(name) == name_key(r['name'])"));
assert.ok(!source.includes("name_key(r['name']), name_key(r['sourceName'])"));
assert.ok(source.includes("sourceAliasOnly"));
assert.ok(source.includes("retrospectiveAliasWithoutEffectiveMatch"));
assert.ok(source.includes("rawSourceAliasOnlyArchiveFeatures"));
console.log("Atlas spatial comparison: 13 false historical name matches corrected, 124 mismatches explained, 352 awaiting review; geometry unverified.");

// Preserve the previous frozen acceptance checks above, and validate the current
// snapshot as well. A documented political context is not a certified boundary.
const latest=fetchJson("docs/historical-atlas-spatial-adjudications-20261128.json");
const latestIds=new Set();
for(const r of latest.cases){
 assert.ok(!latestIds.has(r.id),"Duplicate current adjudication "+r.id);latestIds.add(r.id);
 const f=byId.get(r.id);assert.ok(f,"Unknown current archival result "+r.id);
 const c=f.candidates.find(c=>c.geometryId===r.candidateGeometryId);assert.ok(c);
 assert.equal(r.archiveName,f.archiveName);assert.equal(r.archiveSha256,f.archiveSha256);
 assert.equal(r.year,f.year);assert.equal(r.iou,c.iou);
 assert.equal(r.geometryHistoricallyConfirmed,false);
 assert.ok(r.sources.length>0&&r.sources.every(s=>s.startsWith("https://")));
 if(r.proposedMainlandApproxIoU!==undefined){
  assert.ok(Number.isFinite(r.proposedMainlandApproxIoU)&&r.proposedMainlandApproxIoU>=0&&r.proposedMainlandApproxIoU<=1);
 }
}
for(const r of current.cases)assert.ok(latestIds.has(r.id),"Prior case disappeared "+r.id);
assert.equal(latest.counts.archivedNamedDisagreements,byId.size);
assert.equal(latest.counts.explainedComparisonCases,latestIds.size);
assert.equal(latest.counts.remainingWithoutExplanation,byId.size-latestIds.size);
assert.equal(latest.counts.historicallyVerifiedGeometries,0);
assert.equal(latest.counts.unverifiedArchiveGeometries,byId.size);
assert.equal(latest.counts.territorialComponentYearsStillOpenExpected,769);
assert.equal(latestIds.size,136);
const coast=latest.cases.filter(r=>r.classification.startsWith('modern-independent-island-coastline-candidate-'));
assert.equal(coast.length,24);
assert.equal(latest.counts.modernIslandCoastlineReviewCases,coast.length);
assert.equal(latest.counts.modernIslandApproximateOverlapCases,coast.filter(r=>r.proposedMainlandApproxIoU!==undefined).length);
console.log("Current snapshot: 136 classified, 340 unclassified, all 476 geometries unverified.");
