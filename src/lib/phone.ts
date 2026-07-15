/** Normalize a Saudi (or international) phone number for tel: / WhatsApp links. */
export function normalizePhone(raw: string): string {
  let digits = raw.replace(/[^\d+]/g, '')
  if (digits.startsWith('00')) digits = `+${digits.slice(2)}`
  if (digits.startsWith('+')) {
    return digits.replace(/\D/g, '')
  }
  digits = digits.replace(/\D/g, '')
  if (digits.startsWith('966')) return digits
  if (digits.startsWith('0') && digits.length >= 9) return `966${digits.slice(1)}`
  if (digits.length === 9 && digits.startsWith('5')) return `966${digits}`
  return digits
}

export function telHref(phone: string): string {
  const n = normalizePhone(phone)
  return n ? `tel:+${n}` : `tel:${phone}`
}

export function whatsappHref(phone: string): string {
  const n = normalizePhone(phone)
  return n ? `https://wa.me/${n}` : '#'
}

export function slugify(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\u0600-\u06ff-]/gi, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export function placeShareUrl(slug: string): string {
  if (!slug.trim()) return ''
  const base = typeof window !== 'undefined' ? window.location.origin : ''
  return `${base}/#/p/${encodeURIComponent(slug.trim())}`
}

export function parsePlaceSlugFromHash(hash: string): string | null {
  const m = hash.match(/^#\/p\/([^/?#]+)/)
  if (!m) return null
  try {
    return decodeURIComponent(m[1])
  } catch {
    return m[1]
  }
}
