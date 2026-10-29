import { handle, requireMember } from '../../../../lib/server/api'
import { memberEntry, sortRanking } from '../../../../lib/server/views'
import { rangeStats, withHistory } from '../../../../lib/points'
import { teamMembers } from '../../../../lib/org'
import type { RankEntry, RankMetric } from '../../../../types'

/** Ranking dos funcionários e dos departamentos. ?from=<ms>&metric= */
export const GET = handle<{ orgId: string }>(async (req, { orgId }) => {
  const url = new URL(req.url)
  const from = Number(url.searchParams.get('from')) || 0
  const { db, org, me } = await requireMember(orgId, { tasks: true, sessions: { since: from } })
  const metric = (url.searchParams.get('metric') as RankMetric) || 'points'

  // só pessoas: a conta da empresa não compete com a equipa
  const members = teamMembers(db.members, org).filter(m => m.orgId === orgId && m.status === 'activo')
  const tasks = db.tasks.filter(t => t.orgId === orgId)
  const entries: RankEntry[] = members.map(m => ({
    ...memberEntry(m, m.id === me.id),
    ...withHistory(
      rangeStats(db.sessions.filter(s => s.memberId === m.id), tasks.filter(t => t.assigneeId === m.id), from),
      m.history,
      from,
    ),
  }))

  const departments = db.departments
    .filter(d => d.orgId === orgId)
    .map(d => {
      const list = entries.filter(e => e.departmentId === d.id)
      const sum = (k: 'seconds' | 'tasks' | 'points') => list.reduce((a, e) => a + e[k], 0)
      return { id: d.id, name: d.name, color: d.color, members: list.length, seconds: sum('seconds'), tasks: sum('tasks'), points: sum('points') }
    })
    .filter(d => d.members > 0)

  return { entries: sortRanking(entries, metric), departments }
})
