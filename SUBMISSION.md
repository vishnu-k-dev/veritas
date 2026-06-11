# Far Away 2026 — Hackathon Submission

## Project Name
**VERITAS — Evidence-Based AI Examination System**

## Theme
**Examinations** — Reimagine the future of examinations with secure, fair and intelligent solutions.

## Live Demo
→ `http://localhost:5173/exam` (run locally — see setup below)

## GitHub Repository
→ This repository

---

## The Problem

Anyone can claim "full-stack developer" on a CV. GitHub contributions can be forked, plagiarised, or inflated. Traditional exams test memory of facts, not whether the candidate actually built what they claim.

There is no trusted, scalable way to verify authorship of technical work.

---

## Our Solution

VERITAS is an AI examination system that uses a candidate's own GitHub repository as the question paper.

1. Paste a public GitHub repo URL
2. VERITAS reads your commits, file structure, languages, and architecture
3. Groq/Llama-3.3-70b generates 5 questions — each traced to a specific commit or design decision
4. You answer in a proctored written examination (paste blocked, tab switches logged)
5. Answers are evaluated in real time on 5 dimensions: Authenticity, Depth, Specificity, Communication, Consistency
6. A verifiable certificate is issued with a unique ID and a shareable public URL

**No login required. No question bank. No way to prepare except by actually building the project.**

---

## Innovation

### Repository-Aware Questioning
Every question cites the evidence that triggered it — a commit message, a library choice, an architectural pattern. A candidate who copy-pasted the repo cannot answer "why did you switch from Prisma to raw SQL in commit `a3f9c2b`?"

### Honest Scoring — No Floor
Most AI evaluation systems set artificial score floors to avoid uncomfortable zeros. VERITAS does not. A one-word answer scores 5–10. Depth is rewarded, not participation.

### Deterministic Repo Analysis
Framework detection, architecture classification, and system type inference run without any LLM. Zero AI cost for analysis; fully reproducible results.

### Shareable Certificate
After the exam, a certificate is stored server-side at `/verify/:id`. Anyone with the link can verify the examination was real, read the scores, and confirm the repo.

---

## Technical Implementation

| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite 7 + Framer Motion |
| Styling | Tailwind CSS v4 · parchment editorial design system |
| Backend | Node.js + Express 5 |
| AI | Groq API · Llama-3.3-70b-versatile · 4 dedicated keys |
| GitHub | REST API v3 · unauthenticated · ~7 calls per session |
| Repo Analysis | Deterministic rule-based engine (zero LLM) |
| Certificates | In-memory Map · `/verify/:id` public route |

**4-key Groq architecture** — separate API keys per role so rate limits never cross-contaminate:

| Key | Role |
|---|---|
| `GROQ_KEY_ANALYSIS` | Context analysis & orchestration fallback |
| `GROQ_KEY_QUESTIONS` | Viva question generation |
| `GROQ_KEY_EVALUATOR` | Per-answer analysis (authenticity, depth, specificity…) |
| `GROQ_KEY_SCORING` | Composite score computation |

**Proctoring (pure JS, no extensions):**
- `visibilitychange` — tab switch triggers full-screen overlay + strike counter
- `paste` event — blocked and counted
- `copy` event — tracked throughout exam
- Typing velocity — >200 WPM flagged as anomalous
- Right-click and text selection disabled on question cards
- All violations included in integrity report at certificate stage

**Score dimensions:**

| Dimension | Weight | What it measures |
|---|---|---|
| Authenticity | 45% | Files, error messages, config values cited |
| Depth | 25% | WHY and tradeoffs, not just WHAT |
| Specificity | 15% | Numbers, paths, names |
| Communication | 10% | Clarity and structure |
| Consistency | 5% | Coherence across all answers |

---

## Judging Criteria Alignment

| Criterion | VERITAS |
|---|---|
| **Innovation** | Questions generated from the candidate's own git history — no question bank possible |
| **Security & Fairness** | Paste blocked, tab switches logged, no memorisable question set |
| **Technical Depth** | 4-key Groq, deterministic repo analysis, 5-dimension scoring engine |
| **Real-World Impact** | Applicable to college project viva, hiring screens, hackathon judging |
| **Execution** | Full working flow: repo → exam → grade card → shareable certificate |

---

## Local Setup

### Prerequisites
- Node.js 18+
- 4 Groq API keys (free at [console.groq.com](https://console.groq.com))

### Backend
```bash
cd "Far Away/VERITAS/backend"
npm install
# create backend/.env with GROQ keys (see README)
node server.js
```

### Frontend
```bash
cd "Far Away/VERITAS"
npm install
npm run dev
```

### Start the exam
Open `http://localhost:5173/exam` — no login required.

---

*Far Away 2026 · Examinations Theme*
