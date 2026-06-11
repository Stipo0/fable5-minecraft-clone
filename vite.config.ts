import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  // Served from https://<user>.github.io/minecraft-clone/ on GitHub Pages
  base: './',
  plugins: [react()],
})
