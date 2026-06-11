// src/lib/supabase.js
// Browser-side Supabase client. Standard PKCE flow — the SDK auto-exchanges
// the ?code= when /auth/callback loads. No manual exchange, no reload tricks,
// no lock workarounds.

import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  // eslint-disable-next-line no-console
  console.warn(
    '[supabase] VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is missing. ' +
      'Supabase Auth will not function until these are set in .env.'
  )
}

export const supabase = createClient(url || 'http://localhost', anonKey || 'public-anon-key', {
  auth: {
    flowType: 'pkce',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'VERITAS-auth',
  },
})

// Decode the payload of a JWT without verifying it. Safe for client-side use:
// the access token is already trusted (we got it from Supabase) and the server
// re-validates on every API call. Returns null on malformed input.
export function decodeJwt(token) {
  if (!token) return null
  try {
    const payload = token.split('.')[1]
    const padded = payload.replace(/-/g, '+').replace(/_/g, '/')
    const json = atob(padded + '==='.slice((padded.length + 3) % 4))
    return JSON.parse(decodeURIComponent(escape(json)))
  } catch {
    return null
  }
}

// Synchronous-ish access token getter. After the SDK has hydrated from
// localStorage (which happens before the first React render in practice),
// getSession() returns the cached session immediately. No 15-second timeout
// dance, no onAuthStateChange race.
export async function getAuthToken() {
  const { data } = await supabase.auth.getSession()
  return data?.session?.access_token || null
}

export default supabase

