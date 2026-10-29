import type { RankMetric } from '../../types'
import { accountTypeOf } from '../account'
import { rangeStats, withHistory } from '../points'
import { teamMembers } from '../org'
import type { DB } from './store'

/**
 * Rankings vistos pelo painel: empresas, contas pessoais e funcionários de uma empresa.
 * O painel vê tudo com nomes reais, incluindo quem se escondeu (marcado como "hidden").
 */

export type RankKind = 'empresas' | 'pessoais' | 'funcionarios'

export type PanelRankEntry = {
  id: string
  name: string
  /** email, sector ou cargo */
  sub: string
  picture?: string
  /** empresas: pessoas activas */
  members?: number
  department?: string
  seconds: number
  tasks: number
  points: number
  /** escondido do ranking público (empresa nas definições, pessoa no perfil) */
  hidden: boolean
  /** ficha no painel */
  href?: string
}

const KEY = { points: 'points', hours: 'seconds', tasks: 'tasks' } as const

export function panelRanking(db: DB, kind: RankKind, metric: RankMetric, from: number, orgId?: string): PanelRankEntry[] {
  const key = KEY[metric] ?? 'points'
  const byKey = (a: PanelRankEntry, b: PanelRankEntry) => b[key] - a[key] || b.points - a.points || a.name.localeCompare(b.name)

  if (kind === 'empresas') {
    const avg = (e: PanelRankEntry) => (e.members ? e[key] / e.members : 0)
    return db.orgs
      .map(org => {
        const members = teamMembers(db.members, org).filter(m => m.orgId === org.id && m.status === 'activo')
        const total = { seconds: 0, tasks: 0, points: 0 }
        for (const m of members) {
          const s = withHistory(rangeStats(db.sessions.filter(x => x.memberId === m.id), db.tasks.filter(t => t.orgId === org.id && t.assigneeId === m.id), from), m.history, from)
          total.seconds += s.seconds
          total.tasks += s.tasks
          total.points += s.points
        }
        return { id: org.id, name: org.name, sub: org.sector || 'Sem sector', members: members.length, ...total, hidden: !!org.hideFromRanking, href: `/marcos/faz/empresas/${org.id}` }
      })
      .filter(e => e.members > 0)
      // como no ranking público: média por pessoa activa
      .sort((a, b) => avg(b) - avg(a) || b[key] - a[key] || a.name.localeCompare(b.name))
  }

  if (kind === 'pessoais') {
    const inOrg = new Set(db.members.filter(m => m.status === 'activo' && m.userId).map(m => m.userId!))
    return db.users
      .filter(u => accountTypeOf(u, inOrg.has(u.id)) === 'personal')
      .map(u => ({
        id: u.id,
        name: u.name,
        sub: u.email,
        picture: u.picture,
        ...rangeStats(db.sessions.filter(s => s.userId === u.id), db.tasks.filter(t => t.ownerId === u.id && !t.orgId), from),
        hidden: u.rankingVisibility === 'oculto',
        href: `/marcos/faz/utilizadores/${u.id}`,
      }))
      .sort(byKey)
  }

  // funcionários de uma empresa
  const departments = db.departments.filter(d => d.orgId === orgId)
  return teamMembers(db.members, db.orgs.find(o => o.id === orgId))
    .filter(m => m.orgId === orgId && m.status === 'activo')
    .map(m => ({
      id: m.id,
      name: m.name,
      sub: m.jobTitle || m.email,
      picture: m.picture,
      department: m.departmentId ? departments.find(d => d.id === m.departmentId)?.name : undefined,
      ...withHistory(rangeStats(db.sessions.filter(s => s.memberId === m.id), db.tasks.filter(t => t.orgId === orgId && t.assigneeId === m.id), from), m.history, from),
      hidden: false,
      href: m.userId ? `/marcos/faz/utilizadores/${m.userId}` : undefined,
    }))
    .sort(byKey)
}
