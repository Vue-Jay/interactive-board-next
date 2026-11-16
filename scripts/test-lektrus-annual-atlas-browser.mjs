// Real renderer/selection test: one snapshot per changed state, one click per
// independent review unit. Shards partition periods deterministically.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {historicalBlockForYear,historicalYearState} from '../src/lektrusHistoricalTimeline.ts';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.LEKTRUS_PLAYWRIGHT_MODULE||'playwright');
const root=process.env.LEKTRUS_ANNUAL_TIMELINE_DIR, archive=process.env.LEKTRUS_ATLAS_DATA_DIR;
assert.ok(root&&archive);
const registry=JSON.parse(fs.readFileSync(path.join(root,'change-review-registry.json')));
const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json')));
const shard=Number(process.env.LEKTRUS_ATLAS_SHARD??0),shards=Number(process.env.LEKTRUS_ATLAS_SHARDS??1);
assert.ok(Number.isInteger(shard)&&shard>=0&&shard<shards);
const periods=registry.periods.filter((_,i)=>i%shards===shard);
const byYear=new Map();
for(const unit of registry.reviewUnits){if(unit.geometryStatus==='rejected')continue;const y=unit.intervals.at(-1).to;if(!byYear.has(y))byYear.set(y,[]);byYear.get(y).push(unit)}
const browser=await chromium.launch({headless:true,...(process.env.LEKTRUS_CHROMIUM_EXECUTABLE?{executablePath:process.env.LEKTRUS_CHROMIUM_EXECUTABLE}:{})});
try{
 const page=await browser.newPage({viewport:{width:1360,height:1000}}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.route(/(?:historical-basemaps|natural-earth-vector).*\/(?:world_[^/]+\.geojson|ne_[^/]+\.geojson|index\.json)(?:\?.*)?$/,async route=>{
  const local=path.join(archive,path.basename(new URL(route.request().url()).pathname));
  if(fs.existsSync(local))await route.fulfill({path:local,contentType:'application/json',headers:{'access-control-allow-origin':'*'}});else await route.continue();
 });
 await page.goto((process.env.LEKTRUS_ATLAS_BASE_URL||'http://127.0.0.1:4175')+'/demo/board?scene=history&capture=1&annualAtlas=1');
 const input=page.getByLabel('Выбрать год исторической карты');await input.waitFor({timeout:90000});
 await page.getByTitle('Выбрать территорию карты').click();await page.getByRole('option',{name:'Весь мир',exact:true}).click();
 let tested=0,states=0,lastBlock,pack;
 for(const period of periods){
  const year=period.to,block=historicalBlockForYear(manifest,year);
  if(lastBlock!==block.file){pack=JSON.parse(fs.readFileSync(path.join(root,block.file)));lastBlock=block.file}
  const state=historicalYearState(pack,year);
  await input.fill(String(year));await input.press('Enter');
  await page.locator(`[data-atlas-source-year="${year}"]`).waitFor({timeout:90000});
  await page.getByTitle('Вписать выбранный регион').click();
  await page.locator('.lektrus-atlas-overlay').waitFor({state:'hidden',timeout:90000});
  const shapes=page.locator('path.lektrus-atlas-country[data-atlas-revision-id]');
  const rendered=await shapes.evaluateAll(nodes=>nodes.map(n=>({id:n.dataset.atlasRevisionId,d:n.getAttribute('d')})));
  assert.deepEqual(rendered.map(r=>r.id).sort(),state.drawable.map(r=>r.record.id).sort(),`Missing or wrong rendered revisions at ${year}`);
  assert.ok(rendered.every(r=>r.d&&!/NaN|Infinity/.test(r.d)),`Invalid SVG at ${year}`);
  const active=new Set(rendered.map(r=>r.id));
  for(const unit of byYear.get(year)??[]){
   const id=unit.revisions.find(id=>active.has(id));assert.ok(id,`No rendered record for unit ${unit.id}`);
   const shape=page.locator(`path[data-atlas-revision-id="${id}"]`),index=await shape.getAttribute('data-atlas-feature-index');
   await shape.dispatchEvent('click');
   const selected=page.locator(`.lektrus-atlas-info-object[data-atlas-selected-index="${index}"]`);
   await selected.waitFor({state:'visible',timeout:6000});
   assert.ok((await selected.locator('.lektrus-atlas-description strong').first().textContent()).trim(),`Empty title for ${id}`);
   tested++;
  }
  states++;
  console.log(`${year}: ${rendered.length} polygons, ${tested} distinct unit clicks (${states}/${periods.length} states)`);
 }
 if(shard===0){await input.fill('2025');await input.press('Enter');await page.getByRole('alert').filter({hasText:'Для 2025 года пока нет'}).waitFor({timeout:90000});assert.equal(await page.locator('path[data-atlas-revision-id]').count(),0);}
 assert.deepEqual(errors,[]);
 console.log(`Shard ${shard}: ${states} change periods, ${tested} unit clicks. Technical visual checks only.`);
}finally{await browser.close()}
