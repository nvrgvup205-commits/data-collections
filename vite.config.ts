import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { buildCompanyManifest, buildResearcherManifest } from './shared/pwa-manifest'

function companyManifestDevPlugin(): Plugin {
  return {
    name: 'company-manifest-dev',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const rawUrl = (req as { url?: string }).url ?? ''
        const pathOnly = rawUrl.split('?')[0] ?? ''
        const match = pathOnly.match(/^\/manifest\/company\/([^/]+)\.webmanifest$/)
        if (!match) {
          next()
          return
        }
        let slug: string
        try {
          slug = decodeURIComponent(match[1])
        } catch {
          slug = match[1]
        }
        const q = rawUrl.indexOf('?')
        const nameParam =
          q >= 0 ? new URLSearchParams(rawUrl.slice(q + 1)).get('name') : null
        const companyName = nameParam?.trim() || slug
        const body = JSON.stringify(buildCompanyManifest(slug, companyName))
        res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8')
        res.end(body)
      })
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    companyManifestDevPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'pwa/icon-192.png', 'pwa/icon-512.png', 'pwa/apple-touch-icon.png'],
      manifest: buildResearcherManifest(),
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
