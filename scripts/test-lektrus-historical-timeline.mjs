import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import polygonClipping from 'polygon-clipping';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {buildHistoricalTimeline,normalizeHistoricalSource,sha256,removeRetracedHole,deriveConfirmedOverlapExclusions,deriveTerritorialBatch,territorialBatch,territorialResolutions,independentIslands,independentIslandGeometry,partitionHistoricalGeometry,historicalTitleCorrections,secondaryExactReviews,thirdExactReviews,fourthExactReviews,fifthExactReviews,sixthExactReviews,provisionalExactReviews,exactConflictPendingReviews,exactConflictGroupPrefix,elba1797Partition,buildElbaPartition,earlyComorosRoutes,earlyComorosHashes} from './build-lektrus-historical-timeline.mjs';
import {historicalUnresolvedCenters,historicalUnresolvedRegions} from '../src/lektrusHistoricalUnresolvedCenters.ts';
import {capitalInsideCountry} from './atlas-2026-capitals.mjs';
import {historicalYearOrdinal,historicalYearFromOrdinal,stepHistoricalYear,historicalBlockForYear,historicalYearState,historicalYearFeatureCollection,validateHistoricalManifest,validateHistoricalPack} from '../src/lektrusHistoricalTimeline.ts';
import {createHistoricalTimelineLoader} from '../src/lektrusHistoricalTimelineLoader.ts';
import {referenceAdmissionWarnings} from './audit-lektrus-atlas-annual.mjs';
import {buildChangeRegistry,componentHash,exactComponentConflicts,sourceComponentEvidence} from './audit-lektrus-historical-changes.mjs';
import {historicalGapLocators} from '../src/lektrusHistoricalGapLocators.ts';
import {componentHash as sourceComponentHash,documentedCores,buildDocumentedCore,ceylonCoastalRoutes,ceylonEarlyRoutes} from './build-lektrus-historical-timeline.mjs';

