import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import polygonClipping from 'polygon-clipping';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {buildHistoricalTimeline,normalizeHistoricalSource,sha256,removeRetracedHole,deriveConfirmedOverlapExclusions,deriveTerritorialBatch,territorialBatch,territorialResolutions,documentedStateCoverageGaps,independentIslands,independentIslandGeometry,partitionHistoricalGeometry,historicalTitleCorrections,tianjinReviewedSourceOwner,secondaryExactReviews,thirdExactReviews,fourthExactReviews,fifthExactReviews,sixthExactReviews,provisionalExactReviews,exactConflictPendingReviews,exactConflictGroupPrefix,elba1797Partition,buildElbaPartition,earlyComorosRoutes,earlyComorosHashes} from './build-lektrus-historical-timeline.mjs';
import {historicalUnresolvedCenters,historicalUnresolvedRegions,historicalTreatyPortCenters,historicalCorsicaLiberationCenters,historicalDatedGapCenters,tianjinConcessionChronology,tianjinConcessionStatus,historicalCenterSources} from '../src/lektrusHistoricalUnresolvedCenters.ts';
import {capitalInsideCountry} from './atlas-2026-capitals.mjs';
import {historicalYearOrdinal,historicalYearFromOrdinal,stepHistoricalYear,historicalBlockForYear,historicalYearState,historicalYearFeatureCollection,historicalYearSourcesComparable,validateHistoricalManifest,validateHistoricalPack} from '../src/lektrusHistoricalTimeline.ts';
import {createHistoricalTimelineLoader} from '../src/lektrusHistoricalTimelineLoader.ts';
import {referenceAdmissionWarnings} from './audit-lektrus-atlas-annual.mjs';
import {buildChangeRegistry,componentHash,exactComponentConflicts,sourceComponentEvidence} from './audit-lektrus-historical-changes.mjs';
import {historicalGapLocators} from '../src/lektrusHistoricalGapLocators.ts';
import {componentHash as sourceComponentHash,documentedCores,buildDocumentedCore,ceylonFortCores,saintMartinSpanish,tobagoDutch,ceylonCoastalRoutes,ceylonEarlyRoutes,ceylonWarRoutes,capeTerritoryRoutes,capeTerritories,songAnnexations} from './build-lektrus-historical-timeline.mjs';

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
assert.ok(territorialResolutions.davaoTransfer.reasonRu.includes('к концу 1849'),
 'The city history dates Oyanguren\'s claimed peaceful control to the END of 1849');
assert.ok(!territorialResolutions.davaoTransfer.reasonRu.includes('к началу 1849'),
 'Do not backdate Davao Gulf control to early 1849');
assert.ok(territorialResolutions.davaoTransfer.reason.includes('The 1848 polygon is therefore'),
 '1848 conquest of the fortified settlement is not a survey of the entire gulf');
// Evidence-led modern name chronology: national names never change the coastline.
const recentlyDatedTitles=[["Turkey","Q43",2022,"Türkiye"],["Republic of Turkey","Q43",2022,"Republic of Türkiye"],["Türkiye","Q43",1923,"Turkey"],["Republic of Türkiye","Q43",1923,"Republic of Turkey"],["Republic of Cabo Verde","Q1011",1975,"Republic of Cape Verde"],["Cabo Verde","Q1011",1975,"Cape Verde"],["Republic of Cape Verde","Q1011",2013,"Republic of Cabo Verde"],["Cape Verde","Q1011",2013,"Cabo Verde"],["Union of Myanmar","Q836",1948,"Union of Burma"],["Union of Myanmar","Q836",1974,"Socialist Republic of the Union of Burma"],["Union of Myanmar","Q836",1988,"Union of Burma"],["Republic of the Union of Myanmar","Q836",1989,"Union of Myanmar"]];
for(const [name,qid,year,title] of recentlyDatedTitles){
 const matches=historicalTitleCorrections.filter(r=>r[0]===name&&r[1]===qid&&r[2]<=year&&year<=r[3]);
 assert.equal(matches.length,1,'Missing/duplicate dated title '+name+'/'+year);
 assert.equal(matches[0][4],title);
 assert.ok(matches[0][6].startsWith('https://'));
}
for(const name of ['Union of Myanmar','Turkey','Republic of Cabo Verde']){
 const rules=historicalTitleCorrections.filter(r=>r[0]===name);
 for(let i=0;i<rules.length;i++)for(let j=i+1;j<rules.length;j++)
  assert.ok(rules[i][3]<rules[j][2]||rules[j][3]<rules[i][2],'Overlapping title years '+name);
}
// Additional modern-to-older names are verified against national acts and UN notices.
const laterCountryNames=[["Samoa","Q683",1962,"Western Samoa"],["Independent State of Samoa","Q683",1962,"Independent State of Western Samoa"],["Western Samoa","Q683",1997,"Samoa"],["Republic of Cameroon","Q1009",1962,"Federal Republic of Cameroon"],["Republic of Cameroon","Q1009",1972,"United Republic of Cameroon"],["Federal Republic of Cameroon","Q1009",1972,"United Republic of Cameroon"],["United Republic of Cameroon","Q1009",1984,"Republic of Cameroon"],["Central African Republic","Q929",1977,"Central African Empire"],["Republic of the Congo","Q971",1970,"People's Republic of the Congo"],["Republic of Congo","Q971",1970,"People's Republic of the Congo"],["People's Republic of the Congo","Q971",1992,"Republic of the Congo"]];
for(const [sourceName,sourceId,year,expected] of laterCountryNames){
 const candidates=historicalTitleCorrections.filter(r=>r[0]===sourceName&&r[1]===sourceId&&r[2]<=year&&year<=r[3]);
 assert.equal(candidates.length,1,'Missing historical transition '+sourceName+'/'+year);
 assert.equal(candidates[0][4],expected,'False government title '+sourceName+'/'+year);
 assert.ok(candidates[0][6].startsWith('https://'));
}
const allDatedNames=new Map();
for(const rule of historicalTitleCorrections){
 const key=rule[0]+'|'+rule[1];const history=allDatedNames.get(key)??[];
 for(const prev of history)assert.ok(prev[3]<rule[2]||rule[3]<prev[2],
  'Overlapping historical title intervals '+key);
 history.push(rule);allDatedNames.set(key,history);
}
// New Tianjin background owners have exact chronological and source-identity gates.
for(const [year,source] of [[1900,'Qing Dynasty'],[1901,'Qing Dynasty'],[1902,'Qing Dynasty'],[1916,'Empire of China'],[1917,'Kuomintang'],
 [1923,'Kuomintang'],[1927,'Kuomintang'],[1928,'Kuomintang'],
 [1936,'Republic of China'],[1937,null],[1945,null],
 [1901,'Qing Dynasty'],[1946,'Republic of China']]){
 assert.equal(tianjinReviewedSourceOwner(year),source,'Tianjin background '+year);
}
for(const [name,qid,year,label] of [
 ['Empire of China','Q175379',1916,'Republic of China (Hongxian monarchy until 22 March)'],
 ['Kuomintang','Q31113',1917,'Republic of China (Beiyang era; disputed source aggregate)'],
 ['Kuomintang','Q31113',1927,'Republic of China (Beiyang era; disputed source aggregate)']
]){
 const rule=historicalTitleCorrections.find(row=>row[0]===name&&row[1]===qid&&year>=row[2]&&year<=row[3]);
 assert.equal(rule?.[4],label,'False China polity attribution '+year);
 assert.ok(rule?.[6]?.startsWith('https://'));
}
// 1928–29 Nationalist governmental terminology, not a party as a country.
const nationalist=historicalTitleCorrections.find(r=>r[0]==='Kuomintang'&&r[1]==='Q31113'&&r[2]===1928&&r[3]===1929);
assert.equal(nationalist?.[4],'Republic of China (Nationalist government; source aggregate)');
for(const [year,phrase] of [[1928,'июне 1928'],[1937,'30 июля 1937'],[1945,'6 октября 1945']]){
 const transitions=tianjinConcessionStatus(year).transitions;
 assert.ok(transitions.some(t=>t.from===year&&t.to===year&&t.description.includes(phrase)&&t.url.startsWith('https://')),
  'Undocumented Tianjin change in '+year);
 const marker=historicalTreatyPortCenters(year)[0];
 assert.ok(marker?.description.includes(phrase),'Missing dated transition in Tianjin marker '+year);
}
for(const year of [1900,1901,1902]){
 const marker=historicalTreatyPortCenters(year)[0];
 assert.ok(marker?.description.includes('не означала прекращения китайского суверенитета'));
 assert.ok(tianjinConcessionStatus(year).transitions.some(t=>t.from===1900&&t.to===1902&&t.url.endsWith('/frus1902/d159')));
}
assert.equal(historicalCorsicaLiberationCenters(1942).length,0);
const corsica1943=historicalCorsicaLiberationCenters(1943);
const corsica1944=historicalCorsicaLiberationCenters(1944);
assert.equal(corsica1943.length,1);
assert.equal(corsica1944.length,1);
assert.equal(corsica1943[0].id,corsica1944[0].id);
assert.ok(corsica1943[0].description.includes('4 октября 1943'));
assert.ok(corsica1944[0].description.includes('уже находилась под французским управлением'));
assert.ok(corsica1944[0].description.includes('не повторное освобождение'));
assert.equal(historicalCorsicaLiberationCenters(1945).length,0);
assert.equal(tianjinConcessionChronology.length,8);
assert.deepEqual(tianjinConcessionStatus(1860).established.map(c=>c.id),['british']);
assert.deepEqual(tianjinConcessionStatus(1895).established.map(c=>c.id),['german']);
assert.deepEqual(tianjinConcessionStatus(1902).established.map(c=>c.id),['belgian','italian','austrohungarian']);
assert.deepEqual(tianjinConcessionStatus(1917).recovery.map(c=>c.id),['german','austrohungarian']);
assert.deepEqual(tianjinConcessionStatus(1919).recovery.map(c=>c.id),[]);
assert.deepEqual(tianjinConcessionStatus(1920).recovery.map(c=>c.id),['russian']);
assert.deepEqual(tianjinConcessionStatus(1931).recovery.map(c=>c.id),['belgian']);
assert.deepEqual(tianjinConcessionStatus(1945).recovery.map(c=>c.id),['british','french','japanese','italian']);
assert.equal(tianjinConcessionStatus(1946).active.length,0);
// Counterexamples to conflating legal settlements and actual administration.
for(const year of [1918,1919])assert.ok(!tianjinConcessionStatus(year).active.some(c=>c.id==='austrohungarian'));
for(const year of [1921,1922,1923,1924])assert.ok(!tianjinConcessionStatus(year).active.some(c=>c.id==='russian'));
assert.ok(!tianjinConcessionStatus(1942).active.some(c=>c.id==='british'));
for(const id of ['british','french','italian'])assert.ok(!tianjinConcessionStatus(1944).active.some(c=>c.id===id));
assert.deepEqual(tianjinConcessionStatus(1943).administrationChanges.map(c=>c.id),['french','italian']);
assert.ok(historicalTreatyPortCenters(1943)[0].description.includes('20 мая'));
assert.ok(historicalTreatyPortCenters(1947)[0].description.includes('15 сентября 1947'));
assert.equal(historicalTreatyPortCenters(1948).length,0);
// Confirm that the missing dated 1630–31 WIC city control and the 1673–74
// Dutch reconquest appear as sourced year-specific atlas content, never as
// fabricated polygons or imported 1632/1663 outlines.
for(const [year,count] of [[1629,0],[1630,4],[1631,4],[1632,0],[1672,0],[1673,1],[1674,1],[1675,0]]){
  const entries=historicalDatedGapCenters(year);
  assert.equal(entries.length,count,`dated gap transition ${year}`);
  for(const entry of entries){
    assert.equal(entry.year,year);
    assert.ok(entry.id.startsWith('historical-center-'));
    assert.match(entry.description,/точка/i);
    assert.ok(entry.sources.length&&entry.sources.every(u=>u.startsWith('https://')));
    assert.ok(Number.isFinite(entry.lon)&&Number.isFinite(entry.lat));
  }
}
for(const year of [1630,1631]){
 const fortMarkers=historicalDatedGapCenters(year).filter(x=>/recife-(schans|frederik)/.test(x.id));
 assert.equal(fortMarkers.length,2);
 assert.ok(fortMarkers.every(x=>x.sources.includes('https://whc.unesco.org/en/tentativelists/5997')));
 assert.ok(fortMarkers.every(x=>/не исторический контур|не к точным границам/.test(x.description)));
 assert.ok(fortMarkers.every(x=>x.lon>-35&&x.lon<-34.8&&x.lat>-8.2&&x.lat<-8));
}
assert.ok(historicalDatedGapCenters(1673)[0].description.includes('Антони Колве'));
assert.ok(historicalDatedGapCenters(1674)[0].description.includes('10 ноября 1674 года'));
assert.ok(historicalDatedGapCenters(1674)[0].sources.includes('https://www.archontology.org/nations/us/new_york/01_polity_1673_74.php'));
assert.ok(historicalDatedGapCenters(1630).some(x=>x.title.includes('Ресифи')));
assert.ok(historicalDatedGapCenters(1630).some(x=>x.title.includes('Олинда')));
assert.ok(historicalDatedGapCenters(1673)[0].title.includes('Новый Оранж'));
assert.ok(historicalDatedGapCenters(1674)[0].description.includes('Вестминстерскому'));
assert.ok(historicalCenterSources(historicalDatedGapCenters(1673)[0]).length>=2);
assert.match(fs.readFileSync(new URL('../src/LektrusMapAtlas.tsx',import.meta.url),'utf8'),/historicalDatedGapCenters\(snapshot\.year\)/);

