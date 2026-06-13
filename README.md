# VERITAS

> *The examination that knows what you actually built.*

---

## The System Is Rigged — Just Not Against Who You Think

Imagine you spent six months building something real.

Late nights debugging a race condition nobody warned you about. Three rewrites of the auth flow before it finally made sense. A README you wrote at 2am that actually explains why you made the decisions you made.

Now imagine the person sitting next to you in the interview memorised StackOverflow answers for a week.

**You both get the same question: "Tell me about a challenging project you worked on."**

They answer fluently. You answer honestly. The interviewer cannot tell the difference.

That is not an examination. That is a coin flip — and the coin is weighted against the people who actually did the work.

---

## Not Fair — For Everyone

### For the student who actually built it
Your final-year project took eight months. Theirs was a GitHub repo they forked and renamed. The viva examiner asks "what framework did you use?" You both answer "React." You both pass. **Nothing in the examination proved who built what.**

### For the institution trying to award merit
Your degree is only worth what the weakest person who got it had to prove. If the examination can be passed by someone who copied the project and memorised a few answers, then the degree signals completion — not competence. Every genuine student's credential is diluted.

### For the hiring team making real bets
A wrong hire costs ₹8–15 lakh in India before you factor in the work that didn't get done. Most technical screens still use the same question bank that has been on GeeksForGeeks since 2018. The person who crammed it beats the person who built it, every time — because the exam doesn't know the difference.

**VERITAS is fair because it is impossible to fake.** There is no question bank. The questions come from your own commit history — decisions you made six months ago, files you named, errors you actually encountered. You can only answer them if you were actually there.

---

## Not Secure — And Getting Worse Fast

### The question bank is already compromised
Within days of any new technical exam going live, its questions appear on prep forums. Companies spend thousands designing question sets. Candidates spend ₹500 on a prep course that has all the answers. The entire exercise becomes a test of who is better at googling "top 50 [company] interview questions."

### Resumes and portfolios cannot be verified
A GitHub profile with 400 stars means nothing if the person didn't write the code. A portfolio project means nothing if it was vibe-coded with AI and the developer cannot explain a single decision in it. There is no mechanism to check.

### AI has made the signal completely dead
ChatGPT can ace any generic technical interview today. It can answer "explain the difference between TCP and UDP" more eloquently than most senior engineers. Any exam that asks questions with known answers is now trivially solvable by pasting into a chat window. The 2024 crop of candidates has grown up knowing this. The examiners mostly haven't caught up.

**VERITAS is secure because the question is your own history.** A question like *"Why did you remove Redux from your state management in commit a3f9c2b and what did you replace it with?"* cannot be answered by ChatGPT, cannot be found on any prep site, and cannot be memorised the night before — because it didn't exist until VERITAS read your repository. The proctoring layer (paste blocked, tab switches logged, typing velocity analysed) makes it harder to cheat in real time. But the deeper security is structural: **there is nothing to cheat from.**

---

## Not Intelligent — Asking What When It Should Ask Why

### Generic questions have no signal anymore
"What is the difference between `==` and `===`?" is the top result for "JavaScript interview questions" on three different websites. It tells you nothing about whether the candidate has ever shipped JavaScript. A person who has never opened a code editor can answer it after ten minutes of reading.

### The exam measures memory, not judgment
Good engineers make decisions under uncertainty. They choose between tradeoffs they can defend. They have debugging stories — not because they read about debugging, but because they actually got stuck and had to think their way out. No MCQ captures this. No "tell me about a challenging project" prompt reliably surfaces it.

### The interview is easy to game and hard to assess
Candidates are coached to use the STAR method. Interviewers are coached to probe for specifics. The whole conversation becomes a structured performance that both sides know is slightly artificial. The actual work — the commits, the PRs, the decisions — sits on GitHub untouched.