const square = (x=0,y=0)=>({type:'Polygon',coordinates:[[[x,y],[x+1,y],[x+1,y+1],[x,y+1],[x,y]]]});
const elbaParts=buildElbaPartition().map(g=>g.coordinates),elbaUnion=polygonClipping.union(...elbaParts);
for(const [i,a] of elbaParts.entries())for(const b of elbaParts.slice(i+1))assert.equal(polygonClipping.intersection(a,b).length,0);
assert.equal(polygonClipping.difference(elba1797Partition.outline,elbaUnion).length,0);
assert.equal(polygonClipping.difference(elbaUnion,elba1797Partition.outline).length,0);
for(const [lon,lat,owner] of [[10.315,42.808,0],[10.395,42.772,1],[10.396,42.814,2],[10.2,42.78,2],[10.406,42.75,1]])assert.deepEqual(elbaParts.flatMap((p,i)=>polygonClipping.intersection(p,square(lon,lat).coordinates.map(r=>r.map(([x,y])=>[lon+(x-lon)*.000001,lat+(y-lat)*.000001]))).length?[i]:[]),[owner]);
assert.equal(removeRetracedHole([[0,0],[1,0],[0,0],[1,1],[0,0]]),null);
assert.deepEqual(removeRetracedHole([[0,0],[1,0],[1,1],[2,2],[1,1],[0,1],[0,0]]),square().coordinates[0]);
const reviewBase={entityId:'a',geometryId:'shared',name:'A',nameStatus:'candidate',geometryStatus:'candidate'};
const reviewRecords=[{...reviewBase,id:'a1',from:-1,to:-1},{...reviewBase,id:'a2',from:1,to:2},{...reviewBase,id:'b1',entityId:'b',from:2,to:2}];
const warning={name:'missing',date:'1'};
const review=buildChangeRegistry(reviewRecords,[{year:-1,records:1},{year:1,records:1,membershipWarnings:[warning]},{year:2,records:2,membershipWarnings:[warning]}],-1,2);
assert.equal(review.counts.uniqueGeometries,1);assert.equal(review.counts.reviewUnits,2);assert.equal(review.counts.changePeriods,3);
assert.deepEqual(review.reviewUnits.find(u=>u.entityId==='a').intervals,[{from:-1,to:2,years:3}]);
assert.deepEqual(review.issues[0].intervals,[{from:1,to:2,years:2}]);
const overlapRecords=[
 {...reviewBase,role:'polity',sourceIndex:1,sourceName:'A',geometryId:'a',from:-2,to:2},
 {...reviewBase,role:'polity',sourceIndex:2,sourceName:'B',entityId:'b',geometryId:'b',from:-1,to:3},
 {...reviewBase,role:'composite',sourceIndex:3,sourceName:'Union',entityId:'c',geometryId:'b',from:-1,to:3},
 {...reviewBase,role:'polity',sourceIndex:4,sourceName:'Rejected',entityId:'d',geometryStatus:'rejected',geometryId:'b',from:-1,to:3}
];
const overlaps=exactComponentConflicts(overlapRecords,new Map([['a',['x','y']],['b',['y','z']]]));
assert.deepEqual(overlaps.counts,{pairs:1,annualPairOccurrences:3,annualComponentOccurrences:3});
assert.deepEqual(overlaps.groups[0].intervals,[{from:-1,to:2,years:3,components:['y']}]);
const withSettlement=[...overlapRecords,{...reviewBase,role:'settlement',sourceRole:'polity',sourceIndex:5,sourceName:'Settlements',entityId:'e',geometryId:'b',from:1,to:2}];
assert.equal(exactComponentConflicts(withSettlement,new Map([['a',['x','y']],['b',['y','z']]])).counts.pairs,1);
assert.deepEqual(exactComponentConflicts(withSettlement,new Map([['a',['x','y']],['b',['y','z']]]),true).counts,{pairs:2,annualPairOccurrences:4,annualComponentOccurrences:6});
assert.equal(componentHash(square().coordinates),componentHash([[[1,1],[1,0],[0,0],[0,1],[1,1]]]));
assert.notEqual(componentHash(square().coordinates),componentHash(square(1).coordinates));
const feature=(name,from,to,geometry=square(),wikidata='',type='POLITY',components='')=>({type:'Feature',properties:{Name:name,FromYear:from,ToYear:to,Wikidata:wikidata,Type:type,Components:components},geometry});
const duplicateSource=[feature('Old rule',1800,1806,{type:'MultiPolygon',coordinates:[square().coordinates,square(3).coordinates]}),feature('New rule',1802,1803,square()),feature('New rule',1805,1806,square()),feature('New rule',1802,1806,square(3))];
const derived=deriveConfirmedOverlapExclusions(duplicateSource,[{index:0,loser:/Old rule/,winner:/New rule/,from:1801,to:1805,boxes:[[-1,-1,2,2]],reason:'evidence',ru:'evidence',source:'https://example.com'}]);
assert.deepEqual(derived.map(r=>[r[2],r[3],r[7]]),[[1802,[0],1803],[1805,[0],1805]]);
const evidenceFixture=sourceComponentEvidence([{left:{sourceIndex:0,name:'A'},right:{sourceIndex:1,name:'B'},intervals:[{from:1,to:2,years:2,components:[componentHash(square(1).coordinates),'unmatched']}]}],[feature('A',1,2,{type:'MultiPolygon',coordinates:[square().coordinates,square(1).coordinates]}),feature('B',1,2,square(1))]);
assert.deepEqual(evidenceFixture[0].intervals[0].matches.map(m=>[m.left,m.right]),[[[{part:1,bbox:[1,0,2,1]}],[{part:0,bbox:[1,0,2,1]}]],[[],[]]]);
const malaccaFixture=normalizeHistoricalSource({type:'FeatureCollection',features:[feature('Sultanate of Malacca',1520,1535)]});
assert.deepEqual(malaccaFixture.records.map(r=>[r.from,r.to,r.geometryStatus]),[[1520,1528,'candidate'],[1529,1535,'rejected']]);
assert.equal(malaccaFixture.records[0].geometryId,malaccaFixture.records[1].geometryId);
const settlementFixture=normalizeHistoricalSource({type:'FeatureCollection',features:[feature('Viking settlements',1028,1325)]});
assert.equal(settlementFixture.records[0].role,'settlement');
assert.equal(settlementFixture.records[0].sourceRole,'polity');
assert.equal(settlementFixture.records[0].geometryId,sha256(JSON.stringify(square())));
const source={type:'FeatureCollection',features:[feature('A',-3400,0),feature('A',1,10),feature('Mali Federation',1960,1960,square(),'Q216632'),feature('Mali Federation',1961,2024,square(),'Q216632'),feature('Republic of Indonesia',1960,1975,square(137.5,-4.5),'Q252'),feature('(Relation)',1,2024,square(),'','RELATION','A;B'),feature('(Composite)',1,10,square(),'','POLITY','A')]};
assert.equal(stepHistoricalYear(-1,1),1);
assert.equal(stepHistoricalYear(1,-1),-1);
assert.equal(stepHistoricalYear(-3400,-1),-3400);
assert.equal(stepHistoricalYear(2024,1),2024);
const unresolvedFixture={hash:'same-canonical-footprint',geometryId:'raw-1',group:'Corsica',from:1757,to:1767,reason:'Раздельное управление',evidence:'https://example.test/first',sources:['https://example.test/map']};
const groupedFixture=historicalUnresolvedRegions(1763,[unresolvedFixture,{...unresolvedFixture,geometryId:'raw-2',evidence:'https://example.test/second'}]);
assert.equal(groupedFixture.length,1);assert.equal(groupedFixture[0].rows.length,2);assert.ok(groupedFixture[0].description.includes('1765'));assert.equal(groupedFixture[0].sources.length,3);
assert.deepEqual(historicalUnresolvedRegions(1768,[unresolvedFixture]),[]);
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
const delhiFeature=(name,from,to,components='')=>{const f=feature(name,from,to,square(),'Q229411','POLITY',components);f.properties.SeshatID='in_delhi_sultanate';if(!components)f.properties.MemberOf='(Delhi Sultanate)';return f};
const delhi=normalizeHistoricalSource({type:'FeatureCollection',features:[delhiFeature('(Delhi Sultanate)',1407,1452,'Tughlaq Dynasty'),delhiFeature('Tughlaq Dynasty',1407,1414),delhiFeature('Sayyid Dynasty',1415,1452)]});
assert.deepEqual(delhi.records.filter(r=>r.role==='composite').map(r=>[r.from,r.to,r.components[0]]),[[1407,1413,'Tughlaq Dynasty'],[1414,1450,'Sayyid Dynasty'],[1451,1452,'Lodi Dynasty']]);
assert.equal(delhi.records.find(r=>r.from===1451&&r.role==='polity').name,'Lodi Dynasty');
assert.deepEqual(delhi.records.find(r=>r.from===1451&&r.role==='composite').sourceComponents,['Tughlaq Dynasty']);
const zhou=normalizeHistoricalSource({type:'FeatureCollection',features:[feature('Later Zhou',-750,-451,square(),'Q1154556'),feature('Later Zhou',960,960,square(),'Q1154556'),feature('(Spring and Autumn States)',-750,-481,square(),'','POLITY','Later Zhou')]});
assert.equal(zhou.records[0].name,'Eastern Zhou');assert.equal(zhou.records[1].name,'Later Zhou');assert.deepEqual(zhou.records[2].components,['Eastern Zhou']);assert.deepEqual(zhou.records[2].sourceComponents,['Later Zhou']);
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
assert.ok(state.coverageGaps.some(g=>g.name==='Algeria'));
assert.deepEqual(historicalYearFeatureCollection(state).historicalCoverageGaps,state.coverageGaps);
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
if(process.env.LEKTRUS_GAP_LOCATOR_SOURCE_FILE){
 const bytes=fs.readFileSync(process.env.LEKTRUS_GAP_LOCATOR_SOURCE_FILE);
 assert.equal(sha256(bytes),'239eec57ac17f100a11e2536cffc56752c318b50ae765b0918ff7aab4ce8f255');
 const features=JSON.parse(bytes).features;
 for(const l of Object.values(historicalGapLocators)){
  const f=features.filter(f=>f.properties.ADM0_A3===l.iso);assert.equal(f.length,1);
  assert.deepEqual([l.lon,l.lat],[f[0].properties.LABEL_X,f[0].properties.LABEL_Y]);
 }
 for(const e of independentIslandGeometry){const f=features.filter(f=>f.properties.ADM0_A3===e.iso);assert.equal(f.length,1);assert.equal(f[0].properties.NE_ID,e.neId);assert.deepEqual(f[0].geometry,e.geometry);assert.equal(sha256(JSON.stringify(f[0].geometry)),e.hash);}
 console.log('10 gap map locators verified against pinned Natural Earth label anchors');
}
if(outDir&&sourceFile){
  const raw=fs.readFileSync(sourceFile);
  const input=JSON.parse(raw);
  const manifest=validateHistoricalManifest(JSON.parse(fs.readFileSync(path.join(outDir,'manifest.json'))));
  assert.equal(manifest.source.sha256,sha256(raw));
  const original=input.features.map((f,index)=>({f,index}));
  const elbaPolygon=input.features[10965].geometry.coordinates[1];
  const elbaUnionHash=componentHash(polygonClipping.union(elbaPolygon)[0]);
  const reviewedBatch=deriveTerritorialBatch(input.features);
  assert.equal(reviewedBatch.count,989);
  const batchByYear=new Map();
  for(const r of territorialBatch.rows)for(let year=r.from;year<=r.to;year++){if(year===0)continue;if(!batchByYear.has(year))batchByYear.set(year,[]);batchByYear.get(year).push(r);}
  const decisionsByKey=new Map(reviewedBatch.resolved.map(r=>[`${r.source}:${r.part}:${r.from}:${r.to}`,r]));
  const extensionsByYear=new Map();for(const r of reviewedBatch.extensions)for(let year=r.from;year<=r.to;year++){if(!extensionsByYear.has(year))extensionsByYear.set(year,[]);extensionsByYear.get(year).push(r)}
  const pendingExtensionsByYear=new Map();for(const r of reviewedBatch.pendingExtensions)for(let year=r.from;year<=r.to;year++){if(!pendingExtensionsByYear.has(year))pendingExtensionsByYear.set(year,[]);pendingExtensionsByYear.get(year).push(r)}
  let batchReady=0,batchPending=0,batchResolved=0,extended=0,sourceRecordYears=0,restoredRecordYears=0,externalRecordYears=0,datedRecordYears=0,unresolvedRegionYears=0,unresolvedSourceYears=0;
  let checkedSupplementYears=0,unresolvedExactComponentYears=0,unresolvedExactSourceYears=0;
  const territorialOpenByGroup={},exactOpenByGroup={},documentedCoreByGroup={};
  const ringArea=r=>Math.abs(r.slice(1).reduce((a,p,i)=>a+r[i][0]*p[1]-p[0]*r[i][1],0))/2;
  const area=g=>g.reduce((a,p)=>a+ringArea(p[0])-p.slice(1).reduce((s,r)=>s+ringArea(r),0),0);
  const bounds=p=>p[0].reduce((a,[x,y])=>[Math.min(a[0],x),Math.min(a[1],y),Math.max(a[2],x),Math.max(a[3],y)],[Infinity,Infinity,-Infinity,-Infinity]);
  const intersect=(a,b)=>{try{return polygonClipping.intersection(a,b);}catch(e){const snap=p=>p.map(r=>r.map(([x,y])=>[Math.round(x*1e7)/1e7,Math.round(y*1e7)/1e7]));return polygonClipping.intersection(snap(a),snap(b));}};
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
    const partCache=new Map(),parts=id=>{if(!partCache.has(id)){const g=pack.geometries[id];partCache.set(id,(g.type==='Polygon'?[g.coordinates]:g.coordinates).map(p=>[bounds(p),p]));}return partCache.get(id);};
    packCount++;
    for(const [id,geometry] of Object.entries(pack.geometries)){assert.equal(sha256(JSON.stringify(geometry)),id);allGeometries.add(id);}
    for(const r of pack.records){
      seen.add(r.id);
      if(r.externalGeography){
        const e=independentIslandGeometry.find(x=>x.iso===r.externalGeography.iso),d=independentIslands.states.find(x=>x.iso===r.externalGeography.iso);assert.ok(e&&d);
        assert.equal(r.sourceIndex,e.neId);assert.equal(r.sourceFrom,d.from);assert.equal(r.sourceTo,2024);assert.equal(r.externalGeography.datasetHash,independentIslands.source.sha256);
        assert.deepEqual(pack.geometries[r.geometryId],{type:'MultiPolygon',coordinates:e.geometry.type==='Polygon'?[e.geometry.coordinates]:e.geometry.coordinates});
        assert.ok(r.review.reasonRu.includes('не является исторической съёмкой'));continue;
      }
      const f=input.features[r.sourceIndex];
      assert.equal(r.sourceRole??r.role,f.properties.Type==='RELATION'?'relation':f.properties.Components?'composite':'polity');assert.equal(r.sourceName,f.properties.Name.trim());
      if(r.role==='settlement'){assert.equal(r.sourceName,'Viking settlements');assert.ok(r.review?.sources.length);}
      const list=v=>String(v??'').split(';').map(s=>s.trim()).filter(Boolean);
      assert.deepEqual(r.sourceComponents??r.components,list(f.properties.Components));assert.deepEqual(r.sourceMemberOf??r.memberOf,list(f.properties.MemberOf));
      assert.equal(r.sourceFrom,f.properties.FromYear);assert.equal(r.sourceTo,f.properties.ToYear);
      if(r.datedGeography){const d=r.datedGeography,f=input.features[r.sourceIndex],raw=f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates;assert.equal(f.properties.FromYear,d.referenceYear);const outline=d.parts.map(i=>raw[i]);assert.deepEqual(pack.geometries[d.outlineGeometryId],{type:'MultiPolygon',coordinates:outline});let coords=outline;for(const id of d.trimGeometryIds)coords=polygonClipping.difference(coords,pack.geometries[id].coordinates);assert.deepEqual(pack.geometries[r.geometryId],{type:'MultiPolygon',coordinates:coords});continue;}
      if(r.boundaryAdjustment){const a=r.boundaryAdjustment,base=pack.geometries[a.baseGeometryId],coords=partitionHistoricalGeometry(base.type==='Polygon'?[base.coordinates]:base.coordinates,a.cuts.map(c=>pack.geometries[c.cutGeometryId].coordinates));if(a.exhausted)assert.equal(coords.length,0);else assert.deepEqual(pack.geometries[r.geometryId],{type:'MultiPolygon',coordinates:coords});}
      assert.equal(r.sourceGeometryId??r.boundaryAdjustment?.baseGeometryId??r.geometryId,sourceHashes.get(r.sourceIndex));
      if(r.sourceGeometryId){
        const orig=f.geometry,repaired=pack.geometries[r.boundaryAdjustment?.baseGeometryId??r.geometryId];
        if(r.mapPartition?.kind==='documented-core'){
          const definition=documentedCores.find(c=>c.periods.some(p=>p.source===r.sourceIndex&&p.from===r.from&&p.to===r.to));
          assert.ok(definition);const d=definition.periods.find(p=>p.source===r.sourceIndex&&p.from===r.from&&p.to===r.to),index=d.part??definition.part,outline=(f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates)[index];
          assert.equal(sourceComponentHash(outline),definition.hash);
          assert.deepEqual(pack.geometries[r.mapPartition.outlineGeometryId],{type:'MultiPolygon',coordinates:[outline]});
          assert.deepEqual(repaired,buildDocumentedCore(outline,definition));
          assert.deepEqual(r.geometryParts,[{index:d.source,part:index}]);
          assert.equal(r.name,d.name);
        }
        else if(r.mapPartition){assert.deepEqual(pack.geometries[r.mapPartition.outlineGeometryId],{type:'MultiPolygon',coordinates:[elba1797Partition.outline]});assert.deepEqual(repaired,buildElbaPartition()[r.mapPartition.area]);assert.deepEqual(r.geometryParts,[{index:elba1797Partition.source,part:elba1797Partition.part}]);}
        else if(['reviewed-source-components','reviewed-union-source-components','reviewed-difference-source-components'].includes(r.geometryRepair)){
          const sourcePart=({index,part})=>{const g=input.features[index].geometry;return (g.type==='Polygon'?[g.coordinates]:g.coordinates)[part]};
          for(const w of r.geometryTemporalWitnesses??[]){assert.equal(input.features[w.before.index].properties.ToYear,w.year-1);assert.equal(input.features[w.after.index].properties.FromYear,w.year+1);assert.equal(componentHash(sourcePart(w.before)),w.hash);assert.equal(componentHash(sourcePart(w.after)),w.hash);}
          const readPart=({index,part})=>{const x=input.features[index];assert.ok((x.properties.FromYear<=r.from&&x.properties.ToYear>=r.to)||r.geometryTemporalWitnesses?.some(w=>w.before.index===index&&w.before.part===part&&w.year===r.from&&w.year===r.to));return sourcePart({index,part})};
          const parts=r.geometryParts.map(readPart);
          assert.deepEqual(repaired,{type:'MultiPolygon',coordinates:r.geometryRepair==='reviewed-difference-source-components'?polygonClipping.difference(polygonClipping.union(...parts),...r.geometrySubtractions.map(readPart)):r.geometryRepair==='reviewed-union-source-components'?polygonClipping.union(...parts):parts});
        }else{assert.equal(r.geometryRepair,'retracted-zero-area-interior-edges');assert.equal(orig.type,repaired.type);const shells=g=>(g.type==='Polygon'?[g.coordinates]:g.coordinates).map(p=>p[0]);assert.deepEqual(shells(orig),shells(repaired));}
      }
    }
    for(let year=block.to;year>=block.from;year--){
      if(year===0)continue;
      const expected=original.filter(({f})=>f.properties.FromYear<=year&&f.properties.ToYear>=year).map(({index})=>index);
      const state=historicalYearState(pack,year);
      const sourceRecords=state.records.filter(r=>!r.editorialRestoration&&!r.externalGeography&&!r.datedGeography);
      for(const r of sourceRecords){
        const rule=historicalTitleCorrections.find(([name,qid,from,to])=>r.sourceName===name&&r.sourceWikidata===qid&&year>=from&&year<=to);
        if(rule){assert.equal(r.name,rule[4],`Incorrect historical title ${r.sourceIndex}/${year}`);assert.equal(r.nameRu,rule[5]);assert.ok(r.review.sources.includes(rule[6]));}
      }
      assert.deepEqual(sourceRecords.map(r=>r.sourceIndex),expected,`Incorrect active source records at ${year}`);
      sourceRecordYears+=sourceRecords.length;restoredRecordYears+=state.records.filter(r=>r.editorialRestoration).length;externalRecordYears+=state.records.filter(r=>r.externalGeography).length;datedRecordYears+=state.records.filter(r=>r.datedGeography).length;
      for(const {record:r} of state.drawable.filter(({record})=>record.datedGeography||record.externalGeography?.kind==='modern-stable-land-border')){
        checkedSupplementYears++;
        for(const {record:o} of state.drawable)if(o.id!==r.id){
          let overlap=0;
          for(const [a,q] of parts(r.geometryId))for(const [b,t] of parts(o.geometryId))if(a[0]<=b[2]&&a[2]>=b[0]&&a[1]<=b[3]&&a[3]>=b[1])overlap+=area(intersect(q,t));
          assert.ok(overlap<1e-5,`Material land overlap ${year}: ${r.name}/${o.name} (${overlap} square degrees)`);
        }
      }
      assert.equal(state.records.length,state.drawable.length+state.overlays.length+state.rejected.length);
      assert.ok(state.drawable.every(r=>r.record.geometryStatus==='candidate'&&r.geometry));
      assert.equal(historicalYearFeatureCollection(state).features.length,state.drawable.length);
      assert.equal(historicalYearFeatureCollection(state,true).features.length,state.drawable.length+state.overlays.length);
      const activeRecords=new Map(sourceRecords.map(r=>[r.sourceIndex,r]));
      for(const d of independentIslands.states){
        const candidates=state.drawable.filter(({record})=>record.externalGeography?.iso===d.iso);
        assert.equal(candidates.length,year>=d.from?1:0,`${d.iso}/${year}`);
        if(candidates.length){const {record}=candidates[0];assert.equal(record.name,d.transition&&year>=d.transition.year?d.transition.name:d.name);assert.ok(record.review.sources.includes(independentIslands.source.url));}
      }
      for(const d of territorialResolutions.independenceGapRestorations)if(d.from===d.to&&year===d.from){
        const owners=state.drawable.filter(({record})=>record.editorialRestoration&&record.sourceIndex===d.source&&record.name===d.name);
        assert.equal(owners.length,1,`${d.name}/${year}`);assert.equal(owners[0].geometry.coordinates.length,d.parts.length);
      }
      if(year===1944){
        const target=activeRecords.get(12942),island=input.features[12901].geometry.coordinates[4];
        assert.equal(target.name,'Free French');assert.equal(target.geometryTemporalWitnesses.length,1);assert.ok(target.geometryParts.some(p=>p.index===12901&&p.part===4));
        const normalizedHash=componentHash(polygonClipping.union(island)[0]);
        const owners=state.drawable.filter(({geometry})=>(geometry.type==='Polygon'?[geometry.coordinates]:geometry.coordinates).some(p=>componentHash(p)===normalizedHash||componentHash(p)==='c6112dfe98f227b48dbd7df302405c9bd2abbe65204887ced3463de80aa1ac44'));
        assert.deepEqual(owners.map(({record})=>record.sourceIndex),[12942]);
      }
      const hasPart=(record,index,part)=>record&&record.geometryStatus==='candidate'&&(record.geometryParts?record.geometryParts.some(p=>p.index===index&&p.part===part):record.sourceIndex===index);
      for(const [source,target,from,to,losers,winners] of [...secondaryExactReviews,...thirdExactReviews,...fourthExactReviews,...fifthExactReviews,...sixthExactReviews,...provisionalExactReviews])if(from<=year&&year<=to){
        assert.ok(losers.every(part=>!hasPart(activeRecords.get(source),source,part)),`Secondary duplicate ${source}/${year}`);
        const winner=activeRecords.get(target);assert.ok(winners.every(part=>hasPart(winner,target,part)),`Missing secondary counterpart ${target}/${year}`);
        assert.ok(winners.every(part=>winner.territorialAttributions?.some(note=>note.part===part&&note.from<=year&&year<=note.to)));
      }
      if(year>=587&&year<=773)for(const r of sourceRecords.filter(r=>r.sourceName==='Kingdom of Italy'&&r.sourceWikidata==='Q172579'))assert.equal(r.name,'Kingdom of the Lombards');
      if(year>=644&&year<=646){const r=activeRecords.get(2453);assert.equal(r.name,'Kingdom of the Lombards');const note=r.territorialAttributions.find(n=>n.part===2);assert.match(note.group,/Вероятная/);assert.match(note.reason,/гипотезу/);assert.ok(note.sources.length>=3);}
      for(const [source,target,from,to,left,right,title] of exactConflictPendingReviews)if(from<=year&&year<=to){
        for(const [i,part] of left.entries()){
          assert.ok(!hasPart(activeRecords.get(source),source,part)&&!hasPart(activeRecords.get(target),target,right[i]),`Uncertain pair retained as a political claim ${source}/${target}/${year}`);
          const group=exactConflictGroupPrefix+title;
          const a=state.territorialIssues.find(n=>n.sourceIndex===source&&n.part===part&&n.group===group),b=state.territorialIssues.find(n=>n.sourceIndex===target&&n.part===right[i]&&n.group===group);
          assert.ok(a&&b&&a.hash===b.hash&&componentHash(a.geometry.coordinates)===componentHash(b.geometry.coordinates));
          assert.ok(!state.drawable.some(({geometry})=>(geometry.type==='Polygon'?[geometry.coordinates]:geometry.coordinates).some(p=>componentHash(p)===a.hash)),`Uncertain contour rendered by another polity ${year}/${title}`);
        }
      }
      const earlyComoros=earlyComorosRoutes.find(([, ,from,to])=>from<=year&&year<=to);
      if(earlyComoros){
        const [source,first]=earlyComoros;
        for(let i=0;i<4;i++)assert.ok(!hasPart(activeRecords.get(source),source,first+i));
        for(let i=0;i<3;i++){
          const candidates=state.drawable.filter(({record,geometry})=>record.editorialRestoration&&geometry.coordinates.some(p=>componentHash(p)===earlyComorosHashes[i]));
          assert.equal(candidates.length,1,`Missing local Comorian island ${i}/${year}`);
          assert.match(candidates[0].record.name,/^(Mayotte|Mohéli|Anjouan)/);
        }
        assert.ok(state.territorialIssues.some(i=>i.sourceIndex===source&&i.hash===earlyComorosHashes[3]));
      }
      if(year===1842){assert.ok(!hasPart(activeRecords.get(11399),11399,8));assert.ok(!hasPart(activeRecords.get(11329),11329,1));assert.ok(state.drawable.some(({record})=>record.name==='Mayotte (cession treaty pending ratification)'));}
      if(year>=1840&&year<=1845)assert.ok(!hasPart(activeRecords.get(11329),11329,6),'Akaroa settlement is not French India');
      for(const item of batchByYear.get(year)??[]){
        const record=activeRecords.get(item.source);assert.ok(record,`Missing reviewed record ${item.source}/${year}`);
        const decision=decisionsByKey.get(`${item.source}:${item.part}:${item.from}:${item.to}`);
        if(decision?.mode==='relabel'&&item.source===decision.target)assert.equal(record.name,'Saint Croix (United States Virgin Islands)');
        else assert.ok(!hasPart(record,item.source,item.part),`Wrong political component retained ${item.source}/${item.part}/${year}`);
        if(item.status==='ready'){
          assert.ok(item.otherParts.some(p=>hasPart(activeRecords.get(item.other),item.other,p)),`Correct exact counterpart lost ${item.other}/${year}`);batchReady++;
        }else if(decision){
          assert.ok(!state.territorialIssues.some(i=>i.sourceIndex===item.source&&i.part===item.part&&i.hash===item.hash),`Resolved issue still pending ${item.source}/${year}`);
          if(decision.mode==='retained'){
            const target=activeRecords.get(decision.target);assert.ok(item.otherParts.some(p=>hasPart(target,item.other,p)),`Verified attributed contour missing ${item.other}/${year}`);
            assert.ok(target.territorialAttributions.some(n=>n.hash===item.hash&&n.from<=year&&n.to>=year&&n.sources.length),`Missing dated status for ${item.other}/${year}`);
          }else if(decision.mode==='restored'){
            const matching=state.drawable.filter(({record,geometry})=>record.editorialRestoration&&record.sourceIndex===decision.target&&geometry.coordinates.some(p=>componentHash(p)===item.hash));
            assert.equal(matching.length,1,`Missing or duplicate restored island ${item.group}/${year}`);
            if(['Мэн (лордство)','Манус','Никобары'].includes(item.group))assert.ok(item.otherParts.every(p=>!hasPart(activeRecords.get(item.other),item.other,p)));
            if(item.group==='Никобары')assert.ok(matching[0].record.name.includes(year===1868?'annexation pending':'British India'));
          }else if(decision.mode==='transfer'){
            const targets=state.drawable.filter(({record})=>(item.group==='Цейлон'?record.name==='Kingdom of Kandy':record.sourceName==='County of Savoy')&&record.geometryRepair==='reviewed-union-source-components'&&record.geometryParts.some(p=>componentHash((input.features[p.index].geometry.type==='Polygon'?[input.features[p.index].geometry.coordinates]:input.features[p.index].geometry.coordinates)[p.part])===item.hash));
            assert.equal(targets.length,1,`Missing transfer ${item.group}/${year}`);
          }else{
            const target=activeRecords.get(decision.target);assert.equal(target.name,'Saint Croix (United States Virgin Islands)');assert.equal(target.geometryStatus,'candidate');
          }
          batchResolved++;
        }else if(item.group==='Эльба'&&year>=1797&&year<=1798){
          const restored=state.drawable.filter(({record})=>record.mapPartition);assert.equal(restored.length,3);assert.equal(state.territorialIssues.filter(i=>i.group==='Эльба').length,0);assert.deepEqual(restored.map(({record})=>record.mapPartition.area).sort(),[0,1,2]);batchResolved++;
        }else{
          const issue=state.territorialIssues.find(i=>i.sourceIndex===item.source&&i.part===item.part&&i.hash===item.hash);
          assert.ok(issue&&componentHash(issue.geometry.coordinates)===item.hash,`Unresolved geometry lost ${item.source}/${item.part}/${year}`);batchPending++;
        }
      }
      for(const item of extensionsByYear.get(year)??[]){
        assert.ok(!hasPart(activeRecords.get(item.source),item.source,item.part),`Adjacent misattribution retained ${item.source}/${year}`);
        if(item.mode==='transfer'){const target=activeRecords.get(item.target);assert.equal(target.geometryRepair,'reviewed-union-source-components');assert.ok(item.group==='Цейлон'?target.geometryParts.some(p=>componentHash((input.features[p.index].geometry.type==='Polygon'?[input.features[p.index].geometry.coordinates]:input.features[p.index].geometry.coordinates)[p.part])===item.hash):hasPart(target,item.source,item.part));}
        else if(item.other!==undefined){const target=activeRecords.get(item.other);assert.ok(hasPart(target,item.other,item.otherPart));assert.ok(target.territorialAttributions.some(n=>n.hash===item.hash&&n.from<=year&&n.to>=year));}
        else assert.equal(state.drawable.filter(({record,geometry})=>record.editorialRestoration&&record.sourceIndex===item.source&&geometry.coordinates.some(p=>componentHash(p)===item.hash)).length,1,`Adjacent restoration missing ${item.group}/${year}`);
        extended++;
      }
      for(const item of pendingExtensionsByYear.get(year)??[]){
        assert.ok(!hasPart(activeRecords.get(item.source),item.source,item.part));
        assert.ok(state.territorialIssues.some(i=>i.sourceIndex===item.source&&i.hash===item.hash&&componentHash(i.geometry.coordinates)===item.hash));
      }
      if(year>=1416&&year<=1539)assert.equal(sourceRecords.find(r=>r.sourceName==='County of Savoy')?.name,'Duchy of Savoy');
      if(year>=1540&&year<=1563){
        const nice=state.drawable.filter(({record})=>record.editorialRestoration&&record.name==='County of Nice (Duchy of Savoy)');
        assert.equal(nice.length,1);
        assert.ok(nice[0].record.review.reasonRu.includes('временный военный контроль'));
        const france=state.drawable.find(({record})=>record.sourceName==='Kingdom of France'&&record.geometryRepair==='reviewed-difference-source-components');
        assert.ok(france&&france.record.geometrySubtractions.some(p=>p.index===(year<=1546?8090:8124)&&p.part===2));
        for(const entry of state.drawable)if(entry!==nice[0])assert.equal(polygonClipping.intersection(entry.geometry.coordinates,nice[0].geometry.coordinates).length,0,`Nice overlaps ${entry.record.name}/${year}`);
      }
      const mindanaoIssues=state.territorialIssues.filter(i=>i.group==='Mindanao');
      const core=state.drawable.filter(({record})=>record.mapPartition?.kind==='documented-core');
      const corePeriod=documentedCores.flatMap(c=>c.periods).find(p=>p.from<=year&&year<=p.to);
      assert.equal(core.length,corePeriod?1:0);
      if(corePeriod){
        const definition=documentedCores.find(c=>c.periods.includes(corePeriod));
        documentedCoreByGroup[definition.id]=(documentedCoreByGroup[definition.id]??0)+1;
        assert.equal(core[0].record.name,corePeriod.name);
        if(year>=1757){
          assert.ok(capitalInsideCountry([9.4108,42.86],core[0].geometry));
          assert.ok(!capitalInsideCountry([9.151,42.306],core[0].geometry));
          assert.equal(state.territorialIssues.filter(i=>i.group===(year===1768?exactConflictGroupPrefix+'Корсика — переход 1768 года':'Corsica')).length,2);
        }else{
          assert.ok(capitalInsideCountry([102.249609,2.192621],core[0].geometry));
          assert.ok(!capitalInsideCountry([102.0913,2.5897],core[0].geometry));
        }
        for(const other of state.drawable)if(other!==core[0])assert.equal(polygonClipping.intersection(core[0].geometry.coordinates,other.geometry.coordinates).length,0,`Documented core overlaps ${other.record.name}/${year}`);
      }
      if(year>=1512&&year<=1608){
        assert.equal(mindanaoIssues.length,year>=1521&&year<=1581?2:1);
        assert.ok(mindanaoIssues.every(i=>i.sources?.length>=3&&i.sources.every(s=>s.startsWith('https://'))));
        if(year<=1581)assert.ok(!hasPart(activeRecords.get(7792),7792,7));
        if(year>=1521)assert.equal(activeRecords.get(7904).geometryStatus,'rejected');
      }else assert.equal(mindanaoIssues.length,0);
      const expectedCenters=[...(year>=1521&&year<=1608?['maguindanao']:[]),...(year>=1521&&year<=1565?['butuan']:[]),...(year>=1579&&year<=1608?['buayan']:[]),...(year===1515?['malabang']:[]),...(year===1521?['kipit']:[]),...(year===1578?['butuan-1578']:[]),...(year>=1757&&year<=1767?['corte','bastia','saint-florent',year<1764?'algajola-genoa':year===1767?'algajola-1767':'algajola','ajaccio','calvi','bonifacio']:[]),...(year>=1757&&year<=1762?['cap-corse']:[]),...(year>=1677&&year<=1845?['iconi','itsandra','ntsudjini']:[]),...(year===1844?['moroni-1844','mitsamiouli-1844']:[]),...(year>=1641&&year<=1647?['melaka','linggi-estuary','kesang-estuary']:[])];
      if(year>=1641&&year<=1647){
        const issues=state.territorialIssues.filter(i=>i.group==='Малакка');
        assert.equal(issues.length,year<1645?1:2);
        assert.ok(issues.every(i=>i.sources.length>=4));
        assert.ok(!hasPart(activeRecords.get(8866),8866,11));
        if(year>=1645)assert.ok(!hasPart(activeRecords.get(8910),8910,10));
      }
      if(year===1640)assert.ok(hasPart(activeRecords.get(8866),8866,11));
      if(year>=1848&&year<=1852){
        const source=year===1848?8613:11490,cell=input.features[source].geometry.coordinates;
        assert.equal(activeRecords.get(source).geometryStatus,'rejected');
        const spain=state.drawable.find(({record})=>record.sourceIndex===11140);
        assert.ok(spain&&spain.record.geometryParts.some(p=>p.index===source&&p.part===0));
        assert.equal(polygonClipping.difference(cell,spain.geometry.coordinates).length,0);
        for(const entry of state.drawable)if(entry!==spain)assert.equal(polygonClipping.intersection(entry.geometry.coordinates,cell).length,0,`Davao overlaps ${entry.record.name}/${year}`);
      }
      if(year>=1641&&year<=1647)expectedCenters.push('malacca-fort');
      if(year===1641)expectedCenters.push('naning-1641','rembau-1641');
      if(year===1646)expectedCenters.push('rembau-1646');
      if(year===1768)expectedCenters.push('corte-1768','bonifacio-1768');
      if(year>=1662&&year<=1664)expectedCenters.push('cape-coast-castle','mouri-fort');
      if(year>=1552&&year<=1555)expectedCenters.push('muscat-port');
      if(year>=1529&&year<=1539)expectedCenters.push(year<1536?'bra-imperial':'bra-french',year<1531?'cherasco-before-1531':year<=1536?'cherasco-savoy':year===1537?'cherasco-war':'cherasco-after-1537');
      if(year>=410&&year<=442)expectedCenters.push('kath-afrighid');
      const centers=historicalUnresolvedCenters(year,state.territorialIssues);
      assert.deepEqual(centers.map(c=>c.id),expectedCenters.map(id=>`historical-center-${id}`));
      if(year>=1662&&year<=1664){
        const disputed=state.territorialIssues.find(i=>i.sourceIndex===9047&&i.part===0);
        assert.ok(disputed);
        const castle=centers.find(c=>c.id==='historical-center-cape-coast-castle'),mouri=centers.find(c=>c.id==='historical-center-mouri-fort');
        assert.ok(!capitalInsideCountry([castle.lon,castle.lat],disputed.geometry));
        assert.ok(capitalInsideCountry([mouri.lon,mouri.lat],disputed.geometry));
        assert.ok(disputed.sources.length>=3);
      }
      if(year>=1529&&year<=1539){
        const disputed=state.territorialIssues.find(i=>i.sourceIndex===7955&&i.part===0);
        assert.ok(disputed&&disputed.sources.length>=4);
        for(const c of centers.filter(c=>c.id.includes('bra-')||c.id.includes('cherasco-')))assert.ok(capitalInsideCountry([c.lon,c.lat],disputed.geometry));
        assert.ok(!capitalInsideCountry([8.03,44.7],disputed.geometry),'Alba is outside the disputed footprint');
        assert.ok(!capitalInsideCountry([8.203,44.9],disputed.geometry),'Asti is outside the disputed footprint');
      }
      const regions=historicalUnresolvedRegions(year,state.territorialIssues);
      assert.equal(regions.length,new Set(state.territorialIssues.map(i=>i.hash)).size);
      assert.equal(regions.flatMap(r=>r.rows).length,state.territorialIssues.length);
      for(const r of regions){assert.ok(r.title&&r.description&&r.sources.length&&r.rows.every(i=>i.hash===r.issue.hash&&i.group===r.issue.group));assert.equal(r.year,year);}
      const exactRegions=regions.filter(r=>r.issue.group.startsWith(exactConflictGroupPrefix));
      for(const r of regions){
        const counts=r.issue.group.startsWith(exactConflictGroupPrefix)?exactOpenByGroup:territorialOpenByGroup;
        const group=r.issue.group.replace(exactConflictGroupPrefix,'');
        const count=counts[group]??={componentYears:0,sourceYears:0};
        count.componentYears++;count.sourceYears+=r.rows.length;
      }
      assert.ok(exactRegions.every(r=>r.rows.length===2&&r.rows.every(n=>n.sources?.length)));
      unresolvedExactComponentYears+=exactRegions.length;unresolvedExactSourceYears+=exactRegions.flatMap(r=>r.rows).length;
      unresolvedRegionYears+=regions.length-exactRegions.length;unresolvedSourceYears+=state.territorialIssues.length-exactRegions.flatMap(r=>r.rows).length;
      for(const issue of state.territorialIssues.filter(i=>['Corsica','Эльба','Коморы','Малакка'].includes(i.group)))assert.ok(issue.sources?.length&&issue.sources.every(s=>s.startsWith('https://')));
      for(const c of centers){assert.ok(c.url.startsWith('https://'));assert.ok(c.description.includes('Точка'));assert.ok(Number.isFinite(c.lon)&&Math.abs(c.lon)<=180&&Number.isFinite(c.lat)&&Math.abs(c.lat)<=90);assert.equal(c.year,year);}
      assert.deepEqual(historicalUnresolvedCenters(year,[]),[]);
      if(year>=1629&&year<=1814){const kandy=state.drawable.filter(({record})=>record.name==='Kingdom of Kandy');assert.equal(kandy.length,1);assert.equal(kandy[0].record.nameRu,'Королевство Канди');assert.deepEqual(kandy[0].record.memberOf,[]);assert.ok(kandy[0].record.sourceMemberOf.length);}
      if(year>=1629&&year<=1637){
        const coast=state.drawable.filter(({record})=>record.name==='Portuguese Ceylon');assert.equal(coast.length,1);
        const [source,,,parts]=ceylonEarlyRoutes.find(([,from,to])=>year>=from&&year<=to);
        assert.deepEqual(coast[0].record.geometryParts,parts.map(part=>({index:source,part})));assert.deepEqual(coast[0].record.memberOf,['(Portuguese Empire)','(Spanish Empire)']);
        const kandy=state.drawable.find(({record})=>record.name==='Kingdom of Kandy');assert.equal(polygonClipping.intersection(coast[0].geometry.coordinates,kandy.geometry.coordinates).length,0);
        for(const point of [[79.86,6.93],[80.025,9.66],[80.22,6.03],[81.23,8.58],[81.69,7.71]]){const owners=state.drawable.filter(({geometry})=>capitalInsideCountry(point,geometry));assert.equal(owners.length,1);assert.equal(owners[0].record.id,coast[0].record.id);}
        for(const name of coast[0].record.memberOf){const o=state.overlays.find(({record})=>record.name===name);assert.ok(o&&o.record.components.includes('Portuguese Ceylon'));assert.ok(!capitalInsideCountry([80.635,7.29],o.geometry));}
      }
      if(year>=1659&&year<=1814){
        const dutch=year<1796,name=dutch?'Dutch Ceylon':'British Ceylon',group=dutch?'(Dutch Republic)':'(British Empire)';
        const candidates=state.drawable.filter(({record})=>record.name===name);assert.equal(candidates.length,1,`Missing or duplicate Ceylon coast ${year}`);
        const coast=candidates[0],kandy=state.drawable.find(({record})=>record.name==='Kingdom of Kandy');
        const [source,,,parts]=ceylonCoastalRoutes.find(([,start,end])=>year>=start&&year<=end);
        assert.deepEqual(coast.record.memberOf,[group]);assert.deepEqual(coast.record.geometryParts,parts.map(part=>({index:source,part})));
        assert.equal(polygonClipping.intersection(coast.geometry.coordinates,kandy.geometry.coordinates).length,0,`Ceylon coast intersects Kandy ${year}`);
        for(const point of [[79.86,6.93],[80.025,9.66],[80.22,6.03],...(year>=1665?[[81.23,8.58],[81.69,7.71]]:[])]){
          const owners=state.drawable.filter(({geometry})=>capitalInsideCountry(point,geometry));
          assert.equal(owners.length,1,`Ceylon port has ${owners.length} owners ${year} ${point}`);assert.equal(owners[0].record.id,coast.record.id);
        }
        if(year<1665)for(const point of [[81.23,8.58],[81.69,7.71]]){const owners=state.drawable.filter(({geometry})=>capitalInsideCountry(point,geometry));assert.equal(owners.length,1);assert.equal(owners[0].record.id,kandy.record.id);}
        const overlays=state.overlays.filter(({record})=>record.name===group||record.components.includes(name));assert.ok(overlays.length);
        for(const o of overlays){assert.ok(o.record.components.includes(name));assert.ok(!capitalInsideCountry([80.635,7.29],o.geometry),`Kandy inside imperial overlay ${year}/${o.record.sourceIndex}`);for(const part of parts)assert.ok(o.record.geometryParts.some(p=>p.index===source&&p.part===part));}
        for(const o of state.overlays.filter(({record})=>record.name==='(Portuguese Empire)')){assert.ok(!o.record.components.includes('Portuguese Ceylon'));assert.ok(!capitalInsideCountry([80.635,7.29],o.geometry));}
      }
      if(year>=1815&&year<=1859){
        const hash='c440529d0c7fde4ec1dbf13983ef01d0c128f86661e64156915318dd023a27c8';
        const island=state.drawable.filter(({geometry})=>geometry.coordinates.some(p=>{const h=componentHash(p);return h===hash||h===elbaUnionHash;}));
        assert.equal(island.length,1,`Elba must have one political attribution in ${year}`);
        assert.equal(island[0].record.name,year<=1858?'Grand Duchy of Tuscany':'Elba (Provisional Government of Tuscany)');
        if(year<=1858){
          const florence=state.drawable.filter(({geometry})=>capitalInsideCountry([11.2558,43.7696],geometry));
          assert.equal(florence.length,1,`Florence must have one political attribution in ${year}`);
          assert.equal(florence[0].record.entityId,island[0].record.entityId);
        }
      }
      if(year===1794||year===1795){
        const island=state.drawable.filter(({record,geometry})=>record.role==='polity'&&geometry.coordinates.some(p=>componentHash(p)==='c6112dfe98f227b48dbd7df302405c9bd2abbe65204887ced3463de80aa1ac44'));
        assert.equal(island.length,1);assert.equal(island[0].record.name,'Anglo-Corsican Kingdom');
      }
      if(year===1796){
        const corsica=input.features[10403].geometry.coordinates[5];
        const france=activeRecords.get(10427);
        assert.equal(france.name,'French Directory');
        assert.ok(hasPart(france,10403,5));
        assert.equal(polygonClipping.difference(corsica,pack.geometries[france.geometryId].coordinates).length,0);
      }
      if(year===1861){const italy=activeRecords.get(11691);assert.equal(italy.name,'Kingdom of Italy');assert.equal(italy.nameRu,'Королевство Италия');assert.equal(italy.nameStatus,'reviewed');}
      for(const [start,end,name,gap,parts] of [[1964,1966,'Malta','Malta',1],[1965,1966,'The Gambia','The Gambia',1],[1970,1972,'Fiji','Fiji',3],[1971,1972,'State of Qatar','Qatar',1],[1971,1972,'Bahrain','Bahrain',1],[1974,1975,'Grenada','Grenada',1],[1977,1978,'Republic of Djibouti','Djibouti',1],[1981,1982,'Belize','Belize',1],[1994,1995,'Palau','Palau',1],[1973,1975,'Seychelles (British colony)',null,1]])if(year>=start&&year<=end){
        const country=state.drawable.filter(({record})=>record.name===name);
        assert.equal(country.length,1,`${name}/${year}`);assert.ok(country[0].record.editorialRestoration);assert.equal(country[0].geometry.coordinates.length,parts);
        if(gap)assert.ok(!state.coverageGaps.some(g=>g.name===gap),`${gap}/${year} still missing`);
        const restoredHashes=new Set(country[0].geometry.coordinates.map(componentHash));
        for(const other of state.drawable.filter(e=>e!==country[0]))assert.ok(!other.geometry.coordinates.some(p=>restoredHashes.has(componentHash(p))),`Duplicate restored component ${name}/${year}/${other.record.name}`);
      }
      if(year>=1979&&year<=1982){assert.equal(activeRecords.get(13415).name,year===1979?'New Hebrides':'Vanuatu');if(year>=1980)assert.ok(!state.coverageGaps.some(g=>g.name==='Vanuatu'));}
      if(year>=1967&&year<=2023)assert.equal(activeRecords.get(13285).name,year<1970?'The Gambia':'Republic of The Gambia');
      if(year>=1973&&year<=2023){assert.equal(activeRecords.get(13329).name,year<1987?'Fiji':'Republic of Fiji');assert.equal(activeRecords.get(13327).name,year<2002?'Bahrain':'Kingdom of Bahrain');}
      if(year>=1975){
        const comoros=state.drawable.filter(({record})=>record.name==='Comoros');
        assert.equal(comoros.length,1);assert.equal(comoros[0].geometry.coordinates.length,3);
        assert.equal(comoros[0].record.editorialRestoration,true);
        assert.ok(!state.coverageGaps.some(g=>g.name==='Comoros'));
        const mayotteHash='5e8c3940ad185cbe4cf1af0d7f420aeaaa9bead9e850dd11ecbb7a72f850de2a';
        const mayotte=state.drawable.filter(({record,geometry})=>geometry.coordinates.some(p=>componentHash(p)===mayotteHash)||hasPart(record,13646,6));
        assert.equal(mayotte.length,1);assert.equal(mayotte[0].record.name,'French Fifth Republic');
        assert.equal(polygonClipping.difference(input.features[13646].geometry.coordinates[6],mayotte[0].geometry.coordinates).length,0);
      }
      for(const [y,source,part,name] of [[1802,10561,14,'French Consulate'],[1814,10892,4,'Principality of Elba'],[1943,12901,4,'Free French'],[1944,12928,13,'Kingdom of Italy']])if(year===y){
        const cell=input.features[source].geometry.coordinates[part],hash=componentHash(cell);
        const island=state.drawable.filter(({record,geometry})=>geometry.coordinates.some(p=>componentHash(p)===hash)||hasPart(record,source,part));
        assert.equal(island.length,1);assert.equal(island[0].record.name,name);
        assert.equal(polygonClipping.difference(cell,island[0].geometry.coordinates).length,0);
      }
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
      const bySourceName=new Map();for(const r of state.records){if(!bySourceName.has(r.name))bySourceName.set(r.name,[]);bySourceName.get(r.name).push(r)}
      const groupLinkWarnings=[];
      for(const r of state.records){
        for(const component of r.components){const active=bySourceName.get(component);if(!active)groupLinkWarnings.push({kind:'missing-component',group:r.sourceName,component,sourceIndex:r.sourceIndex});else if(active.length>1)groupLinkWarnings.push({kind:'ambiguous-component',group:r.sourceName,component,sourceIndex:r.sourceIndex})}
        for(const group of r.memberOf){if(!bySourceName.get(group)?.some(g=>g.role!=='polity'&&g.components.includes(r.name)))groupLinkWarnings.push({kind:'unmatched-membership',group,component:r.name,sourceIndex:r.sourceIndex})}
      }
      const membershipWarnings=referenceAdmissionWarnings(year,state.drawable.map(r=>r.record.name));
      assert.deepEqual(state.coverageGaps,membershipWarnings,`Coverage gaps not preserved at ${year}`);
      if(identityCollisions.length)yearsWithIdentityCollisions++;
      if(sharedGeometry.length)yearsWithSharedGeometry++;
      admissionWarnings+=membershipWarnings.length;
      years++;recordYears+=state.records.length;rejectedYears+=state.rejected.length;if(!state.records.length)emptyYears++;
      rows.push({year,status:state.status,records:state.records.length,drawable:state.drawable.length,overlays:state.overlays.length,rejected:state.rejected.length,identityCollisions,sharedGeometry,expectedLayerOverlaps,groupLinkWarnings,membershipWarnings,semanticReview:'not-complete',visualReview:'pending'});
    }
  }
  assert.equal(years,5424);
  assert.equal(batchReady,293);assert.equal(batchResolved,541);assert.equal(batchPending,155);
  assert.equal(sourceRecordYears,254984);assert.equal(restoredRecordYears,995);assert.equal(externalRecordYears,469);assert.equal(extended,693);assert.equal([...pendingExtensionsByYear.values()].flat().length,43);
  assert.equal(unresolvedSourceYears,363);assert.equal(unresolvedRegionYears,284);
  assert.equal(fifthExactReviews.reduce((sum,[,,from,to,parts])=>sum+(to-from+1)*parts.length,0),18);
  assert.equal(sixthExactReviews.reduce((sum,[,,from,to,parts])=>sum+(to-from+1)*parts.length,0),2);
  assert.equal(exactConflictPendingReviews.length,8);
  assert.equal(unresolvedExactComponentYears,94);assert.equal(unresolvedExactSourceYears,188);
  const provisionalComponentYears=provisionalExactReviews.reduce((sum,[,,from,to,parts])=>sum+(to-from+1)*parts.length,0);
  assert.equal(provisionalExactReviews.length,1);assert.equal(provisionalComponentYears,3);
  assert.deepEqual(Object.fromEntries(Object.entries(territorialOpenByGroup).map(([g,v])=>[g,v.sourceYears])),{Mindanao:158,Corsica:22,'Коморы':173,'Малакка':10});
  assert.equal(Object.values(exactOpenByGroup).reduce((sum,v)=>sum+v.componentYears,0),unresolvedExactComponentYears);
  assert.deepEqual(documentedCoreByGroup,{'cap-corse':8,'malacca-fort':7});
  const groupLinkIssues=rows.flatMap(r=>r.groupLinkWarnings??[]);
  assert.equal(new Set(groupLinkIssues.map(i=>JSON.stringify(i))).size,32);assert.equal(groupLinkIssues.length,248);
  const auditLedger={territorial:{total:2908,resolved:2908-unresolvedSourceYears,open:unresolvedSourceYears,openRegionYears:unresolvedRegionYears,openByGroup:territorialOpenByGroup},exactPairs:{total:82,resolved:82-exactConflictPendingReviews.length,confirmed:82-exactConflictPendingReviews.length-provisionalExactReviews.length,provisional:provisionalExactReviews.length,provisionalComponentYears,open:exactConflictPendingReviews.length,openComponentYears:unresolvedExactComponentYears,openSourceYears:unresolvedExactSourceYears,openByGroup:exactOpenByGroup},partialReconstructions:{componentYears:Object.values(documentedCoreByGroup).reduce((a,b)=>a+b,0),byGroup:documentedCoreByGroup},groupLinks:{openGroups:new Set(groupLinkIssues.map(i=>JSON.stringify(i))).size,openAnnualOccurrences:groupLinkIssues.length}};
  console.log(`Historical audit ledger: ${JSON.stringify(auditLedger)}`);
  assert.equal(admissionWarnings,1,'Independent-state coverage must not regress');
  assert.deepEqual(rows.filter(r=>r.membershipWarnings?.length).map(r=>[r.year,...r.membershipWarnings.map(w=>w.name)]),[[1971,'United Arab Emirates']]);
  assert.equal(historicalGapLocators['United Arab Emirates'].iso,'ARE');
  assert.match(historicalGapLocators['United Arab Emirates'].historicalNote,/10 февраля 1972/);
  assert.equal(datedRecordYears,43);assert.equal(checkedSupplementYears,111);
  console.log(`Reviewed batch: ${batchReady} original corrections; ${batchResolved} newly resolved attributions; ${batchPending} open; ${extended} adjacent cases; ${restoredRecordYears} restored territory-years`);
  assert.equal(seen.size,manifest.counts.revisions);
  assert.equal(allGeometries.size,manifest.counts.uniqueGeometries);
  const revisionAt=(year,index)=>{const b=historicalBlockForYear(manifest,year);const p=JSON.parse(fs.readFileSync(path.join(outDir,b.file)));return historicalYearState(p,year).records.find(r=>r.sourceIndex===index)};
  for(let year=1967;year<=2024;year++)assert.equal(revisionAt(year,year===2024?13678:13297).name,'Saint Croix (United States Virgin Islands)');
  assert.equal(revisionAt(1800,10558).name,'Kingdom of Great Britain');
  assert.equal(revisionAt(1801,10558).name,'United Kingdom of Great Britain and Ireland');
  assert.equal(revisionAt(1927,12623).name,'United Kingdom of Great Britain and Northern Ireland');
  assert.deepEqual(revisionAt(1969,13305).geometryParts.map(p=>p.part),[2,3,4,5,6,7,13,14]);
  assert.deepEqual(revisionAt(2024,13684).geometryParts.map(p=>p.part),[1,2,3,4,5,6,7,8]);
  assert.deepEqual(revisionAt(1985,11956).geometryParts.map(p=>p.part),[1,2,3,4]);
  assert.deepEqual(revisionAt(1986,11956).geometryParts.map(p=>p.part),[1,2,4]);
  assert.equal(revisionAt(2009,11956).geometryStatus,'candidate');
  assert.equal(revisionAt(2010,11956).geometryStatus,'rejected');
  assert.equal(revisionAt(2024,13642).geometryStatus,'rejected');
  assert.equal(revisionAt(2024,13708).geometryStatus,'rejected');
  assert.equal(revisionAt(2024,13753).geometryStatus,'rejected');
  assert.equal(revisionAt(1974,13277).name,'Portugal');
  assert.deepEqual(revisionAt(1975,13277).geometryParts.map(p=>p.part),[7,8,9,10,20,21]);
  assert.equal(revisionAt(1999,13399).geometryParts,undefined);
  assert.deepEqual(revisionAt(2000,13399).geometryParts.map(p=>p.part),[1,2,3,4,5,6]);
  assert.deepEqual(revisionAt(2024,13659).geometryParts,[{index:13659,part:0},{index:13753,part:0}]);
  assert.equal(revisionAt(2018,13552).name,'Former Yugoslav Republic of Macedonia');
  assert.equal(revisionAt(2019,13552).name,'Republic of North Macedonia');
  assert.equal(revisionAt(1991,13369).entityId,revisionAt(1992,13369).entityId);
  const partsAt=(year,index)=>revisionAt(year,index).geometryParts?.map(r=>r.part);
  // Bounded exclusions must not suppress territory outside the dated overlap.
  assert.equal(partsAt(1802,10461),undefined);
  assert.deepEqual(partsAt(1803,10461),[1]);
  assert.deepEqual(partsAt(1805,10461),[1]);
  assert.equal(partsAt(1806,10461),undefined);
  assert.equal(revisionAt(1804,10461).name,'Sierra Leone Company settlement');
  assert.equal(revisionAt(1806,10461).name,'British Cape and Sierra Leone possessions (source aggregate)');
  assert.equal(revisionAt(1706,9410).name,'English Colonial Empire');
  assert.equal(revisionAt(1707,9410).name,'British colonial possessions (supplemental source record)');
  assert.equal(partsAt(1708,9410),undefined);
  assert.deepEqual(partsAt(1709,9410),[14,24,27,28,29]);
  assert.deepEqual(partsAt(1712,9410),[14,24,27,28,29]);
  const rawParts=index=>{const g=input.features[index].geometry;return g.type==='Polygon'?[g.coordinates]:g.coordinates};
  const rawHashes=index=>new Set(rawParts(index).map(componentHash));
  const british1709=rawHashes(9518);
  for(const part of [0,1,2,3,4,5,6,7,8,9,10,11,12,13,15,16,17,18,19,20,21,22,23,25,26,30,31,32,33,34,35,36,37])assert.ok(british1709.has(componentHash(rawParts(9410)[part])),`Missing exact British duplicate: 9410/${part}`);
  assert.equal(partsAt(1717,9553),undefined);
  assert.deepEqual(partsAt(1718,9553),[0]);
  assert.deepEqual(partsAt(1740,9553),[0]);
  assert.equal(partsAt(1741,9553),undefined);
  const bombayDuplicates=[9562,9613,9643,9675,9733],bombayHash=componentHash(rawParts(9553)[1]);
  for(const index of bombayDuplicates)assert.ok(rawHashes(index).has(bombayHash),`Missing Bombay duplicate in ${index}`);
  for(let year=1718;year<=1740;year++)assert.ok(bombayDuplicates.some(index=>{const {FromYear,ToYear}=input.features[index].properties;return FromYear<=year&&year<=ToYear}),`Missing contemporaneous Bombay record at ${year}`);
  assert.equal(partsAt(1894,12069),undefined);
  assert.deepEqual(partsAt(1895,12069),Array.from({length:22},(_,i)=>i).filter(i=>![11,12,13,14,15,17].includes(i)));
  for(const part of [11,12,13,14,15,17])assert.ok(rawHashes(12119).has(componentHash(rawParts(12069)[part])));
  assert.deepEqual(partsAt(578,1986),[0,1]); // retain African parts; Arabian transition is explicitly unresolved
  assert.deepEqual(partsAt(579,1986),[0,1]);
  assert.deepEqual(partsAt(1440,7187),[0,1,2,4,5,6]);
  assert.deepEqual(partsAt(1454,7187),[0,5]);
  assert.deepEqual(partsAt(1461,7187),[5]);
  assert.equal(revisionAt(1453,7187).name,'Byzantine Empire');
  assert.equal(revisionAt(1454,7187).name,'Byzantine remnants (unverified source aggregate)');
  assert.equal(revisionAt(1461,7187).geometryStatus,'candidate');
  assert.equal(revisionAt(1462,7187).geometryStatus,'rejected');
  assert.equal(revisionAt(1467,7187).geometryStatus,'rejected');
  assert.equal(partsAt(1539,7944),undefined);
  assert.deepEqual(partsAt(1540,7944),Array.from({length:21},(_,i)=>i).filter(i=>![13,14,17,19].includes(i)));
  assert.equal(revisionAt(1744,9806).geometryStatus,'rejected');
  assert.equal(revisionAt(1799,9806).geometryStatus,'rejected');
  assert.deepEqual(partsAt(1970,13318),Array.from({length:38},(_,i)=>i).filter(i=>![22,23,24].includes(i)));
  assert.ok(!partsAt(1971,13318).includes(22));
  assert.ok(partsAt(1972,13318).includes(5));
  assert.ok(!partsAt(1973,13318).includes(5));
  assert.deepEqual(partsAt(1985,13318),[0,18,19,20,21,37]);
  assert.equal(revisionAt(1972,13309).name,'Seychelles (British colony)');
  assert.equal(revisionAt(1973,13313).geometryStatus,'rejected');
  for(let y=1969;y<=1975;y++)assert.ok(revisionAt(y,13313).components.includes('Seychelles (British colony)'));
  for(let y=1976;y<=1995;y++)assert.ok(!revisionAt(y,13313).components.some(n=>/British East Africa|Seychelles/.test(n)));
  assert.equal(revisionAt(1943,12916).geometryStatus,'rejected');
  assert.ok(!revisionAt(1943,12921).memberOf.includes('(Vichy France)'));
  const provisionalName='Provisional Government of the French Republic';
  assert.equal(revisionAt(1944,12941).name,`(${provisionalName})`);
  assert.deepEqual(revisionAt(1944,12932).memberOf,[`(${provisionalName})`]);
  assert.equal(revisionAt(1945,12962).name,provisionalName);
  assert.equal(revisionAt(1945,12970).name,`(${provisionalName})`);
  assert.equal(revisionAt(1944,12941).entityId,revisionAt(1945,12970).entityId);
  assert.equal(revisionAt(1946,12996).name,'French Fourth Republic');
  assert.deepEqual(revisionAt(1943,12910).memberOf,['(Vichy France)']);
  for(const y of [1944,1945])assert.deepEqual(revisionAt(y,12910).memberOf,[]);
  assert.ok(!rows.some(r=>r.groupLinkWarnings?.some(w=>[13309,13313,12910,12921,12932,12941,12962,12969,12970].includes(w.sourceIndex))));
  assert.ok(revisionAt(1415,6958).components.includes('County of Savoy'));
  assert.ok(revisionAt(1416,6958).components.includes('Duchy of Savoy'));
  assert.ok(!rows.some(r=>r.year>=1416&&r.groupLinkWarnings?.some(w=>['County of Savoy','Duchy of Savoy'].includes(w.component))));
  assert.deepEqual(partsAt(1976,13372),[0,1,2,3,4,5,10]);
  assert.deepEqual(partsAt(2024,13646),[0,1,2,3,4,5,10]);
  assert.deepEqual(partsAt(1976,12994),[0,1,2,3,4,5,6]);
  assert.ok(partsAt(1962,13247).includes(4)&&!partsAt(1963,13247).includes(4));
  assert.deepEqual(partsAt(1890,11901),[1]);
  assert.ok(partsAt(1976,13247).includes(15)&&!partsAt(1976,13247).includes(16));
  assert.ok(partsAt(1976,13247).includes(1)&&!partsAt(1977,13247).includes(1)&&!partsAt(1978,13247).includes(1));
  assert.ok(!partsAt(1953,13019).includes(57)&&!partsAt(1953,13019).includes(49));
  assert.ok(!partsAt(1954,13019).includes(49));
  assert.ok(!partsAt(1973,13279).includes(43)&&!partsAt(1973,13279).includes(39));
  assert.ok(!partsAt(1995,13279).includes(37)&&!partsAt(1995,13279).includes(49));
  assert.equal(revisionAt(1100,4253).role,'settlement');
  assert.equal(revisionAt(1100,4253).sourceRole,'polity');
  assert.equal(revisionAt(1100,4529).role,'polity');
  assert.equal(revisionAt(1326,6249).role,'settlement');
  assert.ok(!partsAt(1948,13036).includes(42)&&!partsAt(1948,13036).includes(33)&&partsAt(1948,13036).includes(41));
  assert.ok(!partsAt(1949,13036).includes(41)&&!partsAt(1949,13070).includes(36));
  assert.ok(!partsAt(1961,13161).includes(14)&&partsAt(1961,13161).includes(15));
  assert.ok(!partsAt(1965,13161).includes(15));
  assert.equal(partsAt(1950,13111),undefined);
  assert.deepEqual(partsAt(1951,13111),[1,2,3,4,5]);
  assert.deepEqual(partsAt(1769,9854),[1,2,3]);
  assert.deepEqual(partsAt(1762,9852),[0,1,3,7]);
  assert.equal(revisionAt(1762,9986).name,'Kingdom of Naples (Bourbon)');
  assert.ok(!partsAt(1842,11345).includes(14));
  assert.ok(!partsAt(1926,12589).includes(40)&&partsAt(1926,12589).includes(37));
  assert.ok(!partsAt(1935,12589).includes(37));
  assert.deepEqual(partsAt(1407,6167),[1,2,3,4]);
  assert.ok(!partsAt(1961,13161).includes(13)&&partsAt(1961,13161).includes(15));
  assert.equal(partsAt(1825,11140),undefined);
  assert.ok(!partsAt(1826,11140).includes(1)&&!partsAt(1826,11140).includes(3)&&partsAt(1826,11140).includes(2));
  assert.ok(partsAt(1827,11140).includes(2)&&!partsAt(1828,11140).includes(2)&&partsAt(1828,11140).includes(6));
  assert.deepEqual(partsAt(1824,11074),[0,1]);
  assert.deepEqual(partsAt(1721,9578),[3,4,5]);
  assert.deepEqual(partsAt(1665,9047),[1]);
  assert.ok(!partsAt(1665,9089).includes(0)&&partsAt(1665,9089).includes(10));
  assert.deepEqual(partsAt(1567,8238),[1,3,4,5]); // Chios and the Nice cell are independently excluded
  assert.ok(!partsAt(1463,7268).includes(8)&&partsAt(1463,7268).includes(10));
  assert.deepEqual(partsAt(1476,7268),[0,2,3,5,6,7]); // part 4 is in the reviewed Nice reconstruction queue
  assert.ok(!partsAt(1454,7187).includes(6)&&partsAt(1454,7187).includes(0));
  assert.ok(!partsAt(1461,7187).includes(0));
  assert.deepEqual(partsAt(1344,6377),[0,1,2]);
  assert.deepEqual(partsAt(1362,6377),[0,2]);
  assert.equal(partsAt(1209,5267),undefined);
  assert.deepEqual(partsAt(1210,5267),[8,9]);
  assert.equal(partsAt(-189,833),undefined);
  assert.deepEqual(partsAt(-188,833),[0,2,5]);
  assert.ok(!partsAt(1969,13241).includes(8)&&!partsAt(1969,13241).includes(9)&&partsAt(1969,13241).includes(10));
  assert.ok(!partsAt(1970,13241).includes(10));
  assert.ok(!partsAt(1967,13262).includes(21)&&!partsAt(1967,13262).includes(23)&&!partsAt(1967,13262).includes(27));
  assert.ok(!partsAt(1964,13232).includes(7)&&partsAt(1964,13232).includes(6));
  assert.deepEqual(partsAt(1967,13232),[1,2,10,11,12]);
  assert.deepEqual(partsAt(1961,13209),[0,1]);
  assert.equal(revisionAt(1970,13317).name,'United Arab Republic');
  assert.equal(revisionAt(1971,13317).name,'Arab Republic of Egypt');
  assert.deepEqual(partsAt(1958,12920),[1]);
  assert.equal(revisionAt(1958,12920).name,'British Nigeria');
  assert.equal(revisionAt(1960,13214).name,'Federation of Nigeria');
  assert.equal(revisionAt(1960,13206).geometryStatus,'rejected');
  assert.equal(revisionAt(1962,13227).geometryStatus,'rejected');
  for(const [year,index,name] of [[1961,13244,'Republic of Dahomey'],[1974,13307,'Republic of Dahomey'],[1975,13307,"People's Republic of Benin"],[1990,13307,'Republic of Benin'],[1983,13249,'Republic of Upper Volta'],[1984,13249,'Burkina Faso'],[1965,13267,'Kingdom of Burundi'],[1966,13267,'Republic of Burundi'],[1962,13245,'Federation of Nigeria'],[1963,13245,'Federal Republic of Nigeria'],[1969,13306,"People's Republic of Southern Yemen"],[1970,13306,"People's Democratic Republic of Yemen"],[1989,13371,"People's Republic of Mozambique"],[1990,13371,'Mozambique']])assert.equal(revisionAt(year,index).name,name,`${year}/${index}`);
  assert.equal(revisionAt(1813,10758).name,'Denmark-Norway');
  assert.equal(revisionAt(1814,10923).name,'Denmark');
  assert.deepEqual(partsAt(1918,11752),[0,1,2,3,4,5]);
  assert.equal(revisionAt(1940,12846).name,'Faroe Islands (Danish territory)');
  assert.ok(!partsAt(1865,11633).includes(9)&&partsAt(1865,11633).includes(8));
  assert.ok(!partsAt(1803,10558).includes(6));
  assert.ok(partsAt(1768,10007).includes(5)&&!partsAt(1769,10007).includes(5));
  assert.deepEqual(partsAt(1791,10325),[1]);
  assert.equal(revisionAt(1791,10325).name,'Saint Pierre and Miquelon');
  assert.deepEqual(partsAt(1454,7180),[3,4,5,6]);
  assert.ok(!partsAt(1457,7268).includes(1));
  assert.ok(!partsAt(1454,7187).includes(1));
  assert.equal(revisionAt(1831,11215).name,'First Hellenic Republic');
  assert.equal(revisionAt(1832,11215).name,'Kingdom of Greece');
  assert.deepEqual(partsAt(1832,11215),[1,2,3,4,5,6]);
  assert.equal(revisionAt(1924,12616).name,'Second Hellenic Republic');
  assert.equal(revisionAt(1935,12711).name,'Kingdom of Greece');
  assert.equal(revisionAt(1963,13271).name,'Sultanate of Zanzibar');
  assert.deepEqual(partsAt(1963,13271),[1,2]);
  assert.equal(revisionAt(1964,13271).geometryStatus,'rejected');
  assert.equal(revisionAt(1963,13265).name,'Tanganyika');
  assert.deepEqual(revisionAt(1963,13265).geometryParts,[{index:13265,part:0},{index:13271,part:0}]);
  assert.equal(revisionAt(1964,13265).name,'Tanzania');
  assert.deepEqual(revisionAt(1964,13265).geometryParts,[{index:13265,part:0},{index:13271,part:0},{index:13271,part:1},{index:13271,part:2}]);
  assert.equal(revisionAt(1674,9135).name,'New Netherland');
  assert.equal(revisionAt(1675,9135).name,'Dutch Caribbean and Guiana possessions (source aggregate)');
  assert.equal(revisionAt(1905,12227).name,'British West African territories (Gold Coast and Nigeria)');
  const report={years,recordYears,rejectedYears,emptyYears,packCount,yearsWithIdentityCollisions,yearsWithSharedGeometry,admissionWarnings,externalRecordYears,datedRecordYears,checkedSupplementYears,auditLedger,counts:manifest.counts,source:manifest.source,notice:'Technical annual coverage with review warnings. Shared geometry, aliases and admission warnings are candidates, not proof of errors. External and dated successor outlines are approximate cartographic candidates; historical, geographic and visual acceptance NOT complete.',rows};
  fs.writeFileSync(path.join(outDir,'technical-annual-audit.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({...report,rows:undefined}));
}
