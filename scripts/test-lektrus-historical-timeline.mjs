import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {buildHistoricalTimeline,normalizeHistoricalSource,sha256,removeRetracedHole} from './build-lektrus-historical-timeline.mjs';
import {historicalYearOrdinal,historicalYearFromOrdinal,stepHistoricalYear,historicalBlockForYear,historicalYearState,historicalYearFeatureCollection,validateHistoricalManifest,validateHistoricalPack} from '../src/lektrusHistoricalTimeline.ts';
import {createHistoricalTimelineLoader} from '../src/lektrusHistoricalTimelineLoader.ts';
import {referenceAdmissionWarnings} from './audit-lektrus-atlas-annual.mjs';
import {buildChangeRegistry,componentHash,exactComponentConflicts} from './audit-lektrus-historical-changes.mjs';
import {historicalGapLocators} from '../src/lektrusHistoricalGapLocators.ts';

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
const settlementFixture=normalizeHistoricalSource({type:'FeatureCollection',features:[feature('Viking settlements',1028,1325)]});
assert.equal(settlementFixture.records[0].role,'settlement');
assert.equal(settlementFixture.records[0].sourceRole,'polity');
assert.equal(settlementFixture.records[0].geometryId,sha256(JSON.stringify(square())));
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
 console.log('10 gap map locators verified against pinned Natural Earth label anchors');
}
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
      assert.equal(r.sourceRole??r.role,f.properties.Type==='RELATION'?'relation':f.properties.Components?'composite':'polity');assert.equal(r.sourceName,f.properties.Name.trim());
      if(r.role==='settlement'){assert.equal(r.sourceName,'Viking settlements');assert.ok(r.review?.sources.length);}
      const list=v=>String(v??'').split(';').map(s=>s.trim()).filter(Boolean);
      assert.deepEqual(r.sourceComponents??r.components,list(f.properties.Components));assert.deepEqual(r.sourceMemberOf??r.memberOf,list(f.properties.MemberOf));
      assert.equal(r.sourceFrom,f.properties.FromYear);assert.equal(r.sourceTo,f.properties.ToYear);
      assert.equal(r.sourceGeometryId??r.geometryId,sourceHashes.get(r.sourceIndex));
      if(r.sourceGeometryId){
        const orig=f.geometry,repaired=pack.geometries[r.geometryId];
        if(r.geometryRepair==='reviewed-source-components'){
          const parts=r.geometryParts.map(({index,part})=>{const x=input.features[index];assert.ok(x.properties.FromYear<=r.from&&x.properties.ToYear>=r.to);return (x.geometry.type==='Polygon'?[x.geometry.coordinates]:x.geometry.coordinates)[part]});
          assert.deepEqual(repaired,{type:'MultiPolygon',coordinates:parts});
        }else{assert.equal(r.geometryRepair,'retracted-zero-area-interior-edges');assert.equal(orig.type,repaired.type);const shells=g=>(g.type==='Polygon'?[g.coordinates]:g.coordinates).map(p=>p[0]);assert.deepEqual(shells(orig),shells(repaired));}
      }
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
  assert.equal(seen.size,manifest.counts.revisions);
  assert.equal(allGeometries.size,manifest.counts.uniqueGeometries);
  const revisionAt=(year,index)=>{const b=historicalBlockForYear(manifest,year);const p=JSON.parse(fs.readFileSync(path.join(outDir,b.file)));return historicalYearState(p,year).records.find(r=>r.sourceIndex===index)};
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
  assert.equal(partsAt(1970,13318),undefined);
  assert.ok(!partsAt(1971,13318).includes(22));
  assert.ok(partsAt(1972,13318).includes(5));
  assert.ok(!partsAt(1973,13318).includes(5));
  assert.deepEqual(partsAt(1985,13318),[0,18,19,20,21,37]);
  assert.equal(revisionAt(1972,13309).name,'Seychelles (British colony)');
  assert.equal(revisionAt(1973,13313).geometryStatus,'rejected');
  assert.deepEqual(partsAt(1976,13372),[0,1,2,3,4,5,10]);
  assert.deepEqual(partsAt(2024,13646),[0,1,2,3,4,5,10]);
  assert.deepEqual(partsAt(1976,12994),[0,1,2,3,4,5,6]);
  assert.ok(partsAt(1962,13247).includes(4)&&!partsAt(1963,13247).includes(4));
  assert.deepEqual(partsAt(1890,11901),[1]);
  assert.ok(partsAt(1976,13247).includes(15)&&!partsAt(1976,13247).includes(16));
  assert.ok(partsAt(1977,13247).includes(1)&&!partsAt(1978,13247).includes(1));
  assert.ok(!partsAt(1953,13019).includes(57)&&partsAt(1953,13019).includes(49));
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
  assert.deepEqual(partsAt(1567,8238),[1,2,3,4,5]);
  assert.ok(!partsAt(1463,7268).includes(8)&&partsAt(1463,7268).includes(10));
  assert.deepEqual(partsAt(1476,7268),[0,2,3,4,5,6,7]);
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
  assert.ok(!partsAt(1967,13262).includes(21)&&!partsAt(1967,13262).includes(23)&&partsAt(1967,13262).includes(27));
  assert.ok(!partsAt(1964,13232).includes(7)&&partsAt(1964,13232).includes(6));
  assert.deepEqual(partsAt(1967,13232),[1,2,10,11,12]);
  assert.deepEqual(partsAt(1961,13209),[0,1]);
  assert.equal(revisionAt(1970,13317).name,'United Arab Republic');
  assert.equal(revisionAt(1971,13317).name,'Arab Republic of Egypt');
  assert.deepEqual(partsAt(1958,12920),[1]);
  assert.equal(revisionAt(1958,12920).name,'British Nigeria');
  assert.equal(revisionAt(1960,13214).name,'Nigeria (independence transition year)');
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
  const report={years,recordYears,rejectedYears,emptyYears,packCount,yearsWithIdentityCollisions,yearsWithSharedGeometry,admissionWarnings,counts:manifest.counts,source:manifest.source,notice:'Technical annual coverage with review warnings. Shared geometry, aliases and admission warnings are candidates, not proof of errors. Historical, geographic and visual acceptance NOT complete.',rows};
  fs.writeFileSync(path.join(outDir,'technical-annual-audit.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({...report,rows:undefined}));
}
