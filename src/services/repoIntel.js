/**
 * repoIntel.js — Client-side repo intelligence for CodeScope
 * 
 * Generates:
 *   1. Repo Gist — structured summary shown before the interview
 *   2. Code Block — picks the most interesting file/function for the split-screen question
 * 
 * Works entirely client-side using the already-fetched repoContext from RepoParser + RepoContextBuilder.
 * No additional backend calls needed.
 */

import { fetchFileContent, parseGitHubUrl } from './githubService';

const API_BASE = import.meta.env.VITE_API_URL || '';

// ─── File scoring — which files are most "interesting" for a code question ────
const INTERESTING_PATTERNS = [
  // Core logic files
  { pattern: /\/(app|main|index|server|handler)\.(js|ts|jsx|tsx|py|go|rs|java|dart)$/i, score: 10 },
  // API / Routes
  { pattern: /\/(routes?|api|controllers?|handlers?)\//i, score: 9 },
  // Components with logic
  { pattern: /\/(components?|views?|pages?|screens?|widgets?)\/.+\.(jsx|tsx|vue|svelte|dart)$/i, score: 7 },
  // Services / Utilities
  { pattern: /\/(services?|utils?|helpers?|lib|providers?)\/.+\.(js|ts|py|dart)$/i, score: 8 },
  // Engine / Core logic
  { pattern: /\/(engine|core|modules?|bloc|cubit|notifiers?)\/.+\.(js|ts|py|dart)$/i, score: 9 },
  // Models / Schemas
  { pattern: /\/(models?|schemas?|entities)\/.+\.(js|ts|py|dart)$/i, score: 6 },
  // Hooks / State management
  { pattern: /\/(hooks?|state|store)\/.+\.(js|ts|jsx|tsx|dart)$/i, score: 7 },
  // Config files (less interesting)
  { pattern: /\/(config|\.env|webpack|vite|next\.config)/i, score: 2 },
  // Test files (moderately interesting)
  { pattern: /\/(tests?|__tests__|spec|test_)\//i, score: 4 },
];

// Files to skip entirely
const SKIP_PATTERNS = [
  /node_modules/i,
  /dist\//i,
  /build\//i,
  /\.git\//i,
  /\.lock$/i,
  /\.min\.(js|css)$/i,
  /package-lock\.json$/i,
  /yarn\.lock$/i,
  /pubspec\.lock$/i,
  /\.map$/i,
  /\.svg$/i,
  /\.png$/i,
  /\.jpg$/i,
  /\.ico$/i,
  /\.woff/i,
  /\.ttf$/i,
  /LICENSE/i,
  /CHANGELOG/i,
  /\.md$/i,
  /\.txt$/i,
  /\.gitignore$/i,
  /\.env/i,
  /\.g\.dart$/i,       // generated dart files
  /\.freezed\.dart$/i,  // freezed generated
  /generated_plugin_registrant/i,
  /\.gradle/i,
  /Pods\//i,
  /ios\/Runner/i,
  /android\/app\/src\/main\/java\/io/i,
];

// Language detection for syntax highlighting
const LANG_MAP = {
  js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript',
  py: 'python', rb: 'ruby', go: 'go', rs: 'rust', java: 'java',
  dart: 'dart', kt: 'kotlin', swift: 'swift',
  css: 'css', html: 'html', json: 'json', yaml: 'yaml', yml: 'yaml',
  sql: 'sql', sh: 'bash', bash: 'bash', vue: 'javascript', svelte: 'javascript',
};

function detectLanguage(filePath) {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  return LANG_MAP[ext] || 'text';
}

function scoreFile(filePath, fileSize) {
  // Skip unwanted files
  if (SKIP_PATTERNS.some(p => p.test(filePath))) return -1;
  
  // Skip very small (<50 bytes) or very large (>50KB) files
  if (fileSize < 50 || fileSize > 50000) return -1;

  let score = 5; // base
  
  for (const { pattern, score: bonus } of INTERESTING_PATTERNS) {
    if (pattern.test(filePath)) {
      score = Math.max(score, bonus);
    }
  }
  
  // Prefer files in the sweet spot (500-5000 bytes)
  if (fileSize >= 500 && fileSize <= 5000) score += 2;
  else if (fileSize >= 200 && fileSize <= 10000) score += 1;
  
  return score;
}

/**
 * Find the most interesting code block in a file content
 * Returns a subset of lines with context about what the block does
 */
function findInterestingBlock(content, filePath) {
  const lines = content.split('\n');
  if (lines.length < 5) return null;
  
  // Find function/class/handler definitions
  const blockStarters = [];
  const funcPatterns = [
    // JS/TS
    /^(?:export\s+)?(?:async\s+)?function\s+(\w+)/,
    /^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:\(|=>\s*\()/,
    /^(?:export\s+)?class\s+(\w+)/,
    // Python
    /^(?:async\s+)?def\s+(\w+)/,
    /^class\s+(\w+)/,
    // Go
    /^func\s+(?:\(\w+\s+\*?\w+\)\s+)?(\w+)/,
    // Dart/Flutter
    /^\s*(?:Future<|void\s+|Widget\s+|String\s+|int\s+|bool\s+|dynamic\s+|List<|Map<|State<)?\s*(\w+)\s*\(/,
    /^\s*class\s+(\w+)/,
    // Router/handler
    /^\s*(?:router|app)\.(get|post|put|delete|patch|use)\s*\(/i,
  ];
  
  lines.forEach((line, i) => {
    for (const pattern of funcPatterns) {
      const match = line.match(pattern);
      if (match) {
        blockStarters.push({
          lineNum: i,
          name: match[1] || match[0].trim().slice(0, 40),
          line: line.trim(),
        });
      }
    }
  });
  
  if (blockStarters.length === 0) {
    // No function found — return first meaningful chunk (skip imports)
    let startLine = 0;
    for (let i = 0; i < lines.length; i++) {
      if (!/^(import|from|require|\/\/|\/\*|\*|#|part |library |$)/.test(lines[i].trim())) {
        startLine = i;
        break;
      }
    }
    const endLine = Math.min(startLine + 25, lines.length);
    return {
      startLine: startLine + 1,
      endLine,
      code: lines.slice(startLine, endLine).join('\n'),
      functionName: filePath.split('/').pop(),
      totalLines: lines.length,
    };
  }
  
  // Pick the most "interesting" function — prefer non-obvious logic patterns
  const boringNames = /^(constructor|get|set|toString|toJSON|render|componentDidMount|useEffect|build|initState|dispose|createState)$/i;
  const scored = blockStarters.map(b => {
    let interestScore = boringNames.test(b.name) ? 1 : 5;

    // Boost for non-obvious logic patterns (v3)
    const blockEnd   = Math.min(b.lineNum + 50, lines.length);
    const blockText  = lines.slice(b.lineNum, blockEnd).join('\n');

    if (/\btry\b|\bcatch\b|\.catch\b|onError/i.test(blockText))           interestScore += 3; // error handling
    if ((blockText.match(/\bif\b/g) || []).length >= 2)                    interestScore += 2; // multiple conditionals
    if (/\basync\b|\bawait\b|\bPromise\b/.test(blockText))                 interestScore += 2; // async patterns
    if (/retry|backoff|attempt|maxAttempts/i.test(blockText))              interestScore += 4; // retry/backoff
    if (/migrat|switch|replac|upgrad/i.test(blockText))                    interestScore += 3; // migration/switch logic
    if (/Map\(|Set\(|WeakMap|LinkedList|heap|trie|graph|adjacency/i.test(blockText)) interestScore += 3; // unusual data structure
    if (/throttle|debounce|memoize|cache|memo/i.test(blockText))           interestScore += 2; // performance optimization

    return { ...b, interestScore };
  });
  scored.sort((a, b) => b.interestScore - a.interestScore);
  
  const chosen = scored[0];
  const startLine = chosen.lineNum;
  
  // Find the end of this function (look for matching closing brace or next function)
  let endLine = startLine + 1;
  let braceDepth = 0;
  let foundOpen = false;
  
  for (let i = startLine; i < lines.length && i < startLine + 50; i++) {
    for (const ch of lines[i]) {
      if (ch === '{') { braceDepth++; foundOpen = true; }
      if (ch === '}') braceDepth--;
    }
    endLine = i + 1;
    if (foundOpen && braceDepth <= 0 && i > startLine) break;
  }
  
  // Clamp to reasonable size (10-35 lines)
  endLine = Math.min(endLine, startLine + 35);
  if (endLine - startLine < 10) endLine = Math.min(startLine + 15, lines.length);
  
  return {
    startLine: startLine + 1, // 1-indexed
    endLine,
    code: lines.slice(startLine, endLine).join('\n'),
    functionName: chosen.name,
    totalLines: lines.length,
  };
}

/**
 * Build a rich 100-200 word project summary from repo context data
 * Deterministic — no AI call needed
 */
function buildProjectSummary(ctx) {
  const {
    projectName = 'Unknown',
    projectDescription = '',
    techStack = {},
    architecture = {},
    developmentHistory = {},
    documentation = {},
  } = ctx;

  const frameworks = (techStack.frameworks || []).map(f => f.name);
  const languages = (techStack.languages || []).map(l => l.replace(/\s*\(.*\)/, ''));
  const deps = techStack.keyDependencies || [];
  const totalFiles = architecture.totalFiles || 0;
  const totalDeps = techStack.totalDependencies || deps.length;
  const pattern = architecture.pattern || 'standard';
  const layers = architecture.layers || [];
  const totalCommits = developmentHistory.totalCommitsAnalyzed || 0;
  const authors = developmentHistory.authors || [];
  const docSummary = documentation?.summary || '';
  const readmeDesc = docSummary.length > projectDescription.length ? docSummary : projectDescription;

  const parts = [];

  // Opening sentence
  const langStr = languages.slice(0, 3).join(', ') || 'multiple languages';
  const fwStr = frameworks.length > 0 ? ` using ${frameworks.slice(0, 3).join(', ')}` : '';
  parts.push(`${projectName} is a ${langStr}-based project${fwStr}.`);

  // Description from README or GitHub
  if (readmeDesc && readmeDesc.length > 10) {
    const cleaned = readmeDesc.replace(/[#*`]/g, '').trim();
    const sentences = cleaned.split(/(?<=[.!?])\s+/).filter(s => s.length > 10);
    if (sentences.length > 0) {
      parts.push(sentences.slice(0, 3).join(' '));
    }
  }

  // Architecture
  if (pattern && pattern !== 'standard') {
    parts.push(`The project follows a ${pattern} architecture${layers.length > 0 ? ` with distinct ${layers.slice(0, 4).join(', ')} layers` : ''}.`);
  } else if (layers.length > 0) {
    parts.push(`It is organized into ${layers.slice(0, 4).join(', ')} layers.`);
  }

  // Scale
  const scaleItems = [];
  if (totalFiles > 0) scaleItems.push(`${totalFiles} files`);
  if (totalDeps > 0) scaleItems.push(`${totalDeps} dependencies`);
  if (totalCommits > 0) scaleItems.push(`${totalCommits} commits`);
  if (scaleItems.length > 0) {
    parts.push(`The codebase spans ${scaleItems.join(', ')}.`);
  }

  // Key dependencies
  const notableDeps = deps.filter(d => !['react', 'vue', 'angular', 'next', 'express', 'flask', 'django', 'flutter'].includes(d.toLowerCase())).slice(0, 5);
  if (notableDeps.length > 0) {
    parts.push(`Key dependencies include ${notableDeps.join(', ')}.`);
  }

  // Contributors
  if (authors.length === 1) {
    parts.push(`The project was developed by a single contributor (${authors[0]}).`);
  } else if (authors.length > 1) {
    parts.push(`The project was developed by ${authors.length} contributors including ${authors.slice(0, 2).join(' and ')}.`);
  }

  return parts.join(' ').slice(0, 1200); // Safety cap
}

/**
 * Generate a structured gist from repoContext
 * This runs entirely client-side — no AI call needed
 */
export function generateRepoGist(repoContext) {
  if (!repoContext) return null;
  
  const {
    projectName = 'Unknown Project',
    projectDescription = '',
    techStack = {},
    architecture = {},
    developmentHistory = {},
    documentation = {},
  } = repoContext;
  
  const frameworks = (techStack.frameworks || []).map(f => f.name);
  const languages = techStack.languages || [];
  const deps = (techStack.keyDependencies || []).slice(0, 10);
  const dirs = (architecture.topDirectories || [])
    .filter(d => !['node_modules', 'dist', 'build', '.git', '.github', '.vscode', 'ios', 'android', 'web', 'linux', 'macos', 'windows', '.idea', '.dart_tool'].includes(d))
    .slice(0, 8);
  const pattern = architecture.pattern || 'standard';
  const layers = architecture.layers || [];
  
  // Build a proper 100-200 word project summary
  const summary = buildProjectSummary(repoContext);
  const description = projectDescription || documentation?.summary || '';
  
  // Use raw commits if available (has sha + message), fall back to keyCommits
  const rawCommits = developmentHistory.rawCommits || [];
  const keyCommits = developmentHistory.keyCommits || [];
  const commits = rawCommits.length > 0
    ? rawCommits.slice(0, 5).map(c => ({
        sha: (c.sha || '').slice(0, 7),
        message: (c.message || '').split('\n')[0].slice(0, 80),
      }))
    : keyCommits.slice(0, 5).map(c => ({
        sha: c.sha || '',
        message: (c.message || '').slice(0, 80),
      }));
  
  // Total files from architecture
  const totalFiles = architecture.totalFiles || 0;
  
  // Total dependencies — use actual count, not sliced array
  const totalDeps = techStack.totalDependencies || deps.length;
  
  // Total commits analyzed
  const totalCommits = developmentHistory.totalCommitsAnalyzed || rawCommits.length;
  
  // Build focus areas — what VERITAS will ask about
  const focusAreas = [];
  if (frameworks.length > 0) focusAreas.push(`How you set up and configured ${frameworks[0]}`);
  if (layers.includes('api') || dirs.some(d => /api|routes|server/.test(d))) {
    focusAreas.push('Your API architecture and data flow');
  }
  if (layers.includes('services') || layers.includes('engine')) {
    focusAreas.push('Your core business logic and service layer');
  }
  if (dirs.some(d => /screens|pages|views|widgets/.test(d))) {
    focusAreas.push('Your UI architecture and screen navigation');
  }
  if (deps.length > 3 || totalDeps > 3) focusAreas.push('How your dependencies work together');
  if (dirs.length > 3) focusAreas.push('Your project structure and code organization');
  if (commits.length > 0) focusAreas.push('Your development process and key decisions');
  if (focusAreas.length < 2) focusAreas.push('How you built and debugged this project');
  
  return {
    projectName,
    description,
    summary,
    languages,
    frameworks,
    dependencies: deps,
    directories: dirs,
    architecturePattern: pattern,
    layers,
    totalFiles,
    totalDeps,
    totalCommits,
    recentCommits: commits,
    focusAreas: focusAreas.slice(0, 4),
  };
}

/**
 * Pick the best code block from the repo for the CodeScope question
 * Fetches actual file content from GitHub
 */
export async function pickCodeBlock(repoContext) {
  if (!repoContext?.repoUrl) return null;
  
  const parsed = parseGitHubUrl(repoContext.repoUrl);
  if (!parsed) return null;
  
  const { owner, repo } = parsed;
  const branch = repoContext.projectMeta?.defaultBranch || repoContext.defaultBranch || 'main';
  
  // Get the full file tree — prefer architecture.fileTree (which now has raw tree data)
  const tree = repoContext.architecture?.fileTree || [];
  
  if (tree.length === 0) {
    console.warn('CodeScope: No file tree available. Skipping code block pick.');
    return null;
  }
  
  // Score and sort files
  const scoredFiles = tree
    .filter(f => f.type === 'blob')
    .map(f => ({ ...f, score: scoreFile(f.path, f.size || 1000) }))
    .filter(f => f.score > 0)
    .sort((a, b) => b.score - a.score);
  
  if (scoredFiles.length === 0) {
    console.warn('CodeScope: No interesting files found in tree.');
    return null;
  }
  
  // Try top 5 candidates until we find one with good content
  for (const file of scoredFiles.slice(0, 5)) {
    try {
      const content = await fetchFileContent(owner, repo, file.path, branch);
      if (!content || content.length < 100) continue;
      
      const block = findInterestingBlock(content, file.path);
      if (!block || block.code.length < 50) continue;
      
      const language = detectLanguage(file.path);
      
      // Generate a question about this code block (async: tries AI first, falls back to enriched template)
      const question = await generateCodeQuestion(block, file.path, repoContext);
      
      return {
        filePath: file.path,
        language,
        ...block,
        question,
        fullFileContent: content,
      };
    } catch (err) {
      console.warn(`Failed to fetch ${file.path}:`, err.message);
      continue;
    }
  }
  
  return null;
}

/**
 * Generate a code-specific question for the picked block.
 * Tries the AI endpoint first (feeds the actual snippet → question references real identifiers).
 * Falls back to an enriched template that inlines identifiers extracted from the code, seeded
 * per-candidate so two runs on the same repo produce different questions.
 */
async function generateCodeQuestion(block, filePath, repoContext) {
  const fileName = filePath.split('/').pop();
  const funcName = block.functionName || 'this code';
  const startLine = block.startLine;
  const endLine = block.endLine;
  const lang = detectLanguage(filePath);

  // 1. Try AI — it sees the actual code and writes a question grounded in it
  try {
    const aiText = await callAIForCodeQuestion({
      code: block.code,
      filePath,
      functionName: funcName,
      startLine,
      endLine,
      language: lang,
      projectName: repoContext?.projectName || 'project',
    });
    if (aiText && aiText.length > 20 && aiText.length < 400) {
      return {
        text: aiText,
        category: 'code_scope',
        difficulty: 'deep',
        probes: `Specific to ${funcName} in ${filePath}`,
        repoReference: filePath,
        expectedAnswer: `Candidate should reference the specific logic and identifiers inside ${funcName}.`,
      };
    }
  } catch (err) {
    console.warn('CodeScope AI question generation failed, using enriched fallback:', err?.message || err);
  }

  // 2. Enriched fallback — inject actual identifiers from the snippet
  const ids = extractIdentifiers(block.code);
  const id1 = ids[0] || null;
  const id2 = ids[1] || null;
  const id3 = ids[2] || null;

  // Template pool — each variant is salted with identifiers pulled from the actual code.
  // If we have 2+ identifiers, use them. If we only have 1, fall back to simpler variants.
  const richTemplates = [
    () => `In \`${funcName}\` (${fileName}:${startLine}-${endLine}), you use \`${id1}\`${id2 ? ` alongside \`${id2}\`` : ''}. Walk me through the role each plays and what happens if \`${id1}\` is missing or invalid.`,
    () => `Looking at lines ${startLine}-${endLine} of ${fileName}: your \`${funcName}\` references \`${id1}\`${id2 ? ` and \`${id2}\`` : ''}. What failure modes have you seen here, and how does the code handle them today?`,
    () => `You call \`${id1}\` inside \`${funcName}\`${id2 ? ` before touching \`${id2}\`` : ''}. Why that order — what would change if you swapped it or removed \`${id1}\`?`,
    () => `In ${fileName} your \`${funcName}\` branches on \`${id1}\`${id3 ? ` and later on \`${id3}\`` : ''}. Give me a concrete input where this function takes the ${id3 ? 'second' : 'alternate'} branch — what comes out?`,
    () => `Inside \`${funcName}\` at line ${startLine}, you introduce \`${id1}\`${id2 ? ` and pair it with \`${id2}\`` : ''}. Where else in ${repoContext?.projectName || 'the project'} does \`${id1}\` flow, and is anything mutating it along the way?`,
    () => `Your \`${funcName}\` in ${fileName} uses \`${id1}\`. If I passed in a value that makes \`${id1}\` behave unexpectedly, what's the first line of this function that would surface the problem?`,
    () => `You chose \`${id1}\` for this data structure in \`${funcName}\` — what made you pick that over the more obvious choice, and what breaks if you switch it?`,
    () => `\`${funcName}\` retries or handles failure around \`${id1 || 'this operation'}\` — at what point during development did you realize you needed this, and what was the actual failure?`,
  ];

  const simpleTemplates = [
    () => `In ${fileName}, your \`${funcName}\` (lines ${startLine}-${endLine}) — trace a concrete input through it and tell me exactly what comes out, line by line.`,
    () => `Looking at \`${funcName}\` in ${fileName}: name the one line that would be hardest to write without reading the rest of the file, and explain why.`,
  ];

  // Seeded per-candidate so same repo → different question on re-run
  const salt = `${repoContext?.interviewId || ''}:${repoContext?.repoUrl || ''}:${Date.now() % 100000}`;
  const seed = hashString(salt);
  const pool = id1 ? richTemplates : simpleTemplates;
  const template = pool[seed % pool.length];

  return {
    text: template(),
    category: 'code_scope',
    difficulty: 'deep',
    probes: `Tests whether candidate understands ${funcName} in ${filePath}`,
    repoReference: filePath,
    expectedAnswer: `A genuine builder would explain what ${funcName} does in terms of its actual identifiers (${ids.slice(0, 3).join(', ') || 'its variables'}), describe data flow, and connect it to the rest of the project.`,
  };
}

/**
 * POST the snippet to /api/ai/generate asking for one specific code-review question.
 */
async function callAIForCodeQuestion({ code, filePath, functionName, startLine, endLine, language, projectName }) {
  const userPrompt = `Below is a code snippet from a candidate's project. Generate ONE probing code-review question (1-2 sentences) that:
- references a SPECIFIC identifier, branch, call, or literal value from the snippet
- cannot be answered without actually reading this code
- targets NON-OBVIOUS logic: conditionals, error handling, async flows, retry patterns
- asks "WHY did you structure it this way?" or "what were you preventing?" — NOT "what does this function do?"
- if code has if/else: ask about a SPECIFIC branch condition and what it guards
- if code has try/catch: ask about failure modes and recovery strategy
- if code has async/await: ask about timing/ordering and what breaks if order changes
- if code has retry/backoff: ask what failure prompted this pattern
- if code has an unusual data structure: ask why not the obvious choice
- is NOT a generic "walk me through your approach" or "what tradeoffs" question

File: ${filePath} (lines ${startLine}-${endLine})
Function: ${functionName}
Project: ${projectName}

\`\`\`${language}
${code}
\`\`\`

Return ONLY the question text — no quotes, no preamble, no markdown.`;

  const systemPrompt = `You are a senior engineer conducting an evidence-based competency examination.
Every question you write MUST name at least one identifier (variable, function, or call) that appears in the provided snippet.
Never write generic questions that could apply to any codebase.
Prefer questions that reveal WHY the candidate made a specific decision — not WHAT the code does.
Output only the question text.`;

  const res = await fetch(`${API_BASE}/api/ai/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: userPrompt,
      options: { temperature: 0.8, maxTokens: 180, systemPrompt },
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const result = await res.json();
  return (result.data || '').trim().replace(/^["'`]|["'`]$/g, '');
}

/**
 * Extract candidate identifiers (variable/function names) from a code snippet, top-N by frequency.
 * Excludes language keywords and very short names.
 */
const IDENT_STOPWORDS = new Set([
  'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'do', 'switch',
  'case', 'break', 'continue', 'new', 'class', 'extends', 'super', 'this', 'import', 'export',
  'from', 'as', 'default', 'async', 'await', 'try', 'catch', 'finally', 'throw', 'typeof',
  'instanceof', 'in', 'of', 'delete', 'void', 'null', 'undefined', 'true', 'false', 'static',
  'public', 'private', 'protected', 'interface', 'type', 'enum', 'def', 'lambda', 'pass',
  'elif', 'and', 'or', 'not', 'is', 'None', 'True', 'False', 'self', 'yield', 'raise', 'with',
  'global', 'nonlocal', 'print', 'func', 'package', 'struct', 'chan', 'go', 'defer', 'map',
  'range', 'nil', 'string', 'number', 'boolean', 'object', 'array', 'length', 'push', 'pop',
  'console', 'log', 'err', 'error', 'data', 'res', 'req', 'next', 'then', 'value', 'key',
]);

function extractIdentifiers(code) {
  if (!code) return [];
  const freq = new Map();
  const re = /\b([A-Za-z_$][A-Za-z0-9_$]{2,})\b/g;
  let m;
  while ((m = re.exec(code)) !== null) {
    const name = m[1];
    if (IDENT_STOPWORDS.has(name)) continue;
    freq.set(name, (freq.get(name) || 0) + 1);
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name)
    .slice(0, 5);
}

function hashString(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}