**VERITAS is intelligent because it asks *why*, not *what*.** The AI doesn't ask "what is a REST API?" It asks "You chose Express over Fastify for this project — what made you make that call, and given what you know now, would you change it?" That question has no generic answer. It can only be answered by someone who actually stood at that decision point. The scoring engine rewards specificity — naming files, citing error messages, referencing actual tradeoffs — and gives near-zero credit to correct-but-generic answers.

---

## The Shift

| The old way | VERITAS |
|---|---|
| Questions from a bank anyone can study | Questions from your own commit history |
| Anyone who memorised the right things passes | Only someone who was actually there can answer |
| Paste from ChatGPT, nobody knows | Paste is blocked, tab switches logged, velocity tracked |
| Scores inflated to avoid awkward conversations | No score floor — honest measurement, every time |
| "Great interview!" → wrong hire three months later | Verification ID + public certificate anyone can check |
| Same exam for everyone | Every exam is unique to one candidate and one repository |

---

## How It Works

```
  GitHub Repo URL
        │
        ▼
  GitHub REST API  (7 calls, unauthenticated)
  metadata · commits · languages · file tree · README · package.json
        │
        ▼
  Deterministic Repo Analysis  [ZERO LLM — pure rule-based]
  framework detect · architecture classify · tech stack extract
        │
        ├──────────────────────────────────────┐
        ▼                                      ▼
  Cohere embed-english-v3.0            (fallback: raw context)
  ~40 chunks embedded → Neon pgvector
  HNSW cosine index built in <2s
        │
        ▼
  Semantic Retrieval  [top-15 chunks]
  full commit history · README sections · file structure
        │
        ▼
  Groq / Llama-3.3-70b  [Key 2: Question Generation]
  5 questions — each grounded in retrieved repo evidence
        │
        ▼
  Proctored Written Examination
  paste blocked · tab switches logged · typing velocity analysed
        │
  per answer:
  RAG retrieval  →  top-8 evidence chunks keyed to the answer
  Groq / Llama-3.3-70b  [Key 3: Answer Analysis + evidence cross-check]
  Groq / Llama-3.3-70b  [Key 4: Score Computation]
        │
        ▼
  Grade Card + Integrity Report
  Verification ID · /verify/:id · shareable, no login required
  pgvector session purged on report save
```

---

## Scoring

Five dimensions, weighted by predictive validity for authorship confidence:

| Dimension | Weight | What it measures |
|---|---|---|
| **Authenticity** | 45% | Files named, errors cited, config values, commit SHAs |
| **Depth** | 25% | WHY the decision, tradeoffs, alternatives ruled out |
| **Specificity** | 15% | Numbers, paths, version pins, actual error messages |
| **Communication** | 10% | Clarity and logical structure |
| **Consistency** | 5% | Coherence across all five answers |

```
composite = auth×0.45 + depth×0.25 + spec×0.15 + comm×0.10 + cons×0.05

VERIFIED      ≥ 70   — candidate demonstrably built this
CONDITIONAL   50–69  — partial ownership confirmed
NEEDS REVIEW  < 50   — insufficient evidence of authorship
```

No artificial score floor. A one-word answer scores 5–10. Honest measurement, every time.

---

## Proctoring — No Extensions Required

Seven signals, implemented entirely with standard browser Web APIs:

| Signal | Implementation | Effect |
|---|---|---|
| Tab switch | `visibilitychange` event | Full-screen overlay + strike counter |
| Paste attempt | `paste` → `preventDefault()` | Blocked + warning toast |
| Copy tracking | `copy` event listener | Logged throughout exam |
| Typing velocity | WPM at submit | >200 WPM with >40 words = flagged |
| Bulk input | `onChange` delta | >80 chars in one event = suspicious |
| Right-click | `onContextMenu` → `preventDefault()` | Disabled on question cards |
| Text selection | `user-select: none` | Disabled on all question content |

All flags appear in the Integrity Report on the grade card. Scores are evaluated independently — the AI does not know about the flags when it scores.

---

## Architecture

