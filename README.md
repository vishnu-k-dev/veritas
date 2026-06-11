# VERITAS

> **The examination that knows what you built.**

Paste a public GitHub repository. VERITAS reads your commits, your file structure, your architectural decisions — then conducts a five-question written examination on what you *actually* built. No question bank. No generic MCQs. No way to prepare except by having genuinely built the project.

Built for **Far Away 2026** · Theme: *Examinations — Reimagine the future of examinations with secure, fair and intelligent solutions.*

---

## The Problem

The credibility infrastructure for technical skills is broken at every level:

- A developer lists "built a full-stack e-commerce platform" — it's a YouTube tutorial they followed
- A student submits a final-year project — it's a GitHub repo they found and barely modified  
- A candidate says "I know React deeply" — they memorised answers from interview prep sites

Traditional solutions fail because they ask generic questions that any LLM can answer and any determined person can memorise. The question bank *is* the vulnerability.

**VERITAS eliminates the question bank entirely.** Your own repository is the exam paper.

---

## How It Works

```
┌─────────────────────────────────────────────────────────────────────┐
│                        VERITAS PIPELINE                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  GitHub Repo URL                                                    │
│       │                                                             │
│       ▼                                                             │
│  GitHub REST API  ──── 7 calls, unauthenticated ────────────────── │
│  (metadata · commits · languages · file tree · README · package)   │
│       │                                                             │
│       ▼                                                             │
│  Deterministic Repo Analysis  ──── ZERO LLM COST ──────────────── │
│  (framework detect · architecture classify · tech stack extract)   │
│       │                                                             │
│       ▼                                                             │
│  Groq / Llama-3.3-70b  ──── Key 2: Question Generation ─────────  │
│  5 questions, each citing a specific commit or design decision      │
│       │                                                             │
│       ▼                                                             │
│  Proctored Written Examination                                      │
│  (paste blocked · tab switches logged · typing velocity analysed)  │
│       │                                                             │
│  Per answer:                                                        │
│  Groq / Llama-3.3-70b  ──── Key 3: Answer Analysis ─────────────  │
│  Groq / Llama-3.3-70b  ──── Key 4: Score Computation ───────────  │
│       │                                                             │
│       ▼                                                             │
│  Grade Card + Integrity Report + Shareable Certificate             │
│  /verify/:id  ──── public URL, no login required ───────────────  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## What Makes This Different

| Dimension | Traditional Exam | AI Question Bank | VERITAS |
|---|---|---|---|
| Question source | Static bank | AI-generated generic | Candidate's own commits |
| Preparable? | Yes — memorise | Yes — LLM can answer | No — specific to your code |
| Leakable? | Yes | Yes | No |
| Proctoring | Human invigilator | None | Pure-JS, no extensions |
| Score honesty | Pass/fail binary | Inflated | Weighted 5-dimension, no floor |
| Proof of authorship | None | None | Verification ID + public URL |
| Cost per exam | High | Medium | ~₹0.50 in API credits |

---

## Scoring Methodology

Five dimensions, weighted by predictive validity for authorship confidence:

| Dimension | Weight | Signals examined |
|---|---|---|
| **Authenticity** | 45% | Files named, errors cited, config values referenced, commit SHAs |
| **Depth** | 25% | WHY decisions were made, tradeoffs considered, alternatives ruled out |
| **Specificity** | 15% | Numbers, paths, version pins, actual error messages |
| **Communication** | 10% | Clarity, structure, logical flow |
| **Consistency** | 5% | Coherence across all five answers |

```
composite = auth×0.45 + depth×0.25 + spec×0.15 + comm×0.10 + cons×0.05

