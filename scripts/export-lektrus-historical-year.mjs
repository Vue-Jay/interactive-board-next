// Inspect exactly one annual candidate layer, never substitute a nearby year.
// node scripts/export-lektrus-historical-year.mjs TIMELINE_DIR YEAR OUTPUT.geojson
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {sha256} from './build-lektrus-historical-timeline.mjs';
import {historicalBlockForYear,historicalYearState,historicalYearFeatureCollection,validateHistoricalManifest,validateHistoricalPack} from '../src/lektrusHistoricalTimeline.ts';
const [dir,requested,output]=process.argv.slice(2);
assert.ok(dir&&requested&&output,'Usage: export-lektrus-historical-year.mjs TIMELINE_DIR YEAR OUTPUT.geojson');
const year=Number(requested);
const manifest=validateHistoricalManifest(JSON.parse(fs.readFileSync(path.join(dir,'manifest.json'))));
const block=historicalBlockForYear(manifest,year);
assert.ok(block,`No dated source coverage for ${year}; no map exported`);
const bytes=fs.readFileSync(path.join(dir,block.file));
assert.equal(sha256(bytes),block.sha256);
const state=historicalYearState(validateHistoricalPack(JSON.parse(bytes),block),year);
const collection=historicalYearFeatureCollection(state);
fs.writeFileSync(output,JSON.stringify({...collection,year,source:manifest.source,reviewStatus:'candidate-only',rejected:state.rejected})+'\n');
console.log(JSON.stringify({year,status:state.status,features:collection.features.length,rejected:state.rejected.length}));
