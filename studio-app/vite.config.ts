import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

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
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}']
      }
    })
  ],
  server: {
    host: true,
    // Port 7700: En blinkning till Matteus 18:21–22 där Petrus frågar Jesus
    // "Hur många gånger ska jag förlåta?" och Jesus svarar "sjuttio gånger sju"
    // (77 × 100 = 7700) - passande för ett gudstjänstsystem
    port: 7700
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
});
