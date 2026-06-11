# VERITAS — Architecture Deep Dive

## System Overview

VERITAS is a three-layer system: a deterministic analysis engine, an AI examination engine, and a proctored browser UI.

```
Browser (React 19)               Backend (Express 5)          External
──────────────────               ───────────────────          ────────
ExamFlow.jsx                                                  GitHub API
  |-- repo URL ──────────────────────────────────────────────────> |
  |<────────────────────── raw repo data ─────────────────────────|
  |
  |-- buildRepoContext()    [ZERO NETWORK — pure rule-based JS]
  |     repoAnalysis.js
  |     |-- framework detection
  |     |-- architecture classification
  |     +-- tech stack extraction
  |
  |-- POST /api/exam/questions ─────────────────────────> Groq Key 2
  |<─────────────────── 5 evidence-based questions ───────────────|
  |
  |  [PROCTORED EXAMINATION — 5 questions]
  |-- POST /api/exam/evaluate (x5) ────────────────────> Groq Key 3
  |                                ────────────────────> Groq Key 4
  |<───── {composite_score, verdict, strength, weakness} ─────────|
  |
  |-- POST /api/exam/report ──────────────────────> [in-memory Map]
  |<──── {verificationId, shareUrl, scores, verdict} ─────────────|
  |
  |-- /verify/:id ─────────── GET /api/exam/report/:id ──> [Map]
  |<───────────────────────────── report JSON ────────────────────|
```

## Layer 1 — Deterministic Repo Analysis

**File:** `src/engine/repoAnalysis.js`

The analysis engine never calls an LLM. It reads the raw GitHub API response and produces a structured `repoContext` object through rule-based pattern matching.

### Framework Detection
Reads `package.json` dependencies, `requirements.txt`, `go.mod`, `Cargo.toml`. Maps known packages to framework names. Result: `{ react: true, nextjs: false, express: true }`.

### Architecture Classification
Counts directories matching patterns: `services/`, `microservices/`, `functions/`, `api/routes/`, `pages/`. Classifies as: `monolith`, `microservices`, `serverless`, `JAMstack`, `MVC`, `layered`.

### System Type Inference
Reads repo name, description, README keywords, and file tree patterns. Classifies as: `web_app`, `api_server`, `cli_tool`, `library`, `mobile_app`, `data_pipeline`, `devtool`, `game`.

### Why No LLM Here
Reproducibility. Two runs on the same repo must produce identical contexts. An LLM introduces variance that propagates to questions, making each exam non-deterministic. Rule-based analysis is also instant (~200ms), free, and cannot hallucinate a tech stack.

## Layer 2 — AI Examination Engine

**File:** `backend/src/services/ai/index.js`

### 4-Key Design

Four separate Groq API keys, each mapped to one AI role:

```
GROQ_KEY_ANALYSIS   -> Key 1 — context orchestration, fallback
GROQ_KEY_QUESTIONS  -> Key 2 — viva question generation
GROQ_KEY_EVALUATOR  -> Key 3 — per-answer deep analysis
GROQ_KEY_SCORING    -> Key 4 — composite score computation
```

**Rationale:** Groq free tier has per-key rate limits (~30 req/min). Without isolation, the question-generation key could be exhausted by evaluation requests, blocking new exam starts. With isolated keys, each pipeline stage has its own independent budget.

**Temperature tuning:**
- Scoring: 0.1 — deterministic computation
- Evaluator: 0.2 — consistent analytical output
- Questions: 0.75 — creative, varied question generation

### Retry / Backoff
`call()` retries on HTTP 429 with exponential backoff: 1s -> 2s -> 4s. Maximum 3 attempts. Returns `{ success: false }` allowing the route to serve a graceful fallback rather than crashing.

### Question Prompt Design
The prompt instructs Llama-3.3-70b to:
1. Reference specific commits (`"You switched from X to Y in commit a3f9c2b — why?"`)
2. Never ask "what is X" — only WHY they chose it, HOW they debugged it, WHAT they gave up
3. Follow a structured arc: warm-up -> specific decision -> trade-off -> failure story -> pressure question
4. Return a JSON array with `{ id, question, evidence, area }` — no markdown wrapping

### Answer Evaluation
Five dimensions scored 0-100 with explicit tier rubrics. The prompt includes the full project context, all prior Q&A pairs for consistency detection, and explicit instruction: "A one-word answer like 'ok' scores 0-9 across all dimensions — no charity points."

## Layer 3 — Proctored Browser UI

**File:** `src/pages/ExamFlow.jsx`

The exam UI is a state machine: INTAKE -> ANALYZING -> BLUEPRINT -> VIVA -> CERTIFICATE.

### Proctoring Signals

```javascript
// Tab switch detection
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { integrity.tabSwitches++; showOverlay() }
})

// Paste interception — blocks the content, logs the attempt
textarea.onpaste = (e) => {
  e.preventDefault()
  integrity.pasteAttempts++
}

// Copy tracking throughout exam
document.addEventListener('copy', () => integrity.copyAttempts++)

// Typing velocity at submit time
const wpm = wordCount / ((Date.now() - firstKeystroke) / 60000)
if (wpm > 200 && wordCount > 40) integrity.suspiciousCount++

// Bulk input detection (keyboard macros, autocomplete injection)
if (newValue.length - previousLength > 80) integrity.suspiciousCount++
```

### Score Reveal Design
Scores are deliberately withheld during the exam. After submitting each answer, candidates see only: *"Answer recorded — Score will be revealed in the final report."* This prevents mid-exam strategy adjustment based on partial scores.

## Certificate Architecture

### Verification ID
```
Format: VRT-{year}-{4 random bytes as uppercase hex}
Example: VRT-2026-A3F9C2B1
Source: crypto.randomBytes(4).toString('hex').toUpperCase()
```

### Storage and Retrieval
```javascript
// backend/src/routes/exam.js
const reportStore = new Map()
// POST /api/exam/report -> reportStore.set(verificationId, report)
// GET  /api/exam/report/:id -> reportStore.get(id) ?? 404
```

No database. Reports survive server restarts only within the same process. For production, a Redis layer would be the natural upgrade — the Map interface is identical.

### Public Verification Page
`src/pages/VerifyReport.jsx` fetches the report by ID and renders the full certificate. Includes verdict bar, 3-dimension score grid, authenticity statement, and print CSS for clean PDF export. No login required — the URL is the credential.

## Security Architecture

```
express-rate-limit   100 req/15min per IP on all routes
cors                 CORS_ALLOWED_ORIGINS whitelist only
helmet               X-Content-Type-Options, X-Frame-Options, HSTS
sanitiser.js         strips XSS payloads from all request body strings
```

No credentials are stored in the repository. `render.yaml` uses `sync: false` for all secrets — Render prompts for them at deploy time. `.gitignore` excludes all `.env` variants.
