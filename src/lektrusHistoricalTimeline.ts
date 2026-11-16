/** Annual historical data contract. Imported polygons are evidence candidates,
 * not independently verified borders. No interpolation or nearest-year fallback. */
export const HISTORY_SCHEMA = 2;
export const HISTORY_FIRST_YEAR = -3400;
export const HISTORY_LAST_YEAR = 2024;
export type HistoricalGeometry = {type: 'Polygon' | 'MultiPolygon'; coordinates: unknown};
export type HistoricalRevision = {
  id: string; entityId: string; geometryId: string;
  role: 'polity' | 'composite' | 'relation';
  components: string[]; memberOf: string[]; sourceSeshatId: string; sourceWikipedia: string;
  sourceGeometryId?: string; geometryRepair?: 'retracted-zero-area-interior-edges';
  name: string; nameRu?: string; sourceName: string; sourceWikidata: string;
  sourceIndex: number; sourceFrom: number; sourceTo: number;
  from: number; to: number; nameStatus: 'candidate' | 'reviewed';
  geometryStatus: 'candidate' | 'rejected';
  review?: {reason: string; sources: string[]};
};
export type HistoricalPack = {
  schema: 2; from: number; to: number;
  records: HistoricalRevision[]; geometries: Record<string, HistoricalGeometry>;
};
export type HistoricalBlock = {from: number; to: number; file: string; sha256: string; bytes: number; gzipBytes: number};
export type HistoricalManifest = {
  schema: 2; from: number; to: number; source: {name: string; version: string; url: string; license: string; sha256: string};
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
    drawable: records.filter(record => record.geometryStatus === 'candidate'&&record.role==='polity').map(record => ({record, geometry: pack.geometries[record.geometryId]})),
    overlays: records.filter(record => record.geometryStatus === 'candidate'&&record.role!=='polity').map(record => ({record, geometry: pack.geometries[record.geometryId]})),
    rejected: records.filter(record => record.geometryStatus === 'rejected'),
  };
}

/** Geometry adapter for the existing SVG atlas renderer. Rejected records
 * remain in the audit state but cannot silently reach the map layer. */
export function historicalYearFeatureCollection(state: ReturnType<typeof historicalYearState>, includeOverlays=false) {
  return {type:'FeatureCollection' as const, historicalRejected:state.rejected.map(r=>({name:r.nameRu??r.name,review:r.review})),features:(includeOverlays?[...state.drawable,...state.overlays]:state.drawable).map(({record,geometry})=>({
    type:'Feature' as const, geometry, properties:{NAME:record.nameRu ?? (record.role==='polity'?record.name:record.name.slice(1,-1)),
      ATLAS_HISTORICAL_LABEL:record.nameRu, historicalEntityId:record.entityId,
      historicalRevisionId:record.id, sourceName:record.sourceName, sourceWikidata:record.sourceWikidata,
      sourceIndex:record.sourceIndex, from:record.from, to:record.to,
      historicalRole:record.role, historicalComponents:record.components, historicalMemberOf:record.memberOf,
      sourceSeshatId:record.sourceSeshatId, sourceWikipedia:record.sourceWikipedia,
      sourceGeometryId:record.sourceGeometryId, geometryRepair:record.geometryRepair,
      year:state.year, nameStatus:record.nameStatus, geometryStatus:record.geometryStatus,
      review:record.review},
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
  if (pack?.schema !== HISTORY_SCHEMA || pack.from !== block.from || pack.to !== block.to || !Array.isArray(pack.records) || !pack.geometries || typeof pack.geometries !== 'object') throw new Error('Invalid historical period pack');
  const recordIds = new Set<string>();
  for (const record of pack.records) {
    if (!record || !hash.test(record.id) || recordIds.has(record.id) || !hash.test(record.entityId) || !hash.test(record.geometryId) || !record.name || !validHistoricalYear(record.from) || !validHistoricalYear(record.to) || record.from > record.to || record.from > block.to || record.to < block.from || !['candidate','rejected'].includes(record.geometryStatus) || !['candidate','reviewed'].includes(record.nameStatus)) throw new Error('Invalid historical revision');
    const geometry = pack.geometries[record.geometryId];
    if (!['polity','composite','relation'].includes(record.role)||!Array.isArray(record.components)||!Array.isArray(record.memberOf)||![...record.components,...record.memberOf].every(n=>typeof n==='string'&&n.length>0)||(record.role==='polity'?record.components.length!==0:!record.components.length)) throw new Error('Invalid historical layer classification');
    if (record.sourceGeometryId && (!hash.test(record.sourceGeometryId) || record.sourceGeometryId===record.geometryId || record.geometryRepair!=='retracted-zero-area-interior-edges')) throw new Error('Invalid historical repair provenance');
    if (!geometry || !['Polygon','MultiPolygon'].includes(geometry.type) || !Array.isArray(geometry.coordinates)) throw new Error('Missing historical geometry');
    if ((record.geometryStatus === 'rejected' || record.nameStatus === 'reviewed') && (!record.review?.reason || !record.review.sources.length)) throw new Error('Unattributed historical correction');
    recordIds.add(record.id);
  }
  return pack;
}
