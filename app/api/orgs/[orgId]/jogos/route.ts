import { handle, requireAdmin } from '../../../../lib/server/api'
import { read } from '../../../../lib/server/store'
import { playTotals } from '../../../../lib/games'

/**
 * Tempo da equipa nos jogos (?from=): por funcionário e por jogo. Só a administração vê.
 */
export const GET = handle<{ orgId: string }>(async (req, { orgId }) => {
  const from = Number(new URL(req.url).searchParams.get('from')) || 0
  await requireAdmin(orgId)
  const db = await read(async l => { await l.load('plays', { org_id: orgId, ...(from ? { start_at: { gte: from } } : {}) }) })
  const { byMember, byGame } = playTotals(db.plays.filter(p => p.orgId === orgId))
  return {
    members: [...byMember.entries()].map(([memberId, t]) => ({ memberId, ...t })),
    games: byGame,
  }
})
