/**
 * AILiteracyScorer v3 — Industry-standard AI Literacy & Technical Depth Scorer
 *
 * SCORING Model:
 *   Total = Technical Depth (35%) + Specificity (25%) + Decision Clarity (15%)
 *           + Problem Awareness (15%) + Authenticity Signals (10%)
 *
 * Each dimension is scored 0-100 using multi-factor heuristics:
 *   - Regex pattern matching for keyword/phrase signals
 *   - Semantic density analysis (technical terms per sentence)
 *   - Code-reference detection (file names, function names, CLI commands)
 *   - Repo-context matching (mentioned deps, dirs, files from repo)
 *   - Answer quality metrics (length, structure, detail level)
 */

// ─── TECHNICAL DEPTH INDICATORS ──────────────────────────────────────────────
const TECH_INDICATORS = {
  // Code-level references (strongest signal)
  codeReferences: [
    /\b(?:function|const|let|var|class|import|export|require|module)\b/i,
    /\b\w+\.(js|ts|jsx|tsx|py|java|go|rs|rb|css|html|json|yaml|yml|sql|sh)\b/i,
    /\b(?:api|endpoint|route|controller|service|middleware|hook|component|model|schema|migration)\b/i,
    /\b(?:GET|POST|PUT|DELETE|PATCH)\b/,
    /\b(?:localhost|port|env|config|\.env)\b/i,
    /\b(?:npm|yarn|pip|cargo|maven|gradle|docker|git)\s/i,
  ],
  // Architecture & design patterns
  architecture: [
    /\b(?:REST|GraphQL|gRPC|WebSocket|SSE|HTTP|TCP|UDP)\b/i,
    /\b(?:CRUD|MVC|MVVM|microservice|monolith|serverless|event.?driven)\b/i,
    /\b(?:middleware|interceptor|guard|pipe|filter|resolver|handler)\b/i,
    /\b(?:state management|redux|zustand|context|store|dispatch|reducer)\b/i,
    /\b(?:SSR|CSR|SSG|ISR|hydrat)/i,
    /\b(?:ORM|Prisma|Sequelize|TypeORM|Mongoose|Drizzle)\b/i,
  ],
  // Infrastructure & deployment
  infra: [
    /\b(?:deploy|CI\/CD|pipeline|Docker|Kubernetes|k8s|container)\b/i,
    /\b(?:AWS|GCP|Azure|Vercel|Netlify|Render|Heroku|Fly\.io|Railway)\b/i,
    /\b(?:database|DB|SQL|NoSQL|PostgreSQL|MySQL|MongoDB|Redis|Firebase|Supabase)\b/i,
    /\b(?:cache|CDN|load.?balance|reverse.?proxy|nginx)\b/i,
    /\b(?:auth|JWT|OAuth|session|cookie|token|bcrypt|hash)\b/i,
  ],
  // Specific tech mentions
  specificTech: [
    /\b(?:React|Next\.?js|Vue|Angular|Svelte|Solid|Astro|Remix)\b/i,
    /\b(?:Express|Fastify|Koa|Hono|Flask|Django|Spring|Rails|Gin|Fiber)\b/i,
    /\b(?:TypeScript|Python|Rust|Go|Java|C\+\+|Swift|Kotlin)\b/i,
    /\b(?:TailwindCSS|Sass|SCSS|styled.?components|CSS.?Modules)\b/i,
    /\b(?:Webpack|Vite|Rollup|esbuild|Turbopack|Babel)\b/i,
    /\b(?:Jest|Vitest|Cypress|Playwright|Mocha|testing.?library)\b/i,
  ],
};

// ─── SPECIFICITY INDICATORS ──────────────────────────────────────────────────
const SPECIFICITY_INDICATORS = [
  // Personal experience markers
  /\bI (?:chose|picked|decided|went with|used|switched|tried|started|built|made|wrote|added|created|implemented|configured|debugged|refactored|optimized|deployed)\b/i,
  /\bwe (?:chose|picked|decided|went with|used|switched|tried|started|built|made|wrote|added|created|implemented)\b/i,
  // Concrete reasoning
  /\bbecause\b/i,
  /\bspecifically\b/i,
  /\bfor example\b/i,
  /\bin my case\b/i,
  /\bin this project\b/i,
  /\bthe reason\b/i,
  // Concrete details: file/folder/component names
  /\b(?:file|folder|directory|component|module|package|function|class|method|hook|page|route|endpoint|table|collection|schema)\b/i,
  // Concrete details: errors, issues, metrics
  /\b(?:error|bug|crash|issue|problem|exception|warning|timeout|memory leak)\b/i,
  /\b\d+\s*(?:hours?|days?|minutes?|times?|ms|seconds?|MB|GB|lines?|rows?|requests?|users?|%)\b/i,
  // Tool & resource references
  /\b(?:Stack\s*Overflow|documentation|docs?|GitHub|tutorial|video|blog|article|forum|Discord|Reddit)\b/i,
  // Version references
  /\b(?:version|v\d|upgrade|downgrade|migrate|breaking change)\b/i,
  // Deployment specifics
  /\b(?:deployed?|pushed?|shipped?|released?|published|hosted)\b/i,
];

