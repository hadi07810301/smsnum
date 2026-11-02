import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' lets the built site work from any folder.
// During `npm run dev`, API calls are forwarded to the Node server (npm start) on port 3000.
export default defineConfig({
  plugins: [react()],
  base: './',
  server: { proxy: { '/api': 'http://localhost:3000' } },
})
