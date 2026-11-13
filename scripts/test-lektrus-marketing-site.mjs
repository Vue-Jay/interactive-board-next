import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
import ts from "typescript";

const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const site=read("src/LektrusPublicSite.tsx");
const css=read("src/lektrusMarketing.css");
const entry=read("src/LektrusSiteEntry.tsx");
const billing=read("src/billingStore.ts");

for(const id of ["home","features","pricing","help"]){
 assert.ok(site.includes('id:"'+id+'"'),"missing public marketing page: "+id);
}
assert.doesNotMatch(site,/\{id:"(?:teachers|students)",title:/,"former teacher/student tabs must be absent from navigation");
for(const text of [
 "Lektrus","Онлайн-платформа для обучения",
 "Всё, что нужно для учебной работы","Lektrus",
 "О проекте","не только смотреть, но и действовать",
 "Преподавателям","Меньше переключений. Больше наглядности.",
 "Ученикам","Не просто слушать. Пробовать и понимать.",
 "Чем можем помочь?",
 "Частые вопросы","Самое важное о работе с Lektrus.",
 "Напишите нам","Есть вопрос, предложение или замечание?",
 "Помощь и контакты"
]){
 assert.ok(site.includes(text),"missing approved headline: "+text);
}

// Desktop sidebar follows the approved composition: permanent left nav, central
// text, real screenshot slideshow on the right, with tool shortcuts in the rail.
assert.ok(site.includes("marketing-sidebar-content")&&site.includes("marketing-sidebar-tools"),"navigation must be a separate left sidebar with standalone tools");
assert.ok(site.includes('icon=false')&&site.includes('{icon&&<SiteMenuIcon name={id}/>}'),"body links should be text-only while sidebar links have icons");
assert.ok(site.includes('className={previousShot?"marketing-showcase-fade":"marketing-showcase-base"}')&&css.includes(".marketing-showcase-motion"),"the first approved screenshot must appear immediately without waiting for an entrance animation");
assert.ok(site.includes('siteNavigation.map(item=><NavLink')&&site.includes('<SiteMenuIcon name={id}/>'),"the remaining four site pages, including Home, must have branded navigation icons");
assert.ok(site.includes('href="/tools/atlas"')&&site.includes('href="/tools/laboratory"'),"sidebar must link to both real standalone tools");
assert.ok(site.includes("marketing-hero-split")&&site.includes("marketing-hero-copy"),"homepage must position text and real captures as sibling columns");
assert.ok(css.includes(".marketing-site .marketing-hero-split")&&css.includes("--marketing-sidebar-width")&&css.includes(".marketing-sidebar-content"),"full-width desktop sidebar and split layout styles must exist");
assert.ok(site.includes("marketing-sidebar-backdrop")&&css.includes(".marketing-header.is-expanded .marketing-sidebar-content"),"small screens must open and close the same nav using an accessible drawer");
assert.ok(site.includes('event.key==="Escape"')&&site.includes('aria-controls="marketing-sidebar-content"'),"drawer must support Escape and accessible controls");
assert.doesNotMatch(site,/marketing-showcase-window|marketing-showcase-caption|marketing-showcase-controls/,"the automatic capture field must stay label-free and control-free");

assert.doesNotMatch(site,/id:"subjects"/,"the marketing menu must not add a subjects page");
assert.ok(site.includes('href="/tools/atlas"')&&site.includes('href="/tools/laboratory"'),"both standalone public tools must remain directly in the sidebar");
assert.ok(site.includes('"/demo/board?scene="'),"example links must lead to the actual demo board");
assert.ok(site.includes('<LektrusFeedbackForm compact source="site"/>'),"feedback must use the existing submission service");
const feedbackComponent=read("src/LektrusFeedbackForm.tsx");
assert.ok(feedbackComponent.includes('"https://t.me/lektrus"')&&feedbackComponent.includes('source==="site"'),"Public contact form must always show official Telegram address");
assert.ok(feedbackComponent.includes('href={source==="site"?"https://t.me/lektrus":import.meta.env.VITE_TELEGRAM_URL}'),"Site Telegram contact must not depend on environment variables");
assert.ok(feedbackComponent.includes('rel="noopener noreferrer"'),"External Telegram link must be opened safely");
// Help uses a single calm split layout, not two oversized stacked marketing sections.
const helpPage=site.slice(site.indexOf('page==="help"&&!copy?.replaceDefault'),site.indexOf('{customPage&&<SiteCustomPage'));
assert.ok(helpPage.includes("marketing-help-layout")&&helpPage.includes("marketing-help-questions")&&helpPage.includes("marketing-help-contact"),"Help must present FAQ and contact together");
assert.equal((helpPage.match(/data-site-section-id="native-/g)||[]).length,3,"Help must preserve three Site Studio native sections");
assert.ok(helpPage.includes('placed("before-0")')&&helpPage.includes('placed("before-1")')&&helpPage.includes('placed("before-2")'),"Help must preserve existing Site Studio insertion anchors");
assert.ok(helpPage.includes('aria-labelledby="marketing-help-questions-title"')&&helpPage.includes('aria-labelledby="marketing-help-contact-title"'),"Both help sections need accessible titles");
assert.ok(helpPage.includes("questions.map(")&&helpPage.includes("<details key={item.q}>"),"Help answers should expand on demand");
assert.equal((helpPage.match(/<LektrusFeedbackForm compact source="site"\/>/g)||[]).length,1,"Help must have exactly one working feedback form");
assert.ok(!helpPage.includes("VITE_TELEGRAM_URL")&&helpPage.includes("marketing-faq-toggle"),"Avoid duplicate Telegram actions and keep clear FAQ controls");
const helpStyles=read("src/lektrusMarketingTypography.css");
assert.ok(helpStyles.includes(".marketing-site .marketing-help-layout:has(> .site-canvas-slot)")&&helpStyles.includes("grid-template-columns:minmax(0,1fr)"),"Site Studio inserted content must preserve correct help section order");
assert.ok(helpStyles.includes(".marketing-site .marketing-help-layout .marketing-faq details")&&helpStyles.includes(".marketing-site .marketing-help-layout .marketing-form-card"),"Help needs restrained FAQ and form styles");
assert.ok(site.includes("plans.map(")&&billing.includes('id:"free"')&&billing.includes('id:"teacher"')&&billing.includes('id:"pro"'),"marketing pricing should derive current app plan definitions");
assert.ok(!site.includes("Купить подписку"),"test subscriptions must not be advertised as purchasable");
for(const shot of ["board-showcase.png","app-home.png","board-math.png","board-chemistry.png","board-geometry.png","board-physics.png","board-contour.png","board-history.png","board-russian.png"]){
 assert.ok(existsSync(new URL("../public/site/"+shot,import.meta.url)),"missing actual screenshot: "+shot);
}
// Regression: the original local screenshots are actual checked-in assets, not missing URLs.
const approvedLocalShots=[
 "showcase-workspace.png","showcase-geometry.png","showcase-physics.png",
 "showcase-chemistry.png","showcase-contour.png","showcase-russian.png","showcase-ai.png"
];
const source=read("src/marketingSiteConfig.ts");
const showcaseConfig=source.split("export const DEFAULT_SITE_SHOWCASE:SiteShowcaseShot[]=[")[1]?.split("];")[0]??"";
const selected=[...showcaseConfig.matchAll(/src:"\/site\/([^"]+)"/g)].map(m=>m[1]);
assert.deepEqual(selected,approvedLocalShots,"Home must show the seven source captures from the user's local site in order");
assert.ok(source.includes("legacyShowcaseSources")&&source.includes("isLegacyDefault"),"published default galleries must migrate to the user's real screenshots");
for(const shot of [...approvedLocalShots,"showcase-atlas.png","showcase-lab.png","showcase-workspace-mobile.png"]){
 const binary=readFileSync(new URL("../public/site/"+shot,import.meta.url));
 assert.ok(binary.length>40000,"missing or incomplete local image: "+shot);
 assert.ok(binary.subarray(0,8).equals(Buffer.from("89504e470d0a1a0a","hex")),"expected real PNG capture: "+shot);
}

// Typography regression: all public-page text uses local Cyrillic-capable fonts,
// while headings, navigation, help text and mobile typography stay legible.
const typography=read("src/lektrusMarketingTypography.css");
assert.ok(typography.includes(".marketing-site .marketing-help-layout .lektrus-feedback-telegram"),"Telegram contact needs visible, accessible styling");
assert.ok(site.includes('import "./lektrusMarketingTypography.css";'),"public typography must load after base marketing layout");
for(const [path,cssPath] of [
 ["public/fonts/onest/Onest-Variable.ttf","/fonts/onest/Onest-Variable.ttf"],
 ["public/fonts/golos-text/GolosText-Variable.ttf","/fonts/golos-text/GolosText-Variable.ttf"]
]){
 const font=readFileSync(new URL("../"+path,import.meta.url));
 assert.ok(font.length>100000,"missing self-hosted readable marketing font: "+path);
 assert.ok(font.subarray(0,4).equals(Buffer.from("00010000","hex")),"expected a valid variable TrueType font: "+path);
 assert.ok(typography.includes(cssPath),"marketing typography must load local font: "+cssPath);
}
for(const name of ["onest","golos-text"]){
 assert.ok(existsSync(new URL("../public/fonts/"+name+"/OFL.txt",import.meta.url)),"font license must ship: "+name);
}
for(const rule of [
 "--marketing-font-display:","--marketing-font-body:",
 ".marketing-site .marketing-nav a",".marketing-site .marketing-sidebar-tools a",
 ".marketing-site .marketing-hero-split h1",".marketing-site .marketing-project-body",
 ".marketing-site .marketing-feature-item-copy p",".marketing-site .marketing-plan ul",
 ".marketing-site .marketing-faq summary",".marketing-site .marketing-form-card",
 ".marketing-site .site-block :is(p,li)","@media(max-width:700px)","@media(max-width:370px)"
]){
 assert.ok(typography.includes(rule),"missing consistent responsive marketing type rule: "+rule);
}
// Keep the Lektrus name readable: never force adjacent letters to overlap.
for(const selector of [
 ".marketing-site .marketing-brand strong",
 ".marketing-site .marketing-footer-brand strong",
 ".marketing-site .marketing-hero-split h1 .marketing-hero-brand-name"
]){
 const rule=typography.split(selector+" {")[1]?.split("}")[0]||"";
 assert.match(rule,/letter-spacing:\s*0\s*;/,"Lektrus wordmark must use natural character spacing: "+selector);
}
assert.ok(typography.includes("font-display:swap"),"fonts must not block first text paint");
assert.ok(typography.includes('font-size:16px;')&&typography.includes("font-size:14px"),"form and navigation copy must not be tiny");

const localFont=readFileSync(new URL("../public/fonts/manrope/Manrope-Variable.ttf",import.meta.url));
assert.ok(localFont.length>50000,"missing local Manrope font");
assert.ok(css.includes("/fonts/manrope/Manrope-Variable.ttf")&&css.includes("@keyframes marketing-showcase-zoom"),"original local typography and motion must be restored");
const capabilities=site.slice(site.indexOf("const featureGroups=["),site.indexOf("const questions=["));
assert.ok(capabilities.startsWith("const featureGroups=["),"task-first capability data must exist");
assert.equal((capabilities.match(/id:"(?:prepare|explore|result)"/g)||[]).length,3,"Features must have three meaningful work stages");
assert.equal((capabilities.match(/icon:"/g)||[]).length,7,"Features must explain seven concrete capabilities");
assert.equal((capabilities.match(/layout:"cards"/g)||[]).length,2,"preparation and results must have paired compact cards");
assert.equal((capabilities.match(/layout:"rows"/g)||[]).length,1,"working and exploration must use editorial rows");
for(const title of [
 "Собирайте материалы в одном месте","Организуйте учебную работу",
 "Объясняйте на интерактивной доске","Работайте вместе в реальном времени",
 "Исследуйте сложные темы на практике","Создавайте и разбирайте задания",
 "Сохраняйте результаты"
]){
 assert.ok(capabilities.includes(title),"missing approved concrete capability: "+title);
}
assert.ok(site.includes("MarketingFeatureIcon")&&site.includes('viewBox="0 0 24 24"'),"Features must use consistent line SVG icons");
assert.ok(typography.includes(".marketing-site .marketing-feature-items-cards")&&typography.includes(".marketing-site .marketing-feature-items-rows"),"Features must style pairs and rows separately");
assert.ok(css.includes(".marketing-project-caption")&&typography.includes(".marketing-site .marketing-feature-item-copy p")&&typography.includes("@media(max-width:700px)"),"task-first features and marketing copy must remain readable on narrow viewports");
assert.doesNotMatch(entry,/lektrusShowcase\.css/,"the public entry must not load obsolete showcase styling");
assert.match(css,/@media\(max-width:700px\)/,"the site needs small-screen layouts");
assert.ok(site.includes("const showcaseShots=config.showcase")&&read("src/marketingSiteConfig.ts").includes("DEFAULT_SITE_SHOWCASE"),"homepage must use document-managed original screenshots");
assert.ok(site.includes("marketing-showcase-screen")&&site.includes("currentShot.src"),"home must rotate actual screenshots instead of freezing one image");
assert.ok(site.includes("setPreviousSlide")&&site.includes("window.setInterval")&&site.includes("marketing-showcase-fade")&&site.includes("marketing-showcase-base"),"one automatic screenshot field must crossfade between approved local captures");
assert.doesNotMatch(site,/marketing-showcase-(controls|subjects|toolbar|player|counter|progress)/,"homepage must never display a player control bar");
assert.ok(site.includes('window.matchMedia("(prefers-reduced-motion: reduce)")'),"automatic screenshots must respect reduced motion");
assert.ok(css.includes(".marketing-showcase-screen")&&css.includes("@keyframes marketing-unified-crossfade")&&!css.includes(".marketing-showcase-controls"),"one integrated animated screenshot area must replace the old player UI");
assert.ok(site.includes("marketing-project-audiences")&&site.includes("marketing-project-summary"),"project information for teachers and students must appear directly on Home");
const homeSection=site.slice(site.indexOf('page==="home"&&!copy?.replaceDefault'),site.indexOf('page==="features"&&!copy?.replaceDefault'));
assert.equal((homeSection.match(/data-site-section-id=/g)||[]).length,2,"homepage must retain the original two native sections for the site builder");
assert.equal((homeSection.match(/className="marketing-hero-logo"/g)||[]).length,1,"Home must show one official logo in the hero");
assert.ok(homeSection.includes('className="marketing-hero-identity"')&&homeSection.includes('src="/lektrus-icon-192.png"')&&homeSection.includes('alt="" aria-hidden="true"'),"Home identity must pair the existing transparent branded image with the wordmark without duplicating its spoken name");
assert.ok(homeSection.includes('<h1 id="marketing-title">')&&homeSection.includes('marketing-hero-brand-name'),"Keep the editable single h1 and approved Lektrus wordmark");
assert.ok(homeSection.includes('<span className="marketing-hero-tagline">Онлайн-платформа для обучения</span>'),"Home must use approved online-platform descriptor");
assert.ok(typography.includes(".marketing-site .marketing-hero-split .marketing-hero-identity h1 .marketing-hero-tagline")&&typography.includes("text-align:right;"),"Tagline must be right-aligned within the title column");
assert.ok(typography.includes("font-size:clamp(19px,5vw,25px)")&&typography.includes("@media(max-width:370px)"),"Tagline needs safe mobile font scale");
const heroMark=readFileSync(new URL("../public/lektrus-icon-192.png",import.meta.url));
assert.ok(heroMark.length>4000&&heroMark.subarray(1,4).toString()==="PNG","Hero must load the shipped official transparent Lektrus image, not a placeholder");
assert.ok(typography.includes(".marketing-site .marketing-hero-split .marketing-hero-identity")&&typography.includes(".marketing-site .marketing-hero-split .marketing-hero-logo")&&typography.includes("@media(max-width:370px)"),"Home logo must have proportional responsive sizing for desktop and narrow phones");
assert.ok(homeSection.includes('aria-labelledby="marketing-project-title"')&&homeSection.includes("не только смотреть, но и действовать"),"the product story needs a prominent, accessible title");
assert.ok(homeSection.includes('<h2 id="marketing-project-title">Урок, в котором можно не только смотреть, но и действовать</h2>'),"the title must stay a single editable native object for Site Studio");
assert.ok(css.includes(".marketing-site .marketing-project-heading h2::after"),"project emphasis must be decorative, not an editable nested span");
assert.equal((homeSection.match(/className="marketing-project-stage"/g)||[]).length,3,"the story must show a clear three-stage teaching journey");
assert.ok(homeSection.includes('<div className="marketing-project-outro">')&&homeSection.includes("Больше, чем интерактивная доска.")&&!homeSection.includes("marketing-project-outro-icon"),"project outro copy must remain but the decorative star must be removed");
assert.ok(typography.includes(".marketing-site .marketing-project-journey-heading :is(.marketing-eyebrow,h3)")&&typography.includes("text-transform:uppercase;"),"both process headings must use the same small uppercase type");
assert.ok(site.includes('page==="home"?" marketing-footer-home":"')&&site.includes('className="marketing-footer-home-main"')&&site.includes('className="marketing-footer-home-bottom"'),"home must render a distinct but single site footer");
assert.ok(site.includes('aria-label="Разделы сайта"')&&site.includes('aria-label="Учебные инструменты"'),"footer navigation must have named accessible groups");
assert.ok(site.includes('href="/tools/atlas"')&&site.includes('href="/tools/laboratory"'),"home footer must link to standalone subject tools");
assert.ok(css.includes(".marketing-site .marketing-footer-home-main")&&css.includes(".marketing-site .marketing-footer-home-bottom")&&css.includes("@media(max-width:700px)"),"branded footer must have responsive layout");
for(const copy of ["Подготовьте материал","Исследуйте вместе","Продолжайте с результата","Меньше переключений. Больше наглядности.","Не просто слушать. Пробовать и понимать.","Интерактивный атлас и химическая лаборатория доступны также без создания доски"]){
 assert.ok(homeSection.includes(copy),"project presentation is missing a concrete benefit: "+copy);
}
for(const selector of [".marketing-project-intro",".marketing-project-stages",".marketing-project-audience",".marketing-project-outro"]){
 assert.ok(css.includes(selector),"project presentation is missing its visual style: "+selector);
}
assert.ok(css.includes("@media(max-width:700px)")&&css.includes(".marketing-project-stages{grid-template-columns:1fr"),"project narrative must stack cleanly on mobile");
assert.ok(homeSection.includes("marketing-showcase-motion")&&homeSection.includes("marketing-showcase-fade"),"the Home reel must use the locally approved smooth image transition");

assert.ok(site.includes('className="marketing-hero-brand-name"')&&css.includes("h1 .marketing-hero-brand-name"),"the hero must enlarge the wordmark without enlarging the entire tagline");
assert.ok(site.includes('>Демо-версия доски <')&&!site.includes('>Демо доски <'),"the demo button needs its full approved label");
assert.ok(site.includes('className="marketing-project-detail"')&&site.includes("Lektrus — образовательная платформа с общей интерактивной доской")&&site.includes("доступны также без создания доски"),"the project story must explain what Lektrus is, who uses it and why");
assert.ok(css.includes(".marketing-project-body .marketing-project-detail")&&css.includes("@media(max-width:700px)"),"expanded project copy and wordmark need mobile styles");
assert.ok(site.includes("currentShot.src")&&site.includes("previousShot.src")&&site.includes("marketing-showcase"),"one homepage animation must use existing real captures");
assert.ok(css.includes(".marketing-features-list")&&css.includes(".marketing-project-summary")&&css.includes(".marketing-help-intro"),"live public pages must have compact responsive layouts");
assert.match(css, /prefers-reduced-motion:reduce/,"reduced-motion users need a non-animated alternative");
assert.match(site,/aria-expanded=\{menuOpen\}/,"mobile navigation must expose its state");
assert.match(site,/<details key=\{item\.q\}/,"FAQ answers must be expandable");

// The builder must preserve editable public pages and retire the legacy audience tabs without losing their content.
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
assert.ok(site.includes("marketing-project-audiences")&&site.includes("marketing-project-body"),"teaching and learning information must live below the Home hero");


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
for(const id of ["home","features","pricing","help"]){
 assert.ok(site.includes('page==="'+id+'"'),"required page must keep native editable sections: "+id);
}
assert.doesNotMatch(site,/page==="(?:teachers|students|tools|how|about)"/,"retired pages must not render their old layouts");
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


// 2026 marketing IA: role-specific pages are retired even in previously published configs.
const defaultMarketing=model.defaultSiteDocument();
assert.equal(defaultMarketing.showcase.length,7,"all seven locally approved screenshots belong in one homepage field");
assert.ok(defaultMarketing.showcase.every(frame=>frame.src.startsWith("/site/")),"default reel must only use existing product screenshots");
assert.equal(defaultMarketing.navigation.some(item=>item.id==="teachers"),false);
assert.equal(defaultMarketing.navigation.some(item=>item.id==="students"),false);
const publishedLegacy=model.normalizeSiteDocument({...defaultMarketing,navigation:defaultMarketing.navigation.map(x=>({...x,hidden:false}))});
assert.equal(publishedLegacy.navigation.some(item=>item.id==="teachers"),false,"old published configs cannot resurrect teacher tab");
assert.equal(publishedLegacy.navigation.some(item=>item.id==="students"),false,"old published configs cannot resurrect student tab");
const exportedOld={...oldDocument};delete exportedOld.showcase;
assert.equal(model.normalizeSiteDocument(exportedOld).showcase.length,7,"legacy published docs without reel metadata must display the approved local captures");
const reel=model.normalizeSiteDocument({...defaultMarketing,showcase:[
 {scene:"chemistry",subject:"Химия",src:"/site/board-chemistry.png"},
 {scene:"chemistry",subject:"Duplicate",src:"/site/board-chemistry.png"},
 {scene:"math",subject:"Blocked",src:"javascript:alert(1)"},
 {scene:"math",subject:"Математика",src:"/site/board-math.png"}
]}).showcase;
assert.deepEqual(reel.map(frame=>frame.src),["/site/board-chemistry.png","/site/board-math.png"],"ordered reel should deduplicate and reject unsafe URLs");
const legacyGallery=["app-home.png","board-math.png","board-chemistry.png","board-geometry.png","board-physics.png","board-contour.png","board-history.png","board-russian.png"].map(name=>({scene:name,subject:name,src:"/site/"+name}));
const updatedPublished=model.normalizeSiteDocument({...defaultMarketing,showcase:legacyGallery}).showcase;
assert.deepEqual(updatedPublished.map(shot=>shot.src),defaultMarketing.showcase.map(shot=>shot.src),"previously published default galleries must show restored approved local screenshots");
assert.ok(builder.includes("site-builder-home-showcase")&&builder.includes("next.showcase.push("),"admin must be able to choose and rearrange unified screenshot frames");
assert.ok(builder.includes('!retiredSitePages.has(item.id)'),"admin list must not offer removed audience tabs");
assert.ok(site.includes('["teachers","students","tools","how","about"].includes(hash)'),"legacy bookmarks must redirect to Home");
const pageSections=site.slice(site.indexOf('page==="features"&&!copy?.replaceDefault'),site.indexOf('page==="help"&&!copy?.replaceDefault'));
assert.doesNotMatch(pageSections,/<img\b[^>]*src="\/site\//,"other pages must not scatter in-app screenshot files across all sections");


// Simplified information architecture and faster real capture transitions.
const homepage=site.slice(site.indexOf('page==="home"&&!copy?.replaceDefault'),site.indexOf('page==="features"&&!copy?.replaceDefault'));
const featuresPage=site.slice(site.indexOf('page==="features"&&!copy?.replaceDefault'),site.indexOf('page==="pricing"&&!copy?.replaceDefault'));
assert.equal((homepage.match(/data-site-section-id=/g)||[]).length,2,"Home contains one split hero and one project story");
assert.ok(homepage.includes('placed("before-4")'),"the editor must keep old homepage insertion anchors");
assert.ok(homepage.includes('marketing-project-summary')&&homepage.includes('marketing-project-audiences'),"project information is present below the screenshot hero");
assert.doesNotMatch(homepage,/marketing-home-summary|marketing-audience-grid|marketing-home-flow|marketing-last-cta/,"old redundant home sections must stay removed");
assert.ok(featuresPage.includes("marketing-feature-groups")&&featuresPage.includes("featureGroups.map"),"Features page must present the seven capabilities in three stages");
assert.ok(featuresPage.includes('<article className="marketing-feature-item"')&&featuresPage.includes("<p>{item.text}</p>"),"Features must use non-clickable text articles with icons");
assert.ok(featuresPage.includes('data-site-section-id="native-1"')&&featuresPage.includes('placed("before-3")'),"Site Studio feature section and insertion anchors must remain");
assert.doesNotMatch(featuresPage,/<img\b|marketing-showcase/, "Features must not include screenshots");
assert.doesNotMatch(featuresPage,/Для преподавателей|Для учеников|Главное преимущество:/,"Features should not repeat homepage selling points or role divisions");
assert.doesNotMatch(featuresPage,/<DemoLink|<NavLink|<a\b/,"Features must contain no navigation to board creation or demos");
assert.doesNotMatch(site,/page==="(?:about|how|tools|teachers|students)"/,"retired tabs must not render");
assert.ok(builder.includes("BUILTIN_SITE_PAGES"),"editor must adopt the new four built-in pages");
assert.deepEqual(model.defaultSiteDocument().navigation.map(x=>x.id),["home","features","pricing","help"]);
const legacyNav=[
 {id:"home",title:"Главная",hidden:false},{id:"features",title:"Возможности",hidden:false},
 {id:"tools",title:"Инструменты",hidden:false},{id:"how",title:"Как это работает",hidden:false},
 {id:"about",title:"О Lektrus",hidden:false},{id:"pricing",title:"Тарифы",hidden:false},
 {id:"teachers",title:"Учителям",hidden:false},{id:"students",title:"Ученикам",hidden:false},
 {id:"help",title:"Помощь",hidden:false}
];
const normalizedLegacy=model.normalizeSiteDocument({...defaultMarketing,navigation:legacyNav});
assert.deepEqual(normalizedLegacy.navigation.map(x=>x.id),["home","features","pricing","help"],"published legacy menus cannot bring deleted tabs back");
const retiredAsCustom=model.normalizeSiteDocument({...defaultMarketing,customPages:[{id:"about",title:"Reintroduced About",blocks:[]},{id:"new-page",title:"New",blocks:[]}]});
assert.ok(!retiredAsCustom.customPages.some(x=>x.id==="about"),"deleted page names stay reserved");
assert.ok(retiredAsCustom.customPages.some(x=>x.id==="new-page"),"ordinary custom pages continue working");
assert.ok(site.includes("},7500);"),"approved local slideshow must use its original 7.5-second cadence");
assert.ok(site.includes("),900);"),"outgoing screenshot must disappear after the full .9-second fade");
assert.ok(css.includes("@keyframes marketing-showcase-zoom")&&css.includes("@keyframes marketing-showcase-appear"),"approved local reel must animate its capture without white flash");
assert.ok(css.includes("min-height:0")&&css.includes(".marketing-project-summary")&&css.includes("margin-top:auto"),"project section and bottom-pinned footer must eliminate awkward whitespace");

assert.doesNotMatch(site,/Это текущие технические ограничения тарифов/,"remove the old pricing disclaimer beneath plans");
console.log("Lektrus marketing site: four compact pages, project information on Home, prose-only Features, retired routes, dynamic authentic screenshots and legacy migration verified.");
