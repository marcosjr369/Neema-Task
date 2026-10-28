import type { AccountType, DeletedUser, Role } from '../../types'
import { accountTypeOf } from '../account'
import { completedTime, isCompleted, rangeStats } from '../points'
import type { DB } from './store'

/** Métricas do painel de administração, calculadas sobre a base de dados inteira */

const DAY = 24 * 60 * 60 * 1000

export type DayStat = {
  /** AAAA-MM-DD no fuso de quem vê */
  day: string
  signupsPersonal: number
  signupsBusiness: number
  activeUsers: number
  focusSeconds: number
  tasksDone: number
}

export type PanelUser = {
  id: string
  name: string
  email: string
  picture?: string
  type: AccountType | 'none'
  createdAt: number
  disabled: boolean
  orgs: { id: string; name: string; role: Role }[]
  lastActive?: number
  /** no período escolhido */
  focusSeconds: number
  tasksDone: number
  points: number
}

export type PanelOrg = {
  id: string
  name: string
  sector: string
  createdAt: number
  members: number
  pending: number
  admins: string[]
  hidden: boolean
  focusSeconds: number
  tasksDone: number
  points: number
}

export type PanelOverview = {
  generatedAt: number
  days: number
  totals: {
    users: number
    personal: number
    business: number
    none: number
    disabled: number
    deleted: number
    orgs: number
    members: number
    activeToday: number
    active7: number
    active30: number
  }
  period: { signups: number; deletions: number; focusSeconds: number; tasksDone: number; avgActive: number }
  series: DayStat[]
  users: PanelUser[]
  orgs: PanelOrg[]
  /** utilizadores eliminados, do mais recente para o mais antigo */
  deleted: DeletedUser[]
}

/** Data AAAA-MM-DD de um instante, no fuso indicado (UTC se o fuso for inválido) */
export function dayKeyFn(timeZone: string) {
  let fmt: Intl.DateTimeFormat
  try {
    fmt = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })
  } catch {
    fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' })
  }
  return (ts: number) => fmt.format(ts)
}

/** Lista das últimas `days` datas (AAAA-MM-DD) no fuso indicado, da mais antiga para hoje */
export function dayKeys(now: number, days: number, key: (ts: number) => string) {
  const [y, m, d] = key(now).split('-').map(Number)
  const today = Date.UTC(y, m - 1, d)
  return Array.from({ length: days }, (_, i) => new Date(today - (days - 1 - i) * DAY).toISOString().slice(0, 10))
}

