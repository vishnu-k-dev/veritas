/**
 * ProjectIntelligence — Domain classification, commit mining, sophistication scoring
 * Pure computation only — NO external API calls inside any function here.
 */

// ─── SYSTEM TYPE SIGNAL MAP ────────────────────────────────────────────────

const SYSTEM_SIGNALS = {
  distributed_system: {
    deps:   ['redis', 'kafka', 'rabbitmq', 'bull', 'bullmq', 'celery', 'grpc', 'ioredis', 'nats', 'temporal'],
    readme: ['cache', 'queue', 'shortener', 'rate.limit', 'shorten', 'idempotent', 'saga'],
    layers: ['workers', 'queues', 'jobs', 'consumers', 'producers'],
    files:  ['worker.js', 'queue.js', 'job.js', 'consumer.js', 'saga.js'],
  },
  blockchain_system: {
    deps:   ['ethers', 'web3', 'hardhat', '@openzeppelin', 'wagmi', 'viem', 'anchor', 'near-api-js'],
    files:  ['.sol', 'interfaces/', 'mocks/'],
    readme: ['smart.contract', 'token', 'blockchain', 'on-chain', 'oracle', 'merkle', 'gas'],
  },
  ml_system: {
    deps:   ['tensorflow', 'torch', 'sklearn', 'pandas', 'transformers', 'numpy', 'keras', 'xgboost', 'lightgbm', 'datasets'],
    files:  ['.ipynb', 'model/', 'training/', 'checkpoints/', 'experiments/', 'evals/'],
    readme: ['model', 'training', 'inference', 'dataset', 'epoch', 'fine-tune', 'benchmark', 'leaderboard'],
  },
  backend_api_system: {
    deps:   ['express', 'fastify', 'flask', 'django', 'spring', 'hono', 'koa', 'nestjs', 'trpc', 'gin'],
    layers: ['api', 'routes', 'controllers', 'middleware', 'handlers', 'resolvers'],
  },
  frontend_system: {
    deps:   ['react', 'vue', 'angular', 'svelte', 'next', 'nuxt', 'vite', 'remix', 'astro'],
    layers: ['components', 'pages', 'hooks', 'views', 'stores', 'layouts'],
    readme: ['UI', 'interface', 'dashboard', 'frontend', 'SSR', 'hydration', 'accessibility'],
  },
  data_pipeline_system: {
    deps:   ['airflow', 'luigi', 'dbt', 'spark', 'polars', 'flink', 'beam'],
    files:  ['etl/', 'pipeline/', 'dags/', 'transforms/', 'seeds/', 'models/'],
    readme: ['ETL', 'pipeline', 'ingestion', 'transform', 'SLA', 'lineage', 'backfill', 'schema evolution'],
  },
  infra_devops_system: {
    files:  ['Dockerfile', '.github/workflows/', 'terraform/', 'k8s/', 'helm/', '.gitlab-ci.yml', 'Makefile'],
    deps:   ['@pulumi', 'aws-cdk', 'serverless', 'cdktf'],
    readme: ['deploy', 'pipeline', 'rollback', 'observability', 'alert', 'SLO', 'on-call'],
  },
  real_time_system: {
    deps:   ['socket.io', 'ws', 'pusher', 'ably', 'liveblocks', 'yjs', 'partykit'],
    readme: ['websocket', 'real-time', 'live', 'streaming', 'collaborative', 'CRDT', 'presence', 'conflict'],
  },
};

// ─── DETECTION ────────────────────────────────────────────────────────────────

/**
 * Detect system types from a repo context object.
 * Pure computation — no API calls.
 * @param {object} repoContext
 * @returns {{ types: Array<{type, confidence, signals, sophisticationScore}>, primary: string }}
 */