### Deterministic Repository Analysis
`src/engine/repoAnalysis.js` runs entirely without an LLM. Framework detection, architecture classification (monolith / microservices / serverless / JAMstack), system type inference, and tech stack extraction use rule-based pattern matching over file trees and dependency lists. The LLM receives a clean structured object — it never reads raw source code.

Result: zero AI cost for analysis, fully reproducible across runs, zero hallucination risk on the repo facts.

### 4-Key Groq Architecture
```
GROQ_KEY_ANALYSIS   → Key 1 — context orchestration, fallback
GROQ_KEY_QUESTIONS  → Key 2 — viva question generation
GROQ_KEY_EVALUATOR  → Key 3 — per-answer analysis
GROQ_KEY_SCORING    → Key 4 — composite score computation
```
Each role has its own independent rate-limit budget. A burst on answer evaluation never blocks question generation for another user.

### pgvector RAG Pipeline
`backend/src/services/rag/` — At question generation, the full repo is chunked (commits individually, README by paragraph, file tree in batches) and embedded with Cohere `embed-english-v3.0` into a Neon Postgres pgvector table. An HNSW index (cosine ops) is built on the session. The LLM receives the top-15 semantically retrieved chunks instead of a truncated excerpt — it can see every commit, not just the last 10.

At evaluation time, the candidate's answer is embedded and the top-8 most relevant repo chunks are retrieved and injected into the evaluator prompt. The AI can now verify or contradict specific claims against actual repo evidence. Session vectors are purged after the report saves — no storage accumulation.

Both `DATABASE_URL` (Neon) and `COHERE_API_KEY` are optional. Without them the exam runs normally on raw context.

### Durable Certificates via Neon
Each exam produces a `VRT-2026-XXXXXXXX` verification ID persisted to the `exam_reports` table in Neon Postgres (same database as the RAG pipeline). Certificates survive Render restarts and redeployments. Falls back to in-memory storage when `DATABASE_URL` is absent. The public `/verify/:id` page renders the full certificate — no login, includes print CSS for PDF export.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite 7 + Framer Motion |
| Styling | Tailwind CSS v4 · parchment editorial design system |
| Backend | Node.js 20 + Express 5 |
| AI | Groq API · Llama-3.3-70b-versatile · 4 dedicated keys |
| Embeddings | Cohere `embed-english-v3.0` · 1024 dimensions · batched |
| Vector DB | Neon Postgres · pgvector · HNSW cosine index |
| GitHub | REST API v3 · optional PAT · 60 → 5,000 req/hr with token |
| Repo Analysis | Deterministic rule-based (zero LLM) |
| Certificates | Neon Postgres · `/verify/:id` public route · fallback to memory |

---

## Local Setup

