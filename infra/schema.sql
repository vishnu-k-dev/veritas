-- infra/schema.sql
-- Supabase PostgreSQL schema for CREDA v2
-- Run this in the Supabase SQL Editor

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- USERS
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  firebase_uid TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  company TEXT,
  role TEXT DEFAULT 'user',  -- 'user', 'recruiter', 'admin'
  training_consent BOOLEAN DEFAULT FALSE,
  training_consent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_firebase_uid ON users(firebase_uid);

-- ============================================
-- SCREENING CODES
-- ============================================
CREATE TABLE IF NOT EXISTS screening_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL,
  recruiter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id UUID,
  role_title TEXT NOT NULL,
  experience_level TEXT DEFAULT 'mid',
  required_skills JSONB DEFAULT '[]',
  preferred_skills JSONB DEFAULT '[]',
  job_description TEXT DEFAULT '',
  include_github BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'active',
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_codes_recruiter ON screening_codes(recruiter_id);
CREATE INDEX idx_codes_code ON screening_codes(code);
CREATE INDEX idx_codes_status ON screening_codes(status);

-- ============================================
-- INTERVIEWS
-- ============================================
CREATE TABLE IF NOT EXISTS interviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  screening_code_id TEXT,
  candidate_name TEXT NOT NULL,
  candidate_email TEXT,
  resume_text TEXT DEFAULT '',
  status TEXT DEFAULT 'in_progress',
  current_question TEXT,
  questions_asked INTEGER DEFAULT 0,
  trust_score INTEGER,
  skill_match_score INTEGER,
  authenticity_score INTEGER,
  communication_score INTEGER,
  github_score INTEGER,
  repo_url TEXT,
  verdict TEXT,
  verdict_summary TEXT,
  report_text TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_interviews_user ON interviews(user_id);
CREATE INDEX idx_interviews_code ON interviews(screening_code_id);
CREATE INDEX idx_interviews_status ON interviews(status);

-- ============================================
-- INTERVIEW MESSAGES
-- ============================================
CREATE TABLE IF NOT EXISTS interview_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  interview_id UUID NOT NULL REFERENCES interviews(id) ON DELETE CASCADE,
  role TEXT NOT NULL,  -- 'system', 'user', 'assistant'
  content TEXT NOT NULL,
  difficulty_level TEXT,
  question_type TEXT,
  authenticity_score INTEGER,
  eval_verdict TEXT,
  eval_reasoning TEXT,
  is_fallback BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_interview ON interview_messages(interview_id);

-- ============================================
-- AI USAGE LOG (cost tracking)
-- ============================================
CREATE TABLE IF NOT EXISTS ai_usage_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  interview_id UUID REFERENCES interviews(id),
  user_id UUID REFERENCES users(id),
  model TEXT NOT NULL,
  operation TEXT NOT NULL,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  total_tokens INTEGER,
  cost_usd NUMERIC(10, 6),
  cost_inr NUMERIC(10, 4),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_usage_user ON ai_usage_log(user_id);
CREATE INDEX idx_usage_created ON ai_usage_log(created_at);

-- ============================================
-- PROJECTS (for GitHub repo analysis)
-- ============================================
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  repo_url TEXT,
  repo_name TEXT,
  tech_stack JSONB DEFAULT '[]',
  primary_language TEXT,
  analysis_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ORG MEMBERS (multi-tenant support)
-- ============================================
CREATE TABLE IF NOT EXISTS org_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id),
  role TEXT DEFAULT 'member',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, user_id)
);

-- ============================================
-- USAGE TRACKING (freemium limits)
-- ============================================
CREATE TABLE IF NOT EXISTS usage_tracking (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  firebase_uid TEXT NOT NULL,
  email TEXT,
  action_type TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_usage_tracking_uid ON usage_tracking(firebase_uid);

-- ============================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE interviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE interview_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE screening_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_tracking ENABLE ROW LEVEL SECURITY;
