import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {buildHistoricalTimeline,normalizeHistoricalSource,sha256,removeRetracedHole} from './build-lektrus-historical-timeline.mjs';
import {historicalYearOrdinal,historicalYearFromOrdinal,stepHistoricalYear,historicalBlockForYear,historicalYearState,historicalYearFeatureCollection,validateHistoricalManifest,validateHistoricalPack} from '../src/lektrusHistoricalTimeline.ts';
import {createHistoricalTimelineLoader} from '../src/lektrusHistoricalTimelineLoader.ts';
import {referenceAdmissionWarnings} from './audit-lektrus-atlas-annual.mjs';
import {buildChangeRegistry} from './audit-lektrus-historical-changes.mjs';

const square = (x=0,y=0)=>({type:'Polygon',coordinates:[[[x,y],[x+1,y],[x+1,y+1],[x,y+1],[x,y]]]});
assert.equal(removeRetracedHole([[0,0],[1,0],[0,0],[1,1],[0,0]]),null);
assert.deepEqual(removeRetracedHole([[0,0],[1,0],[1,1],[2,2],[1,1],[0,1],[0,0]]),square().coordinates[0]);
const reviewBase={entityId:'a',geometryId:'shared',name:'A',nameStatus:'candidate',geometryStatus:'candidate'};
const reviewRecords=[{...reviewBase,id:'a1',from:-1,to:-1},{...reviewBase,id:'a2',from:1,to:2},{...reviewBase,id:'b1',entityId:'b',from:2,to:2}];
const warning={name:'missing',date:'1'};
const review=buildChangeRegistry(reviewRecords,[{year:-1,records:1},{year:1,records:1,membershipWarnings:[warning]},{year:2,records:2,membershipWarnings:[warning]}],-1,2);
assert.equal(review.counts.uniqueGeometries,1);assert.equal(review.counts.reviewUnits,2);assert.equal(review.counts.changePeriods,3);
assert.deepEqual(review.reviewUnits.find(u=>u.entityId==='a').intervals,[{from:-1,to:2,years:3}]);
assert.deepEqual(review.issues[0].intervals,[{from:1,to:2,years:2}]);
const feature=(name,from,to,geometry=square(),wikidata='',type='POLITY',components='')=>({type:'Feature',properties:{Name:name,FromYear:from,ToYear:to,Wikidata:wikidata,Type:type,Components:components},geometry});
const source={type:'FeatureCollection',features:[feature('A',-3400,0),feature('A',1,10),feature('Mali Federation',1960,1960,square(),'Q216632'),feature('Mali Federation',1961,2024,square(),'Q216632'),feature('Republic of Indonesia',1960,1975,square(137.5,-4.5),'Q252'),feature('(Relation)',1,2024,square(),'','RELATION','A;B'),feature('(Composite)',1,10,square(),'','POLITY','A')]};
assert.equal(stepHistoricalYear(-1,1),1);
assert.equal(stepHistoricalYear(1,-1),-1);
assert.equal(stepHistoricalYear(-3400,-1),-3400);
assert.equal(stepHistoricalYear(2024,1),2024);
assert.throws(()=>historicalYearOrdinal(0));
for(let year=2024;year>=-3400;year--){if(year===0)continue;assert.equal(historicalYearFromOrdinal(historicalYearOrdinal(year)),year);}
const normalized=normalizeHistoricalSource(source);
assert.equal(normalized.counts.uniqueGeometries,2);
assert.equal(normalized.counts.sourceRelations,1);
assert.equal(normalized.counts.sourceComposites,1);
assert.equal(normalized.counts.zeroBoundaryRecords,1);
assert.equal(normalized.records[0].to,-1);
assert.equal(normalized.records[0].entityId,normalized.records[1].entityId);
assert.equal(normalized.records.find(r=>r.from===1961).name,'Republic of Mali');
assert.equal(normalized.records.find(r=>r.name==='Republic of Indonesia'&&r.from===1960).geometryStatus,'rejected');
const zimbabwe=normalizeHistoricalSource({type:'FeatureCollection',features:[feature('Zimbabwe Rhodesia',1979,1982,square(),'Q890120'),feature('Republic of Zimbabwe',1983,2024,square(),'Q954')]});
assert.deepEqual(zimbabwe.records.map(r=>[r.from,r.to,r.name]),[[1979,1979,'Zimbabwe Rhodesia'],[1980,1982,'Republic of Zimbabwe'],[1983,2024,'Republic of Zimbabwe']]);
assert.equal(zimbabwe.records[1].sourceName,'Zimbabwe Rhodesia');
assert.equal(zimbabwe.records[1].entityId,zimbabwe.records[2].entityId);
assert.throws(()=>normalizeHistoricalSource({type:'FeatureCollection',features:[feature('Bad',1,2,{type:'Polygon',coordinates:[[[0,0],[1,0],[0,1],[1,1]]]})]}));
const fixtureDir=mkdtempSync(path.join(tmpdir(),'lektrus-timeline-fixture-'));
const fixture=buildHistoricalTimeline(source,sha256(JSON.stringify(source)),fixtureDir);
assert.equal(historicalBlockForYear(fixture,0),undefined);
assert.equal(historicalBlockForYear(fixture,2025),undefined);
assert.throws(()=>validateHistoricalManifest({...fixture,blocks:fixture.blocks.slice(1)}));
const block=historicalBlockForYear(fixture,1962);
const pack=validateHistoricalPack(JSON.parse(fs.readFileSync(path.join(fixtureDir,block.file))),block);
const state=historicalYearState(pack,1962);
assert.equal(state.drawable.length,1);
assert.equal(state.overlays.length,1);
assert.equal(state.overlays[0].record.role,'relation');
assert.equal(historicalYearFeatureCollection(state,true).features.length,2);
assert.equal(state.rejected.length,1);
assert.equal(historicalYearFeatureCollection(state).features.length,1);
assert.equal(historicalYearFeatureCollection(state).features[0].properties.NAME,'Республика Мали');
assert.equal(historicalYearState(pack,1963).drawable.length,2);
assert.throws(()=>validateHistoricalPack({...pack,geometries:{}},block));
assert.throws(()=>historicalYearState(pack,1800));
let requests=0, corrupt=false;
const fetchFixture=async url=>{
  requests++;
  const bytes=fs.readFileSync(path.join(fixtureDir,url.replace('/history/','')));
  if(corrupt&&url.includes('/packs/'))bytes[10]^=1;
  return new Response(bytes,{status:200});
};
const loader=createHistoricalTimelineLoader('/history',fetchFixture);
assert.equal((await loader.year(2025)).status,'outside-source-coverage');
assert.equal(requests,1);
await loader.year(1962);await loader.year(1963);assert.equal(requests,2,'same period reused');
corrupt=true;await assert.rejects(loader.year(100),/integrity mismatch/);
corrupt=false;await loader.year(100);assert.equal(requests,4,'corrupted file retried');
console.log('Annual timeline fixtures: dates, identity, geometry deduplication, source corrections, blocked polygons and indexes OK');

