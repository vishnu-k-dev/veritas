# Deployment Guide

## Architecture

- **Frontend** → Vercel (static React build)
- **Backend** → Render (Node.js Express server)
- **Vector DB** → Neon Postgres with pgvector (RAG pipeline)

The frontend calls the backend directly via `VITE_API_URL`. CORS on the backend whitelists the Vercel domain.

---

## Step 1 — Set up Neon (pgvector database)

1. Go to [neon.tech](https://neon.tech) → create a free account
2. **New Project** → name it `veritas`, region closest to your Render instance
3. In the Neon dashboard → **SQL Editor** → paste and run [`backend/migrations/001_rag.sql`](../backend/migrations/001_rag.sql)
4. Go to **Connection Details** → copy the connection string:
   ```
   postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require
   ```

---

## Step 2 — Get a Cohere API key

1. Go to [dashboard.cohere.com](https://dashboard.cohere.com) → free account
2. **API Keys** → **New Trial Key** → copy it

---

## Step 3 — Deploy Backend to Render

1. Go to [render.com](https://render.com) → **New Web Service**
2. Connect the `vishnu-k-dev/veritas` GitHub repository
3. Configure:
   - **Root Directory:** `backend`
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
   - **Runtime:** Node
4. Add Environment Variables in the Render dashboard:

| Key | Value |
|---|---|
| `GROQ_KEY_ANALYSIS` | `gsk_...` |
| `GROQ_KEY_QUESTIONS` | `gsk_...` |
| `GROQ_KEY_EVALUATOR` | `gsk_...` |
| `GROQ_KEY_SCORING` | `gsk_...` |
| `DATABASE_URL` | Neon connection string from Step 1 |
| `COHERE_API_KEY` | Cohere key from Step 2 |
| `NODE_ENV` | `production` |
| `PORT` | `3001` |
| `FRONTEND_URL` | *(set after Step 4)* |
| `CORS_ALLOWED_ORIGINS` | *(set after Step 4)* |

5. Deploy → note your Render URL: `https://veritas-api-xxxx.onrender.com`

---

## Step 4 — Deploy Frontend to Vercel

1. Go to [vercel.com](https://vercel.com) → **New Project**
2. Import `vishnu-k-dev/veritas`
3. Configure:
   - **Root Directory:** `/` (not backend)
   - **Framework Preset:** Vite
4. Add Environment Variable:

| Key | Value |
|---|---|
| `VITE_API_URL` | `https://veritas-api-xxxx.onrender.com` |

5. Deploy → note your Vercel URL: `https://veritas-xxxx.vercel.app`

---

## Step 5 — Update CORS on Render

Go back to Render → update the two env vars:

```
FRONTEND_URL         = https://veritas-xxxx.vercel.app
CORS_ALLOWED_ORIGINS = https://veritas-xxxx.vercel.app
```

Trigger a redeploy on Render.

---

## Verify

- `https://veritas-xxxx.vercel.app` — landing page
- `https://veritas-xxxx.vercel.app/exam` — live examination (no login)
- `https://veritas-api-xxxx.onrender.com/api/ping` — backend health check

When RAG is active, the backend logs on each exam:
```
[RAG] Indexed 38 chunks for session exam_1749xxxxxx_xxxxxxxx
```

---

## Notes

- Render free tier spins down after 15 min of inactivity — first request after sleep takes ~30s
- Reports are stored in Neon Postgres (`exam_reports` table) — they persist across Render restarts
- RAG session vectors are purged from Neon automatically when the final report is generated
- `VITE_API_URL` is baked into the frontend bundle at build time — changing it requires a Vercel redeploy
- `DATABASE_URL` and `COHERE_API_KEY` are optional — the exam works without them (falls back to raw context)
