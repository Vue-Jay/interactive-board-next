import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
import ts from "typescript";

const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const site=read("src/LektrusPublicSite.tsx");
const css=read("src/lektrusMarketing.css");
const entry=read("src/LektrusSiteEntry.tsx");
const billing=read("src/billingStore.ts");

for(const id of ["home","features","teachers","students","how","pricing","about","help"]){
 assert.ok(site.includes('id:"'+id+'"'),"missing marketing page: "+id);
}
for(const text of [
 "Одна платформа","для преподавания и обучения",
 "Один холст.","Множество способов преподавать",
 "Знакомьтесь с возможностями Lektrus",
 "Преподавайте так,","как удобно именно вам",
 "Подготовьте урок и сохраните всё в одном месте",
 "Учиться легче,","когда всё видно",
 "Привычные действия","в удобном пространстве",
 "Посмотрите, как устроена работа в Lektrus",
 "Расскажите, что можно улучшить",
 "Найдите решение","или свяжитесь с нами",
 "Ваши вопросы помогают делать Lektrus удобнее",
 "Поддержка, инструкции и обратная связь"
]){
 assert.ok(site.includes(text),"missing approved headline: "+text);
}
assert.doesNotMatch(site,/id:"subjects"/,"the marketing menu must not add a subjects page");
assert.ok(site.includes('href:"/tools/atlas"')&&site.includes('href:"/tools/laboratory"'),"standalone public tools must remain accessible");
assert.ok(site.includes('"/demo/board?scene="'),"example links must lead to the actual demo board");
assert.ok(site.includes('<LektrusFeedbackForm compact source="site"/>'),"feedback must use the existing submission service");
assert.ok(site.includes("plans.map(")&&billing.includes('id:"free"')&&billing.includes('id:"teacher"')&&billing.includes('id:"pro"'),"marketing pricing should derive current app plan definitions");
assert.ok(!site.includes("Купить подписку"),"test subscriptions must not be advertised as purchasable");
for(const shot of ["board-showcase.png","app-home.png","board-math.png","board-chemistry.png","board-geometry.png","board-physics.png","board-contour.png","board-history.png","board-russian.png"]){
 assert.ok(existsSync(new URL("../public/site/"+shot,import.meta.url)),"missing actual screenshot: "+shot);
}
assert.ok(site.includes("marketing-feature-art")&&css.includes(".marketing-feature-art"),"feature cards should include genuine image previews");
assert.doesNotMatch(entry,/lektrusShowcase\.css/,"the public entry must not load obsolete showcase styling");
assert.match(css,/@media\(max-width:700px\)/,"the site needs small-screen layouts");
assert.ok(site.includes("const showcaseShots=")&&site.includes('scene:"home"'),"homepage must present real app-home and subject screenshots");
assert.ok(site.includes("marketing-showcase-screen")&&site.includes("currentShot.src"),"home must rotate actual screenshots instead of freezing one image");
assert.ok(site.includes("setShowcasePaused")&&site.includes('aria-label="Следующий снимок"')&&site.includes('aria-label="Предыдущий снимок"'),"screenshot presentation must support play/pause and manual navigation");
assert.ok(site.includes('window.matchMedia("(prefers-reduced-motion: reduce)")'),"automatic screenshots must respect reduced motion");
assert.ok(css.includes(".marketing-showcase-controls")&&css.includes(".marketing-showcase-caption")&&css.includes(".marketing-showcase-subjects"),"restore screenshot caption, counter and navigation styles");
assert.ok(site.includes("marketing-teacher-scene")&&site.includes("marketing-student-demo")&&site.includes("marketing-about-list")&&site.includes("marketing-steps"),"teacher, student, about and walkthrough pages need distinct content layouts");
assert.ok(site.includes('src="/site/app-home.png"')&&site.includes('src="/site/board-math.png"'),"real instructor screen and lesson capture must be present");
assert.ok(css.includes(".marketing-teacher-window")&&css.includes(".marketing-students-intro")&&css.includes(".marketing-about-advantages"),"distinct presentation styles must be implemented");
assert.match(css, /prefers-reduced-motion:reduce/,"reduced-motion users need a non-animated alternative");
assert.match(site,/aria-expanded=\{menuOpen\}/,"mobile navigation must expose its state");
assert.match(site,/<details key=\{item\.q\}/,"FAQ answers must be expandable");

