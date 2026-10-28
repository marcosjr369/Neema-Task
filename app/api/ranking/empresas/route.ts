import { handle, requireUser } from '../../../lib/server/api'
import { read } from '../../../lib/server/store'
import { rangeStats } from '../../../lib/points'
import { teamMembers } from '../../../lib/org'
import type { OrgRankEntry, RankMetric } from '../../../types'

/**
 * Ranking geral das empresas, visível para todos (contas pessoais e funcionários).
 * Ordena pela média por pessoa activa, para empresas pequenas competirem com as grandes.
 * Só mostra nomes de empresas e totais: nada de pessoas. Empresas escondidas nas definições
 * só aparecem aos próprios membros. ?from=<ms>&metric=
 */
export const GET = handle(async req => {
  const me = await requireUser()
  const url = new URL(req.url)
  const from = Number(url.searchParams.get('from')) || 0
  const metric = (url.searchParams.get('metric') as RankMetric) || 'points'
  const db = await read(async l => {
    await l.load('orgs')
    await l.load('members', { org_id: l.db.orgs.map(o => o.id) })
    await l.load('tasks', { org_id: l.db.orgs.map(o => o.id) })
    const ids = l.db.members.filter(m => m.status === 'activo').map(m => m.id)
    await l.load('sessions', { member_id: ids, ...(from ? { start_at: { gte: from } } : {}) })
  })

  const entries: OrgRankEntry[] = db.orgs.map(org => {
    const all = db.members.filter(m => m.orgId === org.id && m.status === 'activo')
    // a média é por pessoa: a conta da empresa não conta
    const members = teamMembers(all, org)
    const total = { seconds: 0, tasks: 0, points: 0 }
    for (const m of members) {
      const s = rangeStats(
        db.sessions.filter(x => x.memberId === m.id),
        db.tasks.filter(t => t.orgId === org.id && t.assigneeId === m.id),
        from,
      )
      total.seconds += s.seconds
      total.tasks += s.tasks
      total.points += s.points
    }
    return {
      id: org.id,
      name: org.name,
      sector: org.sector,
      members: members.length,
      ...total,
      isMine: all.some(m => m.userId === me.id),
      hidden: !!org.hideFromRanking,
    }
  })

  const key = metric === 'hours' ? 'seconds' : metric === 'tasks' ? 'tasks' : 'points'
  const avg = (e: OrgRankEntry) => (e.members ? e[key] / e.members : 0)
  const list = entries
    .filter(e => e.members > 0 && (e.isMine || (!e.hidden && (e.points > 0 || e.seconds > 0 || e.tasks > 0))))
    .sort((a, b) => avg(b) - avg(a) || b[key] - a[key] || a.name.localeCompare(b.name))
  return { entries: list }
})