export function detectSystemTypes(repoContext) {
  const deps    = (repoContext.techStack?.keyDependencies || []).map(d => d.toLowerCase());
  const layers  = (repoContext.architecture?.layers || []).map(l => l.toLowerCase());
  const files   = (repoContext.architecture?.fileTree || []).map(f => (f.path || '').toLowerCase());
  const readme  = ((repoContext.documentation?.summary || '') + ' ' +
                   (repoContext.projectDescription || '')).toLowerCase();
  const commits = (repoContext.developmentHistory?.keyCommits || []).map(c => (c.message || '').toLowerCase());

  const results = [];

  for (const [type, signals] of Object.entries(SYSTEM_SIGNALS)) {
    let score = 0;
    const matched = [];

    // Dependency match (15 pts each)
    (signals.deps || []).forEach(kw => {
      if (deps.some(d => d.includes(kw))) {
        score += 15;
        matched.push(`dep:${kw}`);
      }
    });

    // File/path match (10 pts)
    (signals.files || []).forEach(kw => {
      if (files.some(f => f.includes(kw))) {
        score += 10;
        matched.push(`file:${kw}`);
      }
    });

    // README match (8 pts)
    (signals.readme || []).forEach(kw => {
      if (readme.includes(kw.toLowerCase())) {
        score += 8;
        matched.push(`readme:${kw}`);
      }
    });

    // Layer match (7 pts)
    (signals.layers || []).forEach(kw => {
      if (layers.some(l => l.includes(kw))) {
        score += 7;
        matched.push(`layer:${kw}`);
      }
    });

    // Commit keyword (5 pts)
    const allSigs = [...(signals.deps || []), ...(signals.readme || [])];
    commits.forEach(msg => {
      allSigs.forEach(kw => {
        if (msg.includes(kw.toLowerCase())) {
          score += 5;
          matched.push(`commit:${kw}`);
        }
      });
    });

    // Co-occurrence bonus: 2+ signal types hit
    const sigTypes = new Set(matched.map(m => m.split(':')[0]));
    if (sigTypes.size >= 2) score += 5;

    if (score > 30) {
      results.push({ type, confidence: Math.min(score, 100), signals: matched, sophisticationScore: 0 });
    }
  }

  results.sort((a, b) => b.confidence - a.confidence);
  return { types: results, primary: results[0]?.type || 'backend_api_system' };
}

/**
 * Lighter detection for resume-only interviews (no repo).
 */
export function detectSystemTypesFromResume(resumeText = '', skillMapping = {}) {
  const text = resumeText.toLowerCase();
  const allSkills = [
    ...((skillMapping.strong || []).map(s => s.skill.toLowerCase())),
    ...((skillMapping.weak   || []).map(s => s.skill.toLowerCase())),
  ];

  const results = [];

  for (const [type, signals] of Object.entries(SYSTEM_SIGNALS)) {
    let score = 0;
    const matched = [];

    (signals.deps || []).forEach(kw => {
      const k = kw.toLowerCase();
      if (text.includes(k) || allSkills.some(s => s.includes(k))) {
        score += 12;
        matched.push(`skill:${kw}`);
      }
    });

    (signals.readme || []).forEach(kw => {
      if (text.includes(kw.toLowerCase())) {
        score += 6;
        matched.push(`resume:${kw}`);
      }
    });

    if (score > 20) {
      results.push({ type, confidence: Math.min(score, 100), signals: matched });
    }
  }

  results.sort((a, b) => b.confidence - a.confidence);
  return { types: results, primary: results[0]?.type || null };
}

// ─── COMMIT PATTERN ANALYSIS ──────────────────────────────────────────────────

/**
 * Analyze the last 30 commits for patterns relevant to question generation.
 * @param {object} repoContext
 * @returns {object} CommitIntelligence
 */
