// Real renderer/selection test: one snapshot per changed state, one click per
// independent review unit. Shards partition periods deterministically.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {historicalBlockForYear,historicalYearState} from '../src/lektrusHistoricalTimeline.ts';
import {historicalGapLocators} from '../src/lektrusHistoricalGapLocators.ts';
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
  const gaps=page.locator('[data-atlas-annual-gap-count]');
  assert.equal(await gaps.count(),state.coverageGaps.length?1:0,`Coverage warning missing or stale at ${year}`);
  if(state.coverageGaps.length)assert.equal(Number(await gaps.getAttribute('data-atlas-annual-gap-count')),state.coverageGaps.length);
  const expectedLocators=state.coverageGaps.flatMap(g=>historicalGapLocators[g.name]?[historicalGapLocators[g.name].iso]:[]).sort();
  const actualLocators=await page.locator('[data-atlas-gap-locator]').evaluateAll(nodes=>nodes.map(n=>n.dataset.atlasGapLocator).sort());
  assert.deepEqual(actualLocators,expectedLocators,`Missing geographical gap locators at ${year}`);
  if(year===2024&&expectedLocators.length){await page.locator('[data-atlas-gap-locator]').first().dispatchEvent('click');assert.notEqual(await gaps.getAttribute('open'),null);}
  const layer=page.getByLabel('Дополнительный исторический слой');
  let renderedCount=0;
  for(const mode of ['none','composite','relation']){
  await layer.selectOption(mode);
  const shapes=page.locator('path.lektrus-atlas-country[data-atlas-revision-id]');
  const rendered=await shapes.evaluateAll(nodes=>nodes.map(n=>({id:n.dataset.atlasRevisionId,role:n.dataset.atlasHistoryRole,fill:n.getAttribute('fill'),d:n.getAttribute('d')})));
  const expected=[...state.drawable,...state.overlays.filter(r=>r.record.role===mode)];
  assert.deepEqual(rendered.map(r=>r.id).sort(),expected.map(r=>r.record.id).sort(),`Missing or wrong rendered revisions at ${year} (${mode})`);
  assert.ok(rendered.every(r=>r.d&&!/NaN|Infinity/.test(r.d)),`Invalid SVG at ${year}`);
  assert.ok(rendered.every(r=>r.role==='polity'||(r.role===mode&&r.fill==='none')),`Incorrect layer semantics at ${year}`);
  renderedCount+=rendered.filter(r=>mode==='none'||r.role===mode).length;
  const active=new Set(rendered.map(r=>r.id));
  for(const unit of (byYear.get(year)??[]).filter(u=>(u.role==='polity'?'none':u.role)===mode)){
   const id=unit.revisions.find(id=>active.has(id));assert.ok(id,`No rendered record for unit ${unit.id}`);
   const shape=page.locator(`path[data-atlas-revision-id="${id}"]`),index=await shape.getAttribute('data-atlas-feature-index');
   await shape.dispatchEvent('click');
   const selected=page.locator(`.lektrus-atlas-info-object[data-atlas-selected-index="${index}"]`);
   await selected.waitFor({state:'visible',timeout:6000});
   assert.ok((await selected.locator('.lektrus-atlas-description strong').first().textContent()).trim(),`Empty title for ${id}`);
   tested++;
  }
  }
  await layer.selectOption('none');
  states++;
  console.log(`${year}: ${renderedCount} polygons across all layers, ${tested} distinct unit clicks (${states}/${periods.length} states)`);
 }
 if(shard===0){await input.fill('2025');await input.press('Enter');await page.getByRole('alert').filter({hasText:'Для 2025 года пока нет'}).waitFor({timeout:90000});assert.equal(await page.locator('path[data-atlas-revision-id]').count(),0);}
 assert.deepEqual(errors,[]);
 console.log(`Shard ${shard}: ${states} change periods, ${tested} unit clicks. Technical visual checks only.`);
}finally{await browser.close()}
