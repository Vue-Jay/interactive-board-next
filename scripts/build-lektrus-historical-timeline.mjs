// Build an immutable, candidate-only annual atlas from the pinned source.
// node scripts/build-lektrus-historical-timeline.mjs SOURCE.geojson OUTPUT_DIR
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {gzipSync} from 'node:zlib';
import {capitalInsideCountry} from './atlas-2026-capitals.mjs';
import {HISTORY_SCHEMA, HISTORY_FIRST_YEAR, HISTORY_LAST_YEAR, historicalYearOrdinal, historicalYearFromOrdinal, validateHistoricalManifest, validateHistoricalPack} from '../src/lektrusHistoricalTimeline.ts';

export const SOURCE = Object.freeze({name:'Cliopatria', version:'0.2.1', url:'https://raw.githubusercontent.com/Seshat-Global-History-Databank/cliopatria/5f433377139a6eeaeacbdc894b70f8805b72c8b5/cliopatria.geojson.zip', license:'CC BY 4.0'});
export const PINNED_SOURCE_SHA256 = 'fc6f0d1e4cc42f45da83522b3696db6f2cc85ec0d12259a85c89b31347b8fc0a';
const MAX_PACK_GZIP = 2 * 1024 * 1024;
export const sha256 = data => createHash('sha256').update(data).digest('hex');
const identity = (...parts) => sha256(JSON.stringify(parts));
const MALI_SOURCES = ['https://digitallibrary.un.org/record/620443','https://legal.un.org/ilc/publications/yearbooks/english/ilc_1962_v2.pdf'];
const INDONESIA_SOURCE = 'https://peacekeeping.un.org/sites/default/files/past/unsfbackgr.html';
const ZIMBABWE_SOURCE = 'https://legal.un.org/repertory/art73/english/rep_supp6_vol5_art73.pdf';
// Precisely identified by the bulk GEOS audit. Only retract zero-area spikes in
// interior rings: no shell, coordinate, polygon extent or historical claim changes.
const RETRACED_HOLES=new Set([
 'f997fe499f3ddf20456b2d95b3453ef88f1abb29ef6a2f1df95fdd48287661e9','50204fb705323b193bdcd69a37b4d33c32dbfdd55220b17b521e07eca0ef9d86',
 '00786671cb5daa0fa15b18636ead2753b15377443bdd09e13a530b88b9078d2f','962c7db877623c69f7517952f2ec79d401f08d950101dd747ca4b591a3305962',
 'cec2a64fe0b26774482c6ba3bd37d8a48f8606d080858534065e7806a0c01fc3','27a6bacb623875306d1f48e960e06396d390bbec077f05848588cd0632e7c72b',
 '7819e7b5ec9482a5cb0c52edc9b6987a82a3d856af63e68d5eca48a7e2889bb8','16e63e027a8082f89428731513ab3e5005f8b657a95e370b5a5766f4b8296a0b',
 'edfcab649fbe27ee26898125ca418acde76b7cf03ceb877b68444f3f76fd654f','274cd2ebff1fef2b38376a9aa953f4d3c8f3207bcdbeecf0b857196a0500d731',
 'af6ace1e0cbeacecd733df2007fea7d0a0a14395b0b37f5d64e36b140ec10fd3','cda8ecb9fd71fa7512fcd9972418a12000ac7dc5566ca800d9a6c4730c5ec2c0',
 '69fde5edb1cf8f8e0a239b131801f552e12eed146fb68aa74a8602504c919bba'
]);
const samePoint=(a,b)=>a[0]===b[0]&&a[1]===b[1];
export function removeRetracedHole(ring){
 const pts=ring.slice(0,-1);let changed=true;
 while(changed&&pts.length>2){
  changed=false;for(let i=0;i<pts.length;i++){
   const next=(i+1)%pts.length,after=(i+2)%pts.length;
   if(samePoint(pts[i],pts[next])){pts.splice(next,1);changed=true;break}
   if(samePoint(pts[i],pts[after])){for(const k of [next,after].sort((a,b)=>b-a))pts.splice(k,1);changed=true;break}
  }
 }
 if(pts.length<3)return null;
 return [...pts,pts[0]];
}
function repairGeometry(geometry,sourceGeometryId){
 if(!RETRACED_HOLES.has(sourceGeometryId))return geometry;
 const fix=p=>[p[0],...p.slice(1).map(removeRetracedHole).filter(Boolean)];
 return {...geometry,coordinates:geometry.type==='Polygon'?fix(geometry.coordinates):geometry.coordinates.map(fix)};
}

