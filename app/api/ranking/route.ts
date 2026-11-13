import { fail, handle, requireUser } from '../../lib/server/api'
import { read } from '../../lib/server/store'
import { displayName, sortRanking } from '../../lib/server/views'
import { accountTypeOf, BUSINESS_ONLY } from '../../lib/account'
import { rangeStats } from '../../lib/points'
import type { RankEntry, RankMetric, Session, Task } from '../../types'

export const GET = handle(async req => {
  const me = await requireUser()
  const url = new URL(req.url)
  const from = Number(url.searchParams.get('from')) || 0
  const metric = (url.searchParams.get('metric') as RankMetric) || 'points'
  // tudo de uma vez (os membros só servem para saber quem está numa empresa)
  const db = await read(async l => {
    await Promise.all([
      l.load('users'),
      l.load('members'),
      l.load('tasks', { org_id: null }),
      l.load('sessions', { member_id: null, ...(from ? { start_at: { gte: from } } : {}) }),
    ])
  })

  const inOrg = new Set(db.members.filter(m => m.status === 'activo' && m.userId).map(m => m.userId!))
  const personal = (id: string) => {
    const u = db.users.find(x => x.id === id)
    return !!u && accountTypeOf(u, inOrg.has(u.id)) === 'personal'
  }
  if (!personal(me.id)) fail(403, BUSINESS_ONLY)

  const tasksBy = new Map<string, Task[]>()
  db.tasks.forEach(t => { if (t.ownerId) { const l = tasksBy.get(t.ownerId); if (l) l.push(t); else tasksBy.set(t.ownerId, [t]) } })
  const sessionsBy = new Map<string, Session[]>()
  db.sessions.forEach(s => { if (s.userId) { const l = sessionsBy.get(s.userId); if (l) l.push(s); else sessionsBy.set(s.userId, [s]) } })

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
