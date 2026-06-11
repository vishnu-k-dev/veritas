/**
 * DomainQuestionBank — Lightweight domain hint registry (NOT a question bank).
 *
 * The LLM generates actual questions. This file tells it WHAT to probe per domain.
 * CIM learns over time which probes produce high-signal answers.
 */

// ─── DOMAIN HINTS ─────────────────────────────────────────────────────────────

export const DOMAIN_HINTS = {
  distributed_system: {
    probe: [
      'hashing/sharding strategy and why that approach',
      'collision handling and how edge cases were tested',
      'cache TTL policy and invalidation triggers',
      'rate limiting design — per user, per IP, or token bucket',
      'consistency vs availability tradeoff chosen',
      'queue retry/backoff logic and poison pill handling',
    ],
    depthMarkers: ['consistent hashing', 'cache invalidation', 'circuit breaker', 'idempotency', 'saga pattern'],
    fakerSignals: ['just use Redis', 'it scales automatically', 'load balancer handles it'],
    seniorProbes: [
      'How did you handle partial failures across distributed transactions?',
      'What is your strategy when the cache and DB are temporarily inconsistent?',
      'How do you prevent queue consumer pile-up under backpressure?',
    ],
    cimTrainingWeight: 0.9,
  },

  blockchain_system: {
    probe: [
      'on-chain vs off-chain split decisions',
      'gas optimization — which functions were expensive and why',
      'oracle design and manipulation risk',
      'tokenization logic and edge cases',
      'smart contract upgrade pattern chosen (UUPS, transparent proxy)',
      'event indexing and off-chain data sync',
    ],
    depthMarkers: ['reentrancy guard', 'merkle proof', 'gas estimation', 'proxy pattern', 'commit-reveal scheme'],
    fakerSignals: ['blockchain makes it secure', 'it\'s decentralized', 'immutable by default'],
    seniorProbes: [
      'How did you handle oracle manipulation risk?',
      'Walk me through your upgrade strategy — UUPS or Transparent Proxy?',
      'How did you approach gas optimization in a loop-heavy function?',
    ],
    cimTrainingWeight: 0.85,
  },

  ml_system: {
    probe: [
      'training pipeline design and orchestration',
      'feature preprocessing decisions and why',
      'model selection rationale vs alternatives considered',
      'overfitting mitigation strategies applied',
      'evaluation metric choice and what it measures vs misses',
      'inference optimization and latency targets',
    ],
    depthMarkers: ['cross-validation', 'learning rate schedule', 'data augmentation', 'confusion matrix', 'RLHF'],
    fakerSignals: ['accuracy was high', 'I tried different models', 'the model learned'],
    seniorProbes: [
      'How did you detect and respond to data drift in production?',
      'What is your strategy for reproducing a specific model checkpoint?',
      'How did you balance model size vs inference latency?',
    ],
    cimTrainingWeight: 0.88,
  },

  backend_api_system: {
    probe: [
      'auth middleware design and token validation flow',
      'request validation strategy — where and how',
      'error handling consistency across the API surface',
      'pagination approach and cursor vs offset tradeoffs',
      'DB transaction usage — what operations are atomic',
      'N+1 query prevention strategy',
    ],
    depthMarkers: ['idempotency keys', 'optimistic locking', 'connection pooling', 'middleware chain', 'ETag caching'],
    fakerSignals: ['REST is stateless', 'just add try/catch', 'JWT is secure'],
    seniorProbes: [
      'How did you handle distributed rate limiting across multiple instances?',
      'Walk me through your strategy for zero-downtime schema migrations.',
      'How did you prevent thundering herd when the cache expired?',
    ],
    cimTrainingWeight: 0.92,
  },

  frontend_system: {
    probe: [
      'state management tradeoffs — what was chosen and why',
      're-render optimization strategy',
      'code splitting and lazy loading approach',
      'form validation — client-side, server-side, or both',
      'API error handling in UI — loading, retry, user messaging',
      'bundle size management as codebase grew',
    ],
    depthMarkers: ['memoization', 'suspense boundary', 'virtualization', 'hydration', 'Lighthouse score'],
    fakerSignals: ['React re-renders when state changes', 'useEffect handles side effects'],
    seniorProbes: [
      'Walk me through your strategy for keeping bundle size under control as the codebase grew.',
      'How did you handle optimistic UI updates that needed to be rolled back?',
      'What is your approach to accessibility in a component system?',
    ],
    cimTrainingWeight: 0.78,
  },

  data_pipeline_system: {
    probe: [
      'idempotency in ETL runs — how re-runs are safe',
      'failure recovery strategy — partial failures, dead letters',
      'data quality checks — what is validated and when',
      'schema evolution handling — what happens downstream',
      'backfill approach and how historical data is reprocessed',
      'late-arriving data strategy',
    ],
    depthMarkers: ['exactly-once semantics', 'checkpointing', 'partition pruning', 'SLA', 'dead letter queue'],
    fakerSignals: ['data just flows through', 'cron job runs it', 'it processes the data'],
    seniorProbes: [
      'How did you handle late-arriving data without re-running full backfills?',
      'What was your alerting strategy when the pipeline fell behind SLA?',
      'How did you evolve schemas without breaking downstream consumers?',
    ],
    cimTrainingWeight: 0.82,
  },

  infra_devops_system: {
    probe: [
      'secret management — rotation, access controls',
      'rollback strategy and how it has been tested',
      'resource limit design — what breaks first under load',
      'networking security — ingress, VPC, mTLS',
      'CI gate design — what blocks a merge',
      'observability stack — metrics, logs, traces',
    ],
    depthMarkers: ['blue-green deployment', 'resource quotas', 'mTLS', 'RBAC', 'canary release', 'SLO/SLA/SLI'],
    fakerSignals: ['Docker makes it portable', 'Kubernetes auto-scales', 'YAML config'],
    seniorProbes: [
      'Walk me through an incident you led — what was the blast radius and how did you contain it?',
      'How did you design your SLOs and what triggered on-call?',
      'What is your strategy for secret rotation without downtime?',
    ],
    cimTrainingWeight: 0.80,
  },

  real_time_system: {
    probe: [
      'connection state management on server and client',
      'reconnection/backoff logic and what triggers it',
      'message ordering guarantees — what is promised vs not',
      'presence tracking design — how stale presence is handled',
      'broadcast vs targeted delivery tradeoffs',
      'load balancing WebSocket connections',
    ],
    depthMarkers: ['heartbeat', 'backpressure', 'sticky sessions', 'event sourcing', 'CRDT', 'vector clock'],
    fakerSignals: ['WebSockets are bidirectional', 'events are emitted', 'real-time is fast'],
    seniorProbes: [
      'How did you handle conflict resolution when two users edited the same field simultaneously?',
      'What happens to your in-flight messages when a WebSocket server crashes?',
      'Walk me through your presence tracking design — how do you handle stale presence?',
    ],
    cimTrainingWeight: 0.87,
  },
};