// The builder must extend, not replace, the eight distinctive editorial pages.
const config=read("src/marketingSiteConfig.ts");
const builder=read("src/LektrusSiteBuilder.tsx");
const blocks=read("src/SiteEditableSections.tsx");
const appRouter=read("src/main.tsx");
const admin=read("src/AdminScreen.tsx");
const sql=read("supabase/v257_marketing_site_builder.sql");
assert.ok(appRouter.includes('window.location.pathname==="/site-builder"'),"website builder route is missing");
assert.ok(admin.includes("Конструктор сайта"),"admin navigation must link to site builder");
assert.ok(builder.includes("getAccountAccess()")&&builder.includes("role.isAdmin"),"editor must require admin role");
assert.ok(builder.includes("publishSiteDocument(doc)")&&builder.includes("saveSiteDraft(doc)"),"draft and publication must be separate");
assert.ok(builder.includes("site-builder-device")&&builder.includes('["desktop","tablet","phone"]'),"builder needs responsive previews");
assert.ok(builder.includes("moveNav(")&&builder.includes("moveBlock(")&&builder.includes("importJson")&&builder.includes("exportJson"),"reorder and portable designs are required");
assert.ok(builder.includes("history(")&&builder.includes("site-builder-page-list"),"editing must include undo/redo and navigation");
assert.ok(sql.includes("is_app_admin(auth.uid())")&&sql.includes("marketing_site_public_read"),"database must authorize publication server-side");
assert.ok(config.includes("normalizeSiteDocument")&&config.includes("safeSiteUrl"),"untrusted published design must be normalized");
assert.ok((blocks.includes("data-site-block-id")||blocks.includes("SiteResizableBlock")&&read("src/SiteResizableBlock.tsx").includes("data-site-block-id"))&&site.includes("SITE_PREVIEW_MESSAGE"),"preview needs editable block selection");
assert.ok(site.includes("marketing-teacher-scene")&&site.includes("marketing-student-demo"),"builder must keep distinct original page templates");


// Website builder media and per-page redesign safety.
const media=read("src/SiteImageChooser.tsx");
const images=read("src/marketingSiteImages.ts");
const assetSql=read("supabase/v258_marketing_site_assets.sql");
assert.ok(builder.includes("replaceDefault")&&site.includes("!copy?.replaceDefault"),"built-in layouts must be replaceable per page without deleting the original");
assert.ok(builder.includes("moveBlockTo(")&&builder.includes("const duplicateBlock=")&&builder.includes("onClick={duplicateBlock}"),"blocks should support drag sorting and duplication");
assert.ok(media.includes("SITE_LIBRARY_SHOTS")&&media.includes("uploadMarketingImage"),"image chooser must offer local snapshots and custom upload");
assert.ok(images.includes("image/jpeg")&&images.includes("image/png")&&images.includes("image/webp"),"media upload must allow only safe image MIME types");
assert.ok(images.includes("5*1024*1024")&&images.includes("getRemoteSession()"),"media upload requires file size limit and user auth");
assert.ok(assetSql.includes("public.is_app_admin(auth.uid())"),"bucket writes must enforce admin rights");
const siteHardening=read("supabase/v259_marketing_site_invoker_rls.sql");
assert.ok(siteHardening.includes("security invoker")&&siteHardening.includes("marketing_site_admin_insert")&&siteHardening.includes("marketing_site_admin_update"),"site publication must use caller privileges and admin RLS");
assert.ok(config.includes('headers:{apikey:key,Accept:"application/json"}'),"public site must use apikey, not put a publishable key in Authorization");

assert.ok(assetSql.includes("bucket_id='marketing-site'"),"media policies must be bucket-scoped");


