import { Entry } from '../types'
import { PHOTO_BUCKET, supabase } from './supabase'
import { slugify } from './phone'

export interface CompanyMeta {
  name: string
  slug: string
  username: string
  password: string
  updatedAt: number
}

const REGISTRY_KEY = 'fr-company-registry-v1'
const PORTAL_SESSION_KEY = 'fr-company-portal-session-v1'

const KNOWN_DEFAULTS: Omit<CompanyMeta, 'updatedAt'>[] = [
  { name: 'سعودي تريند', slug: 'saudi-trend', username: '2222', password: '222222' },
  { name: 'شركة نخبة التسويق', slug: 'nokhba', username: '3333', password: '333333' },
]

function now() {
  return Date.now()
}

export function companyShareUrl(slug: string): string {
  if (!slug.trim()) return ''
  const base = typeof window !== 'undefined' ? window.location.origin : ''
  return `${base}/#/c/${encodeURIComponent(slug.trim())}`
}

export function parseCompanySlugFromHash(hash: string): string | null {
  const m = hash.match(/^#\/c\/([^/?#]+)/)
  if (!m) return null
  try {
    return decodeURIComponent(m[1])
  } catch {
    return m[1]
  }
}

function metaPath(slug: string) {
  return `fr-portals/${slug}/meta.json`
}

function placesPath(slug: string) {
  return `fr-portals/${slug}/places.json`
}

function readLocalRegistry(): CompanyMeta[] {
  try {
    const raw = localStorage.getItem(REGISTRY_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as CompanyMeta[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeLocalRegistry(list: CompanyMeta[]) {
  localStorage.setItem(REGISTRY_KEY, JSON.stringify(list))
}

function upsertLocal(meta: CompanyMeta) {
  const list = readLocalRegistry().filter(
    (c) => c.slug !== meta.slug && c.name.trim() !== meta.name.trim(),
  )
  list.push(meta)
  writeLocalRegistry(list)
  return meta
}

export function listLocalCompanies(): CompanyMeta[] {
  const map = new Map<string, CompanyMeta>()
  for (const d of KNOWN_DEFAULTS) {
    map.set(d.slug, { ...d, updatedAt: 0 })
  }
  for (const c of readLocalRegistry()) {
    map.set(c.slug, c)
  }
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'ar'))
}

export function findCompanyByName(name: string): CompanyMeta | undefined {
  const n = name.trim()
  if (!n) return undefined
  return listLocalCompanies().find((c) => c.name.trim() === n)
}

export function findCompanyBySlug(slug: string): CompanyMeta | undefined {
  const s = slug.trim()
  if (!s) return undefined
  return listLocalCompanies().find((c) => c.slug === s)
}

async function uploadJson(path: string, data: unknown): Promise<void> {
  if (!supabase) throw new Error('Supabase غير مهيّأ')
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' })
  const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, blob, {
    upsert: true,
    contentType: 'application/json',
    cacheControl: '0',
  })
  if (error) throw error
}

async function fetchPublicJson<T>(path: string): Promise<T | null> {
  if (!supabase) return null
  const { data } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path)
  const url = `${data.publicUrl}?t=${Date.now()}`
  try {
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

export async function saveCompanyMeta(input: {
  name: string
  slug: string
  username: string
  password: string
}): Promise<CompanyMeta> {
  const name = input.name.trim()
  const slug = slugify(input.slug) || slugify(name)
  if (!name) throw new Error('اكتب اسم الشركة')
  if (!slug) throw new Error('اكتب slug صالح للشركة')
  if (!input.username.trim() || !input.password.trim()) {
    throw new Error('اكتب اسم المستخدم وكلمة المرور لبوابة الشركة')
  }
  const meta: CompanyMeta = {
    name,
    slug,
    username: input.username.trim(),
    password: input.password.trim(),
    updatedAt: now(),
  }
  upsertLocal(meta)
  try {
    await uploadJson(metaPath(slug), meta)
  } catch (e) {
    console.warn('تعذّر رفع بيانات بوابة الشركة إلى التخزين', e)
  }
  return meta
}

export async function loadCompanyMeta(slug: string): Promise<CompanyMeta | null> {
  const local = findCompanyBySlug(slug)
  const remote = await fetchPublicJson<CompanyMeta>(metaPath(slug))
  if (remote?.slug && remote.name) {
    upsertLocal(remote)
    return remote
  }
  return local ?? null
}

export async function syncCompanyPortalPlaces(
  companyName: string,
  allEntries: Entry[],
): Promise<void> {
  const meta = findCompanyByName(companyName)
  if (!meta) return
  const places = allEntries
    .filter((e) => (e.targetCompany?.trim() || '') === companyName.trim())
    .sort((a, b) => b.updatedAt - a.updatedAt)
  try {
    await uploadJson(placesPath(meta.slug), {
      company: meta.name,
      slug: meta.slug,
      updatedAt: now(),
      places,
    })
  } catch (e) {
    console.warn('تعذّر مزامنة تقارير بوابة الشركة', e)
  }
}

export async function fetchCompanyPortalPlaces(slug: string): Promise<Entry[]> {
  const data = await fetchPublicJson<{ places?: Entry[] }>(placesPath(slug))
  return Array.isArray(data?.places) ? data!.places! : []
}

export interface CompanyPortalSession {
  slug: string
  company: string
  loggedAt: number
}

export function getPortalSession(): CompanyPortalSession | null {
  try {
    const raw = sessionStorage.getItem(PORTAL_SESSION_KEY)
    if (!raw) return null
    return JSON.parse(raw) as CompanyPortalSession
  } catch {
    return null
  }
}

export function setPortalSession(session: CompanyPortalSession | null) {
  if (!session) sessionStorage.removeItem(PORTAL_SESSION_KEY)
  else sessionStorage.setItem(PORTAL_SESSION_KEY, JSON.stringify(session))
}

export async function loginCompanyPortal(
  slug: string,
  username: string,
  password: string,
): Promise<CompanyMeta> {
  const meta = await loadCompanyMeta(slug)
  if (!meta) throw new Error('بوابة الشركة غير موجودة')
  if (meta.username !== username.trim() || meta.password !== password.trim()) {
    throw new Error('اسم المستخدم أو كلمة المرور غير صحيحة')
  }
  setPortalSession({ slug: meta.slug, company: meta.name, loggedAt: now() })
  return meta
}

/** Loud multi-beep alert for new reports on the company portal. */
export function playNewReportAlert() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new AudioCtx()
    const tones = [880, 1175, 1480, 1175, 880]
    tones.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'square'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.0001, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.9, ctx.currentTime + i * 0.12 + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.12 + 0.18)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(ctx.currentTime + i * 0.12)
      osc.stop(ctx.currentTime + i * 0.12 + 0.2)
    })
    if (navigator.vibrate) navigator.vibrate([200, 80, 200, 80, 400])
  } catch {
    // ignore audio failures (autoplay policy / unsupported)
  }
}
