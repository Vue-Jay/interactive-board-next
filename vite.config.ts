import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '192.168.0.10',
    port: 5173,
    strictPort: true,
  },
})
