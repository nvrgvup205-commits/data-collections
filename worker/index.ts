import { buildCompanyManifest } from '../shared/pwa-manifest'

const SUPABASE_URL = 'https://lrwliqnjtrqazkuynhti.supabase.co'
const PHOTO_BUCKET = 'fr-place-photos'

const KNOWN_NAMES: Record<string, string> = {
  'saudi-trend': 'سعودي تريند',
  nokhba: 'شركة نخبة التسويق',
}

interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> }
}

async function fetchCompanyName(slug: string): Promise<string> {
  if (KNOWN_NAMES[slug]) return KNOWN_NAMES[slug]

  const metaUrl = `${SUPABASE_URL}/storage/v1/object/public/${PHOTO_BUCKET}/fr-portals/${encodeURIComponent(slug)}/meta.json`
  try {
    const res = await fetch(metaUrl, { cf: { cacheTtl: 300 } })
    if (res.ok) {
      const meta = (await res.json()) as { name?: string }
      if (meta.name?.trim()) return meta.name.trim()
    }
  } catch {
    /* fall through */
  }

  return slug
}

function manifestResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: {
      'Content-Type': 'application/manifest+json; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
  })
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const match = url.pathname.match(/^\/manifest\/company\/([^/]+)\.webmanifest$/)
    if (match) {
      let slug: string
      try {
        slug = decodeURIComponent(match[1])
      } catch {
        slug = match[1]
      }
      const companyName = await fetchCompanyName(slug)
      return manifestResponse(buildCompanyManifest(slug, companyName))
    }

    return env.ASSETS.fetch(request)
  },
} satisfies ExportedHandler<Env>
