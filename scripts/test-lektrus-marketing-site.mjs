import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";

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
assert.ok(blocks.includes("data-site-block-id")&&site.includes("SITE_PREVIEW_MESSAGE"),"preview needs editable block selection");
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
assert.ok(assetSql.includes("bucket_id='marketing-site'"),"media policies must be bucket-scoped");

console.log("Lektrus marketing site: selected copy, 8 sections, real screenshots, demo links, pricing, accessibility and responsive styling verified.");
