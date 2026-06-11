/**
 * CIMTrainingPipeline — Data flywheel for the VERITAS Intelligence Model.
 *
 * Runs as a BullMQ job after every 50 completed interviews.
 * Curates training examples, scrubs PII, exports datasets, triggers training runs.
 *
 * Security: NEVER store raw code, NEVER store PII. Every text entering the
 *           training pipeline must pass assertNoPII() first.
 */

const API_BASE = typeof import.meta !== 'undefined'
  ? (import.meta.env?.VITE_API_URL || '')
  : '';

// ─── PII SCRUBBING ────────────────────────────────────────────────────────────

const PII_PATTERNS = [
  { re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z]{2,}\b/gi,            replace: '[EMAIL]' },
  { re: /(\+\d{1,3}[\s-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g,        replace: '[PHONE]' },
  { re: /https?:\/\/github\.com\/[^/\s]+\/[^/\s]+/g,                       replace: '[REPO]' },
  { re: /https?:\/\/(www\.)?linkedin\.com\/[^\s]*/g,                        replace: '[PROFILE]' },
];

/**
 * Scrub known PII patterns from text.
 * Note: full-name NER via gemini is handled server-side before data reaches this file.
 * @param {string} text
 * @returns {string}
 */
export function scrubPII(text) {
  if (!text || typeof text !== 'string') return '';
  let result = text;
  for (const { re, replace } of PII_PATTERNS) {
    result = result.replace(re, replace);
  }
  return result;
}

/**
 * Throw if text still contains known PII after scrubbing.
 * @param {string} text
 */
export function assertNoPII(text) {
  for (const { re } of PII_PATTERNS) {
    if (re.test(text)) throw new Error('PII_DETECTED: training data rejected');
    re.lastIndex = 0; // reset stateful regex
  }
}

// ─── VALIDATION ───────────────────────────────────────────────────────────────

const INJECTION_PATTERNS = [
  /ignore previous instructions/i,
  /you are now/i,
  /disregard.*system/i,
  /\beval\s*\(/,
  /require\s*\(\s*['"]child_process/,
  /process\.env/i,
  /<script/i,
];

/**
 * Validate a single training example before it enters the training pool.
 * @param {object} example
 * @returns {{ valid: boolean, reason?: string }}
 */
export function validateTrainingExample(example) {
  if (!example?.input || !example?.output) {
    return { valid: false, reason: 'missing input or output' };
  }

  const questionText = example.output?.question || '';
  const inputContext = JSON.stringify(example.input || {});

  // PII check
  for (const { re } of PII_PATTERNS) {
    if (re.test(questionText) || re.test(inputContext)) {
      re.lastIndex = 0;
      return { valid: false, reason: 'PII detected' };
    }
    re.lastIndex = 0;
  }

  // Injection check
  for (const re of INJECTION_PATTERNS) {
    if (re.test(questionText) || re.test(inputContext)) {
      return { valid: false, reason: 'injection pattern detected' };
    }
  }

  // Raw code check (heuristic)
  if (/```|function\s+\w+\s*\(|def\s+\w+\s*\(|class\s+\w+\s*\{/.test(questionText)) {
    return { valid: false, reason: 'raw code detected in question output' };
  }

  // Quality gate: question must reference something specific
  if (questionText.length < 20) return { valid: false, reason: 'question too short' };
  if (!example.metadata?.systemType) return { valid: false, reason: 'missing systemType' };
  if (!example.metadata?.qualityGrade) return { valid: false, reason: 'missing qualityGrade' };
  if (!example.output?.evaluationLabel?.reasoning) return { valid: false, reason: 'missing evaluation reasoning' };

  return { valid: true };
}

// ─── CURATION ─────────────────────────────────────────────────────────────────

/**
 * Determine quality grade for a training example.
 * A: clear signal (score > 75 or < 25), B: normal, C: borderline
 * @param {number} score 0–100
 * @param {object} evaluation
 * @returns {'A'|'B'|'C'}
 */
export function gradeTrainingExample(score, evaluation) {
  const hasDepthMarkers = (evaluation.reasoning || '').length > 50;
  if ((score > 75 || score < 25) && hasDepthMarkers) return 'A';
  if ((score > 45 && score < 55)) return 'C'; // ambiguous
  return 'B';
}

/**
 * Build a training example object from an interview Q&A.
 * @param {object} params
 * @returns {object|null}
 */
export function buildTrainingExample({ interviewIdHash, question, answer, evaluation, context, sophistication }) {
  const questionText = scrubPII(question?.text || '');
  const systemType   = context?.systemType || null;
  const score        = evaluation?.authenticityScore ?? evaluation?.score ?? 50;
  const grade        = gradeTrainingExample(score, evaluation);

  const example = {
    input: {
      systemPrompt: 'You are VERITAS, an expert technical interviewer. Generate a specific, project-grounded interview question.',
      context: {
        systemType:        systemType,
        sophisticationLevel: sophistication || 'mid',
        domainHints:       context?.domainHints || null,
        pressurePoints:    context?.pressurePoints || null,
        commitSeeds:       context?.commitSeeds || null,
        // NO repo URLs, candidate names, or raw code
      },
      conversationHistory: [], // populated by caller if needed
    },
    output: {
      question:       questionText,
      questionType:   question?.questionType || 'unknown',
      evaluationLabel: {
        score,
        verdict:   evaluation?.verdict || 'unknown',
        reasoning: scrubPII(evaluation?.reasoning || ''),
      },
    },
    metadata: {
      interviewId_hash: interviewIdHash,
      systemType,
      sophisticationLevel: sophistication || 'mid',
      domain:     systemType,
      cimTrainingWeight: context?.cimTrainingWeight || 1.0,
      qualityGrade: grade,
    },
  };

  const validation = validateTrainingExample(example);
  if (!validation.valid) {
    console.warn('[CIM] Training example rejected:', validation.reason);
    return null;
  }

  return example;
}

// ─── EXPORT ───────────────────────────────────────────────────────────────────

/**
 * Format examples for JSONL export (HuggingFace fine-tuning).
 * @param {object[]} examples
 * @returns {string}
 */
export function exportAsJSONL(examples) {
  return examples
    .map(ex => JSON.stringify({
      prompt:     JSON.stringify(ex.input),
      completion: ex.output.question,
    }))
    .join('\n');
}

/**
 * Format examples for Alpaca-style fine-tuning.
 * @param {object[]} examples
 * @returns {string}
 */
export function exportAsAlpaca(examples) {
  return JSON.stringify(
    examples.map(ex => ({
      instruction: 'You are VERITAS. Generate a technical interview question.',
      input:       JSON.stringify(ex.input.context),
      output:      ex.output.question,
    })),
    null, 2
  );
}

// ─── MODEL INDEPENDENCE ───────────────────────────────────────────────────────

/**
 * Compute how independent VERITAS is from external AI APIs.
 * Reads from routing_logs via backend API.
 * @returns {Promise<object>}
 */
export async function computeModelIndependenceScore() {
  try {
    const res = await fetch(`${API_BASE}/api/internal/model-independence`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('[CIM] Could not fetch independence score:', err);
    return {
      independenceScore: 0,
      breakdown: { totalCalls: 0, cimHandled: 0, geminiHandled: 0, openaiHandled: 0, avgCimConfidence: 0, projectedFullIndependenceDate: null },
    };
  }
}

export default {
  scrubPII,
  assertNoPII,
  validateTrainingExample,
  gradeTrainingExample,
  buildTrainingExample,
  exportAsJSONL,
  exportAsAlpaca,
  computeModelIndependenceScore,
};

