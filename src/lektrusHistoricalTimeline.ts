/** Annual historical data contract. Imported polygons are evidence candidates,
 * not independently verified borders. No interpolation or nearest-year fallback. */
export const HISTORY_SCHEMA = 5;
export const HISTORY_FIRST_YEAR = -3400;
export const HISTORY_LAST_YEAR = 2024;
export type HistoricalGeometry = {type: 'Polygon' | 'MultiPolygon'; coordinates: unknown};
export type HistoricalTerritorialIssue={part:number;hash:string;from:number;to:number;group:string;reason:string;evidence:string;counterpartName:string;geometryId:string;sources?:string[]};
export type HistoricalTerritorialAttribution={part:number;hash:string;from:number;to:number;group:string;reason:string;sources:string[]};
export type HistoricalRevision = {
  id: string; entityId: string; geometryId: string;
  role: 'polity' | 'composite' | 'relation' | 'settlement';
  sourceRole?: 'polity';
  components: string[]; memberOf: string[]; sourceSeshatId: string; sourceWikipedia: string;
  sourceComponents?: string[]; sourceMemberOf?: string[];
  sourceGeometryId?: string; geometryRepair?: 'retracted-zero-area-interior-edges' | 'reviewed-source-components' | 'reviewed-union-source-components' | 'reviewed-difference-source-components' | 'reviewed-map-partition';
  mapPartition?: {kind?:'documented-core';area:number;outlineGeometryId:string;evidence:string};
  geometryParts?: {index:number;part:number}[];
  geometryTemporalWitnesses?: {before:{index:number;part:number};after:{index:number;part:number};year:number;hash:string}[];
  /** Separate public-domain cartographic supplement, never a historical shoreline survey. */
  externalGeography?: {iso:string;neId:number;datasetHash:string;url:string;kind:'modern-island-outline'|'modern-stable-land-border'};
  boundaryAdjustment?: {baseGeometryId:string;cuts:{cutGeometryId:string;iso:string}[];exhausted?:true};
  datedGeography?: {referenceYear:number;outlineGeometryId:string;trimGeometryIds:string[];parts:number[]};
  geometrySubtractions?: {index:number;part:number}[];
  territorialIssues?: HistoricalTerritorialIssue[];
  territorialAttributions?: HistoricalTerritorialAttribution[];
  editorialRestoration?: true;
  name: string; nameRu?: string; sourceName: string; sourceWikidata: string;
  sourceIndex: number; sourceFrom: number; sourceTo: number;
  from: number; to: number; nameStatus: 'candidate' | 'reviewed';
  geometryStatus: 'candidate' | 'rejected';
  review?: {reason: string; reasonRu?:string; sources: string[]};
};
export type HistoricalPack = {
  schema: 5; from: number; to: number;
  records: HistoricalRevision[]; geometries: Record<string, HistoricalGeometry>;
  coverageGaps: Record<string, HistoricalCoverageGap[]>;
};
export type HistoricalCoverageGap={name:string;date:string;source:string;reason:string};
export type HistoricalBlock = {from: number; to: number; file: string; sha256: string; bytes: number; gzipBytes: number};
export type HistoricalManifest = {
  schema: 5; from: number; to: number; source: {name: string; version: string; url: string; license: string; sha256: string};
  blocks: HistoricalBlock[];
  counts: {sourcePolities: number; sourceComposites: number; sourceRelations: number; zeroBoundaryRecords: number; revisions: number; uniqueGeometries: number; rejectedRevisions: number; reviewedNames: number};
};

