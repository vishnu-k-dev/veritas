# Deployment Guide

## Architecture

- **Frontend** → Vercel (static React build)
- **Backend** → Render (Node.js Express server)

The frontend calls the backend directly via `VITE_API_URL`. CORS on the backend whitelists the Vercel domain.

---

## Step 1 — Deploy Backend to Render

1. Go to [render.com](https://render.com) → **New Web Service**
2. Connect the `vishnu-k-dev/veritas` GitHub repository
3. Configure:
   - **Root Directory:** `backend`
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
   - **Runtime:** Node
4. Add Environment Variables (in Render dashboard):

| Key | Value |
|---|---|
| `GROQ_KEY_ANALYSIS` | `gsk_...` |
| `GROQ_KEY_QUESTIONS` | `gsk_...` |
| `GROQ_KEY_EVALUATOR` | `gsk_...` |
| `GROQ_KEY_SCORING` | `gsk_...` |
| `NODE_ENV` | `production` |
| `PORT` | `3001` |
| `FRONTEND_URL` | *(set after Step 2)* |
| `CORS_ALLOWED_ORIGINS` | *(set after Step 2)* |

5. Deploy → note your Render URL: `https://veritas-api-xxxx.onrender.com`

---

## Step 2 — Deploy Frontend to Vercel

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

## Step 3 — Update CORS on Render

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

---

## Notes

- Render free tier spins down after 15 min of inactivity — first request after sleep takes ~30s
- Reports are stored in-memory; they reset when Render redeploys or sleeps
- `VITE_API_URL` is baked into the frontend bundle at build time — changing it requires a Vercel redeploy
