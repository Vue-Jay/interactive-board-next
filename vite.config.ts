import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { createReadStream, readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'


// Ship the same branded, dependency-free recovery screen in every web and
// native build. The template also survives a failed initial JS module load.
const recoveryDocument=readFileSync(new URL('./src/serviceUnavailableDocument.html',import.meta.url),'utf8')
const recoveryStyle=recoveryDocument.match(/<style>[\s\S]*?<\/style>/)?.[0]
const recoveryMain=recoveryDocument.match(/<main\b[\s\S]*?<\/main>/)?.[0]
const recoveryScript=recoveryDocument.match(/<script>[\s\S]*?<\/script>/)?.[0]
if(!recoveryStyle||!recoveryMain||!recoveryScript)throw new Error('Missing service recovery template')
const recoveryTemplate='<template id="lektrus-unavailable-template">'+recoveryStyle+recoveryMain+'</template>'
const initialModuleFallback=`<script>
window.addEventListener('error',function(event){
  if(!event.target||event.target.tagName!=='SCRIPT'||event.target.type!=='module')return;
  function show(){
    var root=document.getElementById('root'),template=document.getElementById('lektrus-unavailable-template');
    if(!root||root.childNodes.length||!template)return;
    root.appendChild(template.content.cloneNode(true));
    root.querySelector('[data-u-status]').textContent='Ошибка загрузки';
    root.querySelector('[data-u-title]').textContent='Не удалось открыть Lektrus';
    root.querySelector('[data-u-description]').textContent='Интерфейс не загрузился. Проверяем восстановление подключения.';
    window.lektrusRecoverDocument(root);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',show,{once:true});else show();
},true);
</script>`

export default defineConfig({
  plugins: [react(), {
    name: 'lektrus-annual-atlas-local-preview',
    apply: 'serve',
    configureServer(server) {
      const folder=process.env.LEKTRUS_ANNUAL_TIMELINE_DIR
      if(!folder)return
      server.middlewares.use('/__atlas-annual',(req,res)=>{
        const file=req.url?.split('?')[0]?.replace(/^\//,'')??''
        if(file!=='manifest.json'&&!/^packs\/[0-9a-f]{64}\.json$/.test(file)){res.statusCode=404;res.end();return}
        const target=resolve(folder,file)
        try{const info=statSync(target);if(!info.isFile())throw new Error('not a file');res.setHeader('Content-Length',info.size)}catch{res.statusCode=404;res.end();return}
        res.setHeader('Content-Type','application/json')
        res.setHeader('Cache-Control',file==='manifest.json'?'no-cache':'public, max-age=31536000, immutable')
        createReadStream(target).on('error',()=>res.destroy()).pipe(res)
      })
    },
  }, {
    name: 'lektrus-service-recovery',
    transformIndexHtml: {order:'pre',handler(html){
      return html.replace('</head>',recoveryScript+initialModuleFallback+'</head>').replace('<div id="root"></div>','<div id="root"></div>'+recoveryTemplate)
    }},
    generateBundle(){this.emitFile({type:'asset',fileName:'service-unavailable.html',source:recoveryDocument})},
    configureServer(server){server.middlewares.use('/service-unavailable.html',(_req,res)=>{
      res.setHeader('Content-Type','text/html; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(recoveryDocument)
    })},
  }],
  worker: { format: 'es', plugins: () => [{
    name: 'pdf-worker-fallback-export',
    // Vite strips entry exports from worker bundles. The PDF library also
    // imports the same URL in its main-thread fallback, which needs this export.
    generateBundle(_options, bundle) {
      for (const chunk of Object.values(bundle)) if (chunk.type === 'chunk' && chunk.isEntry && chunk.facadeModuleId?.endsWith('/pdfWorker.ts')) {
        if (!chunk.exports.includes('WorkerMessageHandler')) {
          chunk.code += '\nexport const WorkerMessageHandler = globalThis.pdfjsWorker.WorkerMessageHandler;\n';
        }
      }
    },
  }] },
  ...(process.env.LEKTRUS_NATIVE_BUILD === 'true' ? {
    // Android 7–9 emulator images can ship WebView 69; iOS minimum is 15.0.
    build: { target: ['chrome69', 'safari15'], cssTarget: ['chrome69', 'safari15'] },
    css: { postcss: { plugins: [{
      postcssPlugin: 'native-viewport-unit-fallback',
      Declaration(decl) {
        // Chromium 69–83 ignores the inset shorthand. Split its top-level
        // CSS values without breaking nested var()/calc() expressions.
        if (decl.prop === 'inset') {
          const values:string[]=[];let depth=0,token='';
          for(const ch of decl.value){
            if(ch==='(')depth++;else if(ch===')')depth--;
            if(!depth&&/\s/.test(ch)){if(token){values.push(token);token='';}}
            else token+=ch;
          }
          if(token)values.push(token);
          if(values.length>=1&&values.length<=4){
            const [top,right=top,bottom=top,left=right]=values;
            for(const [prop,value] of Object.entries({top,right,bottom,left}))decl.cloneBefore({prop,value});
          }
        }
        if (/\d(?:d|s|l)v[hw]\b/.test(decl.value)) {
          const value=decl.value.replace(/(\d)(?:d|s|l)v([hw])\b/g,'$1v$2');
          decl.cloneBefore({ value });
        }
      },
    }] } },
  } : {}),
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
  },
})