export function analyzeCommitPatterns(repoContext) {
  const raw = (repoContext.developmentHistory?.rawCommits || []).slice(0, 30);

  const migrationCommits = [];
  const refactorChains   = [];
  const techSwitches     = [];
  const debuggingBursts  = [];
  const featureArcs      = [];

  const MIGRATION_RE = /migrat|switch|replac|upgrad|mov.*from|chang.*to/i;
  const DEBUG_RE     = /fix|bug|patch|hotfix|revert/i;
  const REFACTOR_RE  = /refactor|restructur|reorganiz|cleanup|clean.?up/i;
  const SWITCH_RE    = /remove|replac.*with|swap.*for|migrat.*to/i;

  // Per-date group for debugging bursts
  const byDate = {};

  raw.forEach(commit => {
    const msg = commit.message || '';
    const date = (commit.date || '').slice(0, 10); // YYYY-MM-DD

    if (MIGRATION_RE.test(msg)) migrationCommits.push({ sha: commit.sha, message: msg });
    if (REFACTOR_RE.test(msg)) {
      const last = refactorChains[refactorChains.length - 1];
      if (last) last.commits.push(msg);
      else refactorChains.push({ commits: [msg], area: extractArea(msg) });
    }
    if (SWITCH_RE.test(msg)) techSwitches.push({ sha: commit.sha, message: msg });
    if (DEBUG_RE.test(msg)) {
      if (!byDate[date]) byDate[date] = [];
      byDate[date].push(msg);
    }

    // Feature arcs — extract nouns
    const nouns = msg.split(/\s+/).filter(w => w.length > 4 && /^[a-z]/i.test(w));
    nouns.forEach(noun => {
      const existing = featureArcs.find(f => f.keyword === noun.toLowerCase());
      if (existing) existing.commits.push(msg);
      else featureArcs.push({ keyword: noun.toLowerCase(), commits: [msg] });
    });
  });

  // Debugging bursts: 3+ fix commits same day
  Object.entries(byDate).forEach(([date, msgs]) => {
    if (msgs.length >= 3) {
      debuggingBursts.push({ date, commits: msgs, area: extractArea(msgs[0]) });
    }
  });

  // Velocity pattern
  const velocityPattern = computeVelocityPattern(raw);
  const collaborationScore = computeCollaborationScore(raw);
  const commitQuality = computeCommitQuality(raw);

  // Filter featureArcs to those with 3+ mentions
  const significantArcs = featureArcs.filter(f => f.commits.length >= 3);

  return {
    migrationCommits,
    refactorChains,
    techSwitches,
    debuggingBursts,
    featureArcs: significantArcs,
    velocityPattern,
    collaborationScore,
    commitQuality,
  };
}

function extractArea(msg) {
  const words = (msg || '').split(/\s+/).filter(w => w.length > 3);
  return words[0] || 'unknown';
}

function computeVelocityPattern(commits) {
  if (commits.length < 2) return { avgPerWeek: 0, peakWeek: 0, dropOffDetected: false };

  const dates = commits
    .map(c => new Date(c.date))
    .filter(d => !isNaN(d))
    .sort((a, b) => a - b);

  if (dates.length < 2) return { avgPerWeek: 0, peakWeek: 0, dropOffDetected: false };

  const totalMs = dates[dates.length - 1] - dates[0];
  const totalWeeks = Math.max(1, totalMs / (7 * 24 * 60 * 60 * 1000));
  const avgPerWeek = commits.length / totalWeeks;

  // Check for drop-off: no commits in last 30 days
  const now = new Date();
  const lastCommit = dates[dates.length - 1];
  const daysSinceLast = (now - lastCommit) / (24 * 60 * 60 * 1000);
  const dropOffDetected = daysSinceLast > 30 && commits.length >= 5;

  // Crude peak: count commits in each week bucket
  const weekCounts = {};
  dates.forEach(d => {
    const weekKey = Math.floor((d - dates[0]) / (7 * 24 * 60 * 60 * 1000));
    weekCounts[weekKey] = (weekCounts[weekKey] || 0) + 1;
  });
  const peakWeek = Math.max(...Object.values(weekCounts));

  return { avgPerWeek: Math.round(avgPerWeek * 10) / 10, peakWeek, dropOffDetected };
}

function computeCollaborationScore(commits) {
  if (!commits.length) return 0;
  const authors = new Set(commits.map(c => c.author).filter(Boolean));
  return Math.min(100, Math.round((authors.size / commits.length) * 100 * 3));
}

function computeCommitQuality(commits) {
  const CONVENTIONAL_RE = /^(feat|fix|docs|style|refactor|test|chore|perf|ci|build|revert)(\(.+\))?:/i;
  const conventionalCount = commits.filter(c => CONVENTIONAL_RE.test(c.message || '')).length;
  const avgMessageLength = commits.length
    ? Math.round(commits.reduce((sum, c) => sum + (c.message || '').length, 0) / commits.length)
    : 0;
  return {
    hasConventionalCommits: conventionalCount / Math.max(1, commits.length) >= 0.5,
    avgMessageLength,
  };
}