// Studio v2: independently styled sections, curated presets, reversible editing and keyboard access.
const kits=read("src/siteStudioPresets.ts");
const studioCss=read("src/lektrusSiteBuilder.css");
assert.ok(config.includes('|"faq"|"stats"|"quote"')&&config.includes("DEFAULT_SITE_BLOCK_STYLE"),"v2 content blocks need a normalized, backwards compatible model");
assert.ok(config.includes("buttonLabel:clean(v.buttonLabel")&&config.includes("const style:SiteBlockStyle"),"imported v1 sites need safe defaults for new section controls");
for(const name of ["site-block-faq-list","site-block-stats","site-block-quote","site-block-tone-"]){
 assert.ok(blocks.includes(name)||css.includes(name),"v2 custom block rendering/style missing: "+name);
}
assert.ok(blocks.includes("<details key={i}>")&&blocks.includes("<summary>"),"FAQ uses accessible native accordion");
assert.ok(kits.includes("SITE_SECTION_PRESETS")&&kits.includes("SITE_THEME_PRESETS")&&kits.includes("make(\"gallery\""),"ready-to-use section kits and theme palettes missing");
assert.ok(builder.includes("addSectionKit")&&builder.includes("duplicatePage")&&builder.includes("site-builder-theme-presets"),"section insertion, page cloning and themes must be wired");
assert.ok(builder.includes("commandFromKeyboard(event)")&&builder.includes("saveSiteDraft(doc)")&&read("src/siteStudioCommands.ts").includes("getStudioCommand"),"keyboard undo and local draft save missing");
assert.ok(builder.includes("focusMode")&&studioCss.includes(".site-builder.is-focus"),"distraction-free preview must hide the editor sidebars");
assert.ok(builder.includes("site-builder-page-search")&&builder.includes("site-builder-appearance"),"page search and block appearance controls required");
assert.ok(site.includes("previewSelection")&&site.includes("lektrus:site-select-page"),"preview must expose selected block and page headline click-to-edit");
assert.ok(css.includes("body:has(.marketing-site:not(.site-preview)) .site-editable-block:hover"),"public visitor pages must not display editor hover outlines");


// Execute the real normalizer with a minimal test backend to prevent regressions
// when old published v1 documents are opened by the new studio.
const isolatedSource=config.replace(/^import \{isRemoteBackendEnabled,remoteRequest\} from "\.\/backend";/m,
 "const isRemoteBackendEnabled=()=>false; const remoteRequest=()=>Promise.resolve();")
 .replaceAll("import.meta.env","({})");
const js=ts.transpileModule(isolatedSource,{
 compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext},
 fileName:"marketingSiteConfig.ts"
}).outputText;
const model=await import("data:text/javascript;base64,"+Buffer.from(js).toString("base64"));
const oldDocument=model.defaultSiteDocument();
oldDocument.pages.home={id:"home",title:"Главная",eyebrow:"",heading:"",lead:"",blocks:[
 {id:"legacy-block",kind:"cards",title:"Old design",text:"",image:"/site/board-math.png",href:"/app",items:["A","B"]}
]};
const upgraded=model.normalizeSiteDocument(oldDocument);
assert.equal(upgraded.pages.home.blocks[0].style.tone,"plain","existing blocks should default to their original plain look");
assert.equal(upgraded.pages.home.blocks[0].buttonLabel,"Перейти","legacy buttons need a safe label");
const legacyImage=model.normalizeSiteDocument({...oldDocument,pages:{home:{...oldDocument.pages.home,blocks:[
 {id:"old-photo",kind:"image",title:"Photo",text:"",image:"/site/app-home.png",href:"/app",items:[]}
]}}});
assert.equal(legacyImage.pages.home.blocks[0].buttonLabel,"Подробнее","existing image blocks must retain their original button copy");
assert.equal(upgraded.pages.home.blocks[0].style.columns,3,"old cards need a readable grid");
const newFaq=model.newSiteBlock("faq");
assert.ok(newFaq.items.every(row=>row.includes(" | ")),"FAQ starter questions and answers should be editable");
const copyWithStyles=model.normalizeSiteDocument({...oldDocument,pages:{
 home:{...oldDocument.pages.home,blocks:[{...newFaq,style:{tone:"dark",align:"center",spacing:"airy",columns:4,imageSide:"right"}}]}
}});
assert.equal(copyWithStyles.pages.home.blocks[0].style.tone,"dark","styles must round-trip through the published document");
assert.equal(copyWithStyles.pages.home.blocks[0].style.columns,4,"per-section grid settings must persist");
const unsafe=model.normalizeSiteDocument({...oldDocument,pages:{
 home:{...oldDocument.pages.home,blocks:[{...model.newSiteBlock("image"),image:"javascript:alert(1)",href:"javascript:alert(1)"}]}
}});
assert.equal(unsafe.pages.home.blocks[0].image,"#","untrusted image URLs must remain blocked");
assert.equal(unsafe.pages.home.blocks[0].href,"#","untrusted button URLs must remain blocked");


