import {
  companyAppName,
  companyManifestPath,
  researcherAppName,
} from '../../shared/pwa-manifest'
import { parseCompanySlugFromLocation } from './companies'

export type PwaAppProfile =
  | { kind: 'researcher' }
  | { kind: 'company'; slug: string; name: string }

export function appDisplayName(profile: PwaAppProfile): string {
  if (profile.kind === 'researcher') return researcherAppName()
  return companyAppName(profile.name)
}

export function manifestUrl(profile: PwaAppProfile): string {
  if (profile.kind === 'researcher') return '/manifest.webmanifest'
  return companyManifestPath(profile.slug)
}

function setMeta(name: string, content: string) {
  let el = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.name = name
    document.head.appendChild(el)
  }
  el.content = content
}

/** Point the page at the correct installable app (researcher vs company portal). */
export function applyPwaProfile(profile: PwaAppProfile) {
  if (typeof document === 'undefined') return

  const href = manifestUrl(profile)
  const displayName = appDisplayName(profile)

  let link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]')
  if (!link) {
    link = document.createElement('link')
    link.rel = 'manifest'
    document.head.appendChild(link)
  }
  const absolute = new URL(href, window.location.origin).href
  if (link.href !== absolute) link.href = href

  setMeta('apple-mobile-web-app-title', displayName)
  setMeta('application-name', displayName)
}

export function isStandaloneDisplay(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

/** Hide install CTA when this specific app profile is already on screen as a PWA. */
export function isInstalledForProfile(profile: PwaAppProfile): boolean {
  if (!isStandaloneDisplay()) return false
  const slug =
    typeof window !== 'undefined' ? parseCompanySlugFromLocation(window.location) : null

  if (profile.kind === 'researcher') return !slug
  return slug === profile.slug
}

export { buildResearcherManifest, buildCompanyManifest } from '../../shared/pwa-manifest'