assert.ok(historicalCenterSources(historicalTreatyPortCenters(1921)[0]).includes('https://history.state.gov/historicaldocuments/frus1920v01/d481'));
assert.ok(historicalCenterSources(historicalTreatyPortCenters(1947)[0]).includes('https://treaties.un.org/doc/Publication/UNTS/Volume%2049/v49.pdf'));

assert.ok(historicalTreatyPortCenters(1901)[0].description.includes('временное международное правительство'));
assert.ok(historicalTreatyPortCenters(1902)[0].description.includes('австро-венгерская'));
assert.ok(historicalTreatyPortCenters(1917)[0].description.includes('Восстановление китайского управления'));
assert.ok(historicalTreatyPortCenters(1945)[0].description.includes('китайского управления'));
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
// No false political "extinctions" when moving across 2024→2025 or
// 2025→archive-2026; the comparison must also be withheld visually.
assert.equal(historicalYearSourcesComparable({features:[]},{features:[]}),true);
assert.equal(historicalYearSourcesComparable({historicalUncoveredYear:2025},{features:[]}),false);
assert.equal(historicalYearSourcesComparable({features:[]},{historicalUncoveredYear:2025}),false);
assert.equal(historicalYearSourcesComparable({features:[]},{features:[]},true),false);
assert.equal(historicalYearSourcesComparable(null,{features:[]}),false);
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
const kiribati=independentIslands.states.find(s=>s.iso==='KIR');
assert.equal(kiribati.from,1979);
assert.equal(kiribati.historicalCartography.disputedTerritoryCount,14);
assert.equal(kiribati.historicalCartography.treatySigned,'1979-09-20');
assert.equal(kiribati.historicalCartography.treatyEntryIntoForce,'1983-09-23');
assert.ok(kiribati.sources.some(s=>s.includes('decon_num_15-1.pdf')));
assert.ok(kiribati.sources.some(s=>s.includes('bi-67019.pdf')));
assert.ok(kiribati.reasonRu.includes('1979–1982'));
assert.equal(independentIslands.states.find(s=>s.iso==='MHL').recognitionFrom,1986);
const marshall=independentIslands.states.find(s=>s.iso==='MHL');
assert.equal(marshall.from,1986);
assert.equal(marshall.historicalCartography.from,1986);
assert.equal(marshall.historicalCartography.to,1989);
assert.equal(marshall.historicalCartography.precision,'not-georeferenced-from-1986-source');
assert.ok(marshall.sources.some(s=>s.includes('1986StatsAbstract.pdf')));
assert.ok(marshall.sources.some(s=>s.includes('/of/1986/0419/')));
assert.ok(marshall.sources.some(s=>s.includes('digitallibrary.un.org/record/58340')));
for(let year=1986;year<=1989;year++){
  assert.deepEqual(documentedStateCoverageGaps(year,[],true),[],'Marshall Island dated map gap must be closed '+year);
  assert.ok(historicalGapLocators['Marshall Islands'].historicalNote.includes('21 октября 1986'));
  assert.ok(historicalGapLocators['Marshall Islands'].historicalNote.includes('геодезические берега'));
  assert.equal(historicalGapLocators['Marshall Islands'].historicalSource,'https://history.state.gov/countries/marshall-islands');
  assert.deepEqual(documentedStateCoverageGaps(year,[{sourceWikidata:'Q709',name:'Legacy source'}],true),[]);
  assert.deepEqual(documentedStateCoverageGaps(year,[{name:'Republic of the Marshall Islands'}],true),[]);
  assert.deepEqual(documentedStateCoverageGaps(year,[],false),[],'Small fixtures have no reviewed island supplementation');
}
for(const year of [1985,1990,1991])assert.deepEqual(documentedStateCoverageGaps(year,[],true),[]);
assert.equal(zhou.records[0].name,'Eastern Zhou');assert.equal(zhou.records[1].name,'Later Zhou');assert.deepEqual(zhou.records[2].components,['Eastern Zhou']);assert.deepEqual(zhou.records[2].sourceComponents,['Later Zhou']);
assert.throws(()=>normalizeHistoricalSource({type:'FeatureCollection',features:[feature('Bad',1,2,{type:'Polygon',coordinates:[[[0,0],[1,0],[0,1],[1,1]]]})]}));
const fixtureDir=mkdtempSync(path.join(tmpdir(),'lektrus-timeline-fixture-'));
const fixture=buildHistoricalTimeline(source,sha256(JSON.stringify(source)),fixtureDir);
// The minimal source has no reviewed historical island supplement; annual
// pack building must not refer to normalizeHistoricalSource's private "batch".
// This regression failed with ReferenceError: batch is not defined.
const fixture1987Block=historicalBlockForYear(fixture,1987);
assert.ok(fixture1987Block,'1987 must have a generated yearly pack in fixture');
const fixture1987Pack=validateHistoricalPack(
 JSON.parse(fs.readFileSync(path.join(fixtureDir,fixture1987Block.file),'utf8')),
 fixture1987Block
);
assert.equal(historicalYearState(fixture1987Pack,1987).coverageGaps.filter(
 g=>g.kind==='documented-state'&&g.name==='Marshall Islands').length,0,
 'Do not inject Marshall Islands candidate supplements into small test fixtures');
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
// A source aggregate can be reviewed under a non-parenthesized name. Do not
// amputate first/last letters; only unwrap literal (Parenthesized) labels.
const compositeLabel=historicalYearFeatureCollection({...state,drawable:[],overlays:[
 {record:{...state.overlays[0].record,role:'composite',name:'Former colonial possessions',nameRu:undefined},geometry:square()}
]},true).features[0].properties.NAME;
assert.equal(compositeLabel,'Former colonial possessions');
const wrappedLabel=historicalYearFeatureCollection({...state,drawable:[],overlays:[
 {record:{...state.overlays[0].record,role:'composite',name:'(British Empire)',nameRu:undefined},geometry:square()}
]},true).features[0].properties.NAME;
assert.equal(wrappedLabel,'British Empire');
assert.equal(historicalYearState(pack,1963).drawable.length,2);
assert.throws(()=>validateHistoricalPack({...pack,geometries:{}},block));
// Audit gaps can be attached to BCE years: signed calendar keys are valid,
// year zero is not. Accept only years belonging to the enclosing data pack.
const bceBlock=historicalBlockForYear(fixture,-1);
const bcePack=JSON.parse(fs.readFileSync(path.join(fixtureDir,bceBlock.file)));
const bceGap={name:'Undated state boundary',date:'-1',reason:'Unknown source coverage',source:'https://www.metmuseum.org/exhibitions/listings/2003/art-of-the-first-cities'};
assert.doesNotThrow(()=>validateHistoricalPack({...bcePack,coverageGaps:{...bcePack.coverageGaps,'-1':[bceGap]}},bceBlock));
assert.throws(()=>validateHistoricalPack({...bcePack,coverageGaps:{...bcePack.coverageGaps,'0':[bceGap]}},bceBlock));
assert.ok(historicalYearState({...bcePack,coverageGaps:{...bcePack.coverageGaps,'-1':[bceGap]}},-1).coverageGaps.length===1);
assert.throws(()=>validateHistoricalPack({...bcePack,coverageGaps:{...bcePack.coverageGaps,'-1':[{...bceGap,source:'http://example.org'}]}},bceBlock),
 'Historical evidence must use HTTPS');
