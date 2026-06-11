// One-shot migration runner — node migrate.js (from backend/)
import 'dotenv/config'
import { Pool } from 'pg'
import { readFileSync, readdirSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dir = dirname(fileURLToPath(import.meta.url))
const migrationsDir = join(__dir, 'migrations')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

const files = readdirSync(migrationsDir)
  .filter(f => f.endsWith('.sql'))
  .sort()

for (const file of files) {
  const sql = readFileSync(join(migrationsDir, file), 'utf8')
  try {
    await pool.query(sql)
    console.log(`✓ ${file}`)
  } catch (err) {
    console.error(`✗ ${file}:`, err.message)
    await pool.end()
    process.exit(1)
  }
}

console.log('✓ All migrations complete')
await pool.end()