export function validHistoricalYear(year: number): boolean {
  return Number.isInteger(year) && year !== 0 && year >= HISTORY_FIRST_YEAR && year <= HISTORY_LAST_YEAR;
}
export function historicalYearOrdinal(year: number): number {
  if (!validHistoricalYear(year)) throw new RangeError(`Unsupported historical year: ${year}`);
  return year < 0 ? year + 1 : year;
}
export function historicalYearFromOrdinal(ordinal: number): number {
  const year = ordinal <= 0 ? ordinal - 1 : ordinal;
  if (!validHistoricalYear(year)) throw new RangeError(`Unsupported historical ordinal: ${ordinal}`);
  return year;
}
export function stepHistoricalYear(year: number, delta: number): number {
  const ordinal = historicalYearOrdinal(year);
  if (!Number.isInteger(delta)) throw new RangeError('Year step must be an integer');
  return historicalYearFromOrdinal(Math.max(historicalYearOrdinal(HISTORY_FIRST_YEAR), Math.min(historicalYearOrdinal(HISTORY_LAST_YEAR), ordinal + delta)));
}
export function historicalBlockForYear(manifest: HistoricalManifest, year: number): HistoricalBlock | undefined {
  if (!validHistoricalYear(year)) return undefined;
  return manifest.blocks.find(block => block.from <= year && block.to >= year);
}
export function historicalYearState(pack: HistoricalPack, year: number) {
  if (!validHistoricalYear(year) || year < pack.from || year > pack.to) throw new RangeError(`Year ${year} not covered by this pack`);
  const records = pack.records.filter(record => record.from <= year && record.to >= year);
  return {
    year, status: records.length ? 'candidate' as const : 'no-records' as const,
    records,
    coverageGaps:pack.coverageGaps[year]??[],
    territorialIssues:records.flatMap(record=>(record.territorialIssues??[]).filter(issue=>issue.from<=year&&year<=issue.to).map(issue=>({...issue,sourceIndex:record.sourceIndex,name:record.nameRu??record.name,geometry:pack.geometries[issue.geometryId]}))),
    drawable: records.filter(record => record.geometryStatus === 'candidate'&&record.role==='polity').map(record => ({record, geometry: pack.geometries[record.geometryId]})),
    overlays: records.filter(record => record.geometryStatus === 'candidate'&&record.role!=='polity').map(record => ({record, geometry: pack.geometries[record.geometryId]})),
    rejected: records.filter(record => record.geometryStatus === 'rejected'),
  };
}

/** Geometry adapter for the existing SVG atlas renderer. Rejected records
 * remain in the audit state but cannot silently reach the map layer. */
export function historicalYearFeatureCollection(state: ReturnType<typeof historicalYearState>, includeOverlays=false) {
  return {type:'FeatureCollection' as const, historicalCoverageGaps:state.coverageGaps,historicalTerritorialIssues:state.territorialIssues,historicalRejected:state.rejected.map(r=>({name:r.nameRu??r.name,review:r.review})),features:(includeOverlays?[...state.drawable,...state.overlays]:state.drawable).map(({record,geometry})=>({
    type:'Feature' as const, geometry, properties:{NAME:record.nameRu ?? (record.role==='polity'||record.role==='settlement'?record.name:record.name.slice(1,-1)),
      ATLAS_HISTORICAL_LABEL:record.nameRu, historicalEntityId:record.entityId,
      historicalRevisionId:record.id, sourceName:record.sourceName, sourceWikidata:record.sourceWikidata,
      sourceIndex:record.sourceIndex, from:record.from, to:record.to,
      historicalRole:record.role, historicalSourceRole:record.sourceRole, historicalComponents:record.components, historicalMemberOf:record.memberOf,
      historicalSourceComponents:record.sourceComponents,historicalSourceMemberOf:record.sourceMemberOf,
      sourceSeshatId:record.sourceSeshatId, sourceWikipedia:record.sourceWikipedia,
      sourceGeometryId:record.sourceGeometryId, geometryRepair:record.geometryRepair,geometryParts:record.geometryParts,geometrySubtractions:record.geometrySubtractions,geometryTemporalWitnesses:record.geometryTemporalWitnesses,externalGeography:record.externalGeography,boundaryAdjustment:record.boundaryAdjustment,datedGeography:record.datedGeography,mapPartition:record.mapPartition,
      year:state.year, nameStatus:record.nameStatus, geometryStatus:record.geometryStatus,
      review:record.review,editorialRestoration:record.editorialRestoration,territorialAttributions:record.territorialAttributions?.filter(i=>i.from<=state.year&&i.to>=state.year)},
  }))};
}

