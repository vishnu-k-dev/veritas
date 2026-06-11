// One-shot migration runner — node migrate.js
import 'dotenv/config'
import { Pool } from 'pg'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dir = dirname(fileURLToPath(import.meta.url))
const sql = readFileSync(join(__dir, 'migrations/001_rag.sql'), 'utf8')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

try {
  await pool.query(sql)
  console.log('✓ Migration complete — pgvector schema ready')
} catch (err) {
  console.error('✗ Migration failed:', err.message)
  process.exit(1)
} finally {
  await pool.end()
}