// Canvas editor v3: exact drop targets, per-element editing, legacy defaults and safe embeds.
const canvas=read("src/SiteCanvasDnD.tsx");
const objectLayer=read("src/SiteObjectLayer.tsx");
const presets=read("src/siteStudioPresets.ts");
assert.ok(builder.includes('putSiteCanvasTransfer(event,{type:"block"')&&builder.includes('putSiteCanvasTransfer(event,{type:"kit"'),"palette and presets must be draggable");
assert.ok(builder.includes("insertCanvasTransfer(")&&builder.includes('event.data?.type==="lektrus:site-canvas-drop"'),"cross-iframe drop must update the document");
assert.ok(canvas.includes("event.dataTransfer.getData(SITE_CANVAS_MIME)")&&canvas.includes("SiteDropZone"),"canvas drop zones must actually read HTML5 drag payloads");
assert.ok(site.includes('placed("before-0")')&&site.includes('placed("end")')&&site.includes("SiteAnchorSlot"),"native sections and page end must accept new blocks");
for(const id of ["home","features","teachers","students","how","pricing","about","help"]){
 assert.ok(site.includes('page==="'+id+'"'),"no dropped content page should disappear: "+id);
}
assert.ok(objectLayer.includes("data-site-object-id")&&objectLayer.includes("applyObjectPatch")&&objectLayer.includes("site-select-object"),"DOM object inspector must connect clicks to persisted overrides");
assert.ok(builder.includes("resetObject")&&builder.includes("patchObject")&&builder.includes('inspector==="object"'),"object fields and reset control must exist");
for(const kind of ["video","timeline","comparison","logos","spacer","checklist","button-row"]){
 assert.ok(config.includes('"'+kind+'"')&&blocks.includes('block.kind==="'+kind+'"'),"missing added section kind: "+kind);
}
assert.ok(blocks.includes("youtube-nocookie.com/embed")&&blocks.includes("player.vimeo.com/video"),"video embeds must only use trusted providers");
assert.ok(presets.includes("how-it-works")&&presets.includes("media")&&presets.includes("partners"),"curated new kits must be available");
const movedBlock=model.newSiteBlock("timeline");
movedBlock.anchor="before-2";
const obj=model.normalizeSiteDocument({...oldDocument,pages:{home:{...oldDocument.pages.home,blocks:[movedBlock]}},objects:{
 "home:native-0/root/0":{text:"Новый заголовок",style:{fontSize:34,color:"#2864ee",padding:18,width:75}},
 "global:footer/root/0":{hidden:true},
 "home:native-1/root":{src:"javascript:alert(1)",href:"javascript:alert(2)",style:{fontSize:900,opacity:-2}}
}});
assert.equal(obj.pages.home.blocks[0].anchor,"before-2","dropped position must survive publication normalization");
assert.equal(obj.pages.home.blocks[0].kind,"timeline","new block kind must survive a published document");
assert.equal(obj.objects["home:native-0/root/0"].text,"Новый заголовок","object text must persist");
assert.equal(obj.objects["home:native-0/root/0"].style.fontSize,34,"object font size must persist");
assert.equal(obj.objects["global:footer/root/0"].hidden,true,"global objects must have persisted visibility");
assert.equal(obj.objects["home:native-1/root"].src,"#","JS scheme in image must be rejected");
assert.equal(obj.objects["home:native-1/root"].href,"#","JS scheme in link must be rejected");
assert.equal(obj.objects["home:native-1/root"].style.fontSize,120,"oversized style input must be clamped");
assert.equal(obj.objects["home:native-1/root"].style.opacity,.1,"invalid opacity must be clamped");


