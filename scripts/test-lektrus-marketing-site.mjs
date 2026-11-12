import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";

const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const site=read("src/LektrusPublicSite.tsx");
const css=read("src/lektrusMarketing.css");
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
assert.match(css,/@media\(max-width:700px\)/,"the site needs small-screen layouts");
assert.match(css, /prefers-reduced-motion:reduce/,"reduced-motion users need a non-animated alternative");
assert.match(site,/aria-expanded=\{menuOpen\}/,"mobile navigation must expose its state");
assert.match(site,/<details key=\{item\.q\}/,"FAQ answers must be expandable");
console.log("Lektrus marketing site: selected copy, 8 sections, real screenshots, demo links, pricing, accessibility and responsive styling verified.");
