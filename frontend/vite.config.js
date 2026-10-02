import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// En modo desarrollo (npm run dev) Vite redirige /api al backend local
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:8080',
    },
  },
})
