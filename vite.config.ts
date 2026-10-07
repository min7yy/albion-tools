import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Relative base so the build works on any static host (including a GitHub Pages subpath).
export default defineConfig({
  base: './',
  plugins: [react()],
  // The crafting page bundles ~6,500 recipes (about 110 kB gzipped) in its own lazy chunk.
  build: { chunkSizeWarningLimit: 2000 },
})
