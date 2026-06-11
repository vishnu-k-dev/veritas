-- infra/rls-policies.sql
-- Row Level Security policies for CREDA
-- Run in Supabase SQL Editor AFTER schema.sql

-- ============================================
-- USERS — own data only, no self-promotion
-- ============================================
-- SELECT: users can read their own row
CREATE POLICY "users_select_own" ON users
  FOR SELECT USING (auth.uid()::text = firebase_uid);

-- INSERT: anyone authenticated can create their own row (new sign-up)
CREATE POLICY "users_insert_own" ON users
  FOR INSERT WITH CHECK (auth.uid()::text = firebase_uid);

-- UPDATE: users can update their own row but CANNOT change role, is_banned, or bonus_interviews
-- Those fields are admin-only and mutated only via service-role (backend/admin routes)
CREATE POLICY "users_update_own" ON users
  FOR UPDATE USING (auth.uid()::text = firebase_uid)
  WITH CHECK (
    auth.uid()::text = firebase_uid
    -- Prevent self-promotion by requiring sensitive fields stay at current values
    AND role          = (SELECT role           FROM users WHERE firebase_uid = auth.uid()::text)
    AND is_banned     = (SELECT is_banned      FROM users WHERE firebase_uid = auth.uid()::text)
    AND bonus_interviews = (SELECT bonus_interviews FROM users WHERE firebase_uid = auth.uid()::text)
  );

-- DELETE: not allowed via RLS (use service-role for account deletion)
CREATE POLICY "users_no_delete" ON users
  FOR DELETE USING (false);

-- ============================================
-- INTERVIEWS — own interviews only
-- ============================================
CREATE POLICY "users_own_interviews" ON interviews
  FOR ALL USING (
    user_id = (SELECT id FROM users WHERE firebase_uid = auth.uid()::text)
  );

-- ============================================
-- INTERVIEW MESSAGES — via interview ownership
-- ============================================
CREATE POLICY "users_own_messages" ON interview_messages
  FOR ALL USING (
    interview_id IN (
      SELECT id FROM interviews
      WHERE user_id = (SELECT id FROM users WHERE firebase_uid = auth.uid()::text)
    )
  );

-- ============================================
-- SCREENING CODES — recruiter + org isolation
-- ============================================
CREATE POLICY "recruiters_own_codes" ON screening_codes
  FOR ALL USING (
    recruiter_id = (SELECT id FROM users WHERE firebase_uid = auth.uid()::text)
  );

CREATE POLICY "org_data_isolation" ON screening_codes
  FOR SELECT USING (
    org_id IS NOT NULL
    AND org_id IN (
      SELECT org_id FROM org_members
      WHERE user_id = (SELECT id FROM users WHERE firebase_uid = auth.uid()::text)
    )
  );

-- ============================================
-- AI USAGE LOG — own usage only
-- ============================================
CREATE POLICY "users_own_usage" ON ai_usage_log
  FOR SELECT USING (
    user_id = (SELECT id FROM users WHERE firebase_uid = auth.uid()::text)
  );

-- ============================================
-- PROJECTS — own projects only
-- ============================================
CREATE POLICY "users_own_projects" ON projects
  FOR ALL USING (
    user_id = (SELECT id FROM users WHERE firebase_uid = auth.uid()::text)
  );

-- ============================================
-- USAGE TRACKING — own tracking only
-- ============================================
CREATE POLICY "users_own_tracking" ON usage_tracking
  FOR ALL USING (firebase_uid = auth.uid()::text);

-- ============================================
-- ORG MEMBERS — users can only see their own membership
-- ============================================
CREATE POLICY "org_members_own" ON org_members
  FOR SELECT USING (
    user_id = (SELECT id FROM users WHERE firebase_uid = auth.uid()::text)
  );
