/**
 * DemoEngine — Instant Try product. Zero-login entry for recruiters.
 *
 * All demo content is pre-cached in Supabase — zero API calls during demo playback.
 * The recruiter should never know the content is pre-generated.
 */

const API_BASE = typeof import.meta !== 'undefined'
  ? (import.meta.env?.VITE_API_URL || '')
  : '';

// ─── PRE-BUILT DEMO SCENARIOS ─────────────────────────────────────────────────

export const DEMO_SCENARIOS = {
  scenario_1_distributed: {
    id:          'scenario_1_distributed',
    name:        'URL Shortener with Redis Queue',
    type:        'github',
    systemType:  'distributed_system',
    difficulty:  'mid',
    description: 'A Node.js URL shortener using Redis for caching, BullMQ for async jobs, and SHA-256 hashing with collision handling.',
    whatItReveals: 'Candidates who cannot explain TTL, hash collision handling, or queue retry logic',
    roleTitle:   'Backend Engineer',
    repoUrl:     null, // pre-cached, no real repo needed
  },
  scenario_2_ml: {
    id:          'scenario_2_ml',
    name:        'Sentiment Analysis Pipeline',
    type:        'github',
    systemType:  'ml_system',
    difficulty:  'mid',
    description: 'Python repo using Transformers, training pipeline with sklearn, evaluation metrics and overfitting mitigation.',
    whatItReveals: 'Candidates who confuse accuracy with F1, cannot explain overfitting, or skip cross-validation',
    roleTitle:   'ML Engineer',
    repoUrl:     null,
  },
  scenario_3_realtime: {
    id:          'scenario_3_realtime',
    name:        'Real-time Collaborative Dashboard',
    type:        'github',
    systemType:  'real_time_system',
    difficulty:  'senior',
    description: 'React + Socket.io dashboard with optimistic updates, reconnection logic, and presence tracking.',
    whatItReveals: 'Candidates who cannot explain sticky sessions, backpressure, or conflict resolution',
    roleTitle:   'Senior Frontend Engineer',
    repoUrl:     null,
  },
  scenario_4_resume: {
    id:          'scenario_4_resume',
    name:        'Full-stack developer claiming Redis + Kafka',
    type:        'resume',
    systemType:  'distributed_system',
    difficulty:  'mid',
    description: 'Resume claims production Redis and Kafka experience with 10K concurrent users.',
    whatItReveals: 'Scale claims without infra, caching without invalidation logic',
    roleTitle:   'Full-stack Engineer',
    repoUrl:     null,
  },
};

// ─── DEMO SESSION MANAGEMENT ──────────────────────────────────────────────────

/**
 * Create a new demo session via the backend (no auth required).
 * @param {string} recruiterEmail
 * @param {string|null} scenarioId — if null, VERITAS picks the most impressive one
 * @returns {Promise<object>} session object with pre-cached questions
 */
export async function createDemoSession(recruiterEmail, scenarioId = null) {
  const chosenScenario = scenarioId
    ? (DEMO_SCENARIOS[scenarioId] || DEMO_SCENARIOS.scenario_1_distributed)
    : pickBestScenario();

  try {
    const res = await fetch(`${API_BASE}/api/demo/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: recruiterEmail, scenarioId: chosenScenario.id }),
    });

    if (!res.ok) {
      // Silent fallback: serve from local pre-cached content
      return getLocalDemoSession(recruiterEmail, chosenScenario);
    }

    return await res.json();
  } catch {
    return getLocalDemoSession(recruiterEmail, chosenScenario);
  }
}

/**
 * Get the demo repo context (pre-built, no GitHub API call).
 * @param {string} scenarioId
 * @returns {object} synthetic repoContext
 */
export function getDemoRepo(scenarioId) {
  const scenario = DEMO_SCENARIOS[scenarioId] || DEMO_SCENARIOS.scenario_1_distributed;
  return SYNTHETIC_REPO_CONTEXTS[scenarioId] || SYNTHETIC_REPO_CONTEXTS.scenario_1_distributed;
}

/**
 * Get demo resume text (for resume-mode scenarios).
 * @param {string} scenarioId
 * @returns {string}
 */
export function getDemoResume(scenarioId) {
  return SYNTHETIC_RESUMES[scenarioId] || SYNTHETIC_RESUMES.scenario_4_resume;
}

/**
 * Mark a demo session as completed and track conversion.
 * @param {string} sessionId
 * @returns {Promise<void>}
 */
export async function completeDemoSession(sessionId) {
  try {
    await fetch(`${API_BASE}/api/demo/convert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    });
  } catch {
    // Non-critical — don't surface errors during demo
  }
}

