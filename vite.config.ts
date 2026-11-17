import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  ...(process.env.LEKTRUS_NATIVE_BUILD === 'true' ? {
    // Native Android 11 can ship WebView 83; iOS minimum is 15.0.
    build: { target: ['chrome83', 'safari15'], cssTarget: ['chrome83', 'safari15'] },
    css: { postcss: { plugins: [{
      postcssPlugin: 'native-viewport-unit-fallback',
      Declaration(decl) {
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
