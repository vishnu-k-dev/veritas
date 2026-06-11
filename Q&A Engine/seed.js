// ============================================================
// VERITAS RAG — Seed Questions + Follow-ups
// Run once: node seed/seed.js
// Embeds every question and stores in Supabase
// ============================================================

import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config()

const openai   = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)

// ── Question bank ─────────────────────────────────────────
// These are templates — {{project}}, {{tech}}, {{claim}} are
// filled at retrieval time based on candidate context
const QUESTIONS = [

  // ── WARM_UP — GitHub ─────────────────────────────────────
  { question: "Walk me through what your project does and why you built it.",
    question_type: 'architecture', source: 'github', difficulty: 'warm_up',
    tech_tags: [], role_tags: ['junior', 'mid', 'senior'] },

  { question: "What problem were you trying to solve when you started this project?",
    question_type: 'decision', source: 'github', difficulty: 'warm_up',
    tech_tags: [], role_tags: ['junior', 'mid', 'senior'] },

  { question: "Give me a high-level overview of how the different parts of your project talk to each other.",
    question_type: 'architecture', source: 'github', difficulty: 'warm_up',
    tech_tags: [], role_tags: ['mid', 'senior'] },

  // ── WARM_UP — Resume ─────────────────────────────────────
  { question: "Tell me about the project you're most proud of from your resume.",
    question_type: 'ownership', source: 'resume', difficulty: 'warm_up',
    tech_tags: [], role_tags: ['junior', 'mid', 'senior'] },

  { question: "Walk me through your most recent role — what were you actually building day to day?",
    question_type: 'ownership', source: 'resume', difficulty: 'warm_up',
    tech_tags: [], role_tags: ['mid', 'senior'] },

  // ── MEDIUM — Implementation ───────────────────────────────
  { question: "How did you handle authentication in your project? Walk me through the implementation.",
    question_type: 'implementation', source: 'both', difficulty: 'medium',
    tech_tags: ['auth', 'jwt', 'oauth', 'firebase', 'nextauth'], role_tags: ['mid', 'senior'] },

  { question: "How did you structure your database schema? What were the main tables and why?",
    question_type: 'implementation', source: 'both', difficulty: 'medium',
    tech_tags: ['postgres', 'mysql', 'mongodb', 'supabase', 'database'], role_tags: ['mid', 'senior'] },

  { question: "How does your API handle errors? Walk me through what happens when something goes wrong.",
    question_type: 'implementation', source: 'both', difficulty: 'medium',
    tech_tags: ['api', 'rest', 'nodejs', 'express', 'backend'], role_tags: ['mid', 'senior'] },

  { question: "How did you manage state in the frontend? Why that approach over alternatives?",
    question_type: 'decision', source: 'both', difficulty: 'medium',
    tech_tags: ['react', 'redux', 'zustand', 'context', 'frontend'], role_tags: ['junior', 'mid'] },

  { question: "Walk me through how a user request flows from the frontend to the database and back.",
    question_type: 'architecture', source: 'github', difficulty: 'medium',
    tech_tags: ['fullstack', 'api', 'backend', 'frontend'], role_tags: ['mid', 'senior'] },

  { question: "How did you handle environment-specific configuration — dev vs production?",
    question_type: 'implementation', source: 'github', difficulty: 'medium',
    tech_tags: ['devops', 'deployment', 'env', 'config'], role_tags: ['mid', 'senior'] },

  { question: "How did you approach testing in this project?",
    question_type: 'implementation', source: 'both', difficulty: 'medium',
    tech_tags: ['testing', 'jest', 'cypress', 'mocha', 'vitest'], role_tags: ['mid', 'senior'] },

  { question: "How did you handle API rate limiting or performance bottlenecks?",
    question_type: 'implementation', source: 'both', difficulty: 'medium',
    tech_tags: ['performance', 'api', 'caching', 'redis', 'backend'], role_tags: ['senior', 'lead'] },

  { question: "How did you integrate third-party APIs? Walk through the biggest one you dealt with.",
    question_type: 'implementation', source: 'both', difficulty: 'medium',
    tech_tags: ['api', 'integration', 'backend', 'webhook'], role_tags: ['mid', 'senior'] },

  // ── MEDIUM — Decision ─────────────────────────────────────
  { question: "Why did you choose this tech stack over alternatives you considered?",
    question_type: 'decision', source: 'github', difficulty: 'medium',
    tech_tags: [], role_tags: ['mid', 'senior', 'lead'] },

  { question: "What database did you use and why that one specifically?",
    question_type: 'decision', source: 'both', difficulty: 'medium',
    tech_tags: ['database', 'postgres', 'mongodb', 'mysql', 'redis'], role_tags: ['mid', 'senior'] },

  { question: "You used a monorepo structure — what drove that decision and what were the trade-offs?",
    question_type: 'tradeoff', source: 'github', difficulty: 'medium',
    tech_tags: ['monorepo', 'turborepo', 'nx', 'architecture'], role_tags: ['senior', 'lead'] },

  // ── DEEP — Technical depth ────────────────────────────────
  { question: "Walk me through the most complex piece of logic you wrote in this project. Line by line if you can.",
    question_type: 'implementation', source: 'github', difficulty: 'deep',
    tech_tags: [], role_tags: ['mid', 'senior', 'lead'] },

  { question: "What was the hardest bug you encountered and exactly how did you track it down?",
    question_type: 'debugging', source: 'both', difficulty: 'deep',
    tech_tags: [], role_tags: ['mid', 'senior', 'lead'] },

  { question: "How did you handle concurrent requests or race conditions in your system?",
    question_type: 'implementation', source: 'github', difficulty: 'deep',
    tech_tags: ['concurrency', 'async', 'race-condition', 'queue', 'backend'], role_tags: ['senior', 'lead'] },

  { question: "Walk me through how you'd scale this project to 10x the current load.",
    question_type: 'architecture', source: 'github', difficulty: 'deep',
    tech_tags: ['scalability', 'architecture', 'backend', 'devops'], role_tags: ['senior', 'lead'] },

  { question: "How did you approach caching in your project and what invalidation strategy did you use?",
    question_type: 'implementation', source: 'both', difficulty: 'deep',
    tech_tags: ['caching', 'redis', 'memcached', 'performance'], role_tags: ['senior', 'lead'] },

  { question: "How did you secure your API — beyond just authentication?",
    question_type: 'implementation', source: 'both', difficulty: 'deep',
    tech_tags: ['security', 'api', 'cors', 'helmet', 'rate-limiting'], role_tags: ['senior', 'lead'] },

  { question: "How does your deployment pipeline work? What happens from git push to production?",
    question_type: 'implementation', source: 'github', difficulty: 'deep',
    tech_tags: ['ci-cd', 'deployment', 'docker', 'github-actions', 'devops'], role_tags: ['mid', 'senior'] },

  { question: "How did you design your data models to handle the relationships in your domain?",
    question_type: 'decision', source: 'both', difficulty: 'deep',
    tech_tags: ['database', 'schema', 'orm', 'relations', 'postgres'], role_tags: ['senior', 'lead'] },

  { question: "What design patterns did you apply and where specifically in the codebase?",
    question_type: 'decision', source: 'github', difficulty: 'deep',
    tech_tags: ['design-patterns', 'architecture', 'backend'], role_tags: ['senior', 'lead'] },

  // ── PRESSURE — Authenticity tests ────────────────────────
  { question: "Pick one file in your repo and explain exactly what every function in it does.",
    question_type: 'ownership', source: 'github', difficulty: 'pressure',
    tech_tags: [], role_tags: ['junior', 'mid', 'senior', 'lead'] },

  { question: "What was the commit where everything broke? Tell me exactly what happened.",
    question_type: 'failure', source: 'github', difficulty: 'pressure',
    tech_tags: [], role_tags: ['mid', 'senior'] },

  { question: "If I gave you access to this codebase right now, what would you change first and why?",
    question_type: 'ownership', source: 'github', difficulty: 'pressure',
    tech_tags: [], role_tags: ['mid', 'senior', 'lead'] },

  { question: "What's the biggest technical shortcut you took that you're not proud of?",
    question_type: 'failure', source: 'both', difficulty: 'pressure',
    tech_tags: [], role_tags: ['mid', 'senior'] },

  { question: "What's the exact line count or size of this codebase and which parts took longest?",
    question_type: 'ownership', source: 'github', difficulty: 'pressure',
    tech_tags: [], role_tags: ['junior', 'mid', 'senior'] },

  // ── GAP PROBES — Resume specific ─────────────────────────
  { question: "You mention React on your resume — what's the most complex custom hook you've written?",
    question_type: 'gap_probe', source: 'resume', difficulty: 'deep',
    tech_tags: ['react', 'frontend', 'hooks'], role_tags: ['junior', 'mid', 'senior'] },

  { question: "You mention microservices experience — how did you handle service discovery and communication?",
    question_type: 'gap_probe', source: 'resume', difficulty: 'deep',
    tech_tags: ['microservices', 'backend', 'architecture'], role_tags: ['senior', 'lead'] },

  { question: "You mention AWS on your resume — what specific services did you configure and what were the configs?",
    question_type: 'gap_probe', source: 'resume', difficulty: 'deep',
    tech_tags: ['aws', 'cloud', 'devops'], role_tags: ['mid', 'senior'] },

  { question: "You say you improved performance by X% — what was the baseline and how did you measure after?",
    question_type: 'gap_probe', source: 'resume', difficulty: 'pressure',
    tech_tags: ['performance', 'metrics', 'backend'], role_tags: ['mid', 'senior'] },
]

