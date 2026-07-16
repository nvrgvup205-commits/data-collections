import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'pwa/icon-192.png', 'pwa/icon-512.png', 'pwa/apple-touch-icon.png'],
      manifest: {
        name: 'تقارير',
        short_name: 'تقارير',
        description: 'تقارير الأبحاث الميدانية — تحديث لحظي للباحث والشركات',
        theme_color: '#0f766e',
        background_color: '#f0fdfa',
        display: 'standalone',
        orientation: 'portrait-primary',
        dir: 'rtl',
        lang: 'ar',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: 'pwa/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'pwa/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'pwa/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,webmanifest}'],
        navigateFallback: 'index.html',
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
    }),
  ],
  server: {
    host: true,
    port: 5173,
  },
})
