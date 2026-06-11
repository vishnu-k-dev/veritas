-- ============================================================
-- VERITAS RAG — Utility SQL functions
-- Run in Supabase SQL Editor after schema.sql
-- ============================================================

-- Update question stats after each use (running average)
CREATE OR REPLACE FUNCTION update_question_stats(
  p_question_id UUID,
  p_score FLOAT
)
RETURNS VOID AS $$
BEGIN
  UPDATE rag_questions SET
    use_count = use_count + 1,
    avg_score = ((avg_score * use_count) + p_score) / (use_count + 1)
  WHERE id = p_question_id;
END;
$$ LANGUAGE plpgsql;

-- Get performance stats per question type (for monitoring)
CREATE OR REPLACE VIEW rag_question_performance AS
SELECT
  rq.question_type,
  rq.difficulty,
  rq.source,
  COUNT(ral.id)         AS times_asked,
  AVG(ral.overall)      AS avg_answer_score,
  AVG(ral.authenticity) AS avg_authenticity,
  SUM(CASE WHEN ral.follow_up_needed THEN 1 ELSE 0 END) AS followups_triggered,
  SUM(CASE WHEN ral.verdict = 'suspicious' THEN 1 ELSE 0 END) AS suspicious_count
FROM rag_questions rq
LEFT JOIN rag_answer_log ral ON ral.question_id = rq.id
GROUP BY rq.question_type, rq.difficulty, rq.source
ORDER BY avg_answer_score ASC;

-- Find questions that consistently get weak answers (worth reviewing)
CREATE OR REPLACE VIEW rag_weak_questions AS
SELECT
  id, question, question_type, difficulty, use_count, avg_score
FROM rag_questions
WHERE use_count >= 5 AND avg_score < 45
ORDER BY avg_score ASC;

-- Find the most used follow-up triggers by tech area (tells you where candidates struggle)
CREATE OR REPLACE VIEW rag_struggle_map AS
SELECT
  unnest(tech_tags)            AS tech,
  COUNT(*)                     AS total_answers,
  AVG(overall)                 AS avg_score,
  SUM(CASE WHEN follow_up_needed THEN 1 ELSE 0 END) AS followups,
  SUM(CASE WHEN verdict = 'suspicious' THEN 1 ELSE 0 END) AS suspicious
FROM rag_answer_log
GROUP BY tech
ORDER BY avg_score ASC;
