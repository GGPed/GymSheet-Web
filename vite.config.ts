import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icon.svg', 'maskable-icon.svg', 'exercise-*.jpg'],
      manifest: {
        name: 'GymSheet',
        short_name: 'GymSheet',
        description: 'La tua scheda palestra, offline e senza fronzoli.',
        theme_color: '#315be2',
        background_color: '#f4f6f9',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: '/maskable-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,jpg,jpeg,webp,woff2,wasm}'],
        cleanupOutdatedCaches: true,
        navigateFallback: '/index.html'
      }
    })
  ]
})
