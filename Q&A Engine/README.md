# VERITAS RAG Engine — Drop-in Plugin (v2: Cost-Optimized)

## Cost Comparison

| Operation | v1 | v2 (current) |
|---|---|---|
| Question gen (8×) | GPT-4o-mini → ~₹0.10 | Gemini Flash-Lite → ~₹0.02 |
| Live follow-up | GPT-4o scoring → ~₹1.80 | Rule-based (zero cost) → ₹0.00 |
| Batch evaluation | — | 1× GPT-4o-mini → ~₹0.08 |
| Embeddings | 8× embed → ~₹0.05 | Same → ~₹0.03 |
| Follow-up personalize | GPT-4o-mini → ~₹0.02 | Same → ~₹0.02 |
| **Total** | **~₹2.50** | **~₹0.13** |

> When `B2B_MODE=true` in production, batch eval upgrades to GPT-4o for paid recruiter reports.

---

## Files

```
Q&A Engine/
├── index.js          ← DROP-IN — exports RAG object with 4 methods
├── generator.js      ← Gemini Flash-Lite question gen (GPT-4o-mini fallback)
├── analyzer.js       ← Rule-based live scoring + batch eval at end
├── retriever.js      ← pgvector similarity search + embeddings
├── schema.sql        ← Supabase SQL schema (run first)
├── functions.sql     ← Utility views + RPC (run second)
├── seed.js           ← Populate question bank (run once)
└── README.md
```

---

## Setup

### Step 1: Supabase schema
```sql
-- In Supabase SQL Editor, run in order:
-- 1. schema.sql
-- 2. functions.sql
```

### Step 2: Seed the question bank
```bash
node "Q&A Engine/seed.js"
# Embeds 60+ questions + 20 follow-ups (~$0.01)
```

### Step 3: Dependencies
```bash
npm install @google/generative-ai   # for Gemini Flash-Lite
# openai + @supabase/supabase-js already in your stack
```

### Step 4: Environment
```bash
# Required
OPENAI_API_KEY=sk-...
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...

# Optional (enables Gemini — 10x cheaper questions)
GOOGLE_AI_API_KEY=AI...

# Optional (upgrades batch eval to GPT-4o for paid reports)
B2B_MODE=true    # only set in production for paying clients
```

---

## API — 3 methods

```javascript
import { RAG } from './Q&A Engine/index.js'

// 1. Generate next question (Gemini → GPT fallback)
const q = await RAG.nextQuestion({ context, difficulty, history, usedIds, questionNum, totalQ })

// 2. Live analysis per answer (rule-based, FREE)
const analysis = await RAG.analyzeAnswer({
  question: q.question, answer: userAnswer, context,
  questionType: q.type, difficulty, followupCount, questionId: q.questionId,
})
// analysis.scores = null (scored later in batch)
// analysis.action = 'followup' | 'next_question'
// analysis.followup.question = "the follow-up question"

// 3. After ALL questions — batch score (1 API call)
const evaluations = await RAG.batchEvaluate({ allQAPairs, context, interviewId })
// evaluations[i].overall, .verdict, .authenticity, .depth, .clarity
```

---

## How the v2 loop works

```
Candidate context
    │ embed()
    ▼
pgvector → top 5 questions → Gemini Flash-Lite picks + personalizes → question sent
    │
    ▼ candidate answers
    │
cheapFollowupDecision() — RULE-BASED, ZERO COST
    ├── vague/shallow/suspicious → retrieve follow-up from RAG (vector search)
    │       └── personalize (1× GPT-4o-mini, cheap)
    └── sufficient → next question
    │
    ▼ after all 8 questions
    │
batchEvaluate() — 1× GPT-4o-mini scores all Q&A pairs
    └── { authenticity, depth, clarity, overall, verdict } per answer
```

---

## Self-improving over time

Every interview logs answers + scores. After 500+ interviews:

```sql
SELECT * FROM rag_struggle_map ORDER BY avg_score ASC LIMIT 10;
SELECT * FROM rag_weak_questions;
SELECT * FROM rag_question_performance;
```

