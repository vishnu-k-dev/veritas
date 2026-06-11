/**
 * CIMEvaluator — Evaluation suite that must pass before any CIM version is promoted.
 *
 * 5 evaluation suites:
 *   1. Warmup question quality (cosine similarity to gold set ≥ 0.78)
 *   2. Pressure question quality (≥ 0.75 vs gold set)
 *   3. Anti-hallucination (zero tolerance)
 *   4. Consistency (variance < 0.20 across 5 runs)
 *   5. Calibration (junior vs senior appropriateness)
 */

const API_BASE = typeof import.meta !== 'undefined'
  ? (import.meta.env?.VITE_API_URL || '')
  : '';

// ─── GOLD SETS (examples of high-quality questions per category) ───────────────

const GOLD_WARMUP = [
  'Walk me through what happens inside your src/ folder — how do the files connect?',
  'How does your Redis integration handle TTL expiration and what triggers a cache miss?',
  'What does the main entry point of your app do in the first 100ms of startup?',
  'How does authentication flow from the client request through to the database check?',
];

const GOLD_PRESSURE = [
  'You mention handling 10K concurrent users — what actually broke first under load?',
  'Your README mentions caching but I don\'t see cache invalidation logic — walk me through how stale data is handled',
  'The commit history shows heavy activity then a complete stop — what happened during that phase?',
  'You mention leading a team but most commits here are solo — was this on a different project?',
];

// ─── EMBEDDING SIMILARITY ─────────────────────────────────────────────────────

/**
 * Compute cosine similarity between two embedding vectors.
 */
function cosineSimilarity(a, b) {
  if (a.length !== b.length) return 0;
  const dot = a.reduce((sum, ai, i) => sum + ai * b[i], 0);
  const magA = Math.sqrt(a.reduce((sum, ai) => sum + ai * ai, 0));
  const magB = Math.sqrt(b.reduce((sum, bi) => sum + bi * bi, 0));
  return magA && magB ? dot / (magA * magB) : 0;
}

/**
 * Get embedding for a text string via the backend embed endpoint.
 */