// ─── PROMPT BUILDERS ──────────────────────────────────────────────────────────

/**
 * Build a prompt block that injects domain hints into the LLM question prompt.
 * @param {Array<{type, confidence}>} systemTypes
 * @param {string} sophisticationLevel — 'junior' | 'mid' | 'senior'
 * @returns {string}
 */
export function getDomainPromptBlock(systemTypes, sophisticationLevel = 'mid') {
  if (!systemTypes || !systemTypes.length) return '';

  const lines = ['DOMAIN-SPECIFIC PROBING (generate questions that touch these engineering decisions):'];

  systemTypes.slice(0, 3).forEach(({ type, confidence }) => {
    const hints = DOMAIN_HINTS[type];
    if (!hints) return;

    lines.push(`\n[${type} — ${confidence}% confidence]`);
    lines.push('  Probe areas: ' + hints.probe.join(', '));
    lines.push('  Depth markers (real builders mention these naturally): ' + hints.depthMarkers.join(', '));
    lines.push('  Faker signals (shallow answers contain these): ' + hints.fakerSignals.join(' | '));

    if (sophisticationLevel === 'senior' && hints.seniorProbes?.length) {
      lines.push('  Senior probes (include ≥1 of these verbatim or adapted):');
      hints.seniorProbes.forEach(p => lines.push(`    - ${p}`));
    }
  });

  return lines.join('\n');
}

