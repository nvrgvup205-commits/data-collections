import { DealStatus, Entry, PhotoRef, Section, SECTION_COLORS } from '../types'
import { supabase, PHOTO_BUCKET } from './supabase'
import { uid } from '../storage'

// Cloud data layer (Supabase). Only used when `supabase` is configured.

function db() {
  if (!supabase) throw new Error('Supabase غير مهيّأ')
  return supabase
}

export async function currentUserId(): Promise<string | undefined> {
  const { data } = await db().auth.getUser()
  return data.user?.id
}

// ---------- Sections ----------
export async function fetchSections(): Promise<Section[]> {
  const { data, error } = await db()
    .from('fr_sections')
    .select('id, name, color, created_at')
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    color: r.color ?? SECTION_COLORS[0],
    createdAt: new Date(r.created_at).getTime(),
  }))
}

/** Merge sections that share the same name; reassign places to the kept section. */
export async function dedupeSectionsByName(sections: Section[]): Promise<Section[]> {
  const byName = new Map<string, Section[]>()
  for (const s of sections) {
    const key = s.name.trim()
    const list = byName.get(key) ?? []
    list.push(s)
    byName.set(key, list)
  }

  const keep: Section[] = []
  const remaps: { from: string; to: string }[] = []

  for (const [, group] of byName) {
    const sorted = [...group].sort((a, b) => a.createdAt - b.createdAt)
    const primary = sorted[0]
    keep.push(primary)
    for (const dup of sorted.slice(1)) {
      remaps.push({ from: dup.id, to: primary.id })
    }
  }

  for (const { from, to } of remaps) {
    await db().from('fr_places').update({ section_id: to }).eq('section_id', from)
    await db().from('fr_sections').delete().eq('id', from)
  }

  return keep.sort((a, b) => a.createdAt - b.createdAt)
}

export async function ensureDefaultSections(): Promise<Section[]> {
  let existing = await fetchSections()
  if (existing.length) {
    // Collapse accidental duplicates (e.g. مطاعم وكافيهات repeated).
    const names = new Set(existing.map((s) => s.name.trim()))
    if (names.size < existing.length) {
      existing = await dedupeSectionsByName(existing)
    }
    return existing
  }
  const defaults = [
    { name: 'مطاعم وكافيهات', color: SECTION_COLORS[0] },
    { name: 'شركات', color: SECTION_COLORS[1] },
  ]
  const { data, error } = await db().from('fr_sections').insert(defaults).select()
  if (error) {
    // Another client may have seeded concurrently; re-read + dedupe.
    return dedupeSectionsByName(await fetchSections())
  }
  return (data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    color: r.color ?? SECTION_COLORS[0],
    createdAt: new Date(r.created_at).getTime(),
  }))
}

export async function addSection(name: string, color: string): Promise<Section> {
  const trimmed = name.trim()
  const existing = await fetchSections()
  const found = existing.find((s) => s.name.trim() === trimmed)
  if (found) return found

  const { data, error } = await db()
    .from('fr_sections')
    .insert({ name: trimmed, color })
    .select()
    .single()
  if (error) throw error
  return {
    id: data.id,
    name: data.name,
    color: data.color ?? color,
    createdAt: new Date(data.created_at).getTime(),
  }
}

// ---------- Photos (Storage) ----------
export async function uploadPhoto(blob: Blob): Promise<PhotoRef> {
  const path = `${uid()}.jpg`
  const { error } = await db()
    .storage.from(PHOTO_BUCKET)
    .upload(path, blob, { contentType: 'image/jpeg', upsert: true })
  if (error) throw error
  const { data } = db().storage.from(PHOTO_BUCKET).getPublicUrl(path)
  return { id: path, capturedAt: Date.now(), url: data.publicUrl }
}

async function deletePhotoObjects(paths: string[]): Promise<void> {
  if (!paths.length) return
  await db().storage.from(PHOTO_BUCKET).remove(paths)
}

// ---------- Places ----------
interface PlaceRow {
  id: string
  section_id: string | null
  target_company: string | null
  place_name: string
  address: string | null
  address_notes: string | null
  lat: number | null
  lng: number | null
  manager_name: string | null
  manager_phone: string | null
  activity_type: string | null
  custom_activity: string | null
  met: string | null
  meeting_notes: string | null
  // Optional: only present after running the schema migration on Supabase.
  deal_status?: string | null
  rejection_reason?: string | null
  slug?: string | null
  place_username?: string | null
  place_password?: string | null
  created_at: string
  updated_at: string
}

/** Fallback storage for new fields when DB columns are not migrated yet. */
const EXT_MARK = '«FR_EXT»'

interface PlaceExt {
  dealStatus?: DealStatus
  rejectionReason?: string
  slug?: string
  placeUsername?: string
  placePassword?: string
}

function parseDealStatus(raw: string | null | undefined): DealStatus {
  return raw === 'purchased' || raw === 'rejected' || raw === 'objections' ? raw : ''
}

function packMeetingNotes(notes: string, ext: PlaceExt): string | null {
  const clean = unpackMeetingNotes(notes).notes
  const payload: PlaceExt = {}
  if (ext.dealStatus) payload.dealStatus = ext.dealStatus
  if (ext.rejectionReason) payload.rejectionReason = ext.rejectionReason
  if (ext.slug) payload.slug = ext.slug
  if (ext.placeUsername) payload.placeUsername = ext.placeUsername
  if (ext.placePassword) payload.placePassword = ext.placePassword
  if (!Object.keys(payload).length) return clean || null
  const blob = `${EXT_MARK}${JSON.stringify(payload)}`
  return clean ? `${clean}\n\n${blob}` : blob
}

