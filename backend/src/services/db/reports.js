// Durable report storage backed by Neon Postgres
// Falls back to the caller's in-memory Map when DATABASE_URL is absent.
import pg from 'pg'

let pool = null

function getPool() {
  if (!process.env.DATABASE_URL) return null
  if (!pool) {
    pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 3,
    })
    pool.on('error', err => console.error('[reports] pool error:', err.message))
  }
  return pool
}

export function isDbEnabled() {
  return !!process.env.DATABASE_URL
}

export async function saveReport(report) {
  const db = getPool()
  if (!db) return false
  await db.query(
    `INSERT INTO exam_reports
       (verification_id, candidate_name, repo_name, repo_url, tech_stack,
        scores, verdict, rag_enabled, share_url, issued_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     ON CONFLICT (verification_id) DO NOTHING`,
    [
      report.verificationId,
      report.candidateName,
      report.repoName,
      report.repoUrl || '',
      JSON.stringify(report.techStack || []),
      JSON.stringify(report.scores),
      report.verdict,
      report.ragEnabled || false,
      report.shareUrl || '',
      report.issuedAt,
    ]
  )
  return true
}

export async function getReport(verificationId) {
  const db = getPool()
  if (!db) return null
  const { rows } = await db.query(
    'SELECT * FROM exam_reports WHERE verification_id = $1',
    [verificationId]
  )
  if (!rows.length) return null
  const r = rows[0]
  return {
    verificationId:  r.verification_id,
    candidateName:   r.candidate_name,
    repoName:        r.repo_name,
    repoUrl:         r.repo_url,
    techStack:       r.tech_stack,
    scores:          r.scores,
    verdict:         r.verdict,
    ragEnabled:      r.rag_enabled,
    shareUrl:        r.share_url,
    issuedAt:        r.issued_at,
  }
}