function validateGeometry(g) {
  assert.ok(g && ['Polygon','MultiPolygon'].includes(g.type));
  const polygons = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
  assert.ok(Array.isArray(polygons) && polygons.length);
  for (const polygon of polygons) {
    assert.ok(Array.isArray(polygon) && polygon.length);
    for (const ring of polygon) {
      assert.ok(Array.isArray(ring) && ring.length >= 4);
      for (const point of ring) assert.ok(Array.isArray(point) && point.length >= 2 && Number.isFinite(point[0]) && Number.isFinite(point[1]) && Math.abs(point[0]) <= 180 && Math.abs(point[1]) <= 90);
      assert.deepEqual(ring[0], ring.at(-1), 'unclosed ring');
    }
  }
}

export function normalizeHistoricalSource(source) {
  assert.equal(source.type,'FeatureCollection');
  const geometries = new Map(), records = [];
  const counts = {sourcePolities:0, sourceComposites:0, sourceRelations:0, zeroBoundaryRecords:0, revisions:0, uniqueGeometries:0, rejectedRevisions:0, reviewedNames:0};
  for (const [sourceIndex, feature] of source.features.entries()) {
    const p = feature.properties;
    assert.ok(['POLITY','RELATION'].includes(p.Type));
    const sourceFrom = p.FromYear, sourceTo = p.ToYear;
    assert.ok(Number.isInteger(sourceFrom) && Number.isInteger(sourceTo) && sourceFrom <= sourceTo && sourceFrom >= HISTORY_FIRST_YEAR && sourceTo <= HISTORY_LAST_YEAR, `Invalid dates at ${sourceIndex}`);
    const sourceName = p.Name.trim(), sourceWikidata = p.Wikidata ?? '';
    assert.ok(sourceName, `Empty name at ${sourceIndex}`);
    // The authors explicitly distinguish composite polities from their member
    // polygons; RELATION is a different semantic layer (not sovereignty).
    const list=value=>String(value??'').split(';').map(s=>s.trim()).filter(Boolean);
    const components=list(p.Components),memberOf=list(p.MemberOf);
    const role=p.Type==='RELATION'?'relation':/^\(.+\)$/.test(sourceName)?'composite':'polity';
    assert.equal(role==='polity',components.length===0,`Unexpected component encoding ${sourceIndex}`);
    counts[role==='polity'?'sourcePolities':role==='composite'?'sourceComposites':'sourceRelations']++;
    if (sourceFrom === 0 || sourceTo === 0) counts.zeroBoundaryRecords++;
    // Preserve original endpoints; the displayed calendar has no year zero.
    const from = sourceFrom === 0 ? 1 : sourceFrom, to = sourceTo === 0 ? -1 : sourceTo;
    assert.ok(from <= to, `Zero-only source record at ${sourceIndex} requires editorial review`);
    validateGeometry(feature.geometry);
    const sourceGeometryId = sha256(JSON.stringify(feature.geometry));
    const geometry=repairGeometry(feature.geometry,sourceGeometryId);
    const geometryId = sha256(JSON.stringify(geometry));
    validateGeometry(geometry);
    if (!geometries.has(geometryId)) geometries.set(geometryId, geometry);
    // Provisional source identity, never inferred from a similar display name.
    // A reviewed crosswalk can explicitly link variants later.
    const entityId = identity('source-'+role, sourceName, sourceWikidata);
    const base = {entityId, geometryId, role,components,memberOf,sourceSeshatId:String(p.SeshatID??''),sourceWikipedia:String(p.Wikipedia??''), ...(geometryId!==sourceGeometryId?{sourceGeometryId,geometryRepair:'retracted-zero-area-interior-edges'}:{}),name: sourceName, sourceName, sourceWikidata, sourceIndex, sourceFrom, sourceTo, from, to, nameStatus:'candidate', geometryStatus:'candidate'};
    const add = revision => {
      const id = identity('revision', sourceIndex, sourceFrom, sourceTo, geometryId, revision.from, revision.to, revision.name);
      records.push({id, ...revision});
      if (revision.nameStatus === 'reviewed') counts.reviewedNames++;
      if (revision.geometryStatus === 'rejected') counts.rejectedRevisions++;
    };
    if (sourceName === 'Mali Federation' && from >= 1961 && sourceWikidata === 'Q216632') {
      add({...base, entityId:identity('reviewed-polity','republic-of-mali'), name:'Republic of Mali', nameRu:'Республика Мали', nameStatus:'reviewed', review:{reason:'Federation dissolved in 1960; later records refer to the Republic of Mali. Geometry remains unverified.',sources:MALI_SOURCES}});
    } else if (sourceName === 'Zimbabwe Rhodesia' && sourceWikidata === 'Q890120' && from === 1979 && to === 1982) {
      add({...base,to:1979});
      add({...base,from:1980,entityId:identity('source-polity','Republic of Zimbabwe','Q954'),name:'Republic of Zimbabwe',nameRu:'Республика Зимбабве',nameStatus:'reviewed',review:{reason:'Independence as the Republic of Zimbabwe on 18 April 1980; annual label reflects the new state, not a day-level boundary reconstruction. Geometry remains unverified.',sources:[ZIMBABWE_SOURCE]}});
    } else if (sourceName === 'Republic of Indonesia' && from === 1960 && to >= 1963 && capitalInsideCountry([138,-4], feature.geometry)) {
      add({...base, to:1962, geometryStatus:'rejected', review:{reason:'Source polygon includes western New Guinea before the 1963 transfer; excluded from candidate drawing until corrected geometry is sourced.',sources:[INDONESIA_SOURCE]}});
      add({...base, from:1963});
    } else add(base);
  }
  counts.revisions = records.length;
  counts.uniqueGeometries = geometries.size;
  return {records,geometries,counts};
}