function unpackMeetingNotes(raw: string | null | undefined): { notes: string; ext: PlaceExt } {
  if (!raw) return { notes: '', ext: {} }
  const idx = raw.indexOf(EXT_MARK)
  if (idx === -1) return { notes: raw, ext: {} }
  const notes = raw.slice(0, idx).replace(/\s+$/, '')
  try {
    const ext = JSON.parse(raw.slice(idx + EXT_MARK.length)) as PlaceExt
    return { notes, ext: ext && typeof ext === 'object' ? ext : {} }
  } catch {
    return { notes: raw, ext: {} }
  }
}

function rowToEntry(r: PlaceRow, photos: PhotoRef[]): Entry {
  const { notes, ext } = unpackMeetingNotes(r.meeting_notes)
  return {
    id: r.id,
    sectionId: r.section_id ?? '',
    placeName: r.place_name ?? '',
    address: r.address ?? '',
    addressNotes: r.address_notes ?? '',
    lat: r.lat,
    lng: r.lng,
    managerName: r.manager_name ?? '',
    managerPhone: r.manager_phone ?? '',
    activityType: r.activity_type ?? '',
    customActivity: r.custom_activity ?? '',
    met: (r.met as Entry['met']) ?? '',
    meetingNotes: notes,
    dealStatus: parseDealStatus(r.deal_status) || parseDealStatus(ext.dealStatus) || '',
    rejectionReason: r.rejection_reason ?? ext.rejectionReason ?? '',
    slug: r.slug ?? ext.slug ?? '',
    placeUsername: r.place_username ?? ext.placeUsername ?? '',
    placePassword: r.place_password ?? ext.placePassword ?? '',
    audioNote: '',
    photos,
    targetCompany: r.target_company ?? '',
    createdAt: new Date(r.created_at).getTime(),
    updatedAt: new Date(r.updated_at).getTime(),
  }
}

export async function fetchPlaces(): Promise<Entry[]> {
  const { data: rows, error } = await db()
    .from('fr_places')
    .select('*')
    .order('updated_at', { ascending: false })
  if (error) throw error
  const places = (rows ?? []) as PlaceRow[]

  const ids = places.map((p) => p.id)
  const photosByPlace = new Map<string, PhotoRef[]>()
  if (ids.length) {
    const { data: photoRows } = await db()
      .from('fr_place_photos')
      .select('place_id, storage_path, captured_at')
      .in('place_id', ids)
    for (const pr of photoRows ?? []) {
      const { data } = db().storage.from(PHOTO_BUCKET).getPublicUrl(pr.storage_path)
      const list = photosByPlace.get(pr.place_id) ?? []
      list.push({
        id: pr.storage_path,
        capturedAt: new Date(pr.captured_at).getTime(),
        url: data.publicUrl,
      })
      photosByPlace.set(pr.place_id, list)
    }
  }

  return places.map((p) => rowToEntry(p, photosByPlace.get(p.id) ?? []))
}

export async function savePlace(e: Entry): Promise<void> {
  const researcherId = await currentUserId()
  const slug = e.slug.trim()
  // Pack extended fields into meeting_notes so saves work even before
  // deal_status / slug / credentials columns exist on the live DB.
  const meetingNotes = packMeetingNotes(e.meetingNotes, {
    dealStatus: e.dealStatus || undefined,
    rejectionReason: e.dealStatus === 'rejected' ? e.rejectionReason || undefined : undefined,
    slug: slug || undefined,
    placeUsername: e.placeUsername.trim() || undefined,
    placePassword: e.placePassword.trim() || undefined,
  })
  const row = {
    id: e.id,
    researcher_id: researcherId ?? null,
    section_id: e.sectionId || null,
    target_company: e.targetCompany || null,
    place_name: e.placeName,
    address: e.address || null,
    address_notes: e.addressNotes || null,
    lat: e.lat,
    lng: e.lng,
    manager_name: e.managerName || null,
    manager_phone: e.managerPhone || null,
    activity_type: e.activityType || null,
    custom_activity: e.customActivity || null,
    met: e.met || null,
    meeting_notes: meetingNotes,
    updated_at: new Date().toISOString(),
  }
  const { error } = await db().from('fr_places').upsert(row)
  if (error) throw error

  // Sync photo rows: replace with the current set (objects already uploaded).
  const { data: existing } = await db()
    .from('fr_place_photos')
    .select('storage_path')
    .eq('place_id', e.id)
  const existingPaths = new Set((existing ?? []).map((r) => r.storage_path))
  const currentPaths = new Set(e.photos.map((p) => p.id))

  const toDelete = [...existingPaths].filter((p) => !currentPaths.has(p))
  const toInsert = e.photos.filter((p) => !existingPaths.has(p.id))

  if (toDelete.length) {
    await db().from('fr_place_photos').delete().in('storage_path', toDelete)
    await deletePhotoObjects(toDelete)
  }
  if (toInsert.length) {
    await db()
      .from('fr_place_photos')
      .insert(
        toInsert.map((p) => ({
          place_id: e.id,
          storage_path: p.id,
          captured_at: new Date(p.capturedAt).toISOString(),
        })),
      )
  }
}

export async function deletePlace(id: string, photoPaths: string[]): Promise<void> {
  await db().from('fr_places').delete().eq('id', id) // cascade removes photo rows
  await deletePhotoObjects(photoPaths)
}

// ---------- Realtime ----------
export function subscribePlaces(onChange: () => void): () => void {
  const channel = db()
    .channel('fr_places_changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'fr_places' }, () =>
      onChange(),
    )
    .on('postgres_changes', { event: '*', schema: 'public', table: 'fr_place_photos' }, () =>
      onChange(),
    )
    .subscribe()
  return () => {
    void db().removeChannel(channel)
  }
}
