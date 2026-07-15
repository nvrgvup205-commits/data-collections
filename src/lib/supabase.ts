import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Project defaults (the anon key is a public client key, safe to ship in the
// frontend). Can be overridden at build time via Vite env vars.
const DEFAULT_URL = 'https://lrwliqnjtrqazkuynhti.supabase.co'
const DEFAULT_ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxyd2xpcW5qdHJxYXprdXluaHRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczMjMwOTAsImV4cCI6MjA5Mjg5OTA5MH0.qNdoKg8DOE_0CdJfrTbh_TDikQzqwjBleTKevlq9rLE'

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || DEFAULT_URL
const anonKey =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || DEFAULT_ANON

export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey) : null

export const isSupabaseEnabled = supabase !== null

export const PHOTO_BUCKET = 'fr-place-photos'
