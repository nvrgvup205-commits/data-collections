/** Shared PWA manifest builders (client + Cloudflare Worker). */

export const PWA_THEME_COLOR = '#0f766e'
export const PWA_BACKGROUND_COLOR = '#f0fdfa'

export const PWA_ICONS = [
  { src: '/pwa/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
  { src: '/pwa/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
  { src: '/pwa/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
]

export function researcherAppName(): string {
  return 'باحث'
}

export function companyAppName(companyName: string): string {
  return companyName.trim()
}

export function buildResearcherManifest() {
  const name = researcherAppName()
  return {
    id: 'app-researcher',
    name,
    short_name: name,
    description: 'تقارير الأبحاث الميدانية — لوحة الباحث',
    theme_color: PWA_THEME_COLOR,
    background_color: PWA_BACKGROUND_COLOR,
    display: 'standalone' as const,
    orientation: 'portrait-primary' as const,
    dir: 'rtl' as const,
    lang: 'ar',
    start_url: '/',
    scope: '/',
    icons: PWA_ICONS,
  }
}

export function buildCompanyManifest(slug: string, companyName: string) {
  const safeSlug = slug.trim()
  const name = companyAppName(companyName)
  return {
    id: `app-company-${safeSlug}`,
    name,
    short_name: name,
    description: `تقارير الأبحاث الميدانية — ${companyName.trim()}`,
    theme_color: PWA_THEME_COLOR,
    background_color: PWA_BACKGROUND_COLOR,
    display: 'standalone' as const,
    orientation: 'portrait-primary' as const,
    dir: 'rtl' as const,
    lang: 'ar',
    start_url: `/p/${encodeURIComponent(safeSlug)}/`,
    scope: `/p/${encodeURIComponent(safeSlug)}/`,
    icons: PWA_ICONS,
  }
}

export function companyManifestPath(slug: string): string {
  return `/manifest/company/${encodeURIComponent(slug.trim())}.webmanifest`
}