VERIFIED      ≥ 70   — candidate demonstrably built this
CONDITIONAL   50–69  — partial ownership confirmed
NEEDS REVIEW  < 50   — insufficient evidence of authorship
```

**No artificial score floor.** A one-word answer ("ok", "yes") scores 5–10 across all dimensions.

---

## Proctoring — No Extensions Required

Implemented entirely in the browser with standard Web APIs:

| Signal | Implementation | Effect |
|---|---|---|
| Tab switch | `visibilitychange` event | Full-screen overlay + strike counter |
| Paste attempt | `paste` event → `preventDefault()` | Blocked + warning toast |
| Copy tracking | `copy` event listener | Logged throughout exam |
| Typing velocity | WPM calculation at submit | >200 WPM with >40 words = flagged |
| Bulk input | `onChange` delta check | >80 chars in one event = suspicious |
| Right-click | `onContextMenu` → `preventDefault()` | Disabled on question cards |
| Text selection | `user-select: none` | Disabled on all question content |

All flags are aggregated into an **Integrity Report** on the final grade card. Scores are evaluated independently — flags are advisory, not punitive.

---

## Architecture

### Deterministic Repository Analysis
`src/engine/repoAnalysis.js` runs entirely without any LLM. Framework detection, architecture classification (monolith / microservices / serverless / JAMstack), system type inference, and tech stack extraction use rule-based pattern matching over file trees and dependency lists. The LLM receives a clean structured context object — it never reads raw source code.

This design means: zero AI cost for the analysis phase, fully reproducible results, no hallucination risk on the repo facts.

### 4-Key Groq Architecture
Each AI role has its own Groq API key and independent rate-limit budget:

```
GROQ_KEY_ANALYSIS   → Key 1 — context orchestration, fallback
GROQ_KEY_QUESTIONS  → Key 2 — viva question generation
GROQ_KEY_EVALUATOR  → Key 3 — per-answer analysis
GROQ_KEY_SCORING    → Key 4 — composite score computation
```

A rate-limit burst on answer evaluation never starves question generation. In concurrent multi-user sessions, the four queues are completely independent.

### Shareable Certificates Without a Database
Each completed exam generates a `VRT-2026-XXXXXXXX` verification ID. The report is stored in a server-side `Map()`. The public `/verify/:id` page fetches and renders the full certificate — no login required, includes print CSS for PDF export.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite 7 + Framer Motion |
| Styling | Tailwind CSS v4 · parchment editorial design system |
| Backend | Node.js 20 + Express 5 |
| AI | Groq API · Llama-3.3-70b-versatile · 4 dedicated keys |
| GitHub | REST API v3 · unauthenticated · 60 req/hr |
| Repo Analysis | Deterministic rule-based (zero LLM) |
| Certificates | In-memory Map · `/verify/:id` public route |

---

## Local Setup

**Prerequisites:** Node.js 18+, 4 Groq API keys (free at [console.groq.com](https://console.groq.com))

```bash
# Clone
git clone https://github.com/vishnu-k-dev/veritas.git
cd veritas

# Frontend
npm install

# Backend
cd backend && npm install
```

Create `backend/.env`:
```
NODE_ENV=development
PORT=3001
FRONTEND_URL=http://localhost:5173
CORS_ALLOWED_ORIGINS=http://localhost:5173
GROQ_KEY_ANALYSIS=gsk_...
GROQ_KEY_QUESTIONS=gsk_...
GROQ_KEY_EVALUATOR=gsk_...
GROQ_KEY_SCORING=gsk_...
```

```bash
# Start backend (from backend/)
node server.js

# Start frontend (from root, separate terminal)
npm run dev
```

Open `http://localhost:5173/exam` — no login required.

---

## Deployment

- **Frontend** → Vercel (connect repo, set `VITE_API_URL` env var)
- **Backend** → Render (use `render.yaml`, set 4 Groq keys in dashboard)

See [`docs/DEPLOY.md`](docs/DEPLOY.md) for step-by-step instructions.

---

## Security

- No secrets in repository — `.env` files gitignored
- CORS restricted to configured frontend origin only
- Rate limiting on all API endpoints (`express-rate-limit`)
- Input sanitisation middleware on all routes
- GitHub access is read-only, unauthenticated, public repos only
- No user data persisted beyond server session lifetime

---

*Far Away 2026 · Examinations · Solo submission*