// ── Follow-up bank ────────────────────────────────────────
const FOLLOWUPS = [
  // Triggered when answer is VAGUE
  { question: "Can you be more specific? Give me an exact example from your code.",
    trigger_type: 'vague', tech_tags: [] },
  { question: "That's quite general — can you walk me through how that actually works under the hood?",
    trigger_type: 'vague', tech_tags: [] },
  { question: "Can you name the specific function or file where that logic lives?",
    trigger_type: 'vague', tech_tags: [] },
  { question: "Give me the exact steps you took, not the high-level summary.",
    trigger_type: 'vague', tech_tags: [] },

  // Triggered when answer is SHALLOW
  { question: "Go a level deeper — what's actually happening when that runs?",
    trigger_type: 'shallow', tech_tags: [] },
  { question: "What would break if you removed that part of the code?",
    trigger_type: 'shallow', tech_tags: [] },
  { question: "What were the alternatives you considered before going with that approach?",
    trigger_type: 'shallow', tech_tags: [] },
  { question: "How did you test that it works correctly?",
    trigger_type: 'shallow', tech_tags: [] },
  { question: "What are the edge cases that approach doesn't handle?",
    trigger_type: 'shallow', tech_tags: [] },

  // Triggered when answer is SUSPICIOUS
  { question: "That's interesting — which specific part of that did you write yourself versus use a library for?",
    trigger_type: 'suspicious', tech_tags: [] },
  { question: "Walk me through the exact code path for that — from the entry point.",
    trigger_type: 'suspicious', tech_tags: [] },
  { question: "Can you explain that differently — pretend I can't see the code.",
    trigger_type: 'suspicious', tech_tags: [] },
  { question: "What error did you get the first time you tried to implement that?",
    trigger_type: 'suspicious', tech_tags: [] },

  // Triggered when answer is STRONG (go deeper, reward)
  { question: "That's impressive. What would you do differently if you rebuilt it from scratch?",
    trigger_type: 'strong', tech_tags: [] },
  { question: "How does that solution hold up at scale? Where would it break first?",
    trigger_type: 'strong', tech_tags: [] },
  { question: "What's the most elegant part of that solution and why?",
    trigger_type: 'strong', tech_tags: [] },

  // Triggered when candidate is CONFUSED
  { question: "No worries — let me rephrase. What does that part of the code actually do?",
    trigger_type: 'confused', tech_tags: [] },
  { question: "Let's step back — in simple terms, what problem were you solving there?",
    trigger_type: 'confused', tech_tags: [] },

  // Triggered when answer is PARTIAL
  { question: "You covered part of it — what about the error handling side?",
    trigger_type: 'partial', tech_tags: [] },
  { question: "That covers the happy path — what happens when something fails?",
    trigger_type: 'partial', tech_tags: [] },
  { question: "Good — now what about the security considerations for that approach?",
    trigger_type: 'partial', tech_tags: [] },
]