async function embed(text) {
  const res = await fetch(`${API_BASE}/api/ai/embed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: text.slice(0, 500) }),
  });
  if (!res.ok) throw new Error(`Embed failed: ${res.status}`);
  const data = await res.json();
  return data.embedding;
}

/**
 * Average cosine similarity of candidate questions vs gold set.
 */
async function avgSimilarityToGoldSet(candidates, goldSet) {
  const candEmbeds = await Promise.all(candidates.map(embed));
  const goldEmbeds = await Promise.all(goldSet.map(embed));

  let totalSim = 0;
  let count    = 0;
  for (const cEmb of candEmbeds) {
    const bestMatch = Math.max(...goldEmbeds.map(gEmb => cosineSimilarity(cEmb, gEmb)));
    totalSim += bestMatch;
    count++;
  }
  return count ? totalSim / count : 0;
}

// ─── SUITE 1: WARMUP QUALITY ──────────────────────────────────────────────────

async function suiteWarmupQuality(cimGeneratedWarmups) {
  if (!cimGeneratedWarmups?.length) return { pass: false, score: 0, detail: 'no warmup questions provided' };
  try {
    const sim = await avgSimilarityToGoldSet(cimGeneratedWarmups, GOLD_WARMUP);
    return {
      pass:   sim >= 0.78,
      score:  Math.round(sim * 100) / 100,
      detail: `avg similarity to gold warmup set: ${sim.toFixed(3)} (threshold: 0.78)`,
    };
  } catch (err) {
    return { pass: false, score: 0, detail: `embedding error: ${err.message}` };
  }
}

// ─── SUITE 2: PRESSURE QUALITY ────────────────────────────────────────────────

async function suitePressureQuality(cimGeneratedPressure) {
  if (!cimGeneratedPressure?.length) return { pass: false, score: 0, detail: 'no pressure questions provided' };
  try {
    const sim = await avgSimilarityToGoldSet(cimGeneratedPressure, GOLD_PRESSURE);
    return {
      pass:   sim >= 0.75,
      score:  Math.round(sim * 100) / 100,
      detail: `avg similarity to gold pressure set: ${sim.toFixed(3)} (threshold: 0.75)`,
    };
  } catch (err) {
    return { pass: false, score: 0, detail: `embedding error: ${err.message}` };
  }
}

// ─── SUITE 3: ANTI-HALLUCINATION ──────────────────────────────────────────────

function suiteAntiHallucination(knownRepoContext, cimOutput) {
  const knownDeps    = (knownRepoContext.techStack?.keyDependencies || []).map(d => d.toLowerCase());
  const knownDirs    = (knownRepoContext.architecture?.topDirectories || []).map(d => d.toLowerCase());
  const knownFrameworks = (knownRepoContext.techStack?.frameworks || []).map(f => (f.name || '').toLowerCase());
  const knownTerms   = new Set([...knownDeps, ...knownDirs, ...knownFrameworks]);

  const INVENTION_PATTERNS = [
    /\b(PostgreSQL|MongoDB|MySQL|Cassandra|DynamoDB)\b/gi,  // only if not in deps
    /\b(AWS|Azure|GCP|Kubernetes|Docker)\b/gi,
    /\b(GraphQL|REST|gRPC)\b/gi,
  ];

  const hallucinated = [];
  for (const q of (cimOutput || [])) {
    for (const re of INVENTION_PATTERNS) {
      const matches = (q.text || '').match(re) || [];
      matches.forEach(m => {
        if (!knownTerms.has(m.toLowerCase())) {
          hallucinated.push(`"${m}" in: "${q.text?.slice(0, 60)}..."`);
        }
      });
      re.lastIndex = 0;
    }
  }

  return {
    pass:   hallucinated.length === 0,
    score:  hallucinated.length === 0 ? 1.0 : 0,
    detail: hallucinated.length === 0
      ? 'No hallucinated terms detected'
      : `Hallucinated terms: ${hallucinated.slice(0, 3).join(', ')}`,
  };
}

// ─── SUITE 4: CONSISTENCY ─────────────────────────────────────────────────────

async function suiteConsistency(questionSets) {
  if (!questionSets?.length || questionSets.length < 3) {
    return { pass: false, score: 0, detail: 'need at least 3 question sets for consistency check' };
  }

  try {
    // Take the first question from each set, embed, compute pairwise spread
    const representatives = questionSets.map(s => (s[0]?.text || ''));
    const embeds          = await Promise.all(representatives.filter(Boolean).map(embed));

    if (embeds.length < 2) return { pass: false, score: 0, detail: 'embedding failed' };

    const sims = [];
    for (let i = 0; i < embeds.length; i++) {
      for (let j = i + 1; j < embeds.length; j++) {
        sims.push(cosineSimilarity(embeds[i], embeds[j]));
      }
    }

    const avgSim  = sims.reduce((a, b) => a + b, 0) / sims.length;
    const variance = sims.reduce((sum, s) => sum + Math.pow(s - avgSim, 2), 0) / sims.length;
    const spread   = Math.sqrt(variance);

    return {
      pass:   spread < 0.20,
      score:  Math.round((1 - spread) * 100) / 100,
      detail: `embedding spread: ${spread.toFixed(3)} (threshold: 0.20)`,
    };
  } catch (err) {
    return { pass: false, score: 0, detail: `consistency check error: ${err.message}` };
  }
}

// ─── SUITE 5: CALIBRATION ────────────────────────────────────────────────────

async function suiteCalibration(juniorQuestions, seniorQuestions) {
  if (!juniorQuestions?.length || !seniorQuestions?.length) {
    return { pass: false, score: 0, detail: 'need both junior and senior question sets' };
  }

  try {
    const juniorEmbeds = await Promise.all(juniorQuestions.slice(0, 3).map(q => embed(q.text || q)));
    const seniorEmbeds = await Promise.all(seniorQuestions.slice(0, 3).map(q => embed(q.text || q)));

    // Junior and senior questions should be distinguishably different
    let crossSim = 0;
    let count    = 0;
    for (const jEmb of juniorEmbeds) {
      for (const sEmb of seniorEmbeds) {
        crossSim += cosineSimilarity(jEmb, sEmb);
        count++;
      }
    }
    const avgCrossSim = count ? crossSim / count : 1;

    // Good calibration: cross-similarity BELOW 0.85 (questions are distinguishably different)
    return {
      pass:   avgCrossSim < 0.85,
      score:  Math.round((1 - avgCrossSim) * 100) / 100,
      detail: `cross-level similarity: ${avgCrossSim.toFixed(3)} (should be < 0.85 for good calibration)`,
    };
  } catch (err) {
    return { pass: false, score: 0, detail: `calibration check error: ${err.message}` };
  }
}

// ─── MAIN EVALUATION SUITE ────────────────────────────────────────────────────

/**
 * Run all 5 evaluation suites against a CIM version's outputs.
 * @param {object} params
 * @returns {Promise<{passed: boolean, suites: object, summary: string}>}
 */
export async function runEvaluationSuite({
  warmupQuestions    = [],
  pressureQuestions  = [],
  knownRepoContext   = {},
  hallucTestOutput   = [],
  questionSets       = [],   // 5 runs of the same prompt
  juniorQuestions    = [],
  seniorQuestions    = [],
}) {
  const suites = {};

  suites.warmupQuality     = await suiteWarmupQuality(warmupQuestions);
  suites.pressureQuality   = await suitePressureQuality(pressureQuestions);
  suites.antiHallucination = suiteAntiHallucination(knownRepoContext, hallucTestOutput);
  suites.consistency       = await suiteConsistency(questionSets);
  suites.calibration       = await suiteCalibration(juniorQuestions, seniorQuestions);

  const allPassed = Object.values(suites).every(s => s.pass);
  const failedSuites = Object.entries(suites).filter(([, s]) => !s.pass).map(([name]) => name);

  return {
    passed:  allPassed,
    suites,
    summary: allPassed
      ? 'All 5 evaluation suites PASSED — CIM version is ready for promotion'
      : `FAILED suites: ${failedSuites.join(', ')}. Do not promote this version.`,
  };
}

/**
 * Promote a CIM version if all suites passed.
 * @param {string} modelVersion
 * @param {object} evalResults — from runEvaluationSuite
 * @returns {Promise<object>}
 */
export async function promote(modelVersion, evalResults) {
  if (!evalResults.passed) {
    console.warn(`[CIMEvaluator] Refusing to promote ${modelVersion}: ${evalResults.summary}`);
    return { promoted: false, reason: evalResults.summary };
  }

  try {
    const res = await fetch(`${API_BASE}/api/internal/cim-promote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ version: modelVersion, evalScores: evalResults.suites }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return { promoted: true, version: modelVersion };
  } catch (err) {
    console.error('[CIMEvaluator] promote failed:', err);
    return { promoted: false, reason: err.message };
  }
}

export default {
  runEvaluationSuite,
  promote,
  cosineSimilarity,
};
