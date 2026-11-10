import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import pkg from './package.json'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version || '1.0.0'),
    __GIT_COMMIT__: JSON.stringify('local'),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString().split('T')[0]),
  },
  build: {
    outDir: path.resolve(__dirname, '../backend/public'),
    emptyOutDir: true
  },
  server: {
    port: 5175,
    proxy: {
      '/api': {
        target: 'http://localhost:3005',
        changeOrigin: true
      }
    }
  }
})