// ─── DECISION CLARITY INDICATORS ─────────────────────────────────────────────
const DECISION_INDICATORS = [
  /\bcould have\b/i,
  /\binstead of\b/i,
  /\balternative\b/i,
  /\bcompared\b/i,
  /\btrade.?off\b/i,
  /\bpros?\b.*\bcons?\b/i,
  /\breason\b/i,
  /\bspecifically\b/i,
  /\bin my case\b/i,
  /\bfor this project\b/i,
  /\bneeded\b/i,
  /\brequired\b/i,
  /\bbetter than\b/i,
  /\bworse than\b/i,
  /\bfaster\b|\bslower\b|\beasier\b|\bharder\b|\bsimpler\b|\bmore complex\b/i,
  /\bover\b.*\bbecause\b/i,
  /\bweighed\b|\bevaluated\b|\bconsidered\b/i,
];

// ─── PROBLEM AWARENESS INDICATORS ───────────────────────────────────────────
const PROBLEM_INDICATORS = [
  /\blimitation\b/i,
  /\bworkaround\b/i,
  /\bhack\b/i,
  /\btechnical debt\b/i,
  /\bscal/i,
  /\bperformance\b/i,
  /\boptimiz/i,
  /\bif I (?:had|could|were|would)\b/i,
  /\bnext time\b/i,
  /\blearned\b/i,
  /\bmistake\b/i,
  /\bregret\b/i,
  /\bshould have\b/i,
  /\bin hindsight\b/i,
  /\bimprov/i,
  /\brefactor/i,
  /\btech(?:nical)?\s*debt\b/i,
  /\bbreaking change\b/i,
  /\bedge case\b/i,
  /\bcorner case\b/i,
  /\bsecurity\b/i,
  /\bvulnerab/i,
];

