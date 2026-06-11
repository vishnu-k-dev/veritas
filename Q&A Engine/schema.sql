-- ============================================================
-- VERITAS RAG Engine — Vector Store
-- Run this in Supabase SQL Editor
-- ============================================================

CREATE EXTENSION IF NOT EXISTS vector;

-- ── Question bank (seeded + learned from real interviews) ──
CREATE TABLE rag_questions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question      TEXT NOT NULL,
  question_type TEXT NOT NULL CHECK (question_type IN (
    'architecture',   -- how did you structure X
    'implementation', -- how did you build X
    'decision',       -- why X over Y
    'debugging',      -- how did you fix X
    'ownership',      -- only author knows this
    'tradeoff',       -- what did you sacrifice
    'failure',        -- what went wrong
    'followup',       -- probing a weak answer
    'gap_probe'       -- targeting an exaggeration
  )),
  source        TEXT NOT NULL CHECK (source IN ('github', 'resume', 'both')),
  difficulty    TEXT NOT NULL CHECK (difficulty IN ('warm_up','medium','deep','pressure')),
  tech_tags     TEXT[]   DEFAULT '{}',   -- ['react', 'nodejs', 'postgres']
  role_tags     TEXT[]   DEFAULT '{}',   -- ['junior', 'mid', 'senior']
  embedding     vector(1536),            -- OpenAI text-embedding-3-small
  use_count     INT      DEFAULT 0,
  avg_score     FLOAT    DEFAULT 0,      -- learned: avg eval score when used
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── Answer analysis log (trains the RAG over time) ─────────
CREATE TABLE rag_answer_log (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_id     UUID,
  question_id      UUID REFERENCES rag_questions(id),
  question_text    TEXT NOT NULL,
  answer_text      TEXT NOT NULL,
  answer_embedding vector(1536),
  -- Scores
  authenticity     FLOAT,
  depth            FLOAT,
  clarity          FLOAT,
  overall          FLOAT,
  verdict          TEXT CHECK (verdict IN ('strong','acceptable','weak','suspicious')),
  -- Follow-up decision
  follow_up_needed BOOL DEFAULT FALSE,
  follow_up_reason TEXT,
  follow_up_question TEXT,
  -- Metadata
  tech_tags        TEXT[] DEFAULT '{}',
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ── Follow-up bank (retrieved when answer is weak/vague) ───
CREATE TABLE rag_followups (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_type  TEXT NOT NULL CHECK (trigger_type IN (
    'vague',       -- answer was too generic
    'shallow',     -- lacks technical depth
    'suspicious',  -- inconsistency detected
    'strong',      -- impressive — go deeper
    'confused',    -- candidate seemed lost
    'partial'      -- partially correct
  )),
  parent_type   TEXT,   -- question_type that triggered this follow-up
  question      TEXT NOT NULL,
  tech_tags     TEXT[]  DEFAULT '{}',
  embedding     vector(1536),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── Indexes ────────────────────────────────────────────────
CREATE INDEX rag_questions_embedding_idx
  ON rag_questions USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX rag_followups_embedding_idx
  ON rag_followups USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 50);

CREATE INDEX rag_questions_source_idx ON rag_questions(source);
CREATE INDEX rag_questions_difficulty_idx ON rag_questions(difficulty);
CREATE INDEX rag_questions_type_idx ON rag_questions(question_type);

-- ── Similarity search functions ────────────────────────────
CREATE OR REPLACE FUNCTION search_questions(
  query_embedding  vector(1536),
  p_source         TEXT,
  p_difficulty     TEXT,
  p_tech_tags      TEXT[]  DEFAULT NULL,
  p_limit          INT     DEFAULT 5
)
RETURNS TABLE (
  id TEXT, question TEXT, question_type TEXT,
  difficulty TEXT, tech_tags TEXT[], similarity FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    rq.id::TEXT,
    rq.question,
    rq.question_type,
    rq.difficulty,
    rq.tech_tags,
    1 - (rq.embedding <=> query_embedding) AS similarity
  FROM rag_questions rq
  WHERE
    (p_source IS NULL OR rq.source IN (p_source, 'both'))
    AND (p_difficulty IS NULL OR rq.difficulty = p_difficulty)
    AND (p_tech_tags IS NULL OR rq.tech_tags && p_tech_tags)
  ORDER BY rq.embedding <=> query_embedding
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION search_followups(
  query_embedding vector(1536),
  p_trigger_type  TEXT,
  p_tech_tags     TEXT[] DEFAULT NULL,
  p_limit         INT    DEFAULT 3
)
RETURNS TABLE (
  id TEXT, question TEXT, trigger_type TEXT, similarity FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    rf.id::TEXT,
    rf.question,
    rf.trigger_type,
    1 - (rf.embedding <=> query_embedding) AS similarity
  FROM rag_followups rf
  WHERE
    rf.trigger_type = p_trigger_type
    AND (p_tech_tags IS NULL OR rf.tech_tags && p_tech_tags)
  ORDER BY rf.embedding <=> query_embedding
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;
