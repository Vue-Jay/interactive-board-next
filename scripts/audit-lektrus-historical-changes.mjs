// Collapse repeated annual work into evidence units with exact affected intervals.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {sha256} from './build-lektrus-historical-timeline.mjs';
import {historicalYearOrdinal as ordinal,historicalYearFromOrdinal as year,validateHistoricalManifest,validateHistoricalPack} from '../src/lektrusHistoricalTimeline.ts';

// A new review is required when the identity, contour or semantic facts change.
// Reuse is not proof of accuracy, and different entities never share a verdict.
export function buildChangeRegistry(records, rows, from, to) {
  const units=new Map(), events=new Map(), issueRuns=new Map();
  const event=(at)=>{if(!events.has(at))events.set(at,{starts:[],ends:[]});return events.get(at)};
  for(const r of records){
    const key=sha256(JSON.stringify([r.entityId,r.geometryId,r.name,r.nameRu??null,r.nameStatus,r.geometryStatus,r.role,r.components,r.memberOf,r.sourceSeshatId,r.sourceWikipedia,r.review??null]));
    if(!units.has(key))units.set(key,{id:key,entityId:r.entityId,geometryId:r.geometryId,name:r.name,nameRu:r.nameRu,role:r.role,components:r.components,memberOf:r.memberOf,geometryStatus:r.geometryStatus,reviewStatus:'pending-independent-review',revisions:[],intervals:[]});
    const unit=units.get(key);unit.revisions.push(r.id);unit.intervals.push([ordinal(r.from),ordinal(r.to)]);
    event(ordinal(r.from)).starts.push(r.id);event(ordinal(r.to)+1).ends.push(r.id);
  }
  const coalesce=intervals=>{
    const output=[];
    for(const [a,b] of intervals.sort((x,y)=>x[0]-y[0]||x[1]-y[1])){
      const last=output.at(-1);if(last&&a<=last[1]+1)last[1]=Math.max(last[1],b);else output.push([a,b]);
    }
    return output.map(([a,b])=>({from:year(a),to:year(b),years:b-a+1}));
  };
  const addIssue=(type,detail,y)=>{
    const key=sha256(JSON.stringify([type,detail]));
    if(!issueRuns.has(key))issueRuns.set(key,{id:key,type,detail,intervals:[]});
    issueRuns.get(key).intervals.push([ordinal(y),ordinal(y)]);
  };
  const annual=new Map(rows.filter(r=>r.year>=from&&r.year<=to).map(r=>[r.year,r]));
  const active=new Set(), periods=[];
  let recordYears=0;
  for(let o=ordinal(from);o<=ordinal(to);o++){
    const e=events.get(o);
    if(e){for(const id of e.ends)assert.ok(active.delete(id));for(const id of e.starts){assert.ok(!active.has(id));active.add(id)}}
    const y=year(o), row=annual.get(y);assert.ok(row,`Missing annual acceptance row ${y}`);
    assert.equal(active.size,row.records,`Event sweep disagrees with annual source at ${y}`);
    recordYears+=active.size;
    if(e||!periods.length)periods.push({from:y,to:y,records:active.size,started:e?.starts??[],ended:e?.ends??[],stateHash:sha256(JSON.stringify([...active].sort()))});
    else periods.at(-1).to=y;
    for(const w of row.membershipWarnings??[])addIssue('membership',w,y);
    for(const group of row.identityCollisions??[])addIssue('identity-collision',[...group].sort((a,b)=>a.sourceIndex-b.sourceIndex),y);
    for(const group of row.sharedGeometry??[])addIssue('shared-geometry',[...group].sort((a,b)=>a.sourceIndex-b.sourceIndex),y);
    for(const detail of row.groupLinkWarnings??[])addIssue('group-link',detail,y);
  }
  const reviewUnits=[...units.values()].map(u=>({...u,intervals:coalesce(u.intervals)})).sort((a,b)=>b.intervals.at(-1).to-a.intervals.at(-1).to);
  const issues=[...issueRuns.values()].map(u=>({...u,intervals:coalesce(u.intervals),status:'open'})).sort((a,b)=>b.intervals.at(-1).to-a.intervals.at(-1).to);
  return {from,to,recordYears,periods:periods.reverse(),reviewUnits,issues,counts:{years:annual.size,changePeriods:periods.length,reviewUnits:reviewUnits.length,uniqueGeometries:new Set(records.map(r=>r.geometryId)).size,issues:issues.length,annualIssueOccurrences:issues.reduce((n,u)=>n+u.intervals.reduce((m,i)=>m+i.years,0),0)}};
}

export function auditChanges(folder){
  const manifest=validateHistoricalManifest(JSON.parse(fs.readFileSync(path.join(folder,'manifest.json'))));
  const records=new Map();
  for(const block of manifest.blocks){
    const bytes=fs.readFileSync(path.join(folder,block.file));assert.equal(sha256(bytes),block.sha256);
    const pack=validateHistoricalPack(JSON.parse(bytes),block);
    for(const record of pack.records){if(records.has(record.id))assert.deepEqual(record,records.get(record.id));else records.set(record.id,record)}
  }
  assert.equal(records.size,manifest.counts.revisions);
  const annual=JSON.parse(fs.readFileSync(path.join(folder,'technical-annual-audit.json')));
  assert.equal(annual.source.sha256,manifest.source.sha256);
  const report=buildChangeRegistry([...records.values()],annual.rows,manifest.from,manifest.to);
  assert.equal(report.recordYears,annual.recordYears);
  fs.writeFileSync(path.join(folder,'change-review-registry.json'),JSON.stringify({...report,source:manifest.source,notice:'Review units are work deduplication, NOT historical acceptance. Annual rows and modern unresolved issues remain tracked.'},null,2)+'\n');
  console.log(JSON.stringify({recordYears:report.recordYears,...report.counts}));
  return report;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  assert.ok(process.argv[2],'Usage: audit-lektrus-historical-changes.mjs TIMELINE_FOLDER');auditChanges(process.argv[2]);
}
