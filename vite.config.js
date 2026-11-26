import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/',
  build: {
    minify: false, // আপাতত মিনিফাই বন্ধ রাখুন
  },
})