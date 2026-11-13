import { handle, requireUser } from '../../../lib/server/api'
import { emailTrusted } from '../../../lib/server/sharing'
import { read } from '../../../lib/server/store'
import type { ShareKind } from '../../../types'

/** Quantos quadros, planilhas e diagramas te partilharam que ainda não abriste (ponto no menu) */
export const GET = handle(async () => {
  const user = await requireUser()
  const db = await read(async l => {
    await Promise.all([
      l.load('grants', { user_id: user.id }),
      emailTrusted(user) ? l.load('grants', { email: user.email }) : undefined,
    ])
  })
  const counts: Record<ShareKind, number> = { board: 0, sheet: 0, diagram: 0 }
  const seen = new Set<string>()
  for (const g of db.grants) {
    if (seen.has(g.id) || !g.unseen || g.role === 'pending') continue
    if (g.userId !== user.id && !(emailTrusted(user) && g.email === user.email)) continue
    seen.add(g.id)
    counts[g.kind] = (counts[g.kind] ?? 0) + 1
  }
  return counts
})
