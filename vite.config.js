import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' keeps built asset URLs relative, so the site works when served
// from any path (or opened close to how the original ran from file://).
export default defineConfig({
  base: './',
  plugins: [react()],
})
