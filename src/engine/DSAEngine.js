/**
 * DSAEngine — Coding challenge generation, static evaluation, security hardening.
 *
 * Security rules (non-negotiable):
 *   - NEVER execute submitted code server-side
 *   - NEVER store raw code in DB — store SHA-256 hash + length only
 *   - Reject immediately if code contains disallowed patterns
 *   - All evaluation via gpt-4o-mini static analysis only
 */

const API_BASE = typeof import.meta !== 'undefined'
  ? (import.meta.env?.VITE_API_URL || '')
  : '';

// ─── TOPIC MAP ────────────────────────────────────────────────────────────────

export const TOPIC_MAP = {
  arrays_strings:  'Two pointers, sliding window, prefix sum, string manipulation',
  trees_graphs:    'BFS/DFS, cycle detection, shortest path, topological sort',
  dynamic_prog:    'Memoization, tabulation, knapsack variants, interval DP',
  system_design:   'Rate limiter, URL shortener, cache design (open-ended, no code)',
  sql:             'Joins, window functions, subqueries, CTEs',
  debugging:       'Given broken code, find and fix the bug',
  concurrency:     'Race condition, mutex, async/await pitfalls',
  api_design:      'Design RESTful endpoints, handle pagination, error contracts',
};

// ─── SECURITY ─────────────────────────────────────────────────────────────────

