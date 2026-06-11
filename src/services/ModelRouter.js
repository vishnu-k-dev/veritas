/**
 * ModelRouter — Smart model routing for all AI calls.
 *
 * Tier 0 (FREE):  CIM — local fine-tuned model, served from Supabase Edge Function
 * Tier 1 (CHEAP): gemini-2.0-flash-lite — question gen, gist, summaries, embeddings
 * Tier 2 (SMART): gpt-4o-mini — scoring, CodeScope Q gen, decision layer, DSA eval
 * Tier 3 (NEVER): Any other model
 *
 * Every routing decision is logged. No silent fallbacks.
 */

const API_BASE = typeof import.meta !== 'undefined'
  ? (import.meta.env?.VITE_API_URL || '')
  : '';

// ─── TASK → MODEL MAPPING ─────────────────────────────────────────────────────

const TASK_MODEL_MAP = {
  question_gen:  { primary: 'gemini', forceGPT: false },
  evaluation:    { primary: 'gpt-4o-mini', forceGPT: true },
  embedding:     { primary: 'gemini-embed', forceGPT: false },
  dsa_eval:      { primary: 'gpt-4o-mini', forceGPT: true }, // FORCED — security requirement
  gist:          { primary: 'gemini', forceGPT: false },
  report:        { primary: 'gpt-4o-mini', forceGPT: true },
  code_question: { primary: 'gpt-4o-mini', forceGPT: true },
};

// ─── ROUTING LOGIC ────────────────────────────────────────────────────────────

/**
 * Route an AI task to the appropriate model.
 * @param {string} task — key from TASK_MODEL_MAP
 * @param {string} prompt
 * @param {object} context — { systemType, sophisticationLevel, interviewId, userId }
 * @returns {Promise<{ result, modelUsed, cimUsed }>}
 */
export async function route(task, prompt, context = {}) {
  const mapping = TASK_MODEL_MAP[task] || { primary: 'gemini', forceGPT: false };
  const { systemType, sophisticationLevel, interviewId, userId } = context;

  // DSA eval and scoring always use GPT-4o-mini — no exceptions
  if (mapping.forceGPT) {
    return callModel('gpt-4o-mini', task, prompt, context);
  }

  // Check CIM availability (only for question_gen and gist tasks)
  if ((task === 'question_gen' || task === 'gist') && process.env.CIM_MODEL_URL) {
    const confidence = getCIMConfidence(systemType, sophisticationLevel);
    if (confidence >= (parseFloat(process.env.CIM_CONFIDENCE_THRESHOLD) || 0.72)) {
      try {
        const result = await callCIM(prompt, context);
        await logRouting({
          task, modelUsed: 'cim', systemType, sophisticationLevel,
          cimConfidence: confidence, interviewId, success: true,
        });
        return { result, modelUsed: 'cim', cimUsed: true };
      } catch (err) {
        console.warn('[ModelRouter] CIM failed, falling through:', err.message);
        await logRouting({
          task, modelUsed: 'cim', systemType, sophisticationLevel,
          cimConfidence: confidence, interviewId, success: false, error: err.message,
        });
      }
    }
  }

  // Default to gemini for question gen / gist
  return callModel('gemini', task, prompt, context);
}

// ─── MODEL CALLERS ────────────────────────────────────────────────────────────

async function callModel(model, task, prompt, context = {}) {
  const { interviewId, userId, systemType, sophisticationLevel } = context;

  const res = await fetch(`${API_BASE}/api/ai/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt,
      options: {
        model,
        temperature: task === 'evaluation' ? 0.2 : 0.8,
        maxTokens:   task === 'evaluation' ? 1500 : 2000,
      },
    }),
  });

  if (!res.ok) throw new Error(`Model call failed: ${res.status}`);
  const data = await res.json();

  await logRouting({
    task, modelUsed: model, systemType, sophisticationLevel,
    cimConfidence: null, interviewId, success: true,
  });

  return { result: data.data, modelUsed: model, cimUsed: false };
}

async function callCIM(prompt, context = {}) {
  const cimUrl = process.env.CIM_MODEL_URL;
  if (!cimUrl) throw new Error('CIM_MODEL_URL not configured');

  const res = await fetch(`${cimUrl}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, max_tokens: 500 }),
  });

  if (!res.ok) throw new Error(`CIM call failed: ${res.status}`);
  const data = await res.json();
  return data.generated_text || data.result || '';
}

// ─── CIM CONFIDENCE ───────────────────────────────────────────────────────────

/**
 * Estimate CIM confidence for a given system type + sophistication level.
 * Based on cimTrainingWeight from DomainQuestionBank.
 */
function getCIMConfidence(systemType, sophisticationLevel) {
  const WEIGHTS = {
    backend_api_system:   0.92,
    distributed_system:   0.90,
    ml_system:            0.88,
    real_time_system:     0.87,
    blockchain_system:    0.85,
    data_pipeline_system: 0.82,
    infra_devops_system:  0.80,
    frontend_system:      0.78,
  };

  const base = WEIGHTS[systemType] || 0.70;
  // Senior interviews are harder — CIM less confident on novel patterns
  const levelPenalty = sophisticationLevel === 'senior' ? 0.08 : 0;
  return Math.max(0, base - levelPenalty);
}

// ─── LOGGING ──────────────────────────────────────────────────────────────────

/**
 * Log a routing decision to routing_logs (via backend).
 * Never throws — logging must not block the request chain.
 */
export async function logRouting(event) {
  try {
    await fetch(`${API_BASE}/api/internal/log-routing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        task:            event.task,
        modelUsed:       event.modelUsed,
        cimConfidence:   event.cimConfidence,
        systemType:      event.systemType,
        sophisticationLevel: event.sophisticationLevel,
        interviewIdHash: event.interviewId ? hashId(event.interviewId) : null,
        success:         event.success ?? true,
        error:           event.error || null,
      }),
    });
  } catch {
    // Never throw from logging
  }
}

/**
 * Get routing stats for the investor dashboard.
 * @param {number} days — lookback window
 * @returns {Promise<object>}
 */
export async function getRoutingStats(days = 30) {
  try {
    const res = await fetch(`${API_BASE}/api/internal/routing-stats?days=${days}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch {
    return { totalCalls: 0, cimHandled: 0, geminiHandled: 0, openaiHandled: 0, independenceScore: 0 };
  }
}

function hashId(id) {
  // Simple deterministic hash for logging — not cryptographic
  return id.split('').reduce((hash, ch) => (((hash << 5) - hash) + ch.charCodeAt(0)) | 0, 0).toString(16);
}

export default {
  route,
  logRouting,
  getRoutingStats,
};
