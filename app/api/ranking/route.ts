import { handle, requireUser } from '../../lib/server/api'
import { read } from '../../lib/server/store'
import { displayName, sortRanking } from '../../lib/server/views'
import { rangeStats } from '../../lib/points'
import type { RankEntry, RankMetric, Session, Task } from '../../types'

/** Ranking global das contas pessoais. ?from=<ms>&metric= */
export const GET = handle(async req => {
  const me = await requireUser()
  const url = new URL(req.url)
  const from = Number(url.searchParams.get('from')) || 0
  const metric = (url.searchParams.get('metric') as RankMetric) || 'points'
  // todos os utilizadores e o trabalho do espaço pessoal (sem tarefas/sessões de empresas)
  const db = await read(async l => {
    await l.load('users')
    await l.load('tasks', { org_id: null })
    await l.load('sessions', { member_id: null })
  })

  const tasksBy = new Map<string, Task[]>()
  db.tasks.forEach(t => { if (t.ownerId) tasksBy.set(t.ownerId, [...(tasksBy.get(t.ownerId) ?? []), t]) })
  const sessionsBy = new Map<string, Session[]>()
  db.sessions.forEach(s => { if (s.userId) sessionsBy.set(s.userId, [...(sessionsBy.get(s.userId) ?? []), s]) })

  const entries: RankEntry[] = []
  for (const user of db.users) {
    const isMe = user.id === me.id
    if (user.rankingVisibility === 'oculto' && !isMe) continue
    const stats = rangeStats(sessionsBy.get(user.id) ?? [], tasksBy.get(user.id) ?? [], from)
    if (!stats.seconds && !stats.tasks && !stats.points && !isMe) continue
    entries.push({
      id: user.id,
      name: displayName(user.name, user.rankingVisibility),
      picture: user.rankingVisibility === 'nome' ? user.picture : undefined,
      ...stats,
      isMe,
    })
  }
  return { entries: sortRanking(entries, metric) }
})
