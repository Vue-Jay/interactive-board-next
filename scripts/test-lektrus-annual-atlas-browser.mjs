// Exhaustive annual real-browser audit. One record per year, one actual SVG
// click per rendered territory/layer per year, with results retained even on failure.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {historicalBlockForYear,historicalYearState} from '../src/lektrusHistoricalTimeline.ts';
import {historicalGapLocators} from '../src/lektrusHistoricalGapLocators.ts';
function planAnnualYears(registry,shard,shards){
 const years=[];
 for(const period of registry.periods)for(let year=period.to;year>=period.from;year--)if(year!==0)years.push({year,weight:20+period.records});
 years.sort((a,b)=>b.year-a.year);
 if(years.length!==5424||years[0].year!==2024||years.at(-1).year!==-3400||new Set(years.map(x=>x.year)).size!==years.length)throw new Error('Incomplete or duplicate annual registry');
 if(!Number.isInteger(shards)||shards<1||shards>years.length||!Number.isInteger(shard)||shard<0||shard>=shards)throw new Error('Invalid shard');
 const total=years.reduce((a,b)=>a+b.weight,0),partitions=Array.from({length:shards},()=>[]);
 let cursor=0,weight=0;
 for(const [i,entry] of years.entries()){
  if(cursor<shards-1&&partitions[cursor].length&&(weight>=total*(cursor+1)/shards||years.length-i===shards-cursor-1))cursor++;
  partitions[cursor].push(entry.year);weight+=entry.weight;
 }
 if(partitions.some(p=>!p.length))throw new Error('Empty annual shard');
 return partitions[shard];
}
async function main(){
 const require=createRequire(import.meta.url);
 const {chromium}=require(process.env.LEKTRUS_PLAYWRIGHT_MODULE||'playwright');
 const root=process.env.LEKTRUS_ANNUAL_TIMELINE_DIR,archive=process.env.LEKTRUS_ATLAS_DATA_DIR;
 assert.ok(root&&archive);
 const registry=JSON.parse(fs.readFileSync(path.join(root,'change-review-registry.json')));
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json')));
 const shard=Number(process.env.LEKTRUS_ATLAS_SHARD??0),shards=Number(process.env.LEKTRUS_ATLAS_SHARDS??1);
 const years=planAnnualYears(registry,shard,shards);
 const output=process.env.LEKTRUS_ATLAS_AUDIT_OUTPUT||path.resolve('atlas-browser-audit');
 fs.mkdirSync(output,{recursive:true});
 const file=path.join(output,`year-audit-${shard}.jsonl`);
 fs.writeFileSync(file,'');
 const reportRow=row=>{fs.appendFileSync(file,JSON.stringify(row)+'\n');};
 const browser=await chromium.launch({headless:true,...(process.env.LEKTRUS_CHROMIUM_EXECUTABLE?{executablePath:process.env.LEKTRUS_CHROMIUM_EXECUTABLE}:{})});
 let failures=0,clicked=0,passed=0,completed=0,lastBlock,pack;
 try{
  const page=await browser.newPage({viewport:{width:1360,height:1000}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route(/(?:historical-basemaps|natural-earth-vector).*\/(?:world_[^/]+\.geojson|ne_[^/]+\.geojson|index\.json)(?:\?.*)?$/,async route=>{
   const local=path.join(archive,path.basename(new URL(route.request().url()).pathname));
   if(fs.existsSync(local))await route.fulfill({path:local,contentType:'application/json',headers:{'access-control-allow-origin':'*'}});else await route.continue();
  });
  await page.goto((process.env.LEKTRUS_ATLAS_BASE_URL||'http://127.0.0.1:4175')+'/demo/board?scene=history&capture=1&annualAtlas=1');
  const input=page.getByLabel('Выбрать год исторической карты');
  await input.waitFor({timeout:90000});
  await page.getByTitle('Выбрать территорию карты').click();
  await page.getByRole('option',{name:'Весь мир',exact:true}).click();
  const openYear=async year=>{
   await input.fill(String(year));await input.press('Enter');
   await page.locator(`[data-atlas-source-year="${year}"]`).waitFor({timeout:90000});
   await page.getByTitle('Вписать выбранный регион').click();
   await page.locator('.lektrus-atlas-overlay').waitFor({state:'hidden',timeout:90000});
  };
  const evaluateLayer=async (year,mode,expected,modern=false)=>page.evaluate(async ({year,mode,expected,modern})=>{
   const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
   const label=y=>y<0?`${-y} г. до н. э.`:`${y} г.`;
   const norm=s=>(s??'').replace(/\s+/g,' ').trim();
   const selector=modern?'path.lektrus-atlas-country[data-atlas-feature-index]':'path.lektrus-atlas-country[data-atlas-revision-id]';
   const nodes=[...document.querySelectorAll(selector)];
   const key=n=>modern?n.dataset.atlasFeatureIndex:n.dataset.atlasRevisionId;
   const byId=new Map(expected.map(e=>[e.id,e]));
   const rendered=nodes.map(n=>key(n));
   const issues=[];
   if(new Set(rendered).size!==rendered.length)issues.push({kind:'duplicate-rendered-id'});
   if(modern){if(rendered.length!==expected.length)issues.push({kind:'modern-count-mismatch',expected:expected.length,actual:rendered.length});}
   else{
    for(const e of expected)if(!rendered.includes(e.id))issues.push({kind:'missing-polygon',id:e.id,sourceIndex:e.sourceIndex,name:e.sourceName});
    for(const id of rendered)if(!byId.has(id))issues.push({kind:'unexpected-polygon',id});
   }
   const roleLabels={polity:'Отдельная территория',composite:'Составное объединение',relation:'Политическая связь (не государство)',settlement:'Область поселений (не государство)'};
   const results=[];
   // Use the application's actual SVG click handler. A synthetic DOM click
   // deliberately includes islands too small or covered to hit at overview.
   // This tests selection, not physical pointer hit-testing or historical truth.
   for(const n of nodes){
    const id=key(n),role=n.dataset.atlasHistoryRole??(modern?'modern':null);
    const d=n.getAttribute('d');
    if(!d||/NaN|Infinity/.test(d))issues.push({kind:'invalid-svg',id});
    if(!modern&&(role!=='polity'&&(role!==mode||n.getAttribute('fill')!=='none')))issues.push({kind:'wrong-layer-semantics',id,role});
    if(!modern&&mode!=='none'&&role==='polity')continue; // already clicked in THIS year
    const e=byId.get(id),item={id,sourceIndex:e?.sourceIndex??null,sourceName:e?.sourceName??null,role,index:n.dataset.atlasFeatureIndex,mapTitle:n.querySelector('title')?.textContent?.trim()??null,expectedName:e?.name??null,from:e?.from??null,to:e?.to??null,errors:[],candidates:[],clicked:false};
    try{
     const identity=modern?'data-atlas-feature-index':'data-atlas-revision-id';
     const live=document.querySelector(`${selector}[${identity}="${CSS.escape(id)}"][data-atlas-feature-index="${CSS.escape(item.index)}"]`);
     if(!live)throw new Error('Rendered polygon detached before click');
     live.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,view:window}));
     item.clicked=true;
     let card,title;const deadline=performance.now()+2500;
     do{
      card=document.querySelector(`.lektrus-atlas-info-object[data-atlas-selected-index="${CSS.escape(item.index)}"]`);
      title=card?.querySelector('.lektrus-atlas-description strong');
      if(card&&title&&card.getClientRects().length&&norm(title.textContent))break;
      await sleep(8);
     }while(performance.now()<deadline);
     if(!card||!title||!card.getClientRects().length||!norm(title.textContent))throw new Error('Selected territory card missing after click');
     item.cardTitle=norm(title.textContent);
     if(/^(undefined|null|NaN|Infinity)$/.test(item.cardTitle))item.errors.push('invalid-title');
     if(!modern&&e?.nameRu&&item.cardTitle!==norm(e.nameRu))item.errors.push('corrected-title-mismatch');
     if(item.mapTitle&&norm(item.mapTitle)!==item.cardTitle)item.candidates.push('map-card-title-difference');
     item.keyFacts=[...card.querySelectorAll('.lektrus-history-key-facts span')].map(span=>{
      const key=norm(span.querySelector('strong')?.textContent),text=norm(span.textContent);
      return {key,value:norm(text.slice(key.length))};
     });
     const facts=Object.fromEntries(item.keyFacts.map(x=>[x.key,x.value]));
     if(facts['Период карты']!==label(year))item.errors.push('wrong-card-year');
     if(!modern&&e){
      if(facts['Интервал этой версии записи']!==`${label(e.from)} – ${label(e.to)}`)item.errors.push('wrong-card-revision-interval');
      if(facts['Тип записи']!==roleLabels[e.role])item.errors.push('wrong-card-role');
      if(e.from>year||e.to<year)item.errors.push('source-interval-excludes-year');
     }
     item.articleMissing=!!card.querySelector('.lektrus-history-missing-facts');
     item.articleText=norm(card.querySelector('.lektrus-history-article')?.textContent);
     item.sources=[...card.querySelectorAll('.lektrus-atlas-description a[href]')].map(a=>a.getAttribute('href'));
     if(item.articleMissing)item.candidates.push('missing-independent-article');
     if(!modern&&e&&e.sourceName!==e.name&&!e.nameRu)item.candidates.push('source-name-differs');
    }catch(error){item.errors.push(String(error?.message??error));}
    results.push(item);
   }
   return {mode,rendered,issues,results};
  },{year,mode,expected,modern});
  const runYear=async year=>{
   const row={year,shard,source:year===2026?'Natural Earth historical archive overview':year===2025?'missing':'Cliopatria 0.2.1',coverageStatus:'candidate',expectedClicks:null,issues:[],layers:[],gaps:[],rejected:[],pageErrors:[],completed:false};
   const errorStart=completed===0?0:errors.length;
   try{
    if(year===2025){
     await input.fill('2025');await input.press('Enter');
     await page.getByRole('alert').filter({hasText:'Для 2025 года пока нет'}).waitFor({timeout:90000});
     const stale=await page.locator('path.lektrus-atlas-country[data-atlas-feature-index]').count();
     if(stale)row.issues.push({kind:'stale-polygons-on-unsupported-year',actual:stale});
     row.coverageStatus='missing-dated-source';row.expectedClicks=0;
     row.gaps.push({name:'Весь мир',reason:'2025: датированный независимый слой отсутствует'});
    }else if(year===2026){
     await openYear(year);
     const modern=JSON.parse(fs.readFileSync(path.join(archive,'ne_10m_admin_0_countries_rus.geojson'),'utf8'));
     const expected=modern.features.filter(f=>['Polygon','MultiPolygon'].includes(f.geometry?.type)).map((f,i)=>({id:String(i),sourceName:f.properties?.NAME??f.properties?.ADMIN??null}));
     row.coverageStatus='archived-overview-not-2026';row.expectedClicks=expected.length;
     row.gaps.push({name:'Весь мир',reason:'2026: отображается архивный обзор, а не точный датированный слой'});
     row.layers.push(await evaluateLayer(year,'none',expected,true));
    }else{
     const block=historicalBlockForYear(manifest,year);
     if(!block)throw new Error(`No manifest block for ${year}`);
     if(lastBlock!==block.file){pack=JSON.parse(fs.readFileSync(path.join(root,block.file)));lastBlock=block.file;}
     const state=historicalYearState(pack,year);
     row.gaps=state.coverageGaps;row.rejected=state.rejected.map(r=>({id:r.id,name:r.name,sourceIndex:r.sourceIndex,review:r.review}));
     row.coverageStatus=state.status;row.expectedClicks=state.drawable.length+state.overlays.length;
     await openYear(year);
     const gaps=page.locator('[data-atlas-annual-gap-count]');
     const gapCount=await gaps.count();
     if(gapCount!==(state.coverageGaps.length?1:0))row.issues.push({kind:'wrong-gap-warning-count',expected:state.coverageGaps.length,actual:gapCount});
     if(gapCount===1&&Number(await gaps.getAttribute('data-atlas-annual-gap-count'))!==state.coverageGaps.length)row.issues.push({kind:'wrong-gap-warning-value'});
     const expectedLocators=state.coverageGaps.flatMap(g=>historicalGapLocators[g.name]?[historicalGapLocators[g.name].iso]:[]).sort();
     const actualLocators=await page.locator('[data-atlas-gap-locator]').evaluateAll(nodes=>nodes.map(n=>n.dataset.atlasGapLocator).sort());
     if(JSON.stringify(actualLocators)!==JSON.stringify(expectedLocators))row.issues.push({kind:'wrong-gap-locators',expected:expectedLocators,actual:actualLocators});
     const layer=page.getByLabel('Дополнительный исторический слой');
     for(const mode of ['none','composite','relation','settlement']){
      try{
       await layer.selectOption(mode);
       // Await the actual React-rendered layer, even when no overlay exists.
       await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(resolve)));
       const expected=[...state.drawable,...state.overlays.filter(r=>r.record.role===mode)].map(({record:r})=>({id:r.id,sourceIndex:r.sourceIndex,sourceName:r.sourceName,name:r.name,nameRu:r.nameRu,role:r.role,from:r.from,to:r.to}));
       row.layers.push(await evaluateLayer(year,mode,expected));
      }catch(error){row.issues.push({kind:'layer-error',mode,message:String(error?.message??error)});}
     }
     await layer.selectOption('none');
    }
    row.completed=true;
   }catch(error){row.issues.push({kind:'year-error',message:String(error?.message??error)});}
   row.pageErrors=errors.slice(errorStart);
   const items=row.layers.flatMap(x=>x.results),count=items.filter(x=>x.clicked).length,ok=items.filter(x=>x.clicked&&!x.errors.length).length;
   if(row.expectedClicks!==null&&count!==row.expectedClicks)row.issues.push({kind:'year-click-count-mismatch',expected:row.expectedClicks,actual:count});
   const issueCount=row.issues.length+row.pageErrors.length+row.layers.reduce((n,l)=>n+l.issues.length,0)+items.filter(x=>x.errors.length).length;
   row.summary={expected:row.expectedClicks,clicked:count,verified:ok,attempted:items.length,issues:issueCount,candidates:items.filter(x=>x.candidates.length).length,coverageGaps:row.gaps.length,rejected:row.rejected.length};
   reportRow(row);clicked+=count;passed+=ok;failures+=issueCount;completed++;
   console.log(`ATLAS_YEAR ${JSON.stringify({year,completed:row.completed,coverageStatus:row.coverageStatus,...row.summary})}`);
   if(issueCount)console.log(`ATLAS_YEAR_ISSUES ${JSON.stringify({year,issues:row.issues,layerIssues:row.layers.flatMap(l=>l.issues),cards:items.filter(x=>x.errors.length).slice(0,20).map(x=>({id:x.id,sourceIndex:x.sourceIndex,cardTitle:x.cardTitle,errors:x.errors})),pageErrors:row.pageErrors})}`);
  };
  if(shard===0){await runYear(2026);await runYear(2025);}
  for(const year of years)await runYear(year);
  console.log(`Shard ${shard}: ${completed} years, ${clicked} actual SVG clicks, ${passed} card checks, ${failures} technical issues. Historical truth remains unverified.`);
  if(failures||completed!==years.length+(shard===0?2:0))process.exitCode=1;
 }finally{await browser.close();}
}
await main();
