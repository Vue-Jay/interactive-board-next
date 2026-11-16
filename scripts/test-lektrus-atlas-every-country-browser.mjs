// Exhaustive browser interaction test. Run against a local test build BEFORE
// publishing it. Supplies the genuine pinned files to the browser via routes.
// LEKTRUS_ATLAS_DATA_DIR=/path/to/pinned/files node scripts/test-lektrus-atlas-every-country-browser.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {createRequire} from "node:module";
import {modernCountryStats,countryStatisticsFacts} from "../src/lektrusAtlasModernStats.ts";
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.LEKTRUS_PLAYWRIGHT_MODULE||"playwright");
const dir=process.env.LEKTRUS_ATLAS_DATA_DIR;
assert.ok(dir,"LEKTRUS_ATLAS_DATA_DIR must contain the pinned GeoJSON files");
const base=process.env.LEKTRUS_ATLAS_BASE_URL||"http://127.0.0.1:4175";
const browser=await chromium.launch({headless:true,...(process.env.LEKTRUS_CHROMIUM_EXECUTABLE?{executablePath:process.env.LEKTRUS_CHROMIUM_EXECUTABLE}:{})});
try{
 const page=await browser.newPage({viewport:{width:1360,height:1000}});
 const errors=[];
 page.on("pageerror",err=>errors.push(err.message));
 await page.route(/(?:historical-basemaps|natural-earth-vector).*\/(?:world_[^/]+\.geojson|ne_[^/]+\.geojson|index\.json)(?:\?.*)?$/,async route=>{
  const filename=path.basename(new URL(route.request().url()).pathname);
  const local=path.join(dir,filename);
  if(fs.existsSync(local))await route.fulfill({path:local,contentType:"application/json",headers:{"access-control-allow-origin":"*"}});
  else await route.continue();
 });
 await page.goto(base+"/demo/board?scene=history&capture=1");
 const period=page.getByLabel("Выбрать год исторической карты");
 await period.waitFor({timeout:90000});
 const years=await period.locator("option").evaluateAll(nodes=>nodes.map(node=>Number(node.value)));
 assert.ok(years.length>=50,"missing historical periods");
 await page.getByTitle("Выбрать территорию карты").click();
 await page.getByRole("option",{name:"Весь мир",exact:true}).click();
 const requested=process.env.LEKTRUS_ATLAS_YEARS?.split(",").map(Number);
 if(requested)for(const year of requested)assert.ok(years.includes(year),`missing period in UI: ${year}`);
 let tested=0;
 for(const year of years.filter(y=>!requested||requested.includes(y)).sort((a,b)=>b-a)){
  await period.selectOption(String(year));
  await page.locator(`[data-atlas-source-year="${year}"]`).waitFor({timeout:90000});
  await page.getByTitle("Вписать выбранный регион").click();
  await page.locator(".lektrus-atlas-overlay").waitFor({state:"hidden",timeout:90000});
  const missingCount={2010:19,2000:18,1994:15}[year];
  const shapes=page.locator("path.lektrus-atlas-country[data-atlas-feature-index]");
  await shapes.first().waitFor({state:"attached",timeout:90000});
  const ids=await shapes.evaluateAll(nodes=>nodes.map(node=>node.dataset.atlasFeatureIndex));
  assert.equal(new Set(ids).size,ids.length,`duplicate map identifiers: ${year}`);
  if(year!==2026){
   const source=JSON.parse(fs.readFileSync(path.join(dir,`world_${year<0?"bc"+(-year):year}.geojson`),"utf8"));
   const expected=source.features.filter(feature=>["Polygon","MultiPolygon"].includes(feature.geometry?.type)).length;
   assert.equal(ids.length,expected,`${year}: map has missing source polygons`);
  }else{
   const source=JSON.parse(fs.readFileSync(path.join(dir,"ne_10m_admin_0_countries_rus.geojson"),"utf8"));
   // Eight previously anonymous archive polygons now have source-reviewed
   // geographic labels, not independent sovereign-state identities.
   const expected=source.features.filter(feature=>["Polygon","MultiPolygon"].includes(feature.geometry?.type)).length;
   assert.equal(ids.length,expected,"modern overview: country/territory polygons missing");
  }
  // Dispatch the actual map path click, not a direct call to React state.
  // This includes tiny and overlapping islands that cannot reliably be hit
  // via a coordinate click at world scale. Verify the exact selected feature.
  const verifiedStats=new Set();
  for(const id of ids){
   const path=page.locator(`path.lektrus-atlas-country[data-atlas-feature-index="${id}"]`);
   const adm=year===2026?await path.getAttribute("data-atlas-country-code"):null;
   await path.dispatchEvent("click");
   const selected=page.locator(`.lektrus-atlas-info-object[data-atlas-selected-index="${id}"]`);
   await selected.waitFor({state:"visible",timeout:6000});
   const title=await selected.locator(".lektrus-atlas-description strong").first().textContent({timeout:6000});
   assert.ok(title?.trim(),`${year}, ${id}: missing country title`);
   assert.ok(!/^(?:undefined|null|NaN|Infinity)$/.test(title.trim()),`${year}, ${id}: damaged country title (${title})`);
   if(year===2026){
    const correctedTitles={73:"Нагорный Карабах (архивный контур)",140:"Луганская область (архивный участок)",141:"Донецкая область (архивный участок)",171:"Южное Патагонское ледниковое плато",172:"Ринкон-де-Артигас (архивный участок)",247:"Парасельские острова",250:"Острова Спратли",254:"Остров Ханса (Тартупалук)",255:"Скалы Лианкур (Токто / Такэсима)"};
    if(correctedTitles[id]){
     assert.equal(title.trim(),correctedTitles[id],`2026 ${id}: wrong corrected territory label`);
     await selected.getByText("Источник уточнения",{exact:false}).first().waitFor({state:"visible",timeout:6000});
    }
   }
   if(adm){
    const iso={SDS:"SSD",PSX:"PSE"}[adm]??adm;
    const stats=modernCountryStats[iso];
    if(stats){
     const card=selected.locator('[data-atlas-verified-statistics="2025"]');
     await card.waitFor({state:"visible",timeout:6000});
     const actual=(await card.textContent()).replace(/\s+/g," ");
     for(const fact of countryStatisticsFacts(stats))assert.ok(actual.includes(fact.value.replace(/\s+/g," ")),`${iso}: missing verified statistic ${fact.label}`);
     verifiedStats.add(iso);
    }
   }
   if(missingCount&&id===(year===1994?"179":"180")){
    assert.equal(title.trim(),"Швейцария",`${year}: main Swiss polygon not restored in UI`);
    await selected.locator(`[data-atlas-missing-members="${missingCount}"]`).waitFor({state:"visible",timeout:6000});
   }
   tested++;
  }
  if(year===2026){assert.equal(verifiedStats.size,195,"all 195 UN roster cards must expose verified statistics");console.log("2026: 195 sourced country statistics cards verified after map clicks");}
  console.log(`${year}: ${ids.length} map clicks, ${tested} total`);
 }
 assert.deepEqual(errors,[],"uncaught browser errors during atlas audit");
 console.log(`Verified ${tested} historical map clicks. This tests presentation/selection, not independent historical truth.`);
}finally{await browser.close()}
