import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

function getLatestCarelogicSelectPolicy(): { statement: string } {
  const migrationsDir = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../../../supabase/migrations',
  )
  const migrationFiles = readdirSync(migrationsDir)
    .filter((fileName) => fileName.endsWith('.sql'))
    .sort()

  for (const fileName of migrationFiles.slice().reverse()) {
    const sql = readFileSync(path.join(migrationsDir, fileName), 'utf8')
    const statementMatch = sql.match(
      /CREATE POLICY carelogic_extractions_select[\s\S]*?;/i,
    )

    if (statementMatch) {
      return {
        statement: statementMatch[0],
      }
    }
  }

  throw new Error('Could not find a carelogic_extractions_select policy migration')
}

describe('carelogic extraction select policy migration', () => {
  it('keeps soft-delete filtering and least-privilege owner-or-admin reads in the latest migration', () => {
    const { statement } = getLatestCarelogicSelectPolicy()

    expect(statement).toMatch(/deleted_at\s+IS\s+NULL/i)
    expect(statement).toMatch(
      /\(generated_by\s*=\s*auth\.uid\(\)\s+AND\s+public\.is_org_member\(org_id\)\)/i,
    )
    expect(statement).toMatch(/OR\s+public\.is_org_admin\(org_id\)/i)
  })

  it('does not widen read access to plain org membership in the latest migration', () => {
    const { statement } = getLatestCarelogicSelectPolicy()

    expect(statement).not.toMatch(/OR\s+public\.is_org_member\(org_id\)/i)
  })
})