// Independently compare every requested calendar year with the original
// source records, not just the builder's own normalized representation.
const [outDir,sourceFile]=process.argv.slice(2);
if(outDir&&sourceFile){
  const raw=fs.readFileSync(sourceFile);
  const input=JSON.parse(raw);
  const manifest=validateHistoricalManifest(JSON.parse(fs.readFileSync(path.join(outDir,'manifest.json'))));
  assert.equal(manifest.source.sha256,sha256(raw));
  const original=input.features.map((f,index)=>({f,index}));
  assert.equal(manifest.counts.sourcePolities+manifest.counts.sourceComposites+manifest.counts.sourceRelations,original.length);
  const sourceHashes=new Map(original.map(({f,index})=>[index,sha256(JSON.stringify(f.geometry))]));
  const seen=new Set(), allGeometries=new Set();
  let years=0,recordYears=0,rejectedYears=0,packCount=0,emptyYears=0;
  let yearsWithIdentityCollisions=0,yearsWithSharedGeometry=0,admissionWarnings=0;
  const rows=[2026,2025].map(year=>({year,status:'outside-source-coverage',records:0,drawable:0,rejected:0,semanticReview:'requires independent dated modern source',visualReview:'pending'}));
  for(const block of [...manifest.blocks].reverse()){
    const bytes=fs.readFileSync(path.join(outDir,block.file));
    assert.equal(bytes.length,block.bytes);
    assert.equal(sha256(bytes),block.sha256);
    const pack=validateHistoricalPack(JSON.parse(bytes),block);
    packCount++;
    for(const [id,geometry] of Object.entries(pack.geometries)){assert.equal(sha256(JSON.stringify(geometry)),id);allGeometries.add(id);}
    for(const r of pack.records){
      seen.add(r.id);const f=input.features[r.sourceIndex];
      assert.equal(r.role,f.properties.Type==='RELATION'?'relation':f.properties.Components?'composite':'polity');assert.equal(r.sourceName,f.properties.Name.trim());
      const list=v=>String(v??'').split(';').map(s=>s.trim()).filter(Boolean);
      assert.deepEqual(r.components,list(f.properties.Components));assert.deepEqual(r.memberOf,list(f.properties.MemberOf));
      assert.equal(r.sourceFrom,f.properties.FromYear);assert.equal(r.sourceTo,f.properties.ToYear);
      assert.equal(r.sourceGeometryId??r.geometryId,sourceHashes.get(r.sourceIndex));
      if(r.sourceGeometryId){assert.equal(r.geometryRepair,'retracted-zero-area-interior-edges');const orig=f.geometry, repaired=pack.geometries[r.geometryId];assert.equal(orig.type,repaired.type);const shells=g=>(g.type==='Polygon'?[g.coordinates]:g.coordinates).map(p=>p[0]);assert.deepEqual(shells(orig),shells(repaired));}
    }
    for(let year=block.to;year>=block.from;year--){
      if(year===0)continue;
      const expected=original.filter(({f})=>f.properties.FromYear<=year&&f.properties.ToYear>=year).map(({index})=>index);
      const state=historicalYearState(pack,year);
      assert.deepEqual(state.records.map(r=>r.sourceIndex),expected,`Incorrect active source records at ${year}`);
      assert.equal(state.records.length,state.drawable.length+state.overlays.length+state.rejected.length);
      assert.ok(state.drawable.every(r=>r.record.geometryStatus==='candidate'&&r.geometry));
      assert.equal(historicalYearFeatureCollection(state).features.length,state.drawable.length);
      assert.equal(historicalYearFeatureCollection(state,true).features.length,state.drawable.length+state.overlays.length);
      const byEntity=new Map(),byGeometry=new Map(),allGeometry=new Map();
      for(const r of state.records){
        if(!allGeometry.has(r.geometryId))allGeometry.set(r.geometryId,[]);allGeometry.get(r.geometryId).push(r);
        if(r.role!=='polity')continue;
        if(!byEntity.has(r.entityId))byEntity.set(r.entityId,[]);byEntity.get(r.entityId).push(r);
        if(!byGeometry.has(r.geometryId))byGeometry.set(r.geometryId,[]);byGeometry.get(r.geometryId).push(r);
      }
      const identityCollisions=[...byEntity.values()].filter(group=>group.length>1).map(group=>group.map(r=>({name:r.name,sourceIndex:r.sourceIndex})));
      const sharedGeometry=[...byGeometry.values()].filter(group=>new Set(group.map(r=>r.entityId)).size>1).map(group=>group.map(r=>({name:r.name,sourceIndex:r.sourceIndex})));
      const expectedLayerOverlaps=[...allGeometry.values()].filter(group=>group.some(r=>r.role!=='polity')&&new Set(group.map(r=>r.entityId)).size>1).map(group=>group.map(r=>({name:r.name,sourceIndex:r.sourceIndex,role:r.role})));
      const bySourceName=new Map();for(const r of state.records){if(!bySourceName.has(r.sourceName))bySourceName.set(r.sourceName,[]);bySourceName.get(r.sourceName).push(r)}
      const groupLinkWarnings=[];
      for(const r of state.records){
        for(const component of r.components){const active=bySourceName.get(component);if(!active)groupLinkWarnings.push({kind:'missing-component',group:r.sourceName,component,sourceIndex:r.sourceIndex});else if(active.length>1)groupLinkWarnings.push({kind:'ambiguous-component',group:r.sourceName,component,sourceIndex:r.sourceIndex})}
        for(const group of r.memberOf){if(!bySourceName.get(group)?.some(g=>g.role!=='polity'&&g.components.includes(r.sourceName)))groupLinkWarnings.push({kind:'unmatched-membership',group,component:r.sourceName,sourceIndex:r.sourceIndex})}
      }
      const membershipWarnings=referenceAdmissionWarnings(year,state.records.filter(r=>r.role==='polity').map(r=>r.name));
      if(identityCollisions.length)yearsWithIdentityCollisions++;
      if(sharedGeometry.length)yearsWithSharedGeometry++;
      admissionWarnings+=membershipWarnings.length;
      years++;recordYears+=state.records.length;rejectedYears+=state.rejected.length;if(!state.records.length)emptyYears++;
      rows.push({year,status:state.status,records:state.records.length,drawable:state.drawable.length,overlays:state.overlays.length,rejected:state.rejected.length,identityCollisions,sharedGeometry,expectedLayerOverlaps,groupLinkWarnings,membershipWarnings,semanticReview:'not-complete',visualReview:'pending'});
    }
  }
  assert.equal(years,5424);
  assert.equal(seen.size,manifest.counts.revisions);
  assert.equal(allGeometries.size,manifest.counts.uniqueGeometries);
  const report={years,recordYears,rejectedYears,emptyYears,packCount,yearsWithIdentityCollisions,yearsWithSharedGeometry,admissionWarnings,counts:manifest.counts,source:manifest.source,notice:'Technical annual coverage with review warnings. Shared geometry, aliases and admission warnings are candidates, not proof of errors. Historical, geographic and visual acceptance NOT complete.',rows};
  fs.writeFileSync(path.join(outDir,'technical-annual-audit.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({...report,rows:undefined}));
}