// ─── PRESSURE POINTS ──────────────────────────────────────────────────────────

/**
 * Identify truth-check pressure question targets.
 * @param {object|null} repoContext
 * @param {string} resumeText
 * @param {object} skillMapping
 * @returns {Array<{type, target, questionSeed, severity, trainingLabel}>}
 */
export function identifyPressurePoints(repoContext, resumeText = '', skillMapping = {}) {
  const points = [];
  const readme  = (repoContext?.documentation?.summary || '').toLowerCase();
  const deps    = (repoContext?.techStack?.keyDependencies || []).map(d => d.toLowerCase());
  const primary = repoContext ? detectSystemTypes(repoContext).primary : null;
  const commits = repoContext ? analyzeCommitPatterns(repoContext) : null;

  // 1. Scale claim without infra
  const scaleMatch = resumeText.match(/(\d+[KkMm]\+?\s*(?:users?|requests?|rps))/i);
  const hasScalingDep = deps.some(d => /redis|memcache|kafka|bull|celery|nginx|haproxy/.test(d));
  if (scaleMatch && !hasScalingDep) {
    points.push({
      type: 'scale_verification',
      target: scaleMatch[1],
      questionSeed: `You mention scaling to ${scaleMatch[1]} — what was the first bottleneck you hit?`,
      severity: 'high',
      trainingLabel: 'scale_verification',
    });
  }

  // 2. Claimed feature without implementation
  const featureClaims = [
    { keyword: 'caching', depCheck: /redis|memcache|lru-cache|node-cache/ },
    { keyword: 'auth',    depCheck: /passport|jwt|firebase|clerk|auth0|supabase/ },
    { keyword: 'search',  depCheck: /elasticsearch|algolia|meilisearch|pg_trgm/ },
  ];
  featureClaims.forEach(({ keyword, depCheck }) => {
    if (readme.includes(keyword) && !deps.some(d => depCheck.test(d))) {
      points.push({
        type: 'feature_verification',
        target: keyword,
        questionSeed: `Your README mentions ${keyword} but I don't see a dedicated ${keyword} layer — walk me through how it actually works`,
        severity: 'medium',
        trainingLabel: 'feature_verification',
      });
    }
  });

  // 3. Shallow domain usage
  if (primary === 'blockchain_system' && !deps.some(d => /oracle|event|gasPrice/.test(d))) {
    points.push({
      type: 'domain_depth',
      target: 'blockchain depth',
      questionSeed: 'What would break if you replaced the blockchain layer with a standard database?',
      severity: 'medium',
      trainingLabel: 'domain_depth',
    });
  }
  if (primary === 'ml_system' && !commits?.migrationCommits?.some(c => /train|eval|epoch/.test(c.message))) {
    points.push({
      type: 'domain_depth',
      target: 'ML training depth',
      questionSeed: 'Walk me through your training loop — what metrics did you track and how did you know the model was ready?',
      severity: 'medium',
      trainingLabel: 'domain_depth',
    });
  }

  // 4. Weakest skill
  const weakRequired = (skillMapping.weak || []).filter(s => s.importance === 'required');
  if (weakRequired.length) {
    const skill = weakRequired[0].skill;
    points.push({
      type: 'skill_gap',
      target: skill,
      questionSeed: `You list ${skill} — walk me through a specific production problem you debugged with it`,
      severity: 'medium',
      trainingLabel: 'skill_gap',
    });
  }

  // 5. Velocity drop-off
  if (commits?.velocityPattern?.dropOffDetected) {
    points.push({
      type: 'project_abandonment',
      target: 'commit drop-off',
      questionSeed: 'The commit history shows heavy activity then a drop-off — what happened during that phase?',
      severity: 'low',
      trainingLabel: 'project_abandonment',
    });
  }

  // 6. Solo vs team mismatch
  const teamClaim = /led\s+a\s+team|managed\s+\d+|team\s+of\s+\d+/i.test(resumeText);
  if (teamClaim && (commits?.collaborationScore || 0) < 15) {
    points.push({
      type: 'team_claim_verification',
      target: 'team leadership claim',
      questionSeed: 'You mention leading a team — I see mostly solo commits here. Was this a different project?',
      severity: 'high',
      trainingLabel: 'team_claim_verification',
    });
  }

  return points.slice(0, 3); // Return top 3 by order (highest severity first naturally)
}

