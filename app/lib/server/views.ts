import type { Member, RankEntry, RankingVisibility, User } from '../../types'
import type { DB } from './store'

export function displayName(name: string, visibility: RankingVisibility) {
  if (visibility !== 'iniciais') return name
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map(p => `${p[0].toUpperCase()}.`)
    .join(' ')
}

export function membershipsOf(db: DB, user: User) {
  return db.members
    .filter(m => m.userId === user.id && m.status === 'activo')
    .map(member => ({ member, org: db.orgs.find(o => o.id === member.orgId)! }))
    .filter(x => x.org)
}

/** Empresas a que o utilizador se pode juntar pelo domínio do email */
export function domainSuggestions(db: DB, user: User) {
  if (user.emailVerified === false) return []
  const domain = user.email.split('@')[1]
  const mine = new Set(db.members.filter(m => m.userId === user.id).map(m => m.orgId))
  return db.orgs
    .filter(o => o.domain && o.domain.toLowerCase() === domain && !mine.has(o.id))
    .map(o => ({ id: o.id, name: o.name, sector: o.sector }))
}

export function sortRanking(entries: RankEntry[], metric: 'points' | 'hours' | 'tasks') {
  const key = metric === 'hours' ? 'seconds' : metric === 'tasks' ? 'tasks' : 'points'
  return entries.sort((a, b) => b[key] - a[key] || b.points - a.points || a.name.localeCompare(b.name))
}

export const memberEntry = (m: Member, isMe: boolean): Omit<RankEntry, 'seconds' | 'tasks' | 'points'> => ({
  id: m.id,
  name: m.name,
  picture: m.picture,
  departmentId: m.departmentId,
  isMe,
})
