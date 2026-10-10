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
      includeAssets: ['icon-192.png', 'icon-512.png', 'maskable-512.png', 'apple-touch-icon.png', "exercises/Ab Crunch Machine.jpg","exercises/Addome - Plank e Crunch.svg","exercises/Barbell Bench Press - Medium Grip.jpg","exercises/Cable Crossover.jpg","exercises/Dumbbell Alternate Bicep Curl.jpg","exercises/External Rotation with Band.jpg","exercises/Goblet Squat.jpg","exercises/Leg Extensions.jpg","exercises/Leverage Chest Press.jpg","exercises/Leverage Incline Chest Press.jpg","exercises/Lying Leg Curls.jpg","exercises/Machine Shoulder (Military) Press.jpg","exercises/One Arm Lat Pulldown.jpg","exercises/One-Arm Dumbbell Row.jpg","exercises/Plank_2.jpg","exercises/Seated Cable Rows.jpg","exercises/Seated Leg Curl.jpg","exercises/Side Lateral Raise.jpg","exercises/Side Leg Raises.jpg","exercises/Split Squat with Dumbbells.jpg","exercises/Standing Low-Pulley Deltoid Raise.jpg","exercises/Triceps Pushdown - Rope Attachment.jpg","exercises/Wide-Grip Lat Pulldown.jpg"],
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
        globIgnores: ['**/exercises/**'],
        runtimeCaching: [{urlPattern: /\/exercises\/.*\.(?:jpg|jpeg|png|webp|svg)(?:\?.*)?$/i, handler: 'CacheFirst', options: {cacheName: 'gymsheet-exercise-images', cacheableResponse: {statuses: [200]}}}],
        navigateFallback: 'index.html'
      }
    })
  ]
})
