import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const base = '/GymSheet-Web/'

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icon-192.png', 'icon-512.png', 'maskable-512.png', 'apple-touch-icon.png', 'exercises/*.jpg'],
      manifest: {
        name: 'GymSheet',
        short_name: 'GymSheet',
        description: 'La tua scheda palestra, offline e senza fronzoli.',
        theme_color: '#315be2',
        background_color: '#f4f6f9',
        display: 'standalone',
        orientation: 'portrait',
        start_url: base,
        scope: base,
        icons: [
          { src: `${base}icon-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: `${base}icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: `${base}maskable-512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,jpg,jpeg,webp,woff2,wasm}'],
        cleanupOutdatedCaches: true,
        navigateFallback: 'index.html'
      }
    })
  ]
})