// ── Embedder ──────────────────────────────────────────────
async function embed(text) {
  const res = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  })
  return res.data[0].embedding
}

// ── Seed runner ───────────────────────────────────────────
async function seed() {
  console.log('Seeding VERITAS RAG engine...\n')

  // Seed questions in batches of 10 (API rate limit)
  console.log(`Seeding ${QUESTIONS.length} questions...`)
  for (let i = 0; i < QUESTIONS.length; i += 10) {
    const batch = QUESTIONS.slice(i, i + 10)
    const rows  = await Promise.all(batch.map(async q => ({
      ...q,
      embedding: await embed(q.question),
    })))

    const { error } = await supabase.from('rag_questions').insert(rows)
    if (error) { console.error('Q batch error:', error); continue }
    console.log(`  ✓ Questions ${i + 1}–${Math.min(i + 10, QUESTIONS.length)}`)
  }

  // Seed follow-ups
  console.log(`\nSeeding ${FOLLOWUPS.length} follow-ups...`)
  for (let i = 0; i < FOLLOWUPS.length; i += 10) {
    const batch = FOLLOWUPS.slice(i, i + 10)
    const rows  = await Promise.all(batch.map(async f => ({
      ...f,
      embedding: await embed(f.question),
    })))

    const { error } = await supabase.from('rag_followups').insert(rows)
    if (error) { console.error('F batch error:', error); continue }
    console.log(`  ✓ Follow-ups ${i + 1}–${Math.min(i + 10, FOLLOWUPS.length)}`)
  }

  console.log('\n✅ Seed complete.')
}

seed().catch(console.error)