// ─── INTERNAL HELPERS ─────────────────────────────────────────────────────────

function pickBestScenario() {
  // Pick the distributed system scenario — most universally impressive
  return DEMO_SCENARIOS.scenario_1_distributed;
}

function getLocalDemoSession(email, scenario) {
  return {
    sessionId:       `demo-${Date.now()}`,
    email,
    scenario,
    questions:       PRE_CACHED_QUESTIONS[scenario.id]?.slice(0, 3) || PRE_CACHED_QUESTIONS.scenario_1_distributed.slice(0, 3),
    syntheticAnswers: PRE_CACHED_ANSWERS[scenario.id]?.slice(0, 3) || PRE_CACHED_ANSWERS.scenario_1_distributed.slice(0, 3),
    evaluation:      PRE_CACHED_EVALUATION[scenario.id] || PRE_CACHED_EVALUATION.scenario_1_distributed,
    fromCache:       true,
  };
}

// ─── PRE-CACHED CONTENT ───────────────────────────────────────────────────────

const SYNTHETIC_REPO_CONTEXTS = {
  scenario_1_distributed: {
    projectName: 'url-shortener',
    techStack: { keyDependencies: ['redis', 'bullmq', 'express', 'ioredis'], frameworks: [{ name: 'Express', category: 'backend' }] },
    architecture: { layers: ['api', 'workers', 'queues'], topDirectories: ['src', 'workers', 'lib'] },
    documentation: { summary: 'URL shortener with Redis caching, SHA-256 hashing, BullMQ for async analytics, rate limiting' },
    developmentHistory: { totalCommitsAnalyzed: 28, keyCommits: [{ message: 'replace base62 with SHA-256 + collision retry', category: 'refactor' }] },
  },
};

const SYNTHETIC_RESUMES = {
  scenario_4_resume: `Senior Full-stack Engineer with 5 years experience.
Built systems handling 100K concurrent users using Redis caching and Kafka streaming.
Led a team of 4 engineers at a Series B startup.
Skills: Node.js, Redis, Kafka, PostgreSQL, React, Docker.`,
};

const PRE_CACHED_QUESTIONS = {
  scenario_1_distributed: [
    { text: 'Your SHA-256 hashing function — what happens when two different URLs produce the same 8-char short code?', category: 'technical_implementation', difficulty: 'deep' },
    { text: 'The BullMQ worker in your workers/ folder processes analytics jobs — what happens if the Redis connection drops mid-job?', category: 'debugging_story', difficulty: 'deep' },
    { text: 'Your TTL policy for cached URLs — what triggers a cache miss and how do you prevent a thundering herd when a popular link expires?', category: 'system_design', difficulty: 'deep' },
  ],
};

const PRE_CACHED_ANSWERS = {
  scenario_1_distributed: [
    { answer: 'I use a retry loop with a suffix counter — if the first 8 chars collide I append a counter and rehash. I tested this with a mock that forces collisions to verify the retry path works correctly.', score: 88 },
    { answer: 'BullMQ has built-in job retry with exponential backoff. I configured maxAttempts: 3 with backoff type exponential. Failed jobs go to a dead letter queue which I monitor separately.', score: 82 },
    { answer: 'TTL is 24 hours for most URLs, 1 hour for custom slugs. On cache miss I use a distributed lock via Redlock to prevent multiple workers from hitting the database simultaneously for the same slug.', score: 91 },
  ],
};

const PRE_CACHED_EVALUATION = {
  scenario_1_distributed: {
    hireSignal:  'STRONG',
    confidence:  87,
    trustScore:  85,
    riskLevel:   'LOW',
    action:      'Proceed to technical round',
    timeSavedMinutes: 78,
    redFlags:    [],
    whyStrong:   ['Demonstrates real collision handling knowledge', 'Understands distributed locking patterns'],
    concerns:    [],
  },
};

/**
 * Get pre-cached demo questions for a scenario (no API call needed).
 * @param {string} scenarioId
 * @returns {Array<{text: string, category: string, difficulty: string}>}
 */
export function getDemoQuestions(scenarioId = 'scenario_1_distributed') {
  return PRE_CACHED_QUESTIONS[scenarioId] || PRE_CACHED_QUESTIONS.scenario_1_distributed;
}

export default {
  DEMO_SCENARIOS,
  createDemoSession,
  getDemoRepo,
  getDemoResume,
  getDemoQuestions,
  completeDemoSession,
};

