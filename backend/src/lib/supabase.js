// backend/src/lib/supabase.js
// Supabase PostgreSQL clients — admin (bypasses RLS) + anon (respects RLS)
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const serviceKey  = process.env.SUPABASE_SERVICE_KEY
const anonKey     = process.env.SUPABASE_ANON_KEY

const HAS_SUPABASE = !!(supabaseUrl && serviceKey)

if (!HAS_SUPABASE) {
  console.warn('⚠️  SUPABASE_URL or SUPABASE_SERVICE_KEY not set — database features disabled')
}

// Create a null-safe proxy that returns { data: null, error: 'not configured' } for any call
function createStubClient() {
  const stubResponse = { data: null, error: { message: 'Supabase not configured' } }
  const chainable = new Proxy({}, {
    get: () => (..._args) => chainable,
    apply: () => Promise.resolve(stubResponse)
  })
  return new Proxy({}, {
    get: (_, prop) => {
      if (prop === 'from') return () => new Proxy({}, {
        get: () => function chainMethod() {
          return new Proxy(Promise.resolve(stubResponse), {
            get: (target, p) => {
              if (p === 'then' || p === 'catch' || p === 'finally') return target[p].bind(target)
              return (..._args) => new Proxy(Promise.resolve(stubResponse), {
                get: (t2, p2) => {
                  if (p2 === 'then' || p2 === 'catch' || p2 === 'finally') return t2[p2].bind(t2)
                  return chainMethod
                }
              })
            }
          })
        }
      })
      return () => {}
    }
  })
}

// Backend admin client — bypasses RLS (use for server-side operations only)
export const supabaseAdmin = HAS_SUPABASE
  ? createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
      db: { schema: 'public' }
    })
  : createStubClient()

// Frontend-safe client — respects RLS (never falls back to serviceKey; that bypasses all RLS)
if (HAS_SUPABASE && !anonKey) {
  throw new Error('SUPABASE_ANON_KEY is required. Using serviceKey as anon client would bypass all RLS policies.')
}
export const supabase = HAS_SUPABASE
  ? createClient(supabaseUrl, anonKey)
  : createStubClient()
