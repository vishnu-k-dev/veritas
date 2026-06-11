-- infra/migration_v3_indexes.sql
-- Performance indexes missing from initial schema
-- Safe to run multiple times (IF NOT EXISTS guards)

-- interviews: common filter patterns
CREATE INDEX IF NOT EXISTS idx_interviews_user_id          ON interviews(user_id);
CREATE INDEX IF NOT EXISTS idx_interviews_status           ON interviews(status);
CREATE INDEX IF NOT EXISTS idx_interviews_screening_code   ON interviews(screening_code_id);
CREATE INDEX IF NOT EXISTS idx_interviews_completed_at     ON interviews(completed_at DESC);

-- usage_tracking: per-user action queries (rate limit / quota checks)
CREATE INDEX IF NOT EXISTS idx_usage_uid_type_created      ON usage_tracking(firebase_uid, action_type, created_at);

-- ai_usage_log: per-user spend queries
CREATE INDEX IF NOT EXISTS idx_ai_usage_user_created       ON ai_usage_log(user_id, created_at DESC);

-- interview_messages: message fetch by interview + role
CREATE INDEX IF NOT EXISTS idx_msg_interview_role          ON interview_messages(interview_id, role);
