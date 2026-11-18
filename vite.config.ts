import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
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
