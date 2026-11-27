import { debugFlag } from '@/platform/debug'
import { navigate } from '@/core/store/router'
import { seedQaDatabase } from '@/features/database'

/** QA (`webnota:debug=seed-db` / `seed-db-10k`): once each, a database with every M4 field type. */
export async function seedDb() {
  for (const [flag, rows] of [
    ['seed-db', 50],
    ['seed-db-10k', 10_000],
  ] as const) {
    if (!debugFlag(flag) || localStorage.getItem(`webnota:qa-${flag}`)) continue
    localStorage.setItem(`webnota:qa-${flag}`, '1')
    const id = await seedQaDatabase({ rows, wide: rows > 50, title: `QA database ${rows}` })
    navigate({ name: 'page', id }, { replace: true })
  }
}