**Prerequisites:** Node.js 18+, 4 Groq API keys (free at [console.groq.com](https://console.groq.com))

```bash
git clone https://github.com/vishnu-k-dev/veritas.git
cd veritas
npm install
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

# Optional — enables RAG pipeline (richer questions, evidence-grounded evaluation)
DATABASE_URL=postgresql://...@...neon.tech/neondb?sslmode=require
COHERE_API_KEY=...
```

Create `.env` (frontend, repo root):
```
VITE_API_URL=http://localhost:3001
VITE_GITHUB_TOKEN=ghp_...   # optional — lifts GitHub API rate limit from 60 → 5,000 req/hr
```

If using RAG, run the migration once: `node migrate.js` from the `backend/` directory.

```bash
node server.js          # from backend/
npm run dev             # from root, separate terminal
```

Open `http://localhost:5173/exam` — no login required.

---

## Live Deployment

| Service | URL |
|---|---|
| **Frontend** (Vercel) | [veritas-examination.vercel.app](https://veritas-examination.vercel.app) |
| **Backend** (Render) | [veritas-rgox.onrender.com](https://veritas-rgox.onrender.com) |
| **Database** (Neon) | Postgres + pgvector · `ap-southeast-1` region |

> **Note:** Render free tier spins down after inactivity. First request after idle may take 30–50s. The frontend fires a warmup ping to `/api/ping` on load to pre-warm the server.

### Deploying your own instance

**Backend → Render**

1. New Web Service → connect repo → Root Directory: `backend`
2. Build: `npm install` · Start: `node server.js`
3. Environment variables (all secret):

```
GROQ_KEY_ANALYSIS=gsk_...
GROQ_KEY_QUESTIONS=gsk_...
GROQ_KEY_EVALUATOR=gsk_...
GROQ_KEY_SCORING=gsk_...
DATABASE_URL=postgresql://...@...neon.tech/neondb?sslmode=require
COHERE_API_KEY=...
NODE_ENV=production
PORT=3001
FRONTEND_URL=https://your-vercel-url.vercel.app
CORS_ALLOWED_ORIGINS=https://your-vercel-url.vercel.app
```

**Frontend → Vercel**

1. New Project → import repo → Framework: Vite · Root: `/`
2. Environment variable:

```
VITE_API_URL=https://your-render-url.onrender.com
VITE_GITHUB_TOKEN=ghp_...   ← optional, lifts GitHub API from 60 → 5,000 req/hr
```

**Database migrations** (run once from `backend/`):
```bash
node migrate.js
```
Creates `repo_chunks` (RAG), `exam_reports` (certificates), and all indexes.

---

## Security

- No secrets in repository — `.env` files gitignored
- CORS restricted to configured frontend origin
- Rate limiting on all API endpoints
- Input sanitisation on all routes
- GitHub access is read-only, public repos only
- No user data persisted beyond server session

---

---

## Our Journey — June 7 to June 13, 2026

Seven days from the theme drop to a live, deployed system.

The core insight came on Day 1: a GitHub repository is already a complete record of every decision a developer made. Every commit is a timestamped choice. If the AI reads that, the exam writes itself — and only the person who was actually there can answer it.

From there: built the GitHub ingestion pipeline, a deterministic repo analysis engine (zero LLM cost), and got the first commit-grounded question generated from a real repo. Then the exam UI state machine (`INTAKE → ANALYZING → BLUEPRINT → VIVA → CERTIFICATE`), the proctoring layer, the five-dimension scoring engine, the pgvector RAG pipeline, certificate persistence on Neon Postgres, and the full landing page.

**Bugs we hit and fixed:**
- VIVA stage showed blank screen — the questions array was passed before the API response resolved. Fixed with an explicit loading guard.
- HNSW index creation failed silently when the `pgvector` extension wasn't enabled. Added `CREATE EXTENSION IF NOT EXISTS vector` to the migration.
- Groq key retry was hitting the same failed key in a loop. Fixed with round-robin rotation across all four keys.
- The most important one: VERITAS was only fetching 20 commits (`per_page=20` default) and only feeding 10 of them to the question LLM — so questions were coming entirely from the README, not the commit history. Fixed both: frontend now fetches up to 100, backend feeds up to 50 commits with dates and SHAs, and the prompt mandates that at least two questions name specific commit SHAs.

---

## If We Get to Round 2

**Multi-document evidence** — Extend beyond GitHub repos to PDFs, research papers, and portfolio sites. Anything a candidate claims as their work should be examinable.

**Institution examiner panel** — A dedicated interface for examiners: per-question evidence trails, the ability to add manual notes alongside AI scores, and bulk scheduling for a cohort.

**Longitudinal tracking** — A candidate's VERITAS record across multiple submissions over time, so institutions see growth — not just a single snapshot.

**Richer question types** — Beyond written viva: show a diff from the candidate's own repo and ask what it does and why; a debugging simulation where the candidate explains what they would check first.

**Institutional API** — So universities and bootcamps can embed VERITAS into their existing LMS without replacing anything they already have.

---

*Far Away 2026 · Examinations — Reimagine the future of examinations with secure, fair and intelligent solutions · Solo submission*
