// Trusted pointer acceptance through the application's own directory/focus UI.
// Never modify SVG transforms, pointer-events, geometry or React state to make
// a shape clickable. Occluded/unreachable shapes remain explicit failures.
import assert from 'node:assert/strict';

export async function auditPhysicalTerritories(page, results, modern=false,onResult){
 const attribute=modern?'data-atlas-feature-index':'data-atlas-revision-id';
 const directoryAttribute=modern?'data-atlas-directory-index':'data-atlas-directory-revision-id';
 await page.evaluate(()=>{
  if(window.__atlasPointerListener)return;
  window.__atlasPointerListener=true;
  document.addEventListener('click',event=>{
   const target=event.target.closest?.('path.lektrus-atlas-country');
   if(target)window.__atlasPointerReceipt={trusted:event.isTrusted,index:target.dataset.atlasFeatureIndex,id:target.dataset.atlasRevisionId};
  },true);
 });
 const output=[];
 for(const item of results){
  const row={id:item.id,index:item.index,name:item.cardTitle,sourceIndex:item.sourceIndex,mouse:false,touch:false,stage:'directory',errors:[]};
  try{
   await page.getByRole('tab',{name:'Территории',exact:true}).click();
   await page.getByLabel('Поиск исторического государства').fill(item.cardTitle||item.expectedName||item.sourceName||'');
   const entry=page.locator(`[${directoryAttribute}="${item.id}"]`);
   assert.equal(await entry.count(),1,'Territory has no unique directory entry');
   // This real UI action zooms to small islands and distant components.
   await entry.click();
   row.stage='focused-card';
   const card=page.locator(`.lektrus-atlas-info-object[data-atlas-selected-index="${item.index}"]`);
   await card.waitFor({state:'visible',timeout:6000});
   const type=card.locator('.lektrus-atlas-description strong + small').first();
   assert.equal(await type.textContent({timeout:6000}),'Историческая территория','Directory focus must not label every historical territory as a state');
   for(const kind of ['mouse','touch']){
    row.stage=kind;
    // A preselected card must not make a dead pointer handler pass. The
    // pointer must reopen the Article tab from the Directory tab each time.
    await page.getByRole('tab',{name:'Территории',exact:true}).click();
    assert.equal(await page.getByRole('tab',{name:'Справка',exact:true}).getAttribute('aria-selected'),'false');
    const probe=await page.evaluate(({attribute,id})=>{
     window.__atlasPointerReceipt=null;
     const el=document.querySelector(`path.lektrus-atlas-country[${attribute}="${CSS.escape(id)}"]`);
     if(!el)return null;
     // CDP pointer coordinates and SVG's fractional boundary hit testing can
     // disagree at subpixel edges. Probe the exact integer pixel we will send.
     const hit=(x,y)=>Number.isFinite(x)&&Number.isFinite(y)&&x>=1&&y>=1&&x<innerWidth-1&&y<innerHeight-1&&document.elementFromPoint(x,y)===el;
     const box=el.getBoundingClientRect();
     const left=Math.max(1,box.left),top=Math.max(1,box.top),right=Math.min(innerWidth-1,box.right),bottom=Math.min(innerHeight-1,box.bottom);
     for(const yf of [.5,.25,.75,.1,.9,.4,.6,.02,.98])for(const xf of [.5,.25,.75,.1,.9,.4,.6,.02,.98]){
      const x=Math.round(left+(right-left)*xf),y=Math.round(top+(bottom-top)*yf);
      if(hit(x,y))return {x,y,method:'visible-fill'};
     }
     // Overlays intentionally accept only strokes. Trace the actual SVG
     // perimeter, which also helps with narrow islands and fragmented states.
     const matrix=el.getScreenCTM(),length=el.getTotalLength();
     if(!matrix||!Number.isFinite(length)||length<=0)return null;
     for(let i=0;i<512;i++){
      const p=el.getPointAtLength(length*(i+.5)/512).matrixTransform(matrix);
      for(const [dx,dy] of [[0,0],[1,0],[-1,0],[0,1],[0,-1],[2,0],[-2,0],[0,2],[0,-2]]){
       const x=Math.round(p.x+dx),y=Math.round(p.y+dy);
       if(hit(x,y))return {x,y,method:'visible-stroke'};
      }
     }
     return null;
    },{attribute,id:item.id});
    assert.ok(probe,'No visible hit-test pixel after directory focus');
    row[`${kind}Point`]=probe;
    if(kind==='mouse')await page.mouse.click(probe.x,probe.y);
    else await page.touchscreen.tap(probe.x,probe.y);
    await page.waitForFunction(({attribute,id,index})=>{
     const receipt=window.__atlasPointerReceipt;
     const correct=attribute==='data-atlas-revision-id'?receipt?.id===id:receipt?.index===id;
     return receipt?.trusted&&correct&&receipt.index===index&&document.querySelector('.lektrus-history-tabs [role="tab"][aria-selected="true"]')?.textContent==='Справка';
    },{attribute,id:item.id,index:item.index},{timeout:6000});
    await card.waitFor({state:'visible',timeout:6000});
    const title=(await card.locator('.lektrus-atlas-description strong').first().textContent())?.replace(/\s+/g,' ').trim();
    assert.equal(title,item.cardTitle,'Trusted pointer selected a different card');
    row[kind]=true;
   }
  }catch(error){
   row.errors.push(String(error?.message??error));
   row.observed=await page.evaluate(()=>({selected:[...document.querySelectorAll('.lektrus-atlas-info-object')].map(n=>n.dataset.atlasSelectedIndex),tab:document.querySelector('.lektrus-history-tabs [aria-selected="true"]')?.textContent,receipt:window.__atlasPointerReceipt})).catch(()=>null);
  }
  output.push(row);
  onResult?.(row);
 }
 return output;
}
