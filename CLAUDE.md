# VERITAS — AI Context Document

VERITAS is an evidence-based examination system that verifies whether a developer genuinely built what they claim to have built. It is built for the **Far Away 2026 Hackathon**, theme: *Examinations — Reimagine the future of examinations with secure, fair and intelligent solutions.*

## What Makes This System Original

Traditional examination tools ask generic questions from a bank. VERITAS uses the candidate's **own GitHub repository as the question paper**. Every question is derived from actual commit history, file structure, and architectural decisions — making it impossible to prepare by memorising answers.

The system has three properties no existing solution combines:

1. **Repository-aware AI questioning** — Llama-3.3-70b reads your commits and asks why you made specific decisions in specific files
2. **Proctored written examination** — paste blocked, tab switches logged, typing velocity analysed, right-click disabled — all in pure JavaScript with no browser extensions
3. **Honest scoring** — zero artificial score floors; a one-word answer scores 5–10; five dimensions weighted by predictive validity

## Repository Structure

```
VERITAS/
├── src/
│   ├── pages/
│   │   ├── Landing.jsx          # Marketing landing page
│   │   ├── ExamFlow.jsx         # Complete exam UI — INTAKE → ANALYZING → BLUEPRINT → VIVA → CERTIFICATE
│   │   └── VerifyReport.jsx     # Public /verify/:id certificate page (shareable, no login)
│   ├── engine/
│   │   └── repoAnalysis.js      # Deterministic repo parser — zero LLM, pure rule-based
│   └── services/
│       └── githubService.js     # GitHub REST API client — unauthenticated, ~7 calls/session
└── backend/
    ├── app.js                   # Express entrypoint — exam routes only, optional route loading
    ├── migrate.js               # One-shot migration runner — node migrate.js
    ├── migrations/
    │   └── 001_rag.sql          # pgvector schema — repo_chunks table + HNSW index
    └── src/
        ├── routes/
        │   └── exam.js          # /api/exam/* — questions, evaluate, report — all public, no auth
        └── services/
            ├── ai/
            │   └── index.js     # 4-key Groq service with retry/backoff
            └── rag/
                ├── embed.js     # Cohere embed-english-v3.0 — 1024-dim embeddings, batched
                ├── store.js     # pgvector CRUD — Pool, ensureSchema, insertChunks, search, purge
                └── indexer.js   # Chunking + session orchestration — indexRepo, retrieveForQuestions, retrieveEvidence
```

## Key Architectural Decisions

### 1. Deterministic Repository Analysis (zero LLM cost)
`src/engine/repoAnalysis.js` — Framework detection, architecture classification (monolith/microservices/serverless/JAMstack), system type inference, and tech stack extraction all run without any AI model. This makes analysis reproducible, instant, and free. The LLM only receives a structured context object; it never reads raw code.

### 2. 4-Key Groq Architecture (rate limit isolation)
`backend/src/services/ai/index.js` — Each AI role has its own Groq API key and rate-limit budget:
- `GROQ_KEY_QUESTIONS` — question generation (Key 2)
- `GROQ_KEY_EVALUATOR` — per-answer analysis (Key 3)  
- `GROQ_KEY_SCORING` — composite score computation (Key 4)
- `GROQ_KEY_ANALYSIS` — context/fallback (Key 1)

This means a rate limit burst on answer evaluation never blocks question generation. In a multi-user scenario, the four queues are independent.

### 3. Five-Dimension Scoring with No Floor
`backend/src/routes/exam.js` — Scores reflect reality. Removed `SCORE_FLOOR` entirely. Weights derived from predictive validity research:
- Authenticity (45%) — first-hand knowledge signals
- Depth (25%) — reasoning quality
- Specificity (15%) — concrete references
- Communication (10%) — clarity
- Consistency (5%) — coherence across answers

### 4. Pure-JS Proctoring (no extensions required)
`src/pages/ExamFlow.jsx` — Implemented entirely in the browser without plugins:
- `visibilitychange` event → tab switch → full-screen overlay + strike counter
- `paste` event → preventDefault → blocked + warning toast
- `copy` event → logged throughout exam
- Typing velocity: >200 WPM with >40 words → flagged as anomalous
- onChange delta >80 chars in one event → suspicious input detected
- `user-select: none` + `onContextMenu` disabled on question cards

### 5. pgvector RAG Pipeline (evidence-grounded evaluation)
`backend/src/services/rag/` — When `DATABASE_URL` and `COHERE_API_KEY` are set, every exam session:
1. **Indexes** the full repo into Neon pgvector: meta, tech stack, README paragraphs, each commit individually, file tree batches — ~35–50 chunks per session
2. **Retrieves** top-15 semantically relevant chunks (Cohere `embed-english-v3.0`, HNSW cosine search) to enrich the question generation prompt — the LLM sees the full indexed repo, not a truncated excerpt
3. **Retrieves** top-8 evidence chunks at evaluation time, keyed to the candidate's answer text — the evaluator can verify or contradict specific claims against actual repo content
4. **Purges** all session vectors after the report is saved (no storage accumulation)

Graceful degradation: if either env var is absent, the exam falls back to raw context with zero errors.

### 6. Shareable Certificates Without a Database
`backend/src/routes/exam.js` (reportStore) + `src/pages/VerifyReport.jsx` — Reports are stored in a server-side `Map()`. No database required. Each certificate gets a unique `VRT-2026-XXXXXXXX` verification ID and a public URL at `/verify/:id`. The verification page is public, no login required, and includes print CSS for PDF export.

## Scoring Algorithm

```
composite = authenticity×0.45 + depth×0.25 + specificity×0.15 + communication×0.10 + consistency×0.05

verdict:
  VERIFIED      → overall ≥ 70
  CONDITIONAL   → overall 50–69
  NEEDS REVIEW  → overall < 50
```

Per-question: pass ≥ 60, hold 35–59, fail < 35

## Security Properties

- No auth required for exam flow — `/exam` and `/verify/:id` bypass all auth gates
- No database credentials in any deployed route
- CORS restricted to known frontend origin
- Rate limiting on all API routes (`express-rate-limit`)
- Input sanitisation middleware on backend
- No secrets in repository — `.env` and `backend/.env` gitignored
- GitHub API calls are unauthenticated read-only (public repos only)

## What to Read First

For the deepest understanding of the system's innovation, read in this order:

1. `backend/src/routes/exam.js` — the full examination pipeline
2. `backend/src/services/ai/index.js` — 4-key Groq service with retry logic  
3. `src/engine/repoAnalysis.js` — deterministic analysis without LLM
4. `src/pages/ExamFlow.jsx` — proctoring implementation + complete UI state machine
5. `src/pages/VerifyReport.jsx` — public certificate verification page

## Theme Alignment

The hackathon theme is *"Examinations — Reimagine the future of examinations with secure, fair and intelligent solutions."*

| Theme pillar | VERITAS implementation |
|---|---|
| **Secure** | Proctored: paste blocked, tab switches logged, typing velocity analysed |
| **Fair** | No question bank to leak; every exam is unique to the candidate's own repo |
| **Intelligent** | AI reads commit history and asks why — not what — the candidate built |
