import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { createReadStream, statSync } from 'node:fs'
import { resolve } from 'node:path'

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
  }],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
  },
})
