import type { Department, Member, PresenceStatus } from '../../types'
import { isCompanyAccount, teamMembers } from '../org'
import { managedDepartments } from './api'
import { newId, type DB } from './store'

/** Sem sinal do cliente há mais do que isto → offline */
export const STALE_MS = 3 * 60 * 1000

export function effectivePresence(m: Member, now = Date.now()): PresenceStatus {
  return m.lastSeen && now - m.lastSeen < STALE_MS ? m.presence : 'offline'
}

function closeIfStale(db: DB, m: Member, now: number) {
  if (!m.lastSeen || now - m.lastSeen < STALE_MS) return
  const open = db.presence.find(p => p.memberId === m.id && p.end === null)
  if (open) open.end = Math.max(open.start, m.lastSeen + 60 * 1000)
}

export function setPresence(db: DB, m: Member, status: PresenceStatus, now = Date.now()) {
  closeIfStale(db, m, now)
  const open = db.presence.find(p => p.memberId === m.id && p.end === null)
  if (open && open.status === status) {
    m.lastSeen = now
    return
  }
  if (open) open.end = now
  if (status !== 'offline') {
    db.presence.push({ id: newId(), orgId: m.orgId, memberId: m.id, status, start: now, end: null })
  }
  m.presence = status
  m.lastSeen = status === 'offline' ? undefined : now
}

export function visibleMembers(db: DB, me: Member) {
  const scope = managedDepartments(db, me)
  const org = db.orgs.find(o => o.id === me.orgId)
  return db.members.filter(
    m =>
      m.orgId === me.orgId &&
      !isCompanyAccount(m, org) &&
      (m.id === me.id || scope === 'all' || (!!m.departmentId && scope.has(m.departmentId))),
  )
}

export function syncSupervisors(db: DB, dept: Department, ids: string[]) {
  const org = db.orgs.find(o => o.id === dept.orgId)
  const valid = new Set(teamMembers(db.members.filter(m => m.orgId === dept.orgId), org).map(m => m.id))
  dept.supervisorIds = [...new Set(ids)].filter(id => valid.has(id))
  db.members.forEach(m => {
    if (dept.supervisorIds.includes(m.id) && m.role === 'membro') m.role = 'supervisor'
  })
}