export function buildHistoricalTimeline(source, sourceHash, outDir) {
  const {records,geometries,counts} = normalizeHistoricalSource(source);
  fs.mkdirSync(path.join(outDir,'packs'),{recursive:true});
  const blocks = [];
  function writeBlock(ordinal, end) {
    const from = historicalYearFromOrdinal(ordinal);
    const to = historicalYearFromOrdinal(end);
    const active = records.filter(r => r.from <= to && r.to >= from);
    const ids = [...new Set(active.map(r=>r.geometryId))].sort();
    const pack = {schema:HISTORY_SCHEMA,from,to,records:active,geometries:Object.fromEntries(ids.map(id=>[id,geometries.get(id)]))};
    const bytes = Buffer.from(JSON.stringify(pack));
    const gzipBytes = gzipSync(bytes,{level:6}).length;
    if (gzipBytes > MAX_PACK_GZIP && ordinal < end) {
      const mid = Math.floor((ordinal + end) / 2);
      writeBlock(ordinal,mid);
      writeBlock(mid+1,end);
      return;
    }
    const digest = sha256(bytes), file = `packs/${digest}.json`;
    const block = {from,to,file,sha256:digest,bytes:bytes.length,gzipBytes};
    validateHistoricalPack(pack,block);
    fs.writeFileSync(path.join(outDir,file),bytes);
    blocks.push(block);
  }
  // Locality: nearby years share one pack; recent years need smaller blocks.
  // Algorithmically bisect dense blocks instead of forcing huge downloads.
  const endOrdinal = historicalYearOrdinal(HISTORY_LAST_YEAR);
  for (let ordinal = historicalYearOrdinal(HISTORY_FIRST_YEAR); ordinal <= endOrdinal;) {
    const size = historicalYearFromOrdinal(ordinal) >= 1900 ? 10 : 100;
    const end = Math.min(endOrdinal, ordinal + size - 1);
    writeBlock(ordinal,end);
    ordinal = end + 1;
  }
  const manifest = {schema:HISTORY_SCHEMA,from:HISTORY_FIRST_YEAR,to:HISTORY_LAST_YEAR,source:{...SOURCE,sha256:sourceHash},blocks,counts};
  validateHistoricalManifest(manifest);
  fs.writeFileSync(path.join(outDir,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  return manifest;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [sourceFile,outDir] = process.argv.slice(2);
  assert.ok(sourceFile && outDir,'Usage: build-lektrus-historical-timeline.mjs SOURCE.geojson OUTPUT_DIR');
  const bytes = fs.readFileSync(sourceFile);
  assert.equal(sha256(bytes),PINNED_SOURCE_SHA256,'Source differs from the pinned historical release');
  const manifest = buildHistoricalTimeline(JSON.parse(bytes),PINNED_SOURCE_SHA256,outDir);
  console.log(JSON.stringify({counts:manifest.counts,blocks:manifest.blocks.length,bytes:manifest.blocks.reduce((n,b)=>n+b.bytes,0),gzipBytes:manifest.blocks.reduce((n,b)=>n+b.gzipBytes,0),maxPackGzip:Math.max(...manifest.blocks.map(b=>b.gzipBytes))}));
}
