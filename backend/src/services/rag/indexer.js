// backend/src/services/rag/indexer.js
// Chunks a repo context object into semantically meaningful units,
// embeds them with Cohere, and stores in pgvector.
// Gracefully disabled when COHERE_API_KEY or DATABASE_URL are absent.

import { embedBatch, embedOne, isEmbedEnabled } from './embed.js'
import { ensureSchema, insertChunks, search, purgeSession, isStoreEnabled } from './store.js'

export function isRagEnabled() {
  return isEmbedEnabled() && isStoreEnabled()
}

// ── Chunking ──────────────────────────────────────────────────────────────────

function buildChunks(ctx) {
  const chunks = []

  // 1. Repo identity
  chunks.push({
    type: 'meta',
    content: [
      `Repository: ${ctx.fullName || ctx.name}`,
      ctx.description ? `Description: ${ctx.description}` : null,
      ctx.language   ? `Primary language: ${ctx.language}` : null,
      ctx.topics?.length ? `Topics: ${ctx.topics.join(', ')}` : null,
      `Stars: ${ctx.stars || 0}  Forks: ${ctx.forks || 0}`,
    ].filter(Boolean).join('\n'),
    metadata: { repo: ctx.name },
  })

  // 2. Tech + architecture
  if (ctx.techStack?.length || ctx.architecture) {
    chunks.push({
      type: 'tech',
      content: [
        `Tech stack: ${(ctx.techStack || []).join(', ') || 'unknown'}`,
        `Architecture: ${ctx.architecture || 'unknown'}`,
        `System type: ${ctx.systemType || 'software project'}`,
        ctx.languages && Object.keys(ctx.languages).length
          ? `Languages: ${Object.entries(ctx.languages).map(([l, p]) => `${l} ${p}%`).join(', ')}`
          : null,
      ].filter(Boolean).join('\n'),
      metadata: { repo: ctx.name },
    })
  }

  // 3. README — split on double newlines, max 8 chunks of ~700 chars
  const readme = (ctx.readme || '').trim()
  if (readme) {
    const paras = readme.split(/\n{2,}/).map(p => p.trim()).filter(p => p.length > 40)
    let readmeCount = 0
    for (const para of paras) {
      if (readmeCount >= 8) break
      chunks.push({
        type: 'readme',
        content: para.slice(0, 800),
        metadata: { repo: ctx.name, section: readmeCount },
      })
      readmeCount++
    }
  }

  // 4. Commits — one chunk per commit (up to 25)
  for (const c of (ctx.commits || []).slice(0, 25)) {
    if (!c.message) continue
    chunks.push({
      type: 'commit',
      content: [
        `Commit ${c.sha?.slice(0, 7) || '???????'}: "${c.message}"`,
        `Author: ${c.author || 'unknown'}`,
        c.date ? `Date: ${c.date.slice(0, 10)}` : null,
      ].filter(Boolean).join('\n'),
      metadata: { sha: c.sha, repo: ctx.name },
    })
  }

  // 5. File structure — batches of 30 paths (up to 120 files)
  const files = (ctx.fileTree || []).slice(0, 120)
  for (let i = 0; i < files.length; i += 30) {
    const batch = files.slice(i, i + 30)
    chunks.push({
      type: 'structure',
      content: `File structure (${i + 1}–${i + batch.length}):\n${batch.join('\n')}`,
      metadata: { repo: ctx.name, batch: Math.floor(i / 30) },
    })
  }

  return chunks
}

// ── Public API ─────────────────────────────────────────────────────────────────

// Index a repo into pgvector for a given exam session
export async function indexRepo(sessionId, repoContext) {
  await ensureSchema()

  const rawChunks = buildChunks(repoContext)
  if (!rawChunks.length) return { indexed: 0 }

  const texts = rawChunks.map(c => c.content)
  const embeddings = await embedBatch(texts, 'search_document')

  const chunks = rawChunks.map((c, i) => ({ ...c, embedding: embeddings[i] }))
  await insertChunks(sessionId, chunks)

  console.log(`[RAG] Indexed ${chunks.length} chunks for session ${sessionId}`)
  return { indexed: chunks.length }
}

// Retrieve rich context for question generation
// Returns formatted string of top-15 semantically relevant chunks
export async function retrieveForQuestions(sessionId, repoName) {
  const query = `What did this developer build in ${repoName}? Architectural decisions, technical challenges, key implementation choices, debugging stories.`
  const qVec = await embedOne(query, 'search_query')
  const chunks = await search(sessionId, qVec, { topK: 15 })

  return chunks
    .map(c => `[${c.chunk_type}]\n${c.content}`)
    .join('\n\n---\n\n')
}

// Retrieve evidence relevant to a specific candidate answer
// Used to ground the evaluator in verifiable repo facts
export async function retrieveEvidence(sessionId, answerText) {
  const qVec = await embedOne(answerText, 'search_query')
  const chunks = await search(sessionId, qVec, { topK: 8 })

  return chunks
    .map(c => `[${c.chunk_type}] ${c.content}`)
    .join('\n\n')
}

export { purgeSession }
