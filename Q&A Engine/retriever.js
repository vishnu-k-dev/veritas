// ============================================================
// VERITAS RAG — Retriever
// Embeds candidate context → fetches relevant questions
// This is the RAG "R" — Retrieval
// ============================================================

import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'

// Lazy init — don't crash at import time if keys are missing
let _openai = null
let _supabase = null
function getOpenAI() {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  return _openai
}
function getSupabase() {
  if (!_supabase) _supabase = createClient(process.env.SUPABASE_URL || '', process.env.SUPABASE_SERVICE_KEY || '')
  return _supabase
}

// ── Build a rich retrieval query from candidate context ───
// This is what gets embedded and used to find relevant questions
function buildRetrievalQuery(context, difficulty) {
  const parts = []

  if (context.source === 'github') {
    parts.push(`GitHub project: ${context.repoName || ''}`)
    parts.push(`Architecture: ${context.architecture || ''}`)
    parts.push(`Tech stack: ${(context.techStack || []).join(', ')}`)
    parts.push(`Complexity: ${context.estimatedComplexity || ''}`)
    if (context.implementationTopics?.length)
      parts.push(`Key topics: ${context.implementationTopics.join(', ')}`)
  }

  if (context.source === 'resume') {
    parts.push(`Role: ${context.currentRole || ''}`)
    parts.push(`Experience: ${context.totalExperience || ''}`)
    parts.push(`Skills: ${[
      ...(context.skills?.languages || []),
      ...(context.skills?.frameworks || []),
    ].join(', ')}`)
    if (context.biggestClaims?.length)
      parts.push(`Claims: ${context.biggestClaims.join(', ')}`)
  }

  parts.push(`Difficulty: ${difficulty}`)
  return parts.filter(Boolean).join('. ')
}

// ── Fisher-Yates shuffle (in-place, O(n)) ────────────────
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

// ── Main retrieval function ───────────────────────────────
// Overfetch top 20 from pgvector, shuffle, then slice.
// This prevents deterministic repetition across candidates
// with similar tech stacks.
export async function retrieveQuestions({
  context,
  difficulty,
  alreadyUsed = [],    // question IDs used this session — avoid repeats
  count       = 5,     // how many candidates to return
}) {
  const OVERFETCH = 20  // broad semantic pool before randomisation

  const query     = buildRetrievalQuery(context, difficulty)
  const embedding = await embed(query)

  const techTags = extractTechTags(context)

  const { data, error } = await getSupabase().rpc('search_questions', {
    query_embedding: embedding,
    p_source:        context.source || null,
    p_difficulty:    difficulty,
    p_tech_tags:     techTags.length ? techTags : null,
    p_limit:         OVERFETCH + alreadyUsed.length,
  })

  if (error) throw error

  // Filter out already-used, shuffle the remainder, then slice
  const pool = (data || []).filter(q => !alreadyUsed.includes(q.id))
  return shuffle(pool).slice(0, count)
}

// ── Retrieve follow-up questions ──────────────────────────
export async function retrieveFollowups({
  question,       // original question text
  answer,         // candidate's answer
  triggerType,    // 'vague' | 'shallow' | 'suspicious' | 'strong' | 'partial' | 'confused'
  context,
  count = 3,
}) {
  // Embed the question+answer together for better semantic match
  const query     = `Question: ${question}\nAnswer: ${answer}\nTrigger: ${triggerType}`
  const embedding = await embed(query)
  const techTags  = extractTechTags(context)

  const { data, error } = await getSupabase().rpc('search_followups', {
    query_embedding: embedding,
    p_trigger_type:  triggerType,
    p_tech_tags:     techTags.length ? techTags : null,
    p_limit:         count,
  })

  if (error) throw error
  return data || []
}

// ── Embed text using OpenAI small embeddings ──────────────
// text-embedding-3-small: $0.02/1M tokens — nearly free
export async function embed(text) {
  const res = await getOpenAI().embeddings.create({
    model: 'text-embedding-3-small',
    input: text.slice(0, 8000),  // max input limit
  })
  return res.data[0].embedding
}

// ── Extract tech tags from context ───────────────────────
function extractTechTags(context) {
  const tags = new Set()

  if (context.techStack) {
    context.techStack.forEach(t => tags.add(t.toLowerCase()))
  }
  if (context.skills) {
    const { languages = [], frameworks = [], databases = [] } = context.skills
    ;[...languages, ...frameworks, ...databases]
      .forEach(t => tags.add(t.toLowerCase()))
  }

  // Normalise common aliases
  const ALIASES = {
    'postgresql': 'postgres', 'pg': 'postgres',
    'reactjs':    'react',    'react.js': 'react',
    'nodejs':     'nodejs',   'node':     'nodejs',
    'expressjs':  'express',  'express.js': 'express',
  }
  const normalised = new Set()
  tags.forEach(t => normalised.add(ALIASES[t] || t))

  return [...normalised]
}

