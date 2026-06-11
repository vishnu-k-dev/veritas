/**
 * RAG Augmentation Layer — Semantic retrieval to sharpen interview questions.
 *
 * Runs BEFORE question generation. Retrieves project-specific signals from
 * the rag_questions table via pgvector cosine similarity, then injects them
 * as high-priority context into the LLM prompt.
 *
 * In v3: RAG results also feed CIM training curation via storeRAGFeedback().
 */

const API_BASE = typeof import.meta !== 'undefined'
  ? (import.meta.env?.VITE_API_URL || '')
  : '';

// ─── EMBEDDING ────────────────────────────────────────────────────────────────

/**
 * Get a text embedding via the backend embed endpoint (gemini text-embedding-004).
 * @param {string} text
 * @returns {Promise<number[]>}
 */
async function getEmbedding(text) {
  const res = await fetch(`${API_BASE}/api/ai/embed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: text.slice(0, 500) }),
  });
  if (!res.ok) throw new Error(`Embed failed: ${res.status}`);
  const data = await res.json();
  return data.embedding || [];
}

// ─── RETRIEVAL ────────────────────────────────────────────────────────────────

/**
 * Build a compact retrieval query from repo context.
 * Max 200 chars — compress aggressively.
 * @param {object} repoContext
 * @returns {string}
 */
function buildRetrievalQuery(repoContext) {
  const name    = repoContext.projectName || '';
  const tech    = (repoContext.techStack?.keyDependencies || []).slice(0, 5).join(' ');
  const summary = (repoContext.documentation?.summary || '').slice(0, 60);
  const commits = (repoContext.developmentHistory?.keyCommits || [])
    .slice(0, 3)
    .map(c => c.message)
    .join(' | ');

  return `${name} ${tech} ${summary} ${commits}`.slice(0, 200).trim();
}

/**
 * Re-rank retrieved results using a composite score.
 * Score = cosine_similarity×0.5 + domain_match×0.3 + difficulty_match×0.1 + cim_signal×0.1
 * @param {object[]} results — from pgvector search
 * @param {string} primarySystemType
 * @param {'junior'|'mid'|'senior'} sophisticationLevel
 * @returns {object[]} top 5 re-ranked results
 */
function reRank(results, primarySystemType, sophisticationLevel) {
  const difficultyMap = { junior: 'easy', mid: 'medium', senior: 'hard' };
  const targetDiff    = difficultyMap[sophisticationLevel] || 'medium';

  return results
    .map(r => ({
      ...r,
      rerankScore: (
        (r.similarity        || 0) * 0.5 +
        (r.domain_type === primarySystemType ? 1 : 0) * 0.3 +
        (r.difficulty === targetDiff ? 1 : 0) * 0.1 +
        (r.cim_signal_strength || 0) * 0.1
      ),
    }))
    .sort((a, b) => b.rerankScore - a.rerankScore)
    .slice(0, 5);
}

/**
 * Retrieve project-specific context from the RAG layer.
 * @param {object} repoContext
 * @param {string} interviewId
 * @param {object} options — { primarySystemType, sophisticationLevel, usedQuestionIds }
 * @returns {Promise<string>} RETRIEVAL_CONTEXT block for LLM injection
 */
export async function retrieveProjectContext(repoContext, interviewId, options = {}) {
  const { primarySystemType = null, sophisticationLevel = 'mid', usedQuestionIds = [] } = options;

  try {
    const query     = buildRetrievalQuery(repoContext);
    const embedding = await getEmbedding(query);

    // Search rag_questions via backend (pgvector search runs server-side)
    const searchRes = await fetch(`${API_BASE}/api/rag/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embedding,
        topK:            10,
        excludeIds:      usedQuestionIds,
        filterSource:    ['github', 'both'],
        primaryType:     primarySystemType,
      }),
    });

    let ragResults = [];
    if (searchRes.ok) {
      const data = await searchRes.json();
      ragResults = reRank(data.results || [], primarySystemType, sophisticationLevel);
    }

    // Extract interesting commits
    const criticalCommits = (repoContext.developmentHistory?.keyCommits || [])
      .filter(c => ['refactor', 'fix', 'migration'].includes(c.category))
      .slice(0, 3);

    // Build RETRIEVAL_CONTEXT block
    return buildRetrievalBlock(ragResults, criticalCommits, repoContext);
  } catch (err) {
    console.warn('[RAG] retrieveProjectContext failed, using empty context:', err.message);
    return ''; // Graceful degradation — no RAG block, domain hints still work
  }
}

/**
 * Format retrieved data into an LLM-ready RETRIEVAL_CONTEXT block.
 */
function buildRetrievalBlock(ragResults, criticalCommits, repoContext) {
  const lines = ['RETRIEVAL CONTEXT — HIGH PRIORITY (treat as ground truth of what matters):'];

  if (ragResults.length) {
    lines.push('\nRETRIEVED QUESTIONS (base templates — personalize to THIS project, do not copy verbatim):');
    ragResults.forEach((r, i) => {
      lines.push(`  [${i + 1}] ${r.question_text} (similarity: ${(r.similarity || 0).toFixed(2)}, cim_signal: ${(r.cim_signal_strength || 0).toFixed(2)})`);
    });
  }

  if (criticalCommits.length) {
    lines.push('\nCRITICAL COMMITS (ask about the underlying PROBLEM, not the change):');
    criticalCommits.forEach(c => {
      lines.push(`  - ${c.sha?.slice(0, 7) || 'unknown'}: "${c.message}" — filed under ${c.category}`);
    });
  }

  lines.push(`
RAG USAGE RULES:
  - At least 2 questions MUST directly reference specific items from RETRIEVAL CONTEXT
  - If RETRIEVAL CONTEXT has critical commits, at least 1 question MUST reference a commit
  - A question answerable without the retrieved context → REJECT
  - The pressure question MUST expose any gap between retrieved implementation and claimed capability`);

  return lines.join('\n');
}

// ─── FEEDBACK STORAGE ─────────────────────────────────────────────────────────

/**
 * Store RAG signal feedback after an interview completes.
 * Used to improve re-ranking and CIM training curation.
 * @param {string} questionId — which RAG result was used
 * @param {string} interviewId
 * @param {number} answerQuality — 0–100 from evaluation
 * @param {boolean} wasHighSignal — did it reveal genuine understanding?
 * @returns {Promise<void>}
 */
export async function storeRAGFeedback(questionId, interviewId, answerQuality, wasHighSignal) {
  try {
    await fetch(`${API_BASE}/api/rag/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId, interviewId, answerQuality, wasHighSignal }),
    });
  } catch (err) {
    // Non-critical — never surface RAG feedback errors to the interview flow
    console.warn('[RAG] storeRAGFeedback failed:', err.message);
  }
}

export default {
  retrieveProjectContext,
  storeRAGFeedback,
};