// ─── SOPHISTICATION SCORING ───────────────────────────────────────────────────

/**
 * Score candidate sophistication (0–100) for interview difficulty calibration.
 * @param {object} repoContext
 * @param {object} commitIntel — result from analyzeCommitPatterns
 * @returns {{ sophisticationScore: number, level: string, calibrationSignals: string[] }}
 */
export function scoreCandidateSophistication(repoContext, commitIntel = {}) {
  let score = 0;
  const signals = [];

  const systemTypes = detectSystemTypes(repoContext);
  const layers      = repoContext.architecture?.layers || [];
  const fileTree    = repoContext.architecture?.fileTree || [];
  const deps        = repoContext.techStack?.keyDependencies || [];
  const commits     = repoContext.developmentHistory?.totalCommitsAnalyzed || 0;
  const readme      = repoContext.documentation?.summary || '';

  // Positives
  if (systemTypes.types.length > 1) {
    score += 15;
    signals.push('multi-domain project');
  }
  if ((commitIntel.migrationCommits || []).length > 0) {
    score += 10;
    signals.push('migration commits found');
  }
  if ((commitIntel.debuggingBursts || []).length > 0) {
    score += 10;
    signals.push('debugging burst patterns');
  }
  if (layers.length >= 4) {
    score += 8;
    signals.push('4+ architecture layers');
  }
  const hasErrorHandling = fileTree.some(f =>
    /errors?\.(js|ts)|error.handler|middleware\/errors?/i.test(f.path || ''));
  if (hasErrorHandling) {
    score += 8;
    signals.push('error handling files');
  }
  const hasCICD = fileTree.some(f => /\.github\/workflows|\.gitlab-ci|Jenkinsfile|\.circleci/.test(f.path || ''));
  if (hasCICD) {
    score += 7;
    signals.push('CI/CD config');
  }
  const hasTests = fileTree.some(f => /\/(tests?|spec|__tests__)\//.test(f.path || ''));
  if (hasTests) {
    score += 6;
    signals.push('test directory');
  }
  const hasDocs = fileTree.some(f => /\/(docs?|wiki|adr)\//i.test(f.path || ''));
  if (hasDocs) {
    score += 5;
    signals.push('extended documentation');
  }
  const hasLockFile = fileTree.some(f => /package-lock\.json|yarn\.lock|pnpm-lock|Pipfile\.lock/.test(f.path || ''));
  if (hasLockFile) {
    score += 5;
    signals.push('lock file present');
  }
  const hasEnvConfig = fileTree.some(f => /\.env\.example|config\/.*\.(js|ts|yaml|json)/.test(f.path || ''));
  if (hasEnvConfig) {
    score += 5;
    signals.push('env config separation');
  }

  // Negatives
  if (commits < 5) {
    score -= 10;
    signals.push('shallow commit history (<5)');
  }
  const extensions = new Set(
    fileTree.map(f => (f.path || '').split('.').pop()).filter(e => e && e.length <= 4)
  );
  if (extensions.size <= 1) {
    score -= 10;
    signals.push('single file type');
  }
  if (readme.length < 100) {
    score -= 15;
    signals.push('sparse README (<100 chars)');
  }

  score = Math.max(0, Math.min(100, score));
  const level = score <= 35 ? 'junior' : score <= 65 ? 'mid' : 'senior';

  return { sophisticationScore: score, level, calibrationSignals: signals };
}

export default {
  detectSystemTypes,
  detectSystemTypesFromResume,
  analyzeCommitPatterns,
  identifyPressurePoints,
  scoreCandidateSophistication,
};
