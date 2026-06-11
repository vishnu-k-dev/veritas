// backend/src/routes/auth.js
// Authentication routes — Supabase
import { Router } from 'express'
import { requireAuth } from '../middleware/authGate.js'
import { authLimit } from '../middleware/rateLimiter.js'
import { supabaseAdmin } from '../lib/supabase.js'

const router = Router()

// GET /api/auth/me — get current user
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user.dbUser })
})

// GET /api/auth/profile — full profile from Supabase for authenticated user
router.get('/profile', requireAuth, (req, res) => {
  res.json({ profile: req.user.dbUser })
})

// POST /api/auth/register — register/sync user (called during onboarding).
// Uses requireAuth so getOrCreateUser has already resolved the correct
// public.users row (by id for Supabase, by firebase_uid for Firebase). We
// then UPDATE that row — no more upsert-by-firebase_uid that breaks for
// Supabase users whose firebase_uid column is NULL.
router.post('/register', authLimit, requireAuth, async (req, res) => {
  try {
    const {
      name, company, role,
      // Student fields
      college, branch, year,
      // Recruiter fields
      designation,
      // Institute fields
      instituteName, instituteType, contactPerson, contactPhone, city,
      // GitHub connect fields (passed via syncUserToBackend from useAuth)
      github_connected, github_token, github_username,
    } = req.body
    const yearNum = year ? parseInt(String(year).match(/\d+/)?.[0] || '0') || null : null

    const dbUser = req.user.dbUser
    const updates = {
      email: dbUser.email || req.user.email,
      name: name || dbUser.name || req.user.name || 'User',
      ...(company !== undefined && { company: company || null }),
      ...(role && { role }),
      ...(college && { college_name: college }),
      ...(branch && { department: branch }),
      ...(yearNum && { year_of_study: yearNum }),
      ...(designation && { designation }),
      ...(instituteName && { institute_name: instituteName }),
      ...(instituteType && { institute_type: instituteType }),
      ...(contactPerson && { contact_person: contactPerson }),
      ...(contactPhone && { contact_phone: contactPhone }),
      ...(city && { city }),
      ...(github_connected !== undefined && { github_connected }),
      ...(github_token !== undefined && { github_token }),
      ...(github_username !== undefined && { github_username }),
    }

    const { data, error } = await supabaseAdmin
      .from('users')
      .update(updates)
      .eq('id', dbUser.id)
      .select()
      .single()

    if (error) {
      console.error('[register] UPDATE error:', error.message, 'for user', dbUser.id)
      return res.status(500).json({ error: 'Registration failed' })
    }

    res.status(201).json({ user: data })
  } catch (err) {
    console.error('Register error:', err)
    res.status(500).json({ error: 'Registration failed' })
  }
})

// POST /api/auth/logout — no-op for Firebase (client handles token)
router.post('/logout', (req, res) => {
  res.json({ message: 'Logged out' })
})

export default router