/**
 * Convert commit intelligence into LLM-ready seed lines.
 * @param {object} commitIntel — from analyzeCommitPatterns
 * @returns {string}
 */
export function buildCommitQuestionSeeds(commitIntel) {
  if (!commitIntel) return '';

  // Collect candidate seeds with a rough "interestingness" score, then pick
  // ONLY THE TOP ONE. The LLM has a hard commit-quota of 1 question, so
  // surfacing more just tempts it to over-cover commits.
  const candidates = [];

  (commitIntel.techSwitches || []).forEach(t => {
    candidates.push({
      score: 30 + (t.message?.length || 0),
      seed: `- Commit "${t.message}" → ask what problem made them switch and what they lost in the trade`,
    });
  });

  (commitIntel.migrationCommits || []).forEach(c => {
    candidates.push({
      score: 25 + (c.message?.length || 0),
      seed: `- Commit "${c.message}" → ask what problem or pain forced this migration`,
    });
  });

  (commitIntel.debuggingBursts || []).forEach(b => {
    candidates.push({
      score: 20 + (b.commits?.length || 0) * 3,
      seed: `- ${b.commits.length} fix commits on ${b.date} around ${b.area} → ask what failure was being handled`,
    });
  });

  if (!candidates.length) return '';

  const best = candidates.sort((a, b) => b.score - a.score)[0];

  return [
    'COMMIT-DERIVED QUESTION SEED (HARD LIMIT: exactly ONE question may reference this commit — all others must reference files, deps, or architecture):',
    best.seed,
  ].join('\n');
}

/**
 * Build a calibration block that adjusts question difficulty per sophistication level.
 * @param {'junior'|'mid'|'senior'} level
 * @returns {string}
 */
export function getCalibrationBlock(level = 'mid') {
  const MAP = {
    junior: `CANDIDATE SOPHISTICATION LEVEL: junior

QUESTION CALIBRATION:
  - Lead with "what" before "why" — establish what they built, then dig in
  - One pressure point only — do not stack multiple truth-checks
  - Avoid jargon-heavy senior probes (circuit breakers, saga patterns, etc.)
  - DO NOT SIMPLIFY: still ask about real decisions — just one at a time`,

    mid: `CANDIDATE SOPHISTICATION LEVEL: mid

QUESTION CALIBRATION:
  - Assume working knowledge of chosen technologies — skip intro-level setup questions
  - Push on edge cases and tradeoffs: "what breaks when X?", "why not Y instead?"
  - Include 2 pressure points across the question set
  - At least 1 question should target a non-obvious code decision`,

    senior: `CANDIDATE SOPHISTICATION LEVEL: senior

QUESTION CALIBRATION:
  - Skip basics entirely — they know what React hooks do
  - Open with tradeoffs: "UUPS vs Transparent Proxy — which did you pick and why?"
  - Include 3 pressure points — scale, team claims, domain depth
  - Include at least 1 seniorProbe from the domain hints verbatim or adapted
  - DO NOT SOFTEN: if they claim senior experience, hold them to it`,
  };

  return MAP[level] || MAP.mid;
}

export default {
  DOMAIN_HINTS,
  getDomainPromptBlock,
  buildCommitQuestionSeeds,
  getCalibrationBlock,
};