const DISALLOWED_PATTERNS = [
  /\bexec\b/,
  /\beval\b/,
  /child_process/,
  /os\.system/,
  /subprocess/,
  /Runtime\.getRuntime/,
  /ProcessBuilder/,
  /\bfetch\b/,
  /XMLHttpRequest/,
  /require\s*\(/,
  /import\s+/,
  /__import__/,
  /open\s*\(/,
  /file\s*\(/i,
  /socket\.connect/,
  /net\.createServer/,
  /dns\.lookup/,
];

/**
 * Check if code contains disallowed patterns.
 * @param {string} code
 * @returns {{ rejected: boolean, pattern?: string }}
 */
export function rejectUnsafeCode(code) {
  if (!code || typeof code !== 'string') return { rejected: true, pattern: 'empty_submission' };
  if (code.length > 10240) return { rejected: true, pattern: 'size_limit' };

  for (const pattern of DISALLOWED_PATTERNS) {
    if (pattern.test(code)) return { rejected: true, pattern: pattern.toString() };
  }
  return { rejected: false };
}

/**
 * Compute SHA-256 hash of code string (browser-compatible).
 * @param {string} code
 * @returns {Promise<string>}
 */
export async function hashCode(code) {
  const encoder = new TextEncoder();
  const data = encoder.encode(code);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ─── CHALLENGE GENERATION ─────────────────────────────────────────────────────

/**
 * Generate a DSA challenge via the backend AI route.
 * @param {string} roleTitle
 * @param {'easy'|'medium'|'hard'} difficulty
 * @param {string[]} topics  — keys from TOPIC_MAP
 * @param {'junior'|'mid'|'senior'} sophisticationLevel
 * @returns {Promise<object>} challenge object
 */
export async function generateDSAChallenge(roleTitle, difficulty = 'medium', topics = ['arrays_strings'], sophisticationLevel = 'mid') {
  const topicDescriptions = topics
    .filter(t => TOPIC_MAP[t])
    .map(t => `${t}: ${TOPIC_MAP[t]}`)
    .join('\n');

  const prompt = `Generate a coding interview challenge for a ${roleTitle} candidate (${sophisticationLevel} level).

Difficulty: ${difficulty}
Topics:
${topicDescriptions || 'arrays_strings: Two pointers, sliding window'}

REQUIREMENTS:
- Problem statement: clear, unambiguous, no trick phrasing
- 3 example test cases: at least 1 edge case, at least 1 large input hint
- Constraints: specify expected time/space complexity
${difficulty === 'easy' ? '- Expected approach hints: include (easy difficulty)' : '- Expected approach: HIDDEN (medium/hard difficulty)'}
${difficulty !== 'easy' ? '- Common mistake callout: include one hint like "watch for off-by-one in..."' : ''}
- 2 hidden test cases for evaluation (label them clearly as hidden)
- Starter code in JavaScript

Return ONLY raw JSON:
{
  "title": "...",
  "description": "...",
  "examples": [{"input":"...","output":"...","explanation":"..."}],
  "constraints": "...",
  "starterCode": {"javascript": "function solve(input) {\\n  // your code here\\n}"},
  "testCases": [{"input":"...","expected":"..."}],
  "hiddenTestCases": [{"input":"...","expected":"..."}],
  "estimatedMinutes": 30,
  "approachHints": "..." or null,
  "commonMistake": "..." or null
}`;

  try {
    const res = await fetch(`${API_BASE}/api/ai/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        options: {
          systemPrompt: 'You are an expert technical interviewer creating fair, unambiguous coding challenges. Return only valid JSON.',
          temperature: 0.7,
          maxTokens: 1500,
          model: 'gemini', // uses gemini-2.0-flash-lite for challenge gen
        },
      }),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const result = await res.json();
    const text = (result.data || '').replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(text);

    return {
      challengeId: crypto.randomUUID(),
      title:            parsed.title || 'Untitled Challenge',
      description:      parsed.description || '',
      examples:         parsed.examples || [],
      constraints:      parsed.constraints || '',
      starterCode:      parsed.starterCode || { javascript: '// write your solution here' },
      testCases:        parsed.testCases || [],
      hiddenTestCases:  parsed.hiddenTestCases || [],
      difficulty,
      topic:            topics[0] || 'arrays_strings',
      estimatedMinutes: parsed.estimatedMinutes || (difficulty === 'easy' ? 20 : difficulty === 'medium' ? 35 : 50),
      roleTitle,
      sophisticationLevel,
      approachHints:    parsed.approachHints || null,
      commonMistake:    parsed.commonMistake || null,
    };
  } catch (err) {
    console.error('[DSAEngine] generateDSAChallenge failed:', err);
    return getFallbackChallenge(roleTitle, difficulty, topics[0], sophisticationLevel);
  }
}

/**
 * Evaluate a DSA submission via static analysis (gpt-4o-mini only).
 * @param {object} challenge
 * @param {string} code
 * @param {string} language
 * @returns {Promise<object>} evaluation object
 */
export async function evaluateDSASubmission(challenge, code, language = 'javascript') {
  const safety = rejectUnsafeCode(code);
  if (safety.rejected) {
    return {
      passed: false,
      correctness: 0,
      codeQuality: 0,
      overallScore: 0,
      feedback: `Submission rejected: ${safety.pattern}`,
      candidateFacingFeedback: 'Your submission contained patterns that are not allowed in this challenge environment.',
      strengths: [],
      improvements: ['Review the allowed code patterns for this challenge'],
      cimTrainingCandidate: false,
      rejectedPattern: safety.pattern,
    };
  }

  const systemPrompt = `You are evaluating a candidate's code submission. Be fair, specific, and educational.
NEVER execute code — analyze statically only.
Evaluate against the hidden test cases as thought experiments.
Return ONLY valid JSON — no markdown, no explanation.`;

  const userPrompt = `Challenge: ${challenge.title}
Description: ${challenge.description}
Constraints: ${challenge.constraints}
Test cases (visible): ${JSON.stringify(challenge.testCases || [])}
Hidden test cases: ${JSON.stringify(challenge.hiddenTestCases || [])}

Candidate's ${language} submission (${code.length} chars):
\`\`\`${language}
${code.slice(0, 3000)}
\`\`\`

Evaluate and return JSON:
{
  "passed": boolean,
  "correctness": 0-100,
  "timeComplexity": { "stated": "O(?)", "actual": "O(?)", "isOptimal": boolean, "optimalSolution": "O(?)" },
  "spaceComplexity": { "stated": "O(?)", "actual": "O(?)" },
  "codeQuality": 0-100,
  "approach": { "used": "...", "alternative": "...", "explanation": "..." },
  "patternRecognition": { "identified": boolean, "pattern": "...", "missed": "..." },
  "overallScore": 0-100,
  "feedback": "specific 2-3 sentence feedback for recruiter",
  "candidateFacingFeedback": "encouraging, constructive, non-revealing feedback for candidate",
  "strengths": ["...", "..."],
  "improvements": ["...", "..."],
  "cimTrainingCandidate": boolean
}`;

  try {
    const res = await fetch(`${API_BASE}/api/ai/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: userPrompt,
        options: {
          systemPrompt,
          temperature: 0.2,
          maxTokens: 1200,
          model: 'gpt-4o-mini', // FORCED — security + accuracy requirement
        },
      }),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const result = await res.json();
    const text = (result.data || '').replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(text);
  } catch (err) {
    console.error('[DSAEngine] evaluateDSASubmission failed:', err);
    return {
      passed: false,
      correctness: 0,
      codeQuality: 0,
      overallScore: 0,
      feedback: 'Evaluation service temporarily unavailable.',
      candidateFacingFeedback: 'Your submission was received but could not be evaluated right now. Please try again.',
      strengths: [],
      improvements: [],
      cimTrainingCandidate: false,
    };
  }
}

/**
 * Generate a human-readable DSA report for recruiter display.
 * @param {object} challenge
 * @param {object} evaluation
 * @param {number} timeTaken — seconds
 * @returns {object}
 */
export function generateDSAReport(challenge, evaluation, timeTaken = 0) {
  const minutes = Math.round(timeTaken / 60);
  const est     = challenge.estimatedMinutes || 30;

  return {
    challengeTitle: challenge.title,
    difficulty:     challenge.difficulty,
    topic:          challenge.topic,
    timeTaken:      `${minutes} min`,
    estimatedTime:  `${est} min`,
    efficiency:     minutes <= est ? 'within time' : `${minutes - est} min over`,
    overallScore:   evaluation.overallScore ?? 0,
    passed:         evaluation.passed ?? false,
    correctness:    evaluation.correctness ?? 0,
    codeQuality:    evaluation.codeQuality ?? 0,
    timeComplexity: evaluation.timeComplexity?.actual || 'unknown',
    approach:       evaluation.approach?.used || 'unknown',
    recruiterFeedback:  evaluation.feedback || '',
    strengths:      evaluation.strengths || [],
    improvements:   evaluation.improvements || [],
  };
}

/**
 * Candidate-facing feedback summary (no solution revealed).
 * @param {object} evaluation
 * @returns {object}
 */
export function exportDSAFeedback(evaluation) {
  return {
    overallScore:   evaluation.overallScore ?? 0,
    passed:         evaluation.passed ?? false,
    feedback:       evaluation.candidateFacingFeedback || 'Thank you for completing the challenge.',
    strengths:      (evaluation.strengths || []).slice(0, 2),
    improvement:    (evaluation.improvements || [])[0] || '',
    // NO solution revealed
  };
}

// ─── FALLBACK CHALLENGE ────────────────────────────────────────────────────────

function getFallbackChallenge(roleTitle, difficulty, topic, sophisticationLevel) {
  return {
    challengeId: crypto.randomUUID(),
    title: 'Two Sum',
    description: 'Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target. You may assume each input has exactly one solution, and you may not use the same element twice.',
    examples: [
      { input: 'nums = [2,7,11,15], target = 9', output: '[0,1]', explanation: 'nums[0] + nums[1] == 9, return [0, 1]' },
      { input: 'nums = [3,2,4], target = 6', output: '[1,2]', explanation: '' },
    ],
    constraints: 'O(n) time complexity expected. 2 ≤ nums.length ≤ 10⁴, -10⁹ ≤ nums[i] ≤ 10⁹',
    starterCode: { javascript: 'function twoSum(nums, target) {\n  // your solution here\n}' },
    testCases: [
      { input: '[2,7,11,15], 9', expected: '[0,1]' },
      { input: '[3,2,4], 6',     expected: '[1,2]' },
    ],
    hiddenTestCases: [
      { input: '[3,3], 6',      expected: '[0,1]' },
      { input: '[-1,-2,-3], -5', expected: '[1,2]' },
    ],
    difficulty,
    topic: topic || 'arrays_strings',
    estimatedMinutes: 20,
    roleTitle,
    sophisticationLevel,
    approachHints: 'Consider a hash map to store complements.',
    commonMistake: null,
  };
}

export default {
  TOPIC_MAP,
  rejectUnsafeCode,
  hashCode,
  generateDSAChallenge,
  evaluateDSASubmission,
  generateDSAReport,
  exportDSAFeedback,
};
