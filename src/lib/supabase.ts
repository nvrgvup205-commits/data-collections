import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Configured via build-time env vars (Vite). The anon key is safe to expose.
// On Cloudflare Workers Builds, set these as build environment variables.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey) : null

// When false, the app runs in local demo mode (localStorage + IndexedDB)
// with the built-in demo accounts.
export const isSupabaseEnabled = supabase !== null
