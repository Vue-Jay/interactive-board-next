// Collapse repeated annual work into evidence units with exact affected intervals.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {sha256,componentHash} from './build-lektrus-historical-timeline.mjs';
import {historicalYearOrdinal as ordinal,historicalYearFromOrdinal as year,validateHistoricalManifest,validateHistoricalPack} from '../src/lektrusHistoricalTimeline.ts';

// A new review is required when the identity, contour or semantic facts change.
// Reuse is not proof of accuracy, and different entities never share a verdict.
export function buildChangeRegistry(records, rows, from, to) {
  const units=new Map(), events=new Map(), issueRuns=new Map();
  const event=(at)=>{if(!events.has(at))events.set(at,{starts:[],ends:[]});return events.get(at)};
  for(const r of records){
    const key=sha256(JSON.stringify([r.entityId,r.geometryId,r.name,r.nameRu??null,r.nameStatus,r.geometryStatus,r.role,r.components,r.memberOf,r.sourceSeshatId,r.sourceWikipedia,r.review??null,r.territorialAttributions??null,r.editorialRestoration??null]));
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
  let recordYears=0,lastCoverage;
  for(let o=ordinal(from);o<=ordinal(to);o++){
    const e=events.get(o);
    if(e){for(const id of e.ends)assert.ok(active.delete(id));for(const id of e.starts){assert.ok(!active.has(id));active.add(id)}}
    const y=year(o), row=annual.get(y);assert.ok(row,`Missing annual acceptance row ${y}`);
    assert.equal(active.size,row.records,`Event sweep disagrees with annual source at ${y}`);
    recordYears+=active.size;
    const coverage=JSON.stringify(row.membershipWarnings??[]);
    if(e||!periods.length||coverage!==lastCoverage)periods.push({from:y,to:y,records:active.size,started:e?.starts??[],ended:e?.ends??[],stateHash:sha256(JSON.stringify([[...active].sort(),coverage]))});
    else periods.at(-1).to=y;
    lastCoverage=coverage;
    for(const w of row.membershipWarnings??[])addIssue('membership',w,y);
    for(const group of row.identityCollisions??[])addIssue('identity-collision',[...group].sort((a,b)=>a.sourceIndex-b.sourceIndex),y);
    for(const group of row.sharedGeometry??[])addIssue('shared-geometry',[...group].sort((a,b)=>a.sourceIndex-b.sourceIndex),y);
    for(const detail of row.groupLinkWarnings??[])addIssue('group-link',detail,y);
  }
  const reviewUnits=[...units.values()].map(u=>({...u,intervals:coalesce(u.intervals)})).sort((a,b)=>b.intervals.at(-1).to-a.intervals.at(-1).to);
  const issues=[...issueRuns.values()].map(u=>({...u,intervals:coalesce(u.intervals),status:'open'})).sort((a,b)=>b.intervals.at(-1).to-a.intervals.at(-1).to);
  return {from,to,recordYears,periods:periods.reverse(),reviewUnits,issues,counts:{years:annual.size,changePeriods:periods.length,reviewUnits:reviewUnits.length,uniqueGeometries:new Set(records.map(r=>r.geometryId)).size,issues:issues.length,annualIssueOccurrences:issues.reduce((n,u)=>n+u.intervals.reduce((m,i)=>m+i.years,0),0)}};
}

// Exact component equality catches stale, partially duplicated state contours
// that whole-geometry equality misses. A match is a review candidate, not
// automatic proof of sovereignty or an instruction to delete a polygon.
// Ignore ring start and winding, not coordinates or precision.
export {componentHash} from './build-lektrus-historical-timeline.mjs';
export function exactComponentConflicts(records, hashesByGeometry, thematic=false){
  const byHash=new Map(),pairs=new Map();
  for(const r of records){
    if((r.role!=='polity'&&!(thematic&&r.role==='settlement'))||r.geometryStatus!=='candidate')continue;
    for(const hash of new Set(hashesByGeometry.get(r.geometryId)??[])){
      if(!byHash.has(hash))byHash.set(hash,[]);
      byHash.get(hash).push(r);
    }
  }
  for(const [hash,entries] of byHash){
    entries.sort((a,b)=>ordinal(a.from)-ordinal(b.from));
    for(let i=0;i<entries.length;i++)for(let j=i+1;j<entries.length;j++){
      const a=entries[i],b=entries[j];
      if(ordinal(b.from)>ordinal(a.to))break;
      if(a.sourceIndex===b.sourceIndex||a.entityId===b.entityId)continue;
      if(thematic&&a.role!=='settlement'&&b.role!=='settlement')continue;
      const [left,right]=[a,b].sort((x,y)=>x.sourceIndex-y.sourceIndex);
      const key=left.sourceIndex+':'+right.sourceIndex;
      if(!pairs.has(key))pairs.set(key,{left:{sourceIndex:left.sourceIndex,name:left.sourceName},right:{sourceIndex:right.sourceIndex,name:right.sourceName},years:new Map()});
      const group=pairs.get(key);
      for(let y=Math.max(ordinal(a.from),ordinal(b.from));y<=Math.min(ordinal(a.to),ordinal(b.to));y++){
        if(!group.years.has(y))group.years.set(y,new Set());
        group.years.get(y).add(hash);
      }
    }
  }
  const groups=[...pairs.values()].map(({years,...g})=>{
    const intervals=[];
    for(const [o,hashes] of [...years].sort((a,b)=>a[0]-b[0])){
      const components=[...hashes].sort(),last=intervals.at(-1);
      if(last&&ordinal(last.to)+1===o&&JSON.stringify(last.components)===JSON.stringify(components)){last.to=year(o);last.years++}
      else intervals.push({from:year(o),to:year(o),years:1,components});
    }
    return {...g,intervals,annualOccurrences:years.size};
  }).sort((a,b)=>b.annualOccurrences-a.annualOccurrences);
  return {groups,counts:{pairs:groups.length,annualPairOccurrences:groups.reduce((n,g)=>n+g.annualOccurrences,0),annualComponentOccurrences:groups.reduce((n,g)=>n+g.intervals.reduce((s,i)=>s+i.years*i.components.length,0),0)}};
}

// Identify the exact original feature parts behind each unresolved hash.
// Bounds are descriptive coordinates, not a new or simplified geometry.
export function sourceComponentEvidence(groups,features){
 const cache=new Map();
 const indexParts=index=>{
  if(cache.has(index))return cache.get(index);
  const feature=features[index];
  assert.ok(feature?.geometry,`Unknown source feature ${index}`);
  const {geometry}=feature,parts=geometry.type==='Polygon'?[geometry.coordinates]:geometry.coordinates;
  assert.ok(geometry.type==='Polygon'||geometry.type==='MultiPolygon');
  const hashes=new Map();
  for(const [part,polygon] of parts.entries()){
   let west=Infinity,south=Infinity,east=-Infinity,north=-Infinity;
   for(const ring of polygon)for(const [x,y] of ring){west=Math.min(west,x);south=Math.min(south,y);east=Math.max(east,x);north=Math.max(north,y)}
   const hash=componentHash(polygon);
   if(!hashes.has(hash))hashes.set(hash,[]);
   hashes.get(hash).push({part,bbox:[west,south,east,north].map(n=>Math.round(n*10000)/10000)});
  }
  const result={count:parts.length,hashes};cache.set(index,result);return result;
 };
 return groups.map(g=>{
  const left=indexParts(g.left.sourceIndex),right=indexParts(g.right.sourceIndex);
  return {left:{...g.left,parts:left.count},right:{...g.right,parts:right.count},intervals:g.intervals.map(i=>({from:i.from,to:i.to,years:i.years,matches:i.components.map(hash=>({hash,left:left.hashes.get(hash)??[],right:right.hashes.get(hash)??[]}))}))};
 }).sort((a,b)=>ordinal(b.intervals.at(-1).to)-ordinal(a.intervals.at(-1).to)||a.left.sourceIndex-b.left.sourceIndex||a.right.sourceIndex-b.right.sourceIndex);
}
export function auditChanges(folder,sourceFile){
  const manifest=validateHistoricalManifest(JSON.parse(fs.readFileSync(path.join(folder,'manifest.json'))));
  const records=new Map(),hashesByGeometry=new Map();
  for(const block of manifest.blocks){
    const bytes=fs.readFileSync(path.join(folder,block.file));assert.equal(sha256(bytes),block.sha256);
    const pack=validateHistoricalPack(JSON.parse(bytes),block);
    for(const [id,g] of Object.entries(pack.geometries))if(!hashesByGeometry.has(id))hashesByGeometry.set(id,(g.type==='Polygon'?[g.coordinates]:g.coordinates).map(componentHash));
    for(const record of pack.records){if(records.has(record.id))assert.deepEqual(record,records.get(record.id));else records.set(record.id,record)}
  }
  assert.equal(records.size,manifest.counts.revisions);
  const annual=JSON.parse(fs.readFileSync(path.join(folder,'technical-annual-audit.json')));
  assert.equal(annual.source.sha256,manifest.source.sha256);
  const report=buildChangeRegistry([...records.values()],annual.rows,manifest.from,manifest.to);
  const exactComponents=exactComponentConflicts([...records.values()],hashesByGeometry);
  const thematicComponents=exactComponentConflicts([...records.values()],hashesByGeometry,true);
  assert.equal(report.recordYears,annual.recordYears);
  const rawEvidence=sourceFile?(()=>{
   const bytes=fs.readFileSync(sourceFile);
   assert.equal(sha256(bytes),manifest.source.sha256,'Evidence source differs from candidate source');
   const source=JSON.parse(bytes);
   const evidence={political:sourceComponentEvidence(exactComponents.groups,source.features),thematic:sourceComponentEvidence(thematicComponents.groups,source.features)};
   // Compact evidence in CI logs permits review without downloading large packs.
   for(const [layer,groups] of Object.entries(evidence))for(const group of groups)console.log('ATLAS_COMPONENT_EVIDENCE '+JSON.stringify({layer,...group}));
   for(const issue of report.issues)console.log('ATLAS_OPEN_ISSUE '+JSON.stringify({type:issue.type,detail:issue.detail,intervals:issue.intervals}));
   return evidence;
  })():undefined;
  fs.writeFileSync(path.join(folder,'change-review-registry.json'),JSON.stringify({...report,exactComponents,thematicComponents,...(rawEvidence?{sourceComponentEvidence:rawEvidence}:{}),source:manifest.source,notice:'Review units are work deduplication, NOT historical acceptance. Exact component matches are unresolved candidates, not necessarily incorrect borders. Thematic overlaps remain separately documented. Annual rows and modern unresolved issues remain tracked.'},null,2)+'\n');
  console.log(JSON.stringify({recordYears:report.recordYears,...report.counts,exactComponents:exactComponents.counts,thematicComponents:thematicComponents.counts}));
  return report;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  assert.ok(process.argv[2],'Usage: audit-lektrus-historical-changes.mjs TIMELINE_FOLDER [PINNED_SOURCE.geojson]');auditChanges(process.argv[2],process.argv[3]);
}
