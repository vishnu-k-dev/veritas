-- VERITAS durable certificate storage
-- Run after 001_rag.sql — node migrate.js runs both in order

CREATE TABLE IF NOT EXISTS exam_reports (
  verification_id  TEXT         PRIMARY KEY,
  candidate_name   TEXT         NOT NULL,
  repo_name        TEXT         NOT NULL,
  repo_url         TEXT         DEFAULT '',
  tech_stack       JSONB        DEFAULT '[]',
  scores           JSONB        NOT NULL,
  verdict          TEXT         NOT NULL,
  rag_enabled      BOOLEAN      DEFAULT FALSE,
  share_url        TEXT         DEFAULT '',
  issued_at        TIMESTAMPTZ  DEFAULT NOW()
);

-- Expire reports older than 30 days (run via pg_cron or manually)
-- DELETE FROM exam_reports WHERE issued_at < NOW() - INTERVAL '30 days';
