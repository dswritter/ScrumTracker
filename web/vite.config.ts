import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const syncProxy = {
  // Browser uses same origin (no CORS). Avoids ngrok free-tier OPTIONS interstitial
  // (preflight does not send ngrok-skip-browser-warning, so ngrok can return HTML).
  '/__sync': {
    target: 'http://127.0.0.1:3847',
    changeOrigin: true,
    ws: true,
    rewrite: (p: string) => p.replace(/^\/__sync/, ''),
  },
} as const

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { proxy: { ...syncProxy } },
  preview: { proxy: { ...syncProxy } },
})
