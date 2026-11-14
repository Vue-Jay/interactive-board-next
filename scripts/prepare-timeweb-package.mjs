// Prepare a Vite output directory for Timeweb's Apache static hosting.
// No backend secrets are added: use VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
// at BUILD time, not at runtime. Both are public client configuration values.
import {readdir,readFile,writeFile} from "node:fs/promises";
import {createHash} from "node:crypto";
import {join} from "node:path";
const dist="dist";
const files=await readdir(join(dist,"assets"));
const appCss=files.find(name=>/^appEntry-.*\.css$/.test(name));
if(!appCss)throw Error("Missing appEntry CSS in production output");
const pagePath=join(dist,"index.html");
let html=await readFile(pagePath,"utf8");
if(!/<link\b[^>]*rel="stylesheet"/.test(html))throw Error("Missing initial Vite CSS");
const cssPath="/assets/"+appCss;
const hook=`    <script>
      // Routes outside the landing page need application CSS immediately.
      if (location.pathname !== "/" || /(?:^|[?&])(?:section|email_confirmation|join|source)=/.test(location.search)) {
        var style = document.createElement("link");
        style.rel = "stylesheet";
        style.href = ${JSON.stringify(cssPath)};
        document.head.appendChild(style);
      }
    </script>
`;
html=html.replace("</head>",hook+"</head>");
await writeFile(pagePath,html);
const configPath=join(dist,".htaccess");
let apache=await readFile(configPath,"utf8");
if(!apache.includes('Header always set Cache-Control "no-cache, no-store, must-revalidate"')){
 apache+=`\n<IfModule mod_headers.c>
<FilesMatch "^(index\\.html|sw\\.js|version\\.json)$">
Header always set Cache-Control "no-cache, no-store, must-revalidate"
</FilesMatch>
</IfModule>
`;
 await writeFile(configPath,apache);
}
const swPath=join(dist,"sw.js");
let sw=await readFile(swPath,"utf8");
const stamp=createHash("sha256").update(html).digest("hex").slice(0,12);
sw=sw.replace(/lektrus-shell-[\w-]+/g,"lektrus-shell-timeweb-"+stamp);
await writeFile(swPath,sw);
await writeFile(join(dist,"lektrus-deploy-check.html"),`<!doctype html><html lang="ru"><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Lektrus — проверка обновления</title>
<style>body{font:16px/1.6 system-ui;margin:8vh auto;max-width:680px;padding:24px;color:#20334f;background:#f4f7fb}main{padding:26px;background:white;border-radius:18px}h1{font-size:24px}.ok{color:#14704e}.err{color:#b62932}</style>
<main><h1>Проверка Lektrus на Timeweb</h1><p id="status">Проверяем файлы...</p><p id="detail"></p></main>
<script>(async()=>{const s=document.querySelector("#status"),d=document.querySelector("#detail");try{
const res=await fetch("/assets/${files.find(n=>/^index-.*\.js$/.test(n))||""}",{cache:"no-store"});
const css=await fetch(${JSON.stringify(cssPath)},{cache:"no-store"});
if(!res.ok||!css.ok)throw Error("Ошибка загрузки JS/CSS: "+res.status+"/"+css.status);
s.textContent="✓ Версия Timeweb ${stamp} загружена";s.className="ok";
d.textContent="Базовые файлы доступны. Вход и сохранение данных проверяются отдельно.";
}catch(e){s.textContent="✗ Не удалось проверить файлы";s.className="err";d.textContent=String(e)}})()</script></html>`);
console.log("Timeweb package prepared:",stamp,"CSS",appCss);
