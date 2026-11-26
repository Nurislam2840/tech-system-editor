import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/',
  build: {
    minify: false, // আপাতত বন্ধ রাখলাম, যাতে এরর লুকিয়ে না থাকে
  },
})