import { fail, handle, requireUser } from '../../lib/server/api'
import { read } from '../../lib/server/store'
import { displayName, sortRanking } from '../../lib/server/views'
import { accountTypeOf, BUSINESS_ONLY } from '../../lib/account'
import { rangeStats } from '../../lib/points'
import type { RankEntry, RankMetric, Session, Task } from '../../types'

/** Ranking das contas pessoais (só entre si: funcionários de empresas não entram). ?from=<ms>&metric= */
export const GET = handle(async req => {
  const me = await requireUser()
  const url = new URL(req.url)
  const from = Number(url.searchParams.get('from')) || 0
  const metric = (url.searchParams.get('metric') as RankMetric) || 'points'
  // todos os utilizadores e o trabalho do espaço pessoal (sem tarefas/sessões de empresas)
  const db = await read(async l => {
    await l.load('users')
    await l.load('members', { user_id: l.db.users.map(u => u.id) })
    await l.load('tasks', { org_id: null })
    await l.load('sessions', { member_id: null, ...(from ? { start_at: { gte: from } } : {}) })
  })

  const inOrg = new Set(db.members.filter(m => m.status === 'activo' && m.userId).map(m => m.userId!))
  const personal = (id: string) => {
    const u = db.users.find(x => x.id === id)
    return !!u && accountTypeOf(u, inOrg.has(u.id)) === 'personal'
  }
  if (!personal(me.id)) fail(403, BUSINESS_ONLY)

  const tasksBy = new Map<string, Task[]>()
  db.tasks.forEach(t => { if (t.ownerId) tasksBy.set(t.ownerId, [...(tasksBy.get(t.ownerId) ?? []), t]) })
  const sessionsBy = new Map<string, Session[]>()
  db.sessions.forEach(s => { if (s.userId) sessionsBy.set(s.userId, [...(sessionsBy.get(s.userId) ?? []), s]) })

  const entries: RankEntry[] = []
  for (const user of db.users) {
    if (!personal(user.id)) continue
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
