# VERITAS — Evidence-Based AI Examination System

> Paste a public GitHub repository. VERITAS reads your code, your commits, your decisions — then examines you on what you actually built.

**No login. No question banks. No proctoring theatre.**  
The candidate's own evidence is the exam.

---

## The Problem

Anyone can claim "full-stack developer" on a CV. Institutions have no way to verify it.  
Traditional exams test memory. VERITAS examines authorship.

| Old way | VERITAS |
|---|---|
| Generic MCQs any LLM can answer | Questions generated from *your actual commits* |
| Self-reported skills | GitHub API reads your real codebase |
| Easy to fake | Proctored — paste blocked, tab switches logged |
| Flat pass/fail | 3-dimensional score: Authenticity · Ownership · Competency |

---

## Live Demo

```
http://localhost:5174/exam
```

1. Enter your name
2. Paste any public GitHub repo URL
3. VERITAS reads your code and generates 5 evidence-based questions
4. Answer in your own words (paste is blocked, tab switches are recorded)
5. Receive a grade card with per-question breakdown + integrity report

---

## How It Works

```
GitHub Repo URL
      ↓
GitHub REST API (7 calls, unauthenticated)
  → metadata · commits · languages · file tree · README · package.json
      ↓
Repo Analysis Engine (zero LLM — pure rule-based)
  → tech stack · architecture · system type
      ↓
Groq / Llama-3.3-70b — Key 2 (Question Generation)
  → 5 evidence-based questions, each traced to a commit or file
      ↓
Proctored Examination
  → paste blocked · tab switches logged · typing velocity analysed
      ↓
Groq / Llama-3.3-70b — Key 3 (Answer Analysis)
  → authenticity · depth · specificity · communication · consistency
      ↓
Groq / Llama-3.3-70b — Key 4 (Score Computation)
  → composite score · verdict (pass / hold / fail)
      ↓
Grade Card + Integrity Report
  → Authenticity / Ownership / Competency · per-question breakdown · verification ID
```

---

## Scoring

Five dimensions, no artificial floor — scores reflect reality:

| Dimension | Weight | What it measures |
|---|---|---|
| Authenticity | 45% | First-hand knowledge — files, errors, decisions cited |
| Depth | 25% | Reasoning depth — WHY, not just WHAT |
| Specificity | 15% | Concrete references — numbers, paths, names |
| Communication | 10% | Clarity and structure |
| Consistency | 5% | Coherence across all answers |

**Verdict:** Pass ≥ 60 · Hold 35–59 · Fail < 35

---

## Proctoring

- **Paste blocked** — `paste` event intercepted; warning shown
- **Tab switch detected** — `visibilitychange` triggers full-screen overlay, strike counted
- **Copy tracking** — every `copy` event on the page logged
- **Typing velocity** — answers appearing faster than 200 WPM flagged as anomalous
- **Right-click disabled** on question card and answer area
- **Integrity report** included in final grade card

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite 7 + Framer Motion |
| Styling | Tailwind CSS v4 · parchment design system |
| Backend | Node.js + Express 5 |
| AI | Groq API · Llama-3.3-70b-versatile · 4 dedicated keys |
| GitHub | REST API v3 · unauthenticated · 60 req/hr |
| Repo Analysis | Deterministic rule-based engine (zero LLM) |
| Rate limiting | express-rate-limit · in-memory (Redis optional) |

**4-key Groq architecture** — each role has its own API key and rate-limit budget:

| Key | Role |
|---|---|
| `GROQ_KEY_ANALYSIS` | Context analysis & orchestration |
| `GROQ_KEY_QUESTIONS` | Viva question generation |
| `GROQ_KEY_EVALUATOR` | Answer analysis |
| `GROQ_KEY_SCORING` | Score computation |

---

## Local Setup

### Prerequisites
- Node.js 18+
- 4 Groq API keys (free at [console.groq.com](https://console.groq.com))

### Frontend

```bash
cd "Far Away/VERITAS"
npm install
cp .env.example .env.local   # fill in VITE_API_URL=http://localhost:3001
npm run dev
# → http://localhost:5173
```

### Backend

```bash
cd "Far Away/VERITAS/backend"
npm install
```

Create `backend/.env`:
```
NODE_ENV=development
PORT=3001
FRONTEND_URL=http://localhost:5173
GROQ_KEY_ANALYSIS=gsk_...
GROQ_KEY_QUESTIONS=gsk_...
GROQ_KEY_EVALUATOR=gsk_...
GROQ_KEY_SCORING=gsk_...
```

```bash
node server.js
# → http://localhost:3001/api/ping
```

### Start the exam

Open `http://localhost:5173/exam` — no login required.

---

## Project Structure

```
VERITAS/
├── src/
│   ├── pages/
│   │   ├── Landing.jsx          # Landing page
│   │   ├── ExamFlow.jsx         # Full exam UI (intake → viva → grade card)
│   │   └── VerifyReport.jsx     # Public /verify/:id certificate page
│   ├── services/
│   │   └── githubService.js     # GitHub REST API client
│   └── engine/
│       └── repoAnalysis.js      # Deterministic repo parser
└── backend/
    ├── app.js                   # Express app
    └── src/
        ├── routes/
        │   └── exam.js          # /api/exam/* — no auth required
        └── services/ai/
            └── index.js         # 4-key Groq service
```

---

## Hackathon

Built for **Far Away 2026** — India's Biggest International Hackathon  
Theme: *Examinations — Reimagine the future of examinations with secure, fair and intelligent solutions.*
