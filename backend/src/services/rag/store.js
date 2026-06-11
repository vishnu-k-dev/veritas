// backend/src/services/rag/store.js
// pgvector storage — raw pg client, works with Neon / any Postgres + pgvector

import { Pool } from 'pg'

let pool = null
let schemaEnsured = false

function getPool() {
  if (!pool) {
    const url = process.env.DATABASE_URL
    if (!url) throw new Error('DATABASE_URL not set')
    pool = new Pool({
      connectionString: url,
      ssl: { rejectUnauthorized: false },
      max: 5,
      idleTimeoutMillis: 30000,
    })
    pool.on('error', err => console.error('[RAG:pool]', err.message))
  }
  return pool
}

export async function ensureSchema() {
  if (schemaEnsured) return
  const db = getPool()
  await db.query(`
    CREATE EXTENSION IF NOT EXISTS vector;

    CREATE TABLE IF NOT EXISTS repo_chunks (
      id         BIGSERIAL    PRIMARY KEY,
      session_id TEXT         NOT NULL,
      chunk_type TEXT         NOT NULL,
      content    TEXT         NOT NULL,
      metadata   JSONB        DEFAULT '{}',
      embedding  vector(1024),
      created_at TIMESTAMPTZ  DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS repo_chunks_session_idx
      ON repo_chunks (session_id);

    CREATE INDEX IF NOT EXISTS repo_chunks_hnsw_idx
      ON repo_chunks USING hnsw (embedding vector_cosine_ops)
      WITH (m = 16, ef_construction = 64);
  `)
  schemaEnsured = true
}

// Insert a batch of embedded chunks for a session
export async function insertChunks(sessionId, chunks) {
  if (!chunks.length) return
  const db = getPool()

  // Build a single multi-row INSERT for efficiency
  const vals = []
  const params = []
  chunks.forEach((c, i) => {
    const b = i * 5
    vals.push(`($${b+1}, $${b+2}, $${b+3}, $${b+4}, $${b+5}::vector)`)
    params.push(
      sessionId,
      c.type,
      c.content,
      JSON.stringify(c.metadata || {}),
      `[${c.embedding.join(',')}]`,
    )
  })

  await db.query(
    `INSERT INTO repo_chunks (session_id, chunk_type, content, metadata, embedding)
     VALUES ${vals.join(', ')}`,
    params,
  )
}

// Semantic search — returns top-k chunks ranked by cosine similarity
export async function search(sessionId, queryEmbedding, { topK = 12, types = null } = {}) {
  const db = getPool()
  const vecStr = `[${queryEmbedding.join(',')}]`

  const params = [sessionId, vecStr]
  const typeClause = types?.length
    ? (() => { params.push(types); return `AND chunk_type = ANY($${params.length})` })()
    : ''

  const { rows } = await db.query(
    `SELECT content, chunk_type, metadata,
            1 - (embedding <=> $2::vector) AS score
     FROM   repo_chunks
     WHERE  session_id = $1
     ${typeClause}
     ORDER  BY embedding <=> $2::vector
     LIMIT  ${Number(topK)}`,
    params,
  )
  return rows
}

// Clean up all vectors for a session (call after report is generated)
export async function purgeSession(sessionId) {
  const db = getPool()
  await db.query('DELETE FROM repo_chunks WHERE session_id = $1', [sessionId])
}

export function isStoreEnabled() {
  return !!process.env.DATABASE_URL
}
