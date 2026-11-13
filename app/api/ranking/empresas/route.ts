import { handle, requireUser } from '../../../lib/server/api'
import { read } from '../../../lib/server/store'
import { rangeStats, withHistory } from '../../../lib/points'
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
  // duas fases em paralelo: empresas e membros; depois as tarefas e as sessões deles
  const db = await read(async l => {
    await Promise.all([l.load('orgs'), l.load('members')])
    const ids = l.db.members.filter(m => m.status === 'activo').map(m => m.id)
    await Promise.all([
      l.load('tasks', { org_id: l.db.orgs.map(o => o.id) }),
      l.load('sessions', { member_id: ids, ...(from ? { start_at: { gte: from } } : {}) }),
    ])
  })

  // agrupar uma vez, em vez de filtrar todas as sessões e tarefas para cada pessoa
  const sessionsBy = new Map<string, typeof db.sessions>()
  for (const s of db.sessions) { if (s.memberId) { const l = sessionsBy.get(s.memberId); if (l) l.push(s); else sessionsBy.set(s.memberId, [s]) } }
  const tasksBy = new Map<string, typeof db.tasks>()
  for (const t of db.tasks) { if (t.orgId && t.assigneeId) { const k = `${t.orgId}:${t.assigneeId}`; const l = tasksBy.get(k); if (l) l.push(t); else tasksBy.set(k, [t]) } }

  const entries: OrgRankEntry[] = db.orgs.map(org => {
    const all = db.members.filter(m => m.orgId === org.id && m.status === 'activo')
    const members = teamMembers(all, org)
    const total = { seconds: 0, tasks: 0, points: 0 }
    for (const m of members) {
      const s = withHistory(
        rangeStats(sessionsBy.get(m.id) ?? [], tasksBy.get(`${org.id}:${m.id}`) ?? [], from),
        m.history,
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