// ─── AI-DEPENDENCY RED FLAGS ─────────────────────────────────────────────────
const AI_DEPENDENT_FLAGS = [
  { pattern: /\b(?:as an AI|I'm an AI|language model)\b/i, label: 'AI self-reference', weight: 5 },
  { pattern: /\b(?:here'?s? (?:a|an) (?:example|overview)|let me explain)\b/i, label: 'Tutorial phrasing', weight: 1.5 },
  { pattern: /\bstep 1\b.*\bstep 2\b/is, label: 'Over-structured tutorial', weight: 1 },
  { pattern: /^(?:Sure|Certainly|Of course|Absolutely)[,!.]/i, label: 'AI-like opener', weight: 1 },
  { pattern: /\bin conclusion\b.*\bin summary\b/is, label: 'Essay structure', weight: 0.5 },
];

// ─── HELPER: Count pattern matches ──────────────────────────────────────────
function countMatches(text, patterns) {
  let hits = 0;
  for (const p of patterns) {
    if (p.test(text)) hits++;
  }
  return hits;
}

// ─── HELPER: Compute technical term density ─────────────────────────────────
function technicalDensity(text) {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 5);
  if (sentences.length === 0) return 0;
  const allTechPatterns = [
    ...TECH_INDICATORS.codeReferences,
    ...TECH_INDICATORS.architecture,
    ...TECH_INDICATORS.infra,
    ...TECH_INDICATORS.specificTech,
  ];
  let totalHits = 0;
  for (const s of sentences) {
    totalHits += countMatches(s, allTechPatterns);
  }
  return totalHits / sentences.length; // avg tech refs per sentence
}

// ─── HELPER: Score repo reference matching ──────────────────────────────────
function repoReferenceScore(text, question) {
  if (!question?.repoReference) return 0;
  const refs = question.repoReference.split(/[,;]/).map(r => r.trim().toLowerCase()).filter(r => r.length > 2);
  if (refs.length === 0) return 0;
  const lower = text.toLowerCase();
  let matched = 0;
  for (const ref of refs) {
    if (lower.includes(ref)) matched++;
  }
  return Math.min(100, (matched / Math.max(refs.length, 1)) * 100);
}

/**
 * Score a single answer for AI-literacy and technical depth
 */
export function scoreAnswer(answer, question) {
  if (!answer || answer.trim().length < 10) {
    return {
      technicalDepth: 0,
      specificity: 0,
      decisionClarity: 0,
      problemAwareness: 0,
      aiDependencyFlags: [{ label: 'Answer too short', weight: 3 }],
      totalScore: 5,
      classification: 'AI-Dependent',
      wordCount: 0,
    };
  }

  const text = answer.trim();
  const wordCount = text.split(/\s+/).length;

  // ── 1. TECHNICAL DEPTH (0-100) ──
  const codeRefHits = countMatches(text, TECH_INDICATORS.codeReferences);
  const archHits = countMatches(text, TECH_INDICATORS.architecture);
  const infraHits = countMatches(text, TECH_INDICATORS.infra);
  const techHits = countMatches(text, TECH_INDICATORS.specificTech);
  const totalTechHits = codeRefHits + archHits + infraHits + techHits;
  const density = technicalDensity(text);

  // Technical depth score: combination of absolute hits + density
  let techDepthRaw = 0;
  techDepthRaw += Math.min(40, totalTechHits * 8);       // Up to 40 from pattern hits
  techDepthRaw += Math.min(30, density * 15);              // Up to 30 from density
  techDepthRaw += Math.min(15, repoReferenceScore(text, question) * 0.15); // Up to 15 from repo refs
  // Length bonus for technical answers
  if (wordCount >= 80) techDepthRaw += 15;
  else if (wordCount >= 40) techDepthRaw += 10;
  else if (wordCount >= 20) techDepthRaw += 5;
  const technicalDepth = Math.min(100, Math.round(techDepthRaw));

  // ── 2. SPECIFICITY (0-100) ──
  const specHits = countMatches(text, SPECIFICITY_INDICATORS);
  let specRaw = 0;
  specRaw += Math.min(60, specHits * 8);                 // Up to 60 from patterns
  specRaw += Math.min(20, repoReferenceScore(text, question) * 0.2); // Up to 20 from repo refs
  // Personal pronoun density bonus
  const personalPronouns = (text.match(/\bI\b|\bmy\b|\bwe\b|\bour\b|\bme\b/gi) || []).length;
  specRaw += Math.min(20, personalPronouns * 4);           // Up to 20 from pronouns
  const specificity = Math.min(100, Math.round(specRaw));

  // ── 3. DECISION CLARITY (0-100) ──
  const decisionHits = countMatches(text, DECISION_INDICATORS);
  let decRaw = Math.min(100, decisionHits * 12);
  // Bonus for comparative language
  if (/\bover\b.*\bbecause\b/i.test(text) || /\binstead of\b.*\bbecause\b/i.test(text)) {
    decRaw += 20;
  }
  const decisionClarity = Math.min(100, Math.round(decRaw));

  // ── 4. PROBLEM AWARENESS (0-100) ──
  const probHits = countMatches(text, PROBLEM_INDICATORS);
  const problemAwareness = Math.min(100, Math.round(probHits * 10));

  // ── 5. AI DEPENDENCY FLAGS (penalty) ──
  const flags = [];
  for (const { pattern, label, weight } of AI_DEPENDENT_FLAGS) {
    if (pattern.test(text)) {
      flags.push({ label, weight });
    }
  }
  const flagPenalty = flags.reduce((sum, f) => sum + f.weight * 4, 0);

  // ── COMPOSITE TOTAL SCORE ──
  // Weighted: Technical 35%, Specificity 25%, Decision 15%, Problem 15%, Authenticity 10%
  const authenticityRaw = Math.max(0, 100 - flagPenalty * 5);
  const rawTotal =
    technicalDepth * 0.35 +
    specificity * 0.25 +
    decisionClarity * 0.15 +
    problemAwareness * 0.15 +
    authenticityRaw * 0.10;

  // Floor: Never below 10 for a real substantive answer (>30 chars)
  const totalScore = Math.max(text.length > 30 ? 10 : 5, Math.min(100, Math.round(rawTotal)));

  // Classification
  let classification;
  if (totalScore >= 65) classification = 'Genuine Builder';
  else if (totalScore >= 35) classification = 'AI-Assisted Builder';
  else classification = 'AI-Dependent';

  return {
    technicalDepth,
    specificity,
    decisionClarity,
    problemAwareness,
    personalBonus: Math.min(20, personalPronouns * 4),
    repoRefBonus: Math.round(repoReferenceScore(text, question) * 0.15),
    wordBonus: wordCount >= 80 ? 15 : wordCount >= 40 ? 10 : wordCount >= 20 ? 5 : 0,
    flagPenalty: Math.round(flagPenalty),
    aiDependencyFlags: flags,
    totalScore,
    classification,
    wordCount,
  };
}

/**
 * Calculate overall AI-literacy score across all answers
 */
export function calculateAILiteracy(qaPairs) {
  if (!qaPairs || qaPairs.length === 0) {
    return {
      overallScore: 0,
      classification: 'AI-Dependent',
      confidence: 0,
      breakdown: [],
      summary: 'No answers to analyze',
    };
  }

  const scores = qaPairs.map((qa, index) => {
    const score = scoreAnswer(qa.answer, qa.question || { repoReference: '' });
    return {
      questionIndex: index + 1,
      question: qa.question?.text?.slice(0, 80) || `Question ${index + 1}`,
      fullQuestion: qa.question?.text || `Question ${index + 1}`,
      expectedAnswer: qa.question?.expectedAnswer || '',
      candidateAnswer: qa.answer || '',
      ...score,
    };
  });

  // Overall score — weighted average (equal weight per question)
  const overallScore = Math.round(
    scores.reduce((sum, s) => sum + s.totalScore, 0) / scores.length
  );

  // Consistency check
  const variance = scores.reduce((sum, s) => sum + Math.pow(s.totalScore - overallScore, 2), 0) / scores.length;
  const consistency = Math.max(0, 100 - Math.sqrt(variance));

  // Classification
  let classification;
  if (overallScore >= 65) classification = 'Genuine Builder';
  else if (overallScore >= 35) classification = 'AI-Assisted Builder';
  else classification = 'AI-Dependent';

  // Confidence
  const confidence = Math.round(Math.min(100, 50 + scores.length * 10 + consistency * 0.2));

  // All flags
  const allFlags = scores.flatMap(s => s.aiDependencyFlags);
  const uniqueFlags = [...new Set(allFlags.map(f => f.label))];

  // Summary
  let summary;
  if (classification === 'Genuine Builder') {
    summary = 'Candidate demonstrates genuine technical depth with specific implementation details, debugging experience, and architectural understanding.';
  } else if (classification === 'AI-Assisted Builder') {
    summary = 'Candidate shows moderate technical understanding. Some answers contain specific details while others remain surface-level.';
  } else {
    summary = 'Candidate struggles to provide specific technical details. Answers lack implementation-level depth and concrete experience markers.';
  }

  return {
    overallScore,
    classification,
    confidence,
    consistency: Math.round(consistency),
    breakdown: scores,
    allFlags: uniqueFlags,
    summary,
    dimensions: {
      avgTechnicalDepth: Math.round(scores.reduce((s, x) => s + (x.technicalDepth || 0), 0) / scores.length),
      avgSpecificity: Math.round(scores.reduce((s, x) => s + x.specificity, 0) / scores.length),
      avgDecisionClarity: Math.round(scores.reduce((s, x) => s + x.decisionClarity, 0) / scores.length),
      avgProblemAwareness: Math.round(scores.reduce((s, x) => s + x.problemAwareness, 0) / scores.length),
    },
  };
}

/**
 * Generate a classification badge config
 */
export function getClassificationBadge(classification) {
  const badges = {
    'Genuine Builder': {
      label: 'Genuine Builder',
      color: '#10b981',
      bgColor: '#10b98120',
      icon: '🏗️',
      description: 'Demonstrates genuine technical depth and hands-on building experience',
    },
    'AI-Assisted Builder': {
      label: 'AI-Assisted',
      color: '#f59e0b',
      bgColor: '#f59e0b20',
      icon: '🤖',
      description: 'Used AI tools with reasonable understanding of the codebase',
    },
    'AI-Dependent': {
      label: 'AI-Dependent',
      color: '#ef4444',
      bgColor: '#ef444420',
      icon: '⚠️',
      description: 'Cannot demonstrate genuine technical understanding of the project',
    },
  };
  return badges[classification] || badges['AI-Dependent'];
}

export default {
  scoreAnswer,
  calculateAILiteracy,
  getClassificationBadge,
};
