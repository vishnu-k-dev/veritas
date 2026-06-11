-- infra/migration_v2_1.sql
-- Schema additions from CREDA_BUG_FIX_GUIDE.md
-- Run in Supabase SQL Editor AFTER schema.sql

-- ============================================
-- USERS — missing columns for Bug 1 (GitHub persistence) + Bug 4 (usage tracking)
-- ============================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS user_type TEXT
  CHECK (user_type IN ('student', 'recruiter', 'institute')) DEFAULT 'student';

ALTER TABLE users ADD COLUMN IF NOT EXISTS github_connected BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS github_token TEXT;           -- encrypted
ALTER TABLE users ADD COLUMN IF NOT EXISTS github_username TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS free_interviews_used INT DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS recruiter_interviews_used INT DEFAULT 0;

-- ============================================
-- INTERVIEWS — missing columns for Bug 3 (exits after Q1) + Bug 4 (limit tracking)
-- ============================================
ALTER TABLE interviews ADD COLUMN IF NOT EXISTS interview_type TEXT
  CHECK (interview_type IN ('free_project', 'recruiter_code')) DEFAULT 'free_project';

ALTER TABLE interviews ADD COLUMN IF NOT EXISTS current_question_index INT DEFAULT 0;
ALTER TABLE interviews ADD COLUMN IF NOT EXISTS session_token TEXT UNIQUE;
ALTER TABLE interviews ADD COLUMN IF NOT EXISTS last_activity TIMESTAMPTZ DEFAULT NOW();

-- Prevent duplicate active interviews per user
CREATE UNIQUE INDEX IF NOT EXISTS one_active_interview_per_user
  ON interviews (user_id)
  WHERE status = 'in_progress';

-- ============================================
-- SCREENING CODES — missing columns for Section 5 (validation logic)
-- ============================================
ALTER TABLE screening_codes ADD COLUMN IF NOT EXISTS max_candidates INT DEFAULT 10
  CHECK (max_candidates BETWEEN 1 AND 10);
ALTER TABLE screening_codes ADD COLUMN IF NOT EXISTS candidates_used INT DEFAULT 0;
ALTER TABLE screening_codes ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- ============================================
-- SKILL PASSPORTS — new table (Section 2)
-- ============================================
CREATE TABLE IF NOT EXISTS skill_passports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  interview_id UUID REFERENCES interviews(id) ON DELETE CASCADE,
  trust_score FLOAT,
  verdict TEXT,
  scores JSONB,
  tech_stack TEXT[],
  passport_data JSONB,
  pdf_url TEXT,
  md_url TEXT,
  public_url TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE skill_passports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_passports" ON skill_passports
  FOR ALL USING (
    user_id = (SELECT id FROM users WHERE firebase_uid = auth.uid()::text)
  );

-- ============================================
-- RECRUITER DECISIONS — new table (Section 6)
-- ============================================
CREATE TABLE IF NOT EXISTS recruiter_decisions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  interview_id UUID REFERENCES interviews(id) ON DELETE CASCADE,
  recruiter_id UUID REFERENCES users(id) ON DELETE CASCADE,
  decision TEXT CHECK (decision IN ('approved', 'skipped')) NOT NULL,
  decided_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE recruiter_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recruiters_own_decisions" ON recruiter_decisions
  FOR ALL USING (
    recruiter_id = (SELECT id FROM users WHERE firebase_uid = auth.uid()::text)
  );

-- ============================================
-- RPC: Atomic interview count increment (Bug 4 fix)
-- ============================================
CREATE OR REPLACE FUNCTION increment_interview_count(
  p_user_id UUID,
  p_interview_type TEXT
) RETURNS VOID AS $$
BEGIN
  IF p_interview_type = 'free_project' THEN
    UPDATE users SET free_interviews_used = free_interviews_used + 1
    WHERE id = p_user_id;
  ELSIF p_interview_type = 'recruiter_code' THEN
    UPDATE users SET recruiter_interviews_used = recruiter_interviews_used + 1
    WHERE id = p_user_id;
  END IF;
END;
$$ LANGUAGE plpgsql;
