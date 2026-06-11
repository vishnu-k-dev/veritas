-- VERITAS RAG pipeline schema
-- Run once on your Neon (or any pgvector-enabled Postgres) database
-- Neon free tier: https://neon.tech — pgvector is enabled by default

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS repo_chunks (
  id         BIGSERIAL    PRIMARY KEY,
  session_id TEXT         NOT NULL,           -- exam session identifier
  chunk_type TEXT         NOT NULL,           -- meta | tech | readme | commit | structure
  content    TEXT         NOT NULL,           -- raw text that was embedded
  metadata   JSONB        DEFAULT '{}',       -- repo name, commit sha, etc.
  embedding  vector(1024),                    -- Cohere embed-english-v3.0 (1024 dims)
  created_at TIMESTAMPTZ  DEFAULT NOW()
);

-- Fast lookup by session (used on every query)
CREATE INDEX IF NOT EXISTS repo_chunks_session_idx
  ON repo_chunks (session_id);

-- HNSW approximate nearest-neighbour index (cosine distance)
-- m=16 ef_construction=64 is a good default for <100k rows
CREATE INDEX IF NOT EXISTS repo_chunks_hnsw_idx
  ON repo_chunks USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Optional: auto-purge chunks older than 24 hours (keeps free-tier storage clean)
-- Enable with pg_cron if available, or run manually:
-- DELETE FROM repo_chunks WHERE created_at < NOW() - INTERVAL '24 hours';