const hash = /^[0-9a-f]{64}$/;
/** Validate index at the network boundary before fetching any period. */
export function validateHistoricalManifest(value: unknown): HistoricalManifest {
  const manifest = value as HistoricalManifest;
  if (manifest?.schema !== HISTORY_SCHEMA || manifest.from !== HISTORY_FIRST_YEAR || manifest.to !== HISTORY_LAST_YEAR || !Array.isArray(manifest.blocks) || !manifest.blocks.length || !hash.test(manifest.source?.sha256 ?? '')) throw new Error('Invalid historical manifest');
  let expected = historicalYearOrdinal(manifest.from);
  for (const block of manifest.blocks) {
    if (!validHistoricalYear(block.from) || !validHistoricalYear(block.to) || historicalYearOrdinal(block.from) !== expected || block.to < block.from || !hash.test(block.sha256) || block.file !== `packs/${block.sha256}.json` || !Number.isSafeInteger(block.bytes) || block.bytes <= 0) throw new Error('Invalid historical block index');
    expected = historicalYearOrdinal(block.to) + 1;
  }
  if (expected !== historicalYearOrdinal(manifest.to) + 1) throw new Error('Historical index has a coverage gap');
  return manifest;
}
export function validateHistoricalPack(value: unknown, block: HistoricalBlock): HistoricalPack {
  const pack = value as HistoricalPack;
  if (pack?.schema !== HISTORY_SCHEMA || pack.from !== block.from || pack.to !== block.to || !Array.isArray(pack.records) || !pack.geometries || typeof pack.geometries !== 'object'||!pack.coverageGaps||typeof pack.coverageGaps!=='object'||Array.isArray(pack.coverageGaps)) throw new Error('Invalid historical period pack');
  for(const [year,gaps] of Object.entries(pack.coverageGaps))if(!/^\d+$/.test(year)||Number(year)<block.from||Number(year)>block.to||!Array.isArray(gaps)||gaps.some(g=>!g.name||!g.date||!g.reason||!g.source.startsWith('https://www.un.org/')))throw new Error('Invalid historical coverage gap');
  const recordIds = new Set<string>();
  for (const record of pack.records) {
    if (!record || !hash.test(record.id) || recordIds.has(record.id) || !hash.test(record.entityId) || !hash.test(record.geometryId) || !record.name || !validHistoricalYear(record.from) || !validHistoricalYear(record.to) || record.from > record.to || record.from > block.to || record.to < block.from || !['candidate','rejected'].includes(record.geometryStatus) || !['candidate','reviewed'].includes(record.nameStatus)) throw new Error('Invalid historical revision');
    const geometry = pack.geometries[record.geometryId];
    if (!['polity','composite','relation','settlement'].includes(record.role)||!Array.isArray(record.components)||!Array.isArray(record.memberOf)||![...record.components,...record.memberOf].every(n=>typeof n==='string'&&n.length>0)||(['polity','settlement'].includes(record.role)?record.components.length!==0:!record.components.length)) throw new Error('Invalid historical layer classification');
    if((record.role==='settlement'&&record.sourceRole!=='polity')||(record.role!=='settlement'&&record.sourceRole!==undefined))throw new Error('Invalid historical source role provenance');
    if (record.sourceGeometryId && (!hash.test(record.sourceGeometryId) || record.sourceGeometryId===record.geometryId || !['retracted-zero-area-interior-edges','reviewed-source-components','reviewed-union-source-components','reviewed-difference-source-components','reviewed-map-partition'].includes(record.geometryRepair??''))) throw new Error('Invalid historical repair provenance');
    const validParts=(parts:HistoricalRevision['geometryParts'])=>Array.isArray(parts)&&parts.length>0&&parts.every(p=>Number.isSafeInteger(p.index)&&p.index>=0&&Number.isSafeInteger(p.part)&&p.part>=0);
    if(['reviewed-source-components','reviewed-union-source-components','reviewed-difference-source-components','reviewed-map-partition'].includes(record.geometryRepair??'')&&(!record.sourceGeometryId||!validParts(record.geometryParts)||!record.review?.sources.length))throw new Error('Invalid historical component provenance');
    if(record.geometryRepair==='reviewed-map-partition'){const p=record.mapPartition;if(!p||(p.kind!==undefined&&p.kind!=='documented-core')||!Number.isSafeInteger(p.area)||p.area<0||p.area>(p.kind==='documented-core'?0:2)||!hash.test(p.outlineGeometryId)||pack.geometries[p.outlineGeometryId]?.type!=='MultiPolygon'||!p.evidence.startsWith('https://')||!record.review?.sources.includes(p.evidence)||!record.editorialRestoration)throw new Error('Invalid historical map partition provenance');}else if(record.mapPartition!==undefined)throw new Error('Unexpected historical map partition');
    if(record.geometryRepair==='reviewed-difference-source-components'?!validParts(record.geometrySubtractions):record.geometrySubtractions!==undefined)throw new Error('Invalid historical subtraction provenance');
    if(record.geometryTemporalWitnesses!==undefined&&(!Array.isArray(record.geometryTemporalWitnesses)||!record.geometryTemporalWitnesses.length||record.geometryRepair!=='reviewed-union-source-components'||record.geometryTemporalWitnesses.some(w=>!w||!validParts([w.before,w.after])||w.before.index===w.after.index||w.year!==record.from||w.year!==record.to||!hash.test(w.hash)||!record.geometryParts?.some(p=>p.index===w.before.index&&p.part===w.before.part))))throw new Error('Invalid historical temporal witness');
    if(record.externalGeography!==undefined){
      const e=record.externalGeography;
      if(!e||!['modern-island-outline','modern-stable-land-border'].includes(e.kind)||!/^\w{3}$/.test(e.iso)||!Number.isSafeInteger(e.neId)||e.neId!==record.sourceIndex||!hash.test(e.datasetHash)||!e.url.startsWith('https://github.com/nvkelso/natural-earth-vector/blob/')||record.role!=='polity'||record.nameStatus!=='reviewed'||record.geometryStatus!=='candidate'||record.editorialRestoration||record.sourceGeometryId||record.geometryRepair||record.geometryParts||record.geometryTemporalWitnesses||!record.review?.sources.includes(e.url))throw new Error('Invalid external geography provenance');
    }
    if(record.boundaryAdjustment){const a=record.boundaryAdjustment;if(!hash.test(a.baseGeometryId)||!pack.geometries[a.baseGeometryId]||!Array.isArray(a.cuts)||!a.cuts.length||a.cuts.some(c=>!hash.test(c.cutGeometryId)||!pack.geometries[c.cutGeometryId]||!/^\w{3}$/.test(c.iso))||!record.review?.sources.length||record.externalGeography||record.datedGeography||a.exhausted&&record.geometryStatus!=='rejected')throw new Error('Invalid historical boundary adjustment');}
    if(record.datedGeography){const d=record.datedGeography;if(d.referenceYear!==record.sourceFrom||record.to>=d.referenceYear||d.referenceYear-record.from>5||!hash.test(d.outlineGeometryId)||!pack.geometries[d.outlineGeometryId]||!Array.isArray(d.trimGeometryIds)||d.trimGeometryIds.some(id=>!hash.test(id)||!pack.geometries[id])||!Array.isArray(d.parts)||!d.parts.length||d.parts.some(p=>!Number.isSafeInteger(p)||p<0)||record.role!=='polity'||record.nameStatus!=='reviewed'||record.geometryStatus!=='candidate'||record.externalGeography||record.editorialRestoration||!record.review?.sources.length)throw new Error('Invalid dated successor outline');}
    if (!geometry || !['Polygon','MultiPolygon'].includes(geometry.type) || !Array.isArray(geometry.coordinates)) throw new Error('Missing historical geometry');
    if(record.territorialIssues!==undefined){
      if(!Array.isArray(record.territorialIssues)||!record.review?.sources.length||record.territorialIssues.some(i=>!Number.isSafeInteger(i.part)||i.part<0||!hash.test(i.hash)||!hash.test(i.geometryId)||!validHistoricalYear(i.from)||!validHistoricalYear(i.to)||i.from>i.to||i.from>record.to||i.to<record.from||!i.group||!i.reason||!i.counterpartName||!(i.evidence.startsWith('https://github.com/Vue-Jay/interactive-board-next/pull/364#issuecomment-')||(i.evidence.startsWith('https://')&&i.sources?.includes(i.evidence)))||pack.geometries[i.geometryId]?.type!=='Polygon'))throw new Error('Invalid unresolved historical territorial issue');
      if(record.territorialIssues.some(i=>i.sources!==undefined&&(!Array.isArray(i.sources)||!i.sources.length||i.sources.some(s=>typeof s!=='string'||!s.startsWith('https://')))))throw new Error('Invalid unresolved historical evidence sources');
    }
    if(record.territorialAttributions!==undefined&&(!Array.isArray(record.territorialAttributions)||record.territorialAttributions.some(i=>!Number.isSafeInteger(i.part)||i.part<0||!hash.test(i.hash)||!validHistoricalYear(i.from)||!validHistoricalYear(i.to)||i.from>i.to||i.from>record.to||i.to<record.from||!i.group||!i.reason||!Array.isArray(i.sources)||!i.sources.length||i.sources.some(s=>!s.startsWith('https://')))))throw new Error('Invalid reviewed territorial attribution');
    if(record.editorialRestoration!==undefined&&(record.editorialRestoration!==true||record.role!=='polity'||record.geometryStatus!=='candidate'||record.nameStatus!=='reviewed'||!['reviewed-source-components','reviewed-map-partition'].includes(record.geometryRepair??'')||!record.review?.sources.length))throw new Error('Invalid editorial restoration');
    if ((record.geometryStatus === 'rejected' || record.nameStatus === 'reviewed'||record.sourceRole||record.sourceComponents||record.sourceMemberOf) && (!record.review?.reason || !record.review.sources.length)) throw new Error('Unattributed historical correction');
    recordIds.add(record.id);
  }
  return pack;
}