export function panelOverview(db: DB, days: number, timeZone: string, now = Date.now()): PanelOverview {
  const key = dayKeyFn(timeZone)
  const keys = dayKeys(now, days, key)
  const inRange = new Set(keys)
  const from = now - (days + 1) * DAY // margem: o filtro fino é pela data no fuso

  // quem é dono de cada sessão/tarefa (pessoal: userId/ownerId; empresa: membro → utilizador)
  const userOfMember = new Map(db.members.filter(m => m.userId).map(m => [m.id, m.userId!]))
  const ownerOfSession = (s: DB['sessions'][number]) => s.userId ?? (s.memberId ? userOfMember.get(s.memberId) : undefined)
  const ownerOfTask = (t: DB['tasks'][number]) => t.ownerId ?? (t.assigneeId ? userOfMember.get(t.assigneeId) : undefined)
  const activeMemberships = db.members.filter(m => m.status === 'activo' && m.userId)
  const inOrg = new Set(activeMemberships.map(m => m.userId!))
  const typeOf = (u: DB['users'][number]): AccountType | 'none' => accountTypeOf(u, inOrg.has(u.id)) ?? 'none'

  // dias com actividade e última actividade de cada utilizador
  const activeDays = new Map<string, Set<string>>()
  const lastActive = new Map<string, number>()
  const touch = (userId: string | undefined, ts: number) => {
    if (!userId) return
    if (ts > (lastActive.get(userId) ?? 0)) lastActive.set(userId, ts)
    const days = activeDays.get(userId) ?? new Set<string>()
    days.add(key(ts))
    activeDays.set(userId, days)
  }
  for (const s of db.sessions) touch(ownerOfSession(s), s.end || s.start)
  for (const m of db.members) if (m.lastSeen) touch(m.userId, m.lastSeen)

  const byDay = new Map<string, DayStat>(
    keys.map(day => [day, { day, signupsPersonal: 0, signupsBusiness: 0, activeUsers: 0, focusSeconds: 0, tasksDone: 0 }]),
  )
  for (const u of db.users) {
    const d = byDay.get(key(u.createdAt))
    if (!d) continue
    if (typeOf(u) === 'business') d.signupsBusiness++
    else d.signupsPersonal++
  }
  for (const days of activeDays.values()) for (const day of days) { const d = byDay.get(day); if (d) d.activeUsers++ }
  for (const s of db.sessions) { const d = s.start >= from ? byDay.get(key(s.start)) : undefined; if (d) d.focusSeconds += s.seconds }
  for (const t of db.tasks) {
    const at = completedTime(t)
    if (at === undefined || !isCompleted(t)) continue
    const d = byDay.get(key(at))
    if (d) d.tasksDone++
  }
  const series = keys.map(k => byDay.get(k)!)

  const todayKey = keys[keys.length - 1]
  const activeWithin = (n: number) => {
    const recent = new Set(dayKeys(now, n, key))
    let count = 0
    for (const days of activeDays.values()) if ([...days].some(d => recent.has(d))) count++
    return count
  }
  const rangeFrom = Date.parse(`${keys[0]}T00:00:00Z`) - 14 * 60 * 60 * 1000 // cobre qualquer fuso

  // trabalho de cada utilizador no período
  const sessionsBy = new Map<string, DB['sessions']>()
  for (const s of db.sessions) {
    const owner = ownerOfSession(s)
    if (owner && inRange.has(key(s.start))) sessionsBy.set(owner, [...(sessionsBy.get(owner) ?? []), s])
  }
  const tasksBy = new Map<string, DB['tasks']>()
  for (const t of db.tasks) {
    const owner = ownerOfTask(t)
    if (owner) tasksBy.set(owner, [...(tasksBy.get(owner) ?? []), t])
  }

  const users: PanelUser[] = db.users
    .map(u => {
      const stats = rangeStats(sessionsBy.get(u.id) ?? [], tasksBy.get(u.id) ?? [], rangeFrom)
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        picture: u.picture,
        type: typeOf(u),
        createdAt: u.createdAt,
        disabled: !!u.disabled,
        orgs: activeMemberships
          .filter(m => m.userId === u.id)
          .map(m => ({ id: m.orgId, name: db.orgs.find(o => o.id === m.orgId)?.name ?? '—', role: m.role })),
        lastActive: lastActive.get(u.id),
        focusSeconds: stats.seconds,
        tasksDone: stats.tasks,
        points: stats.points,
      }
    })
    .sort((a, b) => b.createdAt - a.createdAt)

  const orgs: PanelOrg[] = db.orgs
    .map(o => {
      const members = db.members.filter(m => m.orgId === o.id)
      const active = members.filter(m => m.status === 'activo')
      const total = { focusSeconds: 0, tasksDone: 0, points: 0 }
      for (const m of active) {
        const s = rangeStats(
          db.sessions.filter(x => x.memberId === m.id && inRange.has(key(x.start))),
          db.tasks.filter(t => t.orgId === o.id && t.assigneeId === m.id),
          rangeFrom,
        )
        total.focusSeconds += s.seconds
        total.tasksDone += s.tasks
        total.points += s.points
      }
      return {
        id: o.id,
        name: o.name,
        sector: o.sector,
        createdAt: o.createdAt,
        members: active.length,
        pending: members.length - active.length,
        admins: active.filter(m => m.role === 'admin').map(m => m.name),
        hidden: !!o.hideFromRanking,
        ...total,
      }
    })
    .sort((a, b) => b.points - a.points || b.members - a.members)

  const counted = db.users.map(typeOf)
  return {
    generatedAt: now,
    days,
    totals: {
      users: db.users.length,
      personal: counted.filter(t => t === 'personal').length,
      business: counted.filter(t => t === 'business').length,
      none: counted.filter(t => t === 'none').length,
      disabled: db.users.filter(u => u.disabled).length,
      deleted: db.deleted.length,
      orgs: db.orgs.length,
      members: activeMemberships.length,
      activeToday: [...activeDays.values()].filter(d => d.has(todayKey)).length,
      active7: activeWithin(7),
      active30: activeWithin(30),
    },
    period: {
      signups: series.reduce((a, d) => a + d.signupsPersonal + d.signupsBusiness, 0),
      deletions: db.deleted.filter(d => inRange.has(key(d.deletedAt))).length,
      focusSeconds: series.reduce((a, d) => a + d.focusSeconds, 0),
      tasksDone: series.reduce((a, d) => a + d.tasksDone, 0),
      avgActive: Math.round((series.reduce((a, d) => a + d.activeUsers, 0) / days) * 10) / 10,
    },
    series,
    users,
    orgs,
    deleted: [...db.deleted].sort((a, b) => b.deletedAt - a.deletedAt),
  }
}
