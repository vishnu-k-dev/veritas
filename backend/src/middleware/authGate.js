// backend/src/middleware/authGate.js
//
// Single-path Supabase auth middleware. Verifies the JWT via supabaseAdmin
// and loads the matching public.users row. The auth.users → public.users
// trigger (see infra/migration_v4_jwt_hook.sql) keeps the row in sync, so
// the lookup is a primary-key SELECT with an INSERT-on-miss fallback for
// rows created before the trigger was deployed.
//
// Firebase verification, the dual-provider cache, and the email-fallback
// link-by-email logic were removed in the auth rewrite. If you need to
// support legacy Firebase tokens again, restore from git history.

import { supabaseAdmin } from '../lib/supabase.js'

// ─── Timeout wrapper — prevents any external call from hanging indefinitely ──
function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(
        () => reject(Object.assign(new Error(`${label} timed out after ${ms}ms`), { isTimeout: true })),
        ms
      )
    ),
  ])
}

// ─── Cache invalidation — kept as no-ops for caller compatibility ──────────
// admin.js and auth.js call these after profile mutations. The cache itself
// is gone, but the call sites still expect the symbols to exist.
export async function invalidateUserCache(_firebaseUid) { /* no-op */ }
export async function invalidateUserCacheById(_userId) { /* no-op */ }

// ─── Token verification — Supabase only ────────────────────────────────────
async function verifyToken(token) {
  const { data, error } = await withTimeout(
    supabaseAdmin.auth.getUser(token),
    8000,
    'supabaseAdmin.auth.getUser'
  )
  if (error || !data?.user) {
    const err = new Error(error?.message || 'Invalid token')
    err.code = 'invalid_token'
    throw err
  }
  const u = data.user
  return {
    uid: u.id,
    email: u.email,
    name:
      u.user_metadata?.full_name ||
      u.user_metadata?.name ||
      u.email?.split('@')[0] ||
      'User',
  }
}

// ─── User row lookup ───────────────────────────────────────────────────────
// Primary-key SELECT. If the row is missing (e.g. user predates the trigger
// or the trigger failed silently), insert one. Default role = NULL so the
// frontend's `needsOnboarding` derivation kicks in.
async function getOrCreateUser({ uid, email, name }) {
  const DB_TIMEOUT = 8000

  const { data: existing, error: selErr } = await withTimeout(
    supabaseAdmin.from('users').select('*').eq('id', uid).maybeSingle(),
    DB_TIMEOUT, 'users.select(id)'
  )
  if (selErr) return { user: null, err: selErr.message }
  if (existing) return { user: existing, err: null }

  const { data: inserted, error: insErr } = await withTimeout(
    supabaseAdmin
      .from('users')
      .insert({ id: uid, email, name })
      .select()
      .single(),
    DB_TIMEOUT, 'users.insert'
  )
  if (insErr) {
    // Concurrent insert race — re-fetch and return whatever the other
    // request created.
    if (insErr.code === '23505') {
      const { data: reread } = await withTimeout(
        supabaseAdmin.from('users').select('*').eq('id', uid).maybeSingle(),
        DB_TIMEOUT, 'users.select(id) reread'
      )
      if (reread) return { user: reread, err: null }
    }
    return { user: null, err: `users.insert failed: ${insErr.message} (${insErr.code})` }
  }
  return { user: inserted, err: null }
}

// ─── Middleware 1: full auth — verify + load/create dbUser ─────────────────
export async function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'No token provided' })

  try {
    const principal = await verifyToken(token)
    const { user, err } = await getOrCreateUser(principal)
    if (!user) {
      console.error('[AUTH] DB lookup failed:', err)
      return res.status(500).json({ error: `Auth DB error: ${err}` })
    }
    req.user = {
      uid: principal.uid,
      email: principal.email,
      name: principal.name,
      provider: 'supabase',
      dbUser: user,
    }
    next()
  } catch (err) {
    if (err.code === 'invalid_token') {
      return res.status(401).json({ error: 'Invalid or expired token' })
    }
    console.error('[AUTH] error:', err.message)
    res.status(401).json({ error: 'Authentication failed' })
  }
}

// ─── Middleware 2: ownership check ─────────────────────────────────────────
export function requireOwnership(resourceType) {
  return async (req, res, next) => {
    const resourceId = req.params.id || req.body.interviewId

    const { data, error } = await supabaseAdmin
      .from(resourceType)
      .select('user_id')
      .eq('id', resourceId)
      .single()

    if (error || !data) return res.status(404).json({ error: 'Not found' })
    if (data.user_id !== req.user.dbUser.id) {
      return res.status(403).json({ error: 'Access denied' })
    }
    next()
  }
}

// ─── Middleware 3: lightweight auth (no DB lookup) ─────────────────────────
// Name kept as `firebaseAuth` for caller-compat (applicant.js, auth.js).
// Same Supabase verifier as requireAuth, but skips the users-row lookup.
export async function firebaseAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'No token provided' })

  try {
    const p = await verifyToken(token)
    req.firebaseUid = p.uid
    req.firebaseEmail = p.email
    req.firebaseName = p.name
    req.principal = { provider: 'supabase', ...p }
    next()
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' })
  }
}