// Site Studio keyboard operations: verify the real shared model, not only source strings.
const shortcutSource=read("src/siteStudioCommands.ts");
const shortcutJs=ts.transpileModule(shortcutSource,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext},fileName:"siteStudioCommands.ts"}).outputText;
const studioCommands=await import("data:text/javascript;base64,"+Buffer.from(shortcutJs).toString("base64"));
const shortcut=(key,overrides={})=>studioCommands.getStudioCommand({
 key,ctrlKey:false,metaKey:false,shiftKey:false,altKey:false,editable:false,...overrides
});
assert.equal(shortcut("Delete"),"delete","Delete must remove the selected site object");
assert.equal(shortcut("Backspace"),"delete","Backspace must remove the selected site object");
assert.equal(shortcut("z",{ctrlKey:true}),"undo","Ctrl+Z must undo");
assert.equal(shortcut("z",{ctrlKey:true,shiftKey:true}),"redo","Ctrl+Shift+Z must redo");
assert.equal(shortcut("z",{metaKey:true,shiftKey:true}),"redo","Cmd+Shift+Z must redo on macOS");
assert.equal(shortcut("y",{ctrlKey:true}),"redo","Ctrl+Y must redo");
assert.equal(shortcut("s",{ctrlKey:true}),"save","Ctrl+S must explicitly save a local draft");
assert.equal(shortcut("Escape"),"escape","Esc must clear selection");
for(const key of ["Delete","Backspace","z","y","s"]){
 assert.equal(shortcut(key,{ctrlKey:key==="z"||key==="y"||key==="s",editable:true}),null,"editing a text input must never trigger a site command: "+key);
}
assert.equal(shortcut("Delete",{isComposing:true}),null,"IME composition must never delete a block");
assert.equal(shortcut("Backspace",{altKey:true}),null,"Alt+Backspace is not a canvas delete");
assert.equal(shortcut("Backspace",{ctrlKey:true}),null,"Ctrl+Backspace must not accidentally delete blocks");
const staged=model.defaultSiteDocument();
const userBlock=model.newSiteBlock("text");
staged.pages.home={id:"home",title:"Главная",eyebrow:"",heading:"",lead:"",blocks:[userBlock]};
const nodeKey="home:native-0/root/0",blockKey="home:"+userBlock.id+"/root";
staged.objects[nodeKey]={style:{fontSize:24}};
staged.objects[blockKey]={text:"Текст блока"};
assert.equal(studioCommands.deleteStudioSelection(staged,"home",null,nodeKey),"object");
assert.equal(staged.objects[nodeKey].hidden,true,"native object must be reversibly hidden");
assert.equal(studioCommands.restoreStudioObject(staged,nodeKey),true);
assert.equal(staged.objects[nodeKey].hidden,undefined,"restoring must preserve other object styles");
assert.equal(staged.objects[nodeKey].style.fontSize,24);
assert.equal(studioCommands.deleteStudioSelection(staged,"home",userBlock.id,null),"block");
assert.equal(staged.pages.home.blocks.length,0,"custom block must be removed from its own page");
assert.equal(staged.objects[blockKey],undefined,"removed block's object overrides must be pruned");
assert.equal(studioCommands.deleteStudioSelection(staged,"home",null,null),"none","keyboard Delete without selection must be harmless");
assert.ok(builder.includes("site-builder-selection-toolbar")&&builder.includes("site-builder-shortcuts-panel"),"visible keyboard help and selection toolbar are required");
assert.ok(builder.includes("setSelected(value.block)")&&builder.includes("setSelectedObject(value.object)"),"undo must restore selection, not only document");
assert.ok(site.includes('lektrus:site-editor-command')&&site.includes("commandFromKeyboard(event)"),"the preview iframe must forward actual keyboard events");
assert.ok(site.includes("site-canvas-selection-actions"),"the iframe needs visible delete, restore, undo and redo controls");


// Persistent dimension controls: responsive 35–100% width; non-clipping min height.
const resizeComponent=read("src/SiteResizableBlock.tsx");
assert.ok(resizeComponent.includes("setPointerCapture")&&resizeComponent.includes("onPointerMove={move}")&&resizeComponent.includes("lektrus:site-resize-block"),"canvas must support live pointer resize across the iframe");
assert.ok(builder.includes('site-builder-dimensions')&&builder.includes('event.data?.type==="lektrus:site-resize-block"'),"width/height inspector and parent resize handler are required");
const dimensionsDoc=model.defaultSiteDocument();
const resized=model.newSiteBlock("text");
resized.style.width=72;
resized.style.minHeight=360;
dimensionsDoc.pages.home={...oldDocument.pages.home,blocks:[resized]};
let dims=model.normalizeSiteDocument(dimensionsDoc).pages.home.blocks[0].style;
assert.equal(dims.width,72,"published block width must persist");
assert.equal(dims.minHeight,360,"published block minimum height must persist");
resized.style.width=2;
resized.style.minHeight=9999;
dims=model.normalizeSiteDocument(dimensionsDoc).pages.home.blocks[0].style;
assert.equal(dims.width,35,"unreasonably narrow block width must be clamped");
assert.equal(dims.minHeight,1200,"unreasonably tall block size must be clamped");
resized.style.width=100;
resized.style.minHeight=0;
dims=model.normalizeSiteDocument(dimensionsDoc).pages.home.blocks[0].style;
assert.equal(dims.width,100);
assert.equal(dims.minHeight,0);

console.log("Lektrus marketing site: selected copy, 8 sections, real screenshots, demo links, pricing, accessibility and responsive styling verified.");
