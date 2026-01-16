import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        name: 'Church Service Studio',
        short_name: 'Studio',
        description: 'Floor manager view for church service production',
        theme_color: '#1a1a2e',
        background_color: '#1a1a2e',
        display: 'standalone',
        orientation: 'landscape',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
      },
    }),
  ],
  server: {
    host: true,
    // Port 7700: A nod to Matthew 18:21-22 where Peter asks Jesus
    // "How many times shall I forgive?" and Jesus answers "seventy times seven"
    // (77 x 100 = 7700) - fitting for a church service system
    port: 7700,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
})