assert.throws(()=>validateHistoricalPack({...bcePack,coverageGaps:{...bcePack.coverageGaps,'-1':[{...bceGap,reasonRu:123}]}},bceBlock),
 'Localized historical evidence must have a valid nonempty string');
const atlasUI=fs.readFileSync(new URL('../src/LektrusMapAtlas.tsx',import.meta.url),'utf8');
assert.match(atlasUI,/if\(annualPreview&&year===2025\)return \{type:"FeatureCollection",features:\[\],historicalUncoveredYear:2025\}/);
assert.match(atlasUI,/data-atlas-uncovered-year="2025"/);
assert.ok(atlasUI.includes('g.reasonRu??('),'Human-readable coverage explanations must be visible');
assert.match(atlasUI,/const sourcedHistoryCenters=historical&&annualSource/);
assert.match(atlasUI,/data-atlas-sourced-centers=\{sourcedHistoryCenters\.length\}/);
assert.match(atlasUI,/\.\.\.historicalTreatyPortCenters\(snapshot\.year\),\.\.\.historicalCorsicaLiberationCenters\(snapshot\.year\)/);
assert.match(atlasUI,/\.\.\.unresolvedCenters,\.\.\.sourcedHistoryCenters/);
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
  const tianjinSourceNames=new Set(['French Indochina','British Colonial Empire','United States of America','German Empire','Empire of Japan','Russian Empire','Kingdom of Belgium','Kingdom of Italy','Austria-Hungary']);
  const tianjinCells=original.flatMap(({f,index})=>{const {Name:name,FromYear:from,ToYear:to,Components:components}=f.properties;if(!tianjinSourceNames.has(name)||components||to<1860||from>1946)return [];return (f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates).flatMap((p,part)=>{const [x,y,X,Y]=bounds(p);return x>116.5&&X<118.3&&y>38.5&&Y<40.2?[{index,from,to,part,p,hash:componentHash(p)}]:[];});});
  // The extra Japanese polygon at Tanggu/Taku represents a foreign garrison
  // corridor, not sovereign Japan or the Haihe urban Japanese concession.
  const southernJapaneseCells=tianjinCells.filter(c=>{
   const f=input.features[c.index];
   return f.properties.Name==='Empire of Japan'&&bounds(c.p)[1]<39;
  });
  assert.equal(southernJapaneseCells.length,14);
  assert.deepEqual(southernJapaneseCells.map(c=>c.index),[12182,12260,12306,12371,12440,12522,12577,12617,12632,12649,12667,12678,12712,12777]);
  assert.equal(southernJapaneseCells.reduce((n,c)=>n+c.to-c.from+1,0),38);
  for(const cell of southernJapaneseCells){
   assert.equal(input.features[cell.index].properties.Wikidata,'Q188712');
   const [x,y,X,Y]=bounds(cell.p);
   assert.ok(x>117.26&&x<117.27&&y>38.73&&y<38.75&&
    X>117.70&&X<117.72&&Y>38.99&&Y<39,
    'False Japanese Tanggu boundary changed: '+cell.index+'/'+cell.part);
  }

  assert.equal(tianjinCells.length,135);
  let tianjinClosed=0,tianjinOpen=0;
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
          if(definition.hash)assert.equal(sourceComponentHash(outline),definition.hash);
          else assert.ok(definition.id.startsWith('ceylon-')&&/неуточн|неизвест/.test(definition.review?.reasonRu??''));
          assert.ok(definition.mask.length&&definition.sources.every(u=>u.startsWith('https://')));
          assert.deepEqual(pack.geometries[r.mapPartition.outlineGeometryId],{type:'MultiPolygon',coordinates:[outline]});
          assert.deepEqual(repaired,buildDocumentedCore(outline,definition));
          assert.deepEqual(r.geometryParts,[{index:d.source,part:index}]);
          assert.equal(r.name,d.name);
        }
        else if(r.mapPartition?.kind==='documented-island'){
          const d=[saintMartinSpanish,tobagoDutch].find(d=>d.periods.some(([i,,a,b])=>i===r.sourceIndex&&a===r.from&&b===r.to));assert.ok(d);const [index,part]=d.periods.find(([i,,a,b])=>i===r.sourceIndex&&a===r.from&&b===r.to);assert.deepEqual(r.geometryParts,[{index,part}]);
          const raw=f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates;assert.deepEqual(pack.geometries[r.mapPartition.outlineGeometryId],{type:'MultiPolygon',coordinates:[raw[part]]});assert.deepEqual(repaired,{type:'MultiPolygon',coordinates:d.coastline});
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
        if(candidates.length){const {record}=candidates[0];assert.equal(record.name,d.transition&&year>=d.transition.year?d.transition.name:d.name);assert.ok(record.review.sources.includes(independentIslands.source.url));
          if(d.iso==='KIR'&&year>=1979&&year<=1982){
            assert.ok(record.review.reasonRu.includes('оспариваемые притязания'));
            assert.ok(record.review.reasonRu.includes('1983'));
            assert.ok(record.review.sources.some(url=>url.includes('decon_num_15-1.pdf')));
            assert.ok(record.review.sources.some(url=>url.includes('bi-67019.pdf')));
          }
          if(d.iso==='MHL'&&year>=1986&&year<=1989){
            assert.equal(record.externalGeography.kind,'modern-island-outline');
            assert.ok(record.review.reasonRu.includes('1986'));
            assert.ok(record.review.reasonRu.includes('генерализованный'));
            assert.ok(record.review.sources.some(url=>url.includes('1986StatsAbstract.pdf')));
            assert.ok(record.review.sources.some(url=>url.includes('digitallibrary.un.org/record/58340')));
          }
        }
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
      if(year===960){const r=activeRecords.get(3861);assert.equal(r.name,'Northern Song');assert.deepEqual(r.memberOf,[]);}
      for(const [source,target,from] of songAnnexations)if(year>=from&&year<=input.features[source].properties.ToYear){
        const old=activeRecords.get(source),owner=activeRecords.get(target);assert.equal(old.geometryStatus,'rejected');assert.deepEqual(old.memberOf,[]);assert.equal(owner.name,'Northern Song');
        for(const [part] of input.features[source].geometry.coordinates.entries())assert.ok(hasPart(owner,source,part),`Song annexation ${source}/${part}/${year}`);
        for(const {record} of state.overlays.filter(x=>[3863,3963].includes(x.record.sourceIndex)))assert.ok(!record.components.includes(old.sourceName));
      }
      if(year>=1077&&year<=1125){
        const island=activeRecords.get(4524);assert.equal(island.name,year<1116?'Taifa of Mallorca':'Balearic Islands (Almoravid administration)');assert.deepEqual(island.geometryParts,[1,2,3].map(part=>({index:4524,part})));
        if(year<=1084)assert.ok(hasPart(activeRecords.get(4604),4524,0));
        assert.equal(state.territorialIssues.some(i=>i.group==='Дения — материковый контур'),year>=1085&&year<=1093);
        if(year>=1111){const group=activeRecords.get(4744);assert.deepEqual(group.components,year<1116?['Taifa of Mallorca']:[]);assert.equal(group.geometryStatus,year<1116?'candidate':'rejected');if(year<1116)assert.deepEqual(group.geometryParts,island.geometryParts);}
      }
      if(year>=1111&&year<=1146){const group=activeRecords.get(4739);assert.ok(!group.components.includes('County of Maine'));assert.ok(group.geometryParts.every(p=>p.index===4734));if(year>=1144){assert.deepEqual(group.geometryParts,[{index:4734,part:1}]);assert.ok(hasPart(activeRecords.get(4893),4734,0));assert.ok(hasPart(activeRecords.get(4880),4734,0));assert.ok(!hasPart(activeRecords.get(4734),4734,0));}}
      if(year>=1126&&year<=1151){const combined=state.drawable.filter(({record})=>[4821,4874,4898].includes(record.sourceIndex));assert.equal(combined.length,1);assert.equal(combined[0].record.name,'Counties of Blois and Champagne (same ruler)');for(const {record} of state.overlays.filter(x=>[4776,4880,4915].includes(x.record.sourceIndex))){assert.ok(!record.components.includes('County of Champagne'));assert.ok(record.components.includes(combined[0].record.name));}}
      if(year>=1707&&year<=1712){const group=activeRecords.get(year<=1708?9441:9507);assert.ok(group.components.includes('Kingdom of Great Britain'));assert.ok(group.components.includes('British colonial possessions (supplemental source record)'));assert.ok(group.geometryParts.some(p=>p.index===9410));assert.equal(group.geometryRepair,'reviewed-union-source-components');if(year<=1708){assert.equal(activeRecords.get(9438).name,'Kingdom of Great Britain');assert.equal(activeRecords.get(9450).geometryStatus,'rejected');}}
      for(const [source,target,from,to,losers,winners] of [...secondaryExactReviews,...thirdExactReviews,...fourthExactReviews,...fifthExactReviews,...sixthExactReviews,...provisionalExactReviews])if(from<=year&&year<=to){
        assert.ok(losers.every(part=>!hasPart(activeRecords.get(source),source,part)),`Secondary duplicate ${source}/${year}`);
        const winner=activeRecords.get(target);const retained=source===9759&&target===10351&&year===1793?winners.filter(p=>p<13):winners;assert.ok(retained.every(part=>hasPart(winner,target,part)),`Missing secondary counterpart ${target}/${year}`);
        assert.ok(winners.every(part=>winner.territorialAttributions?.some(note=>note.part===part&&note.from<=year&&year<=note.to)));
      }
      if(year>=1793&&year<=1814){
        const occupied=year===1793?10351:9759;
        const parts=year===1793?[13,14,15,16,17]:[6,7,8,9,10];
        const british=state.drawable.filter(({record})=>/British|Great Britain|United Kingdom/.test(record.name));
        for(const part of parts){
          assert.ok(!hasPart(activeRecords.get(occupied),occupied,part),`French occupation ${year}/${part}`);
          const raw=input.features[occupied].geometry.coordinates[part],box=bounds(raw);
          const intersections=british.flatMap(({geometry})=>(geometry.type==='Polygon'?[geometry.coordinates]:geometry.coordinates).filter(p=>{const b=bounds(p);return b[0]<=box[2]&&b[2]>=box[0]&&b[1]<=box[3]&&b[3]>=box[1];}).flatMap(p=>intersect(raw,p)));
          assert.ok(intersections.length&&area(polygonClipping.union(...intersections))/area([raw])>0.99,`Missing British control ${year}/${part}`);
        }
      }
      if(year>=1402&&year<=1486){
        const florence=year<=1406?6808:6924;assert.ok(!hasPart(activeRecords.get(florence),florence,0));
        const salona=state.drawable.filter(({record})=>record.editorialRestoration&&record.name.startsWith('Salona ('));
        assert.equal(salona.length,year<=1409?1:0);
        if(salona.length){assert.equal(salona[0].record.name,year===1402?'Salona (Despotate of Morea)':'Salona (Knights Hospitaller)');assert.ok(capitalInsideCountry([22.38,38.525],salona[0].geometry));}
        if(year>=1410&&year<=1414)assert.ok(hasPart(activeRecords.get(6912),6924,0));
        if(year>=1422&&year<=1428)assert.ok(hasPart(activeRecords.get(6997),6924,0));
        for(const {geometry,record} of state.overlays.filter(x=>[6814,6915,7015].includes(x.record.sourceIndex)))assert.ok(!capitalInsideCountry([22.38,38.525],geometry),`Salona in imperial overlay ${record.sourceIndex}/${year}`);
      }
      if(year>=1619&&year<=1628){
        const essequibo=state.drawable.filter(({record})=>record.name==='Essequibo (Dutch settlements)');assert.equal(essequibo.length,1);
        const hudson=state.drawable.filter(({record})=>record.name==='Dutch Hudson River settlements');assert.equal(hudson.length,year<=1621?1:0);
        if(year<=1621)assert.equal(activeRecords.get(8648).geometryStatus,'rejected');else assert.deepEqual(activeRecords.get(year<=1625?8670:8712).geometryParts.map(p=>p.part),[1]);
        const portugal=activeRecords.get(8663);assert.ok(!portugal.components.includes('Portuguese Empire'));assert.ok([0,4].every(part=>!hasPart(portugal,8663,part)));
      }
      if(year>=1629&&year<=1676){
        const north=state.drawable.filter(({record})=>record.name==='New Netherland');assert.equal(north.length,year<=1663?1:0);if(north.length)assert.ok(north[0].geometry.coordinates.every(p=>bounds(p)[1]>39));
        const guiana=state.drawable.filter(({record})=>record.name=== (year<1670?'Essequibo (Dutch settlements)':'Dutch Guiana (source region)'));assert.equal(guiana.length,1);assert.ok(guiana[0].geometry.coordinates.every(p=>bounds(p)[3]<8));
        const brazil=state.drawable.filter(({record})=>['Dutch Brazil (New Holland)','Portuguese Brazil (Recife region)'].includes(record.name));assert.equal(brazil.length,year>=1632&&year<=1658?1:0);if(brazil.length)assert.equal(brazil[0].record.name,year<1654?'Dutch Brazil (New Holland)':'Portuguese Brazil (Recife region)');
        const english=state.drawable.filter(({record})=>record.name==='English colonies of New York and New Jersey (source region)');assert.equal(english.length,year>=1664&&year<=1669?1:0);
        for(const name of ['Curaçao (Dutch colony)','Bonaire (Dutch colony)','Aruba (Dutch colony)'])assert.equal(state.drawable.filter(({record})=>record.name===name).length,year>=1636?1:0);
        const spanish=state.drawable.filter(({record})=>record.name==='Saint Martin (Spanish occupation)');assert.equal(spanish.length,year>=1633&&year<=1647?1:0);
        assert.equal(state.territorialIssues.filter(i=>i.group==='Сен-Мартен — раздел острова').length,spanish.length?0:1);
        if(spanish.length){assert.ok(capitalInsideCountry([-63.05,18.04],spanish[0].geometry));assert.ok(capitalInsideCountry([-63.08,18.08],spanish[0].geometry));assert.ok(!capitalInsideCountry([-63.05,18.22],spanish[0].geometry));for(const other of state.drawable)if(other!==spanish[0])assert.equal(polygonClipping.intersection(spanish[0].geometry.coordinates,other.geometry.coordinates).length,0,`Saint Martin overlaps ${other.record.name}/${year}`);}
        const tobago=state.drawable.filter(({record})=>record.name==='Tobago (Dutch colony)');assert.equal(tobago.length,year>=1659&&year<=1664?1:0);
        assert.equal(state.territorialIssues.filter(i=>i.group==='Тобаго — колониальные поселения').length,year<=1635||year>=1665&&year<=1669?1:0);
        if(tobago.length){assert.ok(capitalInsideCountry([-60.735,11.19],tobago[0].geometry));assert.ok(!capitalInsideCountry([-61.51,10.65],tobago[0].geometry));for(const other of state.drawable)if(other!==tobago[0])assert.equal(polygonClipping.intersection(tobago[0].geometry.coordinates,other.geometry.coordinates).length,0,`Tobago overlaps ${other.record.name}/${year}`);}
      }
      if(year>=1807&&year<=1810){const holland=sourceRecords.find(r=>r.name==='Kingdom of Holland');assert.ok(holland);assert.ok(sourceRecords.some(r=>r.name==='(Kingdom of Holland)'&&r.components.includes(holland.name)));}
      if(year>=1811&&year<=1813){assert.equal(activeRecords.get(10835).geometryStatus,'rejected');assert.equal(activeRecords.get(10767).name,'Former Dutch colonial possessions (British occupation, source aggregate)');}
      if(year>=1815&&year<=1847){
        const reunion=state.drawable.filter(({record})=>record.name==='Île Bourbon (French colony)');assert.equal(reunion.length,1);assert.ok(capitalInsideCountry([55.45,-20.88],reunion[0].geometry));
        const india=state.drawable.filter(({record})=>record.name==='French India');assert.equal(india.length,year===1815?0:1);
        if(india.length){
          const {geometry,record}=india[0],cells=geometry.coordinates;assert.equal(cells.length,year===1816?2:5);assert.equal(Boolean(record.datedGeography),year<1820);
          for(const p of cells){const b=bounds(p);assert.ok(b[0]>70&&b[2]<90&&b[1]>10&&b[3]<24);for(const {record:o} of [...state.drawable,...state.overlays].filter(({record})=>/British Empire|British Colonial Empire/.test(record.name))){let overlap=0;for(const [a,q] of parts(o.geometryId))if(a[0]<=b[2]&&a[2]>=b[0]&&a[1]<=b[3]&&a[3]>=b[1])overlap+=area(intersect(p,q));assert.ok(overlap<1e-5,`Restored Indian settlement still in British outline ${year}/${o.sourceIndex}`);}}
        }
        for(const {record:o} of [...state.drawable,...state.overlays].filter(({record})=>/British Empire|British Colonial Empire/.test(record.name)))assert.ok(!capitalInsideCountry([55.45,-20.88],pack.geometries[o.geometryId]),`Bourbon still British ${year}/${o.sourceIndex}`);
      }
      if(year>=1860&&year<=1946){
        const unresolved=state.territorialIssues.filter(i=>i.group==='Тяньцзинь — концессия');
        if(year===1916||year>=1917&&year<=1927||year===1936){
         assert.equal(unresolved.length,0,'Wrong unresolved Chinese background '+year);
         const expectedYearName=year===1916?'Republic of China (Hongxian monarchy until 22 March)':year<=1927?'Republic of China (Beiyang era; disputed source aggregate)':'Republic of China';
         assert.ok(state.drawable.some(({record})=>record.name===expectedYearName),
          'Missing corrected Chinese regional label '+year);
        }
        const cells=tianjinCells.filter(c=>c.from<=year&&year<=c.to),owner=tianjinReviewedSourceOwner(year);
        if(year>=1900&&year<=1937){
         const coastal=tianjinCells.filter(c=>c.from<=year&&year<=c.to&&
          input.features[c.index].properties.Name==='Empire of Japan'&&bounds(c.p)[1]<39);
         assert.equal(coastal.length,1,'Expected one nons sovereign coastal Japanese source cell per year '+year);
         if(year<=1936)assert.ok(!unresolved.some(i=>i.sourceIndex===coastal[0].index&&i.part===coastal[0].part),
          'Japanese garrison corridor falsely left as country territory '+year);
         else assert.ok(unresolved.some(i=>i.sourceIndex===coastal[0].index&&i.part===coastal[0].part),
          '1937 Japanese campaign change must remain unresolved');
        }
        if(year>=1900&&year<=1904){
         const german=tianjinCells.filter(c=>c.from<=year&&year<=c.to&&
           input.features[c.index].properties.Name==='German Empire'&&bounds(c.p)[1]<39);
         assert.equal(german.length,1,'Former German/Japanese overlap input absent '+year);
         assert.ok(!unresolved.some(i=>i.sourceIndex===german[0].index&&i.part===german[0].part),
           'German source overlap should be closed after removing false Japanese sovereign polygon '+year);
        }
        if(year>=1900&&year<=1902){
         assert.equal(cells.length,8,'Unexpected Qing/Tianjin source cell count '+year);
         assert.equal(unresolved.length,0,'The Japanese coastal garrison is not a sovereign polity '+year);
         const qing=state.drawable.filter(({record})=>record.sourceName==='Qing Dynasty'&&record.sourceWikidata==='Q8733');
         assert.ok(qing.length,'Qing sovereign regional background missing '+year);
        }
        for(const c of cells){
          // A transferred component can belong to a regional owner, but never
          // to its original concession row or any unrelated aggregate.
          const r=activeRecords.get(c.index);assert.ok(!hasPart(r,c.index,c.part)||r.sourceName===owner&&r.geometryParts?.some(p=>p.index!==c.index),`False concession ${c.index}/${year}`);
          const issue=unresolved.find(i=>i.sourceIndex===c.index&&i.part===c.part);
          if(issue){tianjinOpen++;assert.equal(issue.hash,c.hash);assert.ok(issue.sources.length>=3);}
          else{tianjinClosed++;assert.ok(owner);const regional=state.drawable.filter(({record})=>record.sourceName===owner);assert.ok(regional.length);const b=bounds(c.p),local=regional.flatMap(({record})=>parts(record.geometryId).filter(([a])=>a[0]<b[2]&&a[2]>b[0]&&a[1]<b[3]&&a[3]>b[1]).map(([,p])=>p));assert.ok(local.length);assert.equal(polygonClipping.difference(c.p,...local).length,0,`Uncovered Tianjin ${c.index}/${year}`);}
          const b=bounds(c.p);for(const {record} of [...state.drawable,...state.overlays])if(tianjinSourceNames.has(record.sourceName)||record.role==='composite')if(record.sourceName!==owner)assert.ok(!parts(record.geometryId).some(([a,p])=>a.every((v,i)=>v===b[i])&&componentHash(p)===c.hash),`False concession in ${record.sourceIndex}/${year}`);
        }
        assert.ok(unresolved.every(i=>cells.some(c=>c.index===i.sourceIndex&&c.part===i.part)));
      }
      if(year===1859){
        const unresolved=state.territorialIssues.filter(i=>i.group==='Кохинхина — кампания 1859 года');assert.deepEqual(unresolved.map(i=>i.part).sort((a,b)=>a-b),[9,10]);assert.ok(unresolved.every(i=>i.sourceIndex===11657));
        const caledonia=activeRecords.get(11657);assert.ok([9,10].every(part=>!hasPart(caledonia,11657,part)));assert.ok(pack.geometries[caledonia.geometryId].coordinates.every(p=>bounds(p)[0]>160));
      }
      if(year>=1860&&year<=1886){
        const early=sourceRecords.find(r=>r.sourceName==='French Indochina');assert.ok(early);
        const expected=year<=1866?'French campaign in Cochinchina':year===1867?'French Cochinchina':year<=1884?'French Cochinchina and Cambodia (source aggregate)':'French possessions in Indochina (source aggregate)';assert.equal(early.name,expected);assert.equal(early.nameStatus,'reviewed');
        for(const r of sourceRecords.filter(r=>r.role==='composite'&&r.sourceComponents?.includes('French Indochina')))assert.ok(r.components.includes(expected)&&!r.components.includes('French Indochina'));
        if(year<=1866){const issues=state.territorialIssues.filter(i=>i.group==='Кохинхина — поэтапная уступка');assert.equal(issues.length,2);for(const issue of issues){assert.equal(early.geometryStatus,'rejected');assert.ok(!hasPart(early,issue.sourceIndex,issue.part));for(const {geometry,record} of state.overlays.filter(({record})=>record.name.includes('French')))assert.ok(!geometry.coordinates.some(p=>componentHash(p)===issue.hash),`Cochinchina false extent ${record.sourceIndex}/${year}`);}}
      }
      if(year>=1848&&year<=1957){
        const settlements=state.drawable.filter(({record})=>record.name==='French India');
        assert.equal(settlements.length,year<1954?1:0,`French India ${year}`);
        if(settlements.length){
          const {geometry,record}=settlements[0];assert.equal(geometry.coordinates.length,year<1950?5:4);assert.equal(record.editorialRestoration,true);
          for(const p of geometry.coordinates){const b=bounds(p);assert.ok(b[0]>72&&b[2]<89&&b[1]>9&&b[3]<24);for(const {record:o} of [...state.drawable,...state.overlays].filter(({record})=>/British Empire|British Raj|Republic of India/.test(record.name))){let overlap=0;for(const [a,q] of parts(o.geometryId))if(a[0]<=b[2]&&a[2]>=b[0]&&a[1]<=b[3]&&a[3]>=b[1])overlap+=area(intersect(p,q));assert.ok(overlap<1e-5,`French India overlap ${year}/${o.sourceIndex}`);}}
        }
        const reunion=state.drawable.filter(({record})=>record.name.startsWith('Réunion (French'));assert.equal(reunion.length,1);assert.equal(reunion[0].record.name,year<1946?'Réunion (French colony)':'Réunion (French overseas department)');assert.ok(capitalInsideCountry([55.45,-20.88],reunion[0].geometry));
        const nc=state.drawable.filter(({record})=>record.name==='New Caledonia');assert.equal(nc.length,year>=1853?1:0);if(nc.length){assert.equal(nc[0].geometry.coordinates.length,year<=1863?1:year===1864?2:3);assert.equal(Boolean(nc[0].record.datedGeography),year<1856);assert.ok(capitalInsideCountry([166.45,-22.27],nc[0].geometry));}
        if(year>=1856&&year<=1864){const issues=state.territorialIssues.filter(i=>i.group==='Луайоте — местные вождества');assert.equal(issues.length,year<1864?2:1);for(const issue of issues){assert.ok(!hasPart(activeRecords.get(issue.sourceIndex),issue.sourceIndex,issue.part));assert.ok(issue.sources.length>=3);for(const {record,geometry} of [...state.drawable,...state.overlays])if(record.name.includes('French')||record.name==='New Caledonia')assert.ok(!geometry.coordinates.some(p=>componentHash(p)===issue.hash));}}
        const kerguelen=state.drawable.filter(({record})=>record.name.startsWith('Kerguelen ('));assert.equal(kerguelen.length,year>=1893?1:0);if(kerguelen.length){assert.equal(kerguelen[0].record.name,year<1924?'Kerguelen (French possession)':year<1955?'Kerguelen (dependency of French Madagascar)':'Kerguelen (French Southern and Antarctic Lands)');assert.ok(capitalInsideCountry([70.22,-49.35],kerguelen[0].geometry));assert.equal(Boolean(kerguelen[0].record.datedGeography),year<1895);}
        for(const {record,geometry} of state.drawable.filter(({record})=>!record.editorialRestoration&&!record.datedGeography&&['French Indochina','French Second Republic','Second French Empire','New Caledonia'].includes(record.sourceName))){
          assert.ok(!capitalInsideCountry([55.45,-20.88],geometry),`Réunion mislabeled ${year}/${record.sourceIndex}`);
          assert.ok(!geometry.coordinates.some(p=>{const b=bounds(p);return b[0]>72&&b[2]<89&&b[1]>9&&b[3]<24;}),`French India mislabeled ${year}/${record.sourceIndex}`);
          if(record.sourceName==='French Indochina'){assert.ok(!capitalInsideCountry([166.45,-22.27],geometry));assert.ok(!capitalInsideCountry([70.22,-49.35],geometry));}
        }
        for(const {geometry} of state.overlays.filter(({record})=>record.sourceName==='(Vichy France)')){
          assert.ok(!capitalInsideCountry([79.80,11.86],geometry));assert.ok(!capitalInsideCountry([166.45,-22.27],geometry));if(year>=1942)assert.ok(!capitalInsideCountry([55.45,-20.88],geometry));
        }
        if(year>=1950){const india=state.drawable.find(({record})=>record.name==='Republic of India');assert.ok(india);assert.ok(capitalInsideCountry([88.43,22.71],india.geometry),`Chandernagore missing from India ${year}`);if(year>=1954)for(const p of [[75.60,11.53],[79.8,11.86],[79.80,10.95],[82.34,16.81]])assert.ok(capitalInsideCountry(p,india.geometry),`Ceded French settlement missing ${year}/${p}`);}
      }
      if(year>=1953&&year<=1957){
        for(const [name,point] of [['Kingdom of Laos',[102.6,17.97]],['Kingdom of Cambodia',[104.92,11.56]]]){const x=state.drawable.filter(({record})=>record.name===name);assert.equal(x.length,1,`${name}/${year}`);assert.ok(capitalInsideCountry(point,x[0].geometry));assert.equal(Boolean(x[0].record.datedGeography),year<=1955);for(const {geometry} of state.overlays.filter(({record})=>record.sourceName==='(French Fourth Republic)'))assert.ok(!capitalInsideCountry(point,geometry));}
        if(year>=1954){assert.ok(!state.drawable.some(({record})=>record.name==='French Indochina'));
          for(const [name,point,other] of [['Democratic Republic of Vietnam',[105.8,21],[106.7,10.8]],[year===1954?'State of Vietnam':'Republic of Vietnam',[106.7,10.8],[105.8,21]]]){const x=state.drawable.filter(({record})=>record.name===name);assert.equal(x.length,1,`${name}/${year}`);assert.ok(capitalInsideCountry(point,x[0].geometry));assert.ok(!capitalInsideCountry(other,x[0].geometry));assert.equal(Boolean(x[0].record.datedGeography),year<=1955);for(const {geometry} of state.overlays.filter(({record})=>record.sourceName==='(French Fourth Republic)'))assert.ok(!capitalInsideCountry(point,geometry));}
          if(year>=1956){const x=state.drawable.find(({record})=>record.name==='Republic of Vietnam');assert.ok(capitalInsideCountry([107.58,12.4],x.geometry));for(const {geometry} of state.overlays.filter(({record})=>record.sourceName==='(French Fourth Republic)'))assert.ok(!capitalInsideCountry([107.58,12.4],geometry));}
        }
      }
      if(year>=1830&&year<=1847){assert.equal(sourceRecords.filter(r=>r.name==='July Monarchy').length,1);assert.equal(state.overlays.filter(({record})=>record.name==='(July Monarchy)').length,1);assert.ok(!sourceRecords.some(r=>r.name==='Bourbon Kingdom of France'||r.memberOf.includes('(Bourbon Kingdom of France)')));}
      if(year===1848){assert.equal(activeRecords.get(11472).name,'(French colonial possessions, 1848)');assert.deepEqual(activeRecords.get(11458).memberOf,['(French colonial possessions, 1848)']);}
      if(year===1940){const r=activeRecords.get(12755);assert.ok(!r.components.includes('Netherlands'));assert.ok(!hasPart(r,12755,17));}
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
      if(year>=1846&&year<=1974){
        const source=sourceRecords.find(r=>r.sourceName===(year<1958?'French Africa':'French Fifth Republic'));assert.ok(source);
        const raw=input.features[source.sourceIndex].geometry.coordinates,parts=earlyComorosHashes.map(h=>raw.findIndex(p=>componentHash(p)===h));assert.ok(parts.every(i=>i>=0));
        const labels=year<1886?['Mayotte (French colony)','Mohéli (local rulers)','Anjouan (sultanate)',null]:
         year<1908?['Mayotte (French colony)','Mohéli (French protectorate)','Anjouan (French protectorate)','Grande Comore (French protectorate)']:
         year<1912?['Mayotte (French colony, Madagascar administration)','Mohéli (French protectorate, Madagascar administration)','Anjouan (French protectorate, Madagascar administration)','Grande Comore (French protectorate, Madagascar administration)']:
         Array(4).fill(year<1946?'Comoros (Madagascar dependencies)':year<1961?'Comoros (French overseas territory)':'Comoros (autonomous French overseas territory)');
        for(const [i,part] of parts.entries()){
          const h=earlyComorosHashes[i];assert.ok(!hasPart(source,source.sourceIndex,part));const owners=state.drawable.filter(({geometry})=>geometry.coordinates.some(p=>componentHash(p)===h));
          if(labels[i]){assert.equal(owners.length,1,`Comoro owner ${year}/${i}`);assert.equal(owners[0].record.name,labels[i]);assert.ok(owners[0].record.editorialRestoration);assert.ok(owners[0].record.review.sources.length>=4);
           if(year>=1908&&year<=1911){
             assert.ok(owners[0].record.review.reasonRu.includes('9 апреля 1908'));
             assert.ok(owners[0].record.review.reasonRu.includes('25 июля 1912'));
             assert.ok(owners[0].record.review.sources.includes('https://www.persee.fr/doc/outre_1631-0438_2005_num_92_348_4160'));
           }}
          else{assert.equal(owners.length,0);assert.ok(state.territorialIssues.some(r=>r.sourceIndex===source.sourceIndex&&r.part===part&&r.group==='Коморы'));}
          for(const {geometry,record} of state.overlays.filter(({record})=>/French|France/.test(record.sourceName)))if(year<1886&&i!==0||year>=1942&&record.sourceName==='(Vichy France)')assert.ok(!geometry.coordinates.some(p=>componentHash(p)===h),`Premature or outdated Comoro overlay ${year}/${i}`);
        }
      }
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
      const cores=state.drawable.filter(({record})=>record.mapPartition?.kind==='documented-core');
      const expectedCores=documentedCores.flatMap(definition=>definition.periods
        .filter(period=>period.from<=year&&year<=period.to)
        .map(period=>({definition,period})));
      assert.equal(cores.length,expectedCores.length,`Documented interior count in ${year}`);
      for(const {definition,period} of expectedCores){
        const current=cores.filter(({record})=>record.name===period.name);
        assert.equal(current.length,1,`Documented interior ${definition.id}/${year}`);
        const core=current[0];
        documentedCoreByGroup[definition.id]=(documentedCoreByGroup[definition.id]??0)+1;
        assert.equal(core.record.mapPartition.kind,'documented-core');
        if(definition.id==='cap-corse'){
          assert.ok(capitalInsideCountry([9.4108,42.86],core.geometry));
          assert.ok(!capitalInsideCountry([9.151,42.306],core.geometry));
          assert.equal(state.territorialIssues.filter(i=>i.group===(year===1768?exactConflictGroupPrefix+'Корсика — переход 1768 года':'Corsica')).length,2);
        }else if(definition.id==='malacca-fort'){
          assert.ok(capitalInsideCountry([102.249609,2.192621],core.geometry));
          assert.ok(!capitalInsideCountry([102.0913,2.5897],core.geometry));
        }else{
          assert.ok(definition.id.startsWith('ceylon-'));
          assert.ok(core.record.review.reasonRu.match(/неуточн|неизвест/));
          assert.ok(polygonClipping.intersection(core.geometry.coordinates,definition.mask).length);
          assert.equal(polygonClipping.difference(core.geometry.coordinates,definition.mask).length,0,
            `Ceylon documented fragment must stay inside its conservative mask ${definition.id}/${year}`);
        }
        for(const other of state.drawable)if(other!==core)assert.equal(
          polygonClipping.intersection(core.geometry.coordinates,other.geometry.coordinates).length,0,
          `Documented interior overlaps ${other.record.name}/${year}/${definition.id}`);
      }
      if(year>=1512&&year<=1608){
        assert.equal(mindanaoIssues.length,year>=1521&&year<=1581?2:1);
        assert.ok(mindanaoIssues.every(i=>i.sources?.length>=3&&i.sources.every(s=>s.startsWith('https://'))));
        if(year<=1581)assert.ok(!hasPart(activeRecords.get(7792),7792,7));
        if(year>=1521)assert.equal(activeRecords.get(7904).geometryStatus,'rejected');
      }else assert.equal(mindanaoIssues.length,0);
      const expectedCenters=[...(year>=1521&&year<=1608?['maguindanao']:[]),...(year>=1521&&year<=1565?['butuan']:[]),...(year>=1579&&year<=1608?['buayan']:[]),...(year===1515?['malabang']:[]),...(year===1521?['kipit']:[]),...(year===1578?['butuan-1578']:[]),...(year>=1757&&year<=1767?['corte','bastia','saint-florent',year<1764?'algajola-genoa':year===1767?'algajola-1767':'algajola','ajaccio','calvi','bonifacio']:[]),...(year>=1757&&year<=1762?['cap-corse']:[]),...(year>=1677&&year<=1885?['iconi','itsandra','ntsudjini']:[]),...(year===1844?['moroni-1844','mitsamiouli-1844']:[]),...(year>=1641&&year<=1647?['melaka','linggi-estuary','kesang-estuary']:[])];
      if(year>=1641&&year<=1647){
        const issues=state.territorialIssues.filter(i=>i.group==='Малакка');
        assert.equal(issues.length,year<1645?1:2);
        assert.ok(issues.every(i=>i.sources.length>=4));
        assert.ok(!hasPart(activeRecords.get(8866),8866,11));
        if(year>=1645)assert.ok(!hasPart(activeRecords.get(8910),8910,10));
      }
      if(year===1640)assert.ok(hasPart(activeRecords.get(8866),8866,11));
      if(year>=1612&&year<=1847){
        const cell=input.features[8613].geometry.coordinates,b=bounds(cell),issue=state.territorialIssues.find(i=>i.group==='Давао — местные правители');assert.ok(issue&&issue.sourceIndex===8613&&issue.part===0&&issue.sources.length>=4);assert.equal(activeRecords.get(8613).geometryStatus,'rejected');
        const spanish=[...state.drawable,...state.overlays].filter(({record})=>!record.editorialRestoration&&!record.datedGeography&&['Spanish Empire','(Spanish Empire)'].includes(record.sourceName));assert.equal(spanish.length,2,`Spanish Davao source layers ${year}`);
        for(const {record} of spanish){assert.ok(record.geometrySubtractions?.some(p=>p.index===8613&&p.part===0));let overlap=0;for(const [a,p] of parts(record.geometryId))if(a[0]<b[2]&&a[2]>b[0]&&a[1]<b[3]&&a[3]>b[1])overlap+=area(intersect(p,cell));assert.ok(overlap<1e-10,`Spanish Davao overlap ${year}/${record.sourceIndex}`);}
        expectedCenters.push('cotabato-late','buayan-late');if(year>=1620)expectedCenters.push(year<1844?'davao-local':'davao-cession');
      }
      if(year>=1848&&year<=1852){
        const source=year===1848?8613:11490,cell=input.features[source].geometry.coordinates;
        assert.equal(activeRecords.get(source).geometryStatus,'rejected');
        const spain=state.drawable.find(({record})=>record.sourceIndex===11140);
        assert.ok(spain&&spain.record.geometryParts.some(p=>p.index===source&&p.part===0));
        assert.equal(polygonClipping.difference(cell,spain.geometry.coordinates).length,0);
        for(const entry of state.drawable)if(entry!==spain)assert.equal(polygonClipping.intersection(entry.geometry.coordinates,cell).length,0,`Davao overlaps ${entry.record.name}/${year}`);
      }
      if(year===1859)expectedCenters.push('saigon-1859');
      if(year>=1860&&year<=1861)expectedCenters.push('saigon-1860');
      if(year>=1862&&year<=1866)expectedCenters.push('saigon-1862','bienhoa-1862','mytho-1862');
      if(year>=1641&&year<=1647)expectedCenters.push('malacca-fort');
      if(year===1641)expectedCenters.push('naning-1641','rembau-1641');
      if(year===1646)expectedCenters.push('rembau-1646');
      if(year===1768)expectedCenters.push('corte-1768','bonifacio-1768');
      if(year>=1662&&year<=1664)expectedCenters.push('cape-coast-castle','mouri-fort');
      if(year>=1552&&year<=1555)expectedCenters.push('muscat-port');
      if(year>=1529&&year<=1539)expectedCenters.push(year<1536?'bra-imperial':'bra-french',year<1531?'cherasco-before-1531':year<=1536?'cherasco-savoy':year===1537?'cherasco-war':'cherasco-after-1537');
      if(year>=410&&year<=442)expectedCenters.push('kath-afrighid');
      if(year>=1809&&year<=1819)expectedCenters.push(year<1817?'goree-british':'goree-french');
      if(year>=1638&&year<=1641)expectedCenters.push('batticaloa-voc');
      if(year===1639)expectedCenters.push('trincomalee-voc');
      if(year>=1640&&year<=1658)expectedCenters.push('galle-voc',year<1656?'colombo-portuguese':'colombo-voc',year<1658?'jaffna-portuguese':'jaffna-voc');
      const centers=historicalUnresolvedCenters(year,state.territorialIssues);
      assert.deepEqual(centers.map(c=>c.id).sort(),expectedCenters.map(id=>`historical-center-${id}`).sort());
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
      const treatyPorts=historicalTreatyPortCenters(year);assert.equal(treatyPorts.length,year>=1860&&year<=1946?1:0);if(treatyPorts.length){assert.equal(treatyPorts[0].id,'historical-center-tianjin-treaty-port');assert.ok(treatyPorts[0].description.includes('Точка'));assert.equal(treatyPorts[0].year,year);}
      if(year>=1629&&year<=1814){const kandy=state.drawable.filter(({record})=>record.name==='Kingdom of Kandy');assert.equal(kandy.length,1);assert.equal(kandy[0].record.nameRu,'Королевство Канди');assert.deepEqual(kandy[0].record.memberOf,[]);assert.ok(kandy[0].record.sourceMemberOf.length);}
      if(year>=1797&&year<=1884){
        const route=capeTerritoryRoutes.find(([source])=>input.features[source].properties.FromYear<=year&&input.features[source].properties.ToYear>=year);assert.ok(route);const [source,sierra,seychelles,gambia,goree]=route;
        const cape=activeRecords.get(source);assert.ok(cape);assert.equal(cape.geometryStatus,year>=1803&&year<=1805?'rejected':'candidate');
        const expected=[[sierra,year<1808?capeTerritories.company:capeTerritories.sierra],...(seychelles<0?[]:[[seychelles,capeTerritories.seychelles]]),...(gambia<0?[]:[[gambia,capeTerritories.gambia]]),...(year>=1834&&year<=1839?[[3,capeTerritories.socotra]]:[])];
        for(const [part,d] of expected){const found=state.drawable.filter(({record})=>record.name===d.name);assert.equal(found.length,1,`Missing separate colonial part ${year}/${d.name}`);assert.deepEqual(found[0].record.geometryParts,[{index:source,part}]);assert.deepEqual(found[0].record.memberOf,d.memberOf);assert.ok(!hasPart(cape,source,part));}
        const groups=state.overlays.filter(({record})=>record.name==='(British Empire)'||record.components.includes('British Cape Colony'));assert.ok(groups.length);
        for(const {record:r,geometry:g} of groups){assert.equal(r.components.includes('British Cape Colony'),!(year>=1803&&year<=1805));for(const [,d] of expected)assert.equal(r.components.includes(d.name),d.memberOf.length>0);if(year>=1834&&year<=1839)assert.ok(!g.coordinates.some(p=>componentHash(p)===componentHash(input.features[source].geometry.coordinates[3])));}
        if(goree>=0){const hash=componentHash(input.features[source].geometry.coordinates[goree]);assert.ok(state.territorialIssues.some(i=>i.group==='Горе — материковый контур'&&i.hash===hash));assert.ok(!state.drawable.some(({geometry})=>geometry.coordinates.some(p=>componentHash(p)===hash)));for(const {geometry} of groups)assert.ok(!geometry.coordinates.some(p=>componentHash(p)===hash));}
      }
      if(year>=1629&&year<=1637){
        const coast=state.drawable.filter(({record})=>record.name==='Portuguese Ceylon');assert.equal(coast.length,1);
        const [source,,,parts]=ceylonEarlyRoutes.find(([,from,to])=>year>=from&&year<=to);
        assert.deepEqual(coast[0].record.geometryParts,parts.map(part=>({index:source,part})));assert.deepEqual(coast[0].record.memberOf,['(Portuguese Empire)','(Spanish Empire)']);
        const kandy=state.drawable.find(({record})=>record.name==='Kingdom of Kandy');assert.equal(polygonClipping.intersection(coast[0].geometry.coordinates,kandy.geometry.coordinates).length,0);
        for(const point of [[79.86,6.93],[80.025,9.66],[80.22,6.03],[81.23,8.58],[81.69,7.71]]){const owners=state.drawable.filter(({geometry})=>capitalInsideCountry(point,geometry));assert.equal(owners.length,1);assert.equal(owners[0].record.id,coast[0].record.id);}
        for(const name of coast[0].record.memberOf){const o=state.overlays.find(({record})=>record.name===name);assert.ok(o&&o.record.components.includes('Portuguese Ceylon'));assert.ok(!capitalInsideCountry([80.635,7.29],o.geometry));}
      }
      // Source-backed micro-geometries inside the *fort sites*, not a
      // fictitious whole-coast VOC boundary. The original 24 disputed
      // Ceylon component-years must remain explicitly pending.
      if(year>=1638&&year<=1658){
        const expected=[
          ['ceylon-batticaloa-fort',1638,1641,'Batticaloa (VOC captured fortress, documented interior)'],
          ['ceylon-trincomalee-fort',1639,1639,'Trincomalee (VOC captured fortress, documented interior)'],
          ['ceylon-galle-fort',1640,1658,'Galle Fort (VOC, documented interior only)'],
          ['ceylon-colombo-fort',1656,1658,'Colombo Fort (VOC, documented interior only)'],
          ['ceylon-jaffna-fort',1658,1658,'Jaffna Fort (VOC, documented interior only)']
        ];
        for(const [id,from,to,name] of expected){
          const cores=state.drawable.filter(({record})=>record.name===name);
          assert.equal(cores.length,year>=from&&year<=to?1:0,`VOC fort core ${id}/${year}`);
          if(cores.length){
            const {record,geometry}=cores[0],definition=ceylonFortCores.find(c=>c.id===id);
            assert.equal(record.mapPartition.kind,'documented-core');
            assert.ok(/неуточн|неизвест/.test(record.review.reasonRu));
            assert.ok(polygonClipping.intersection(geometry.coordinates,definition.mask).length);
            assert.equal(polygonClipping.difference(geometry.coordinates,definition.mask).length,0);
          }
        }
        assert.ok(state.territorialIssues.some(i=>i.group==='Цейлон — война VOC'),
          'A few confirmed fort interiors must not hide the unresolved coastal frontier');
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
      if(year>=1638&&year<=1658){
        const [source,,,batti,west,trinco]=ceylonWarRoutes.find(([,from,to])=>year>=from&&year<=to);
        const kandy=state.drawable.find(({record})=>record.name==='Kingdom of Kandy');assert.ok(kandy);
        const coast=state.drawable.filter(({record})=>record.name==='Portuguese Ceylon');assert.equal(coast.length,year<1640?1:0);
        const expected=year===1638?[west,trinco]:year===1639?[west]:[];
        if(expected.length)assert.deepEqual(coast[0].record.geometryParts,expected.map(part=>({index:source,part})));
        const issues=state.territorialIssues.filter(i=>i.group==='Цейлон — война VOC');
        const pending=[...(year>=1640?[west]:[]),...(year<1642?[batti]:[]),...(year===1639?[trinco]:[])];
        assert.deepEqual(issues.map(i=>i.part).sort((a,b)=>a-b),pending.sort((a,b)=>a-b));
        for(const [part,yearOfTransfer,point] of [[batti,1642,[81.69,7.71]],[trinco,1640,[81.23,8.58]]]){
          if(year>=yearOfTransfer){assert.ok(hasPart(kandy.record,source,part));assert.ok(capitalInsideCountry(point,kandy.geometry));}
          else if(pending.includes(part))assert.ok(!state.drawable.some(({geometry})=>capitalInsideCountry(point,geometry)));
        }
        for(const o of state.overlays.filter(({record})=>record.name==='(Portuguese Empire)'||record.name==='(Spanish Empire)')){
          assert.ok(!capitalInsideCountry([80.635,7.29],o.geometry));
          for(const issue of issues)assert.ok(!o.geometry.coordinates.some(p=>componentHash(p)===issue.hash));
        }
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
      const documented=state.coverageGaps.filter(g=>g.kind==='documented-state');
      if(year>=1986&&year<=1989){
        const plottedMarshall=state.drawable.some(({record:r})=>
          r.sourceWikidata==='Q709'||/Marshall Islands/i.test(r.name));
        assert.equal(documented.filter(g=>g.name==='Marshall Islands').length,plottedMarshall?0:1,
         `Marshall independence coverage at ${year}`);
        for(const gap of documented){
          assert.equal(gap.date,'1986-10-21');
          assert.equal(gap.source,'https://history.state.gov/countries/marshall-islands');
        }
      }else assert.equal(documented.length,0,`Unexpected statehood gap at ${year}`);
      assert.deepEqual(state.coverageGaps.filter(g=>g.kind!=='documented-state'),membershipWarnings,
       `UN admission gaps not preserved at ${year}`);
      if(identityCollisions.length)yearsWithIdentityCollisions++;
      if(sharedGeometry.length)yearsWithSharedGeometry++;
      admissionWarnings+=membershipWarnings.length;
      years++;recordYears+=state.records.length;rejectedYears+=state.rejected.length;if(!state.records.length)emptyYears++;
      rows.push({year,status:state.status,records:state.records.length,drawable:state.drawable.length,overlays:state.overlays.length,rejected:state.rejected.length,identityCollisions,sharedGeometry,expectedLayerOverlaps,groupLinkWarnings,membershipWarnings,semanticReview:'not-complete',visualReview:'pending'});
    }
  }
  assert.equal(years,5424);
  assert.equal(batchReady,293);assert.equal(batchResolved,541);assert.equal(batchPending,155);
  assert.equal(sourceRecordYears,254984);assert.equal(restoredRecordYears,2201);assert.equal(externalRecordYears,477);assert.equal(extended,693);assert.equal([...pendingExtensionsByYear.values()].flat().length,43);
  assert.equal(tianjinClosed,397);assert.equal(tianjinOpen,8);
  assert.equal(unresolvedSourceYears,769);assert.equal(unresolvedRegionYears,690);
  assert.equal(fifthExactReviews.reduce((sum,[,,from,to,parts])=>sum+(to-from+1)*parts.length,0),18);
  assert.equal(sixthExactReviews.reduce((sum,[,,from,to,parts])=>sum+(to-from+1)*parts.length,0),2);
  assert.equal(exactConflictPendingReviews.length,8);
  assert.equal(unresolvedExactComponentYears,94);assert.equal(unresolvedExactSourceYears,188);
  const provisionalComponentYears=provisionalExactReviews.reduce((sum,[,,from,to,parts])=>sum+(to-from+1)*parts.length,0);
  assert.equal(provisionalExactReviews.length,1);assert.equal(provisionalComponentYears,3);
  assert.deepEqual(Object.fromEntries(Object.entries(territorialOpenByGroup).map(([g,v])=>[g,v.sourceYears])),{Mindanao:158,Corsica:22,'Коморы':213,'Малакка':10,'Горе — материковый контур':11,'Цейлон — война VOC':24,'Дения — материковый контур':9,'Сен-Мартен — раздел острова':33,'Тобаго — колониальные поселения':12,'Тяньцзинь — концессия':98,'Кохинхина — кампания 1859 года':2,'Луайоте — местные вождества':17,'Кохинхина — поэтапная уступка':14,'Давао — местные правители':236});
  assert.equal(Object.values(exactOpenByGroup).reduce((sum,v)=>sum+v.componentYears,0),unresolvedExactComponentYears);
  assert.deepEqual(documentedCoreByGroup,{'cap-corse':8,'malacca-fort':7,'ceylon-batticaloa-fort':4,'ceylon-trincomalee-fort':1,'ceylon-galle-fort':19,'ceylon-colombo-fort':3,'ceylon-jaffna-fort':1});
  const groupLinkIssues=rows.flatMap(r=>r.groupLinkWarnings??[]);
  console.log('Remaining group links:',JSON.stringify([...new Set(groupLinkIssues.map(i=>JSON.stringify(i)))].map(s=>JSON.parse(s))));
  assert.equal(new Set(groupLinkIssues.map(i=>JSON.stringify(i))).size,7);assert.equal(groupLinkIssues.length,29);
  const auditLedger={territorial:{total:6524,resolved:6524-unresolvedSourceYears,open:unresolvedSourceYears,openRegionYears:unresolvedRegionYears,openByGroup:territorialOpenByGroup},exactPairs:{total:82,resolved:82-exactConflictPendingReviews.length,confirmed:82-exactConflictPendingReviews.length-provisionalExactReviews.length,provisional:provisionalExactReviews.length,provisionalComponentYears,open:exactConflictPendingReviews.length,openComponentYears:unresolvedExactComponentYears,openSourceYears:unresolvedExactSourceYears,openByGroup:exactOpenByGroup},partialReconstructions:{componentYears:Object.values(documentedCoreByGroup).reduce((a,b)=>a+b,0),byGroup:documentedCoreByGroup},groupLinks:{openGroups:new Set(groupLinkIssues.map(i=>JSON.stringify(i))).size,openAnnualOccurrences:groupLinkIssues.length}};
  console.log(`Historical audit ledger: ${JSON.stringify(auditLedger)}`);
  assert.equal(admissionWarnings,1,'Independent-state coverage must not regress');
  assert.deepEqual(rows.filter(r=>r.membershipWarnings?.length).map(r=>[r.year,...r.membershipWarnings.map(w=>w.name)]),[[1971,'United Arab Emirates']]);
  assert.equal(historicalGapLocators['United Arab Emirates'].iso,'ARE');
  assert.match(historicalGapLocators['United Arab Emirates'].historicalNote,/10 февраля 1972/);
  assert.equal(datedRecordYears,62);assert.equal(checkedSupplementYears,130);
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
  assert.deepEqual(partsAt(1802,10461),[0]);
  assert.equal(revisionAt(1803,10461).geometryStatus,'rejected');
  assert.equal(revisionAt(1805,10461).geometryStatus,'rejected');
  assert.deepEqual(partsAt(1806,10461),[0]);
  assert.equal(revisionAt(1804,10461).name,'British Cape Colony (inactive source record)');
  assert.equal(revisionAt(1806,10461).name,'British Cape Colony');
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
  assert.deepEqual(partsAt(1825,11140),Array.from({length:43},(_,i)=>i));
  assert.ok(revisionAt(1825,11140).geometrySubtractions.some(p=>p.index===8613&&p.part===0));
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
