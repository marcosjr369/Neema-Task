import type {
  AccountType, PresenceStatus, Priority, RankingVisibility, ReviewStatus, Role, Session, Task, TaskCategory, TaskStatus,
} from '../../types'
import { DEFAULT_SETTINGS, PRESENCE_STATUSES } from '../../types'
import { accountTypeOf } from '../account'
import { completedTime, isCompleted, rangeStats } from '../points'
import { bestStreak, categoryBreakdown, computeStreak, levelInfo, totalXp } from '../stats'
import { effectivePresence } from './org'
import { dayKeyFn, dayKeys } from './panelStats'
import type { DB } from './store'

/** Fichas de detalhe do painel: um utilizador ou uma empresa, com tudo o que lhes diz respeito */

const DAY = 24 * 60 * 60 * 1000

export type DayWork = { day: string; focusSeconds: number; tasksDone: number }

export type PanelTask = {
  id: string
  title: string
  status: TaskStatus
  priority: Priority
  category: TaskCategory
  deadline?: string
  createdAt: number
  completedAt?: number
  review?: ReviewStatus
  orgName?: string
  assigneeName?: string
  departmentName?: string
  attachments: number
  focusSeconds: number
}

export type UserDetail = {
  generatedAt: number
  user: {
    id: string
    name: string
    email: string
    picture?: string
    type: AccountType | 'none'
    createdAt: number
    disabled: boolean
    disabledAt?: number
    emailVerified: boolean
    timezone?: string
    rankingVisibility: RankingVisibility
    dailyGoalMinutes: number
    pushDevices: number
  }
  lastActive?: number
  allTime: { focusSeconds: number; tasksDone: number; xp: number; level: number; progress: number; streak: number; bestStreak: number }
  period: { focusSeconds: number; tasksDone: number; points: number; activeDays: number }
  series: DayWork[]
  categories: { category: TaskCategory; seconds: number }[]
  memberships: {
    orgId: string
    orgName: string
    role: Role
    department?: string
    status: 'activo' | 'pendente'
    presence: PresenceStatus
    joinedAt?: number
    lastSeen?: number
  }[]
  tasks: PanelTask[]
  recentSessions: { id: string; start: number; seconds: number; taskTitle: string; orgName?: string }[]
}

export type OrgDetail = {
  generatedAt: number
  org: {
    id: string
    name: string
    sector: string
    size?: string
    domain?: string
    inviteCode: string
    createdAt: number
    createdBy?: { id: string; name: string }
    hidden: boolean
  }
  totals: { members: number; pending: number; departments: number; tasksOpen: number; tasksDone: number; awaitingReview: number }
  period: { focusSeconds: number; tasksDone: number; points: number; activeMembers: number }
  series: DayWork[]
  presenceNow: { status: PresenceStatus; count: number }[]
  departments: { id: string; name: string; color: string; members: number; supervisors: string[]; focusSeconds: number; points: number }[]
  members: {
    id: string
    userId?: string
    name: string
    email: string
    picture?: string
    role: Role
    department?: string
    jobTitle?: string
    status: 'activo' | 'pendente'
    presence: PresenceStatus
    joinedAt?: number
    lastSeen?: number
    focusSeconds: number
    tasksDone: number
    points: number
  }[]
  tasks: PanelTask[]
}

/** Trabalho por dia (foco e tarefas concluídas) nas últimas `days` datas */
function workSeries(sessions: Session[], tasks: Task[], days: number, tz: string, now: number): DayWork[] {
  const key = dayKeyFn(tz)
  const keys = dayKeys(now, days, key)
  const map = new Map(keys.map(day => [day, { day, focusSeconds: 0, tasksDone: 0 }]))
  sessions.forEach(s => { const d = map.get(key(s.start)); if (d) d.focusSeconds += s.seconds })
  tasks.forEach(t => {
    const at = completedTime(t)
    if (at === undefined || !isCompleted(t)) return
    const d = map.get(key(at))
    if (d) d.tasksDone++
  })
  return keys.map(k => map.get(k)!)
}

/** Ordem das listas de tarefas: por fazer primeiro, depois as mais recentes */
const taskOrder = (a: PanelTask, b: PanelTask) =>
  (a.status === 'done' ? 1 : 0) - (b.status === 'done' ? 1 : 0) || (b.completedAt ?? b.createdAt) - (a.completedAt ?? a.createdAt)

function toPanelTask(db: DB, t: Task): PanelTask {
  const assignee = t.assigneeId ? db.members.find(m => m.id === t.assigneeId) : undefined
  return {
    id: t.id,
    title: t.title,
    status: t.status,
    priority: t.priority,
    category: t.category,
    deadline: t.deadline,
    createdAt: t.createdAt,
    completedAt: completedTime(t),
    review: t.requiresApproval ? t.review?.status : undefined,
    orgName: t.orgId ? db.orgs.find(o => o.id === t.orgId)?.name : undefined,
    assigneeName: assignee?.name,
    departmentName: t.departmentId ? db.departments.find(d => d.id === t.departmentId)?.name : undefined,
    attachments: t.attachments?.length ?? 0,
    focusSeconds: db.sessions.reduce((a, s) => (s.taskId === t.id ? a + s.seconds : a), 0),
  }
}

export function userDetail(db: DB, userId: string, days: number, tz: string, now = Date.now()): UserDetail | null {
  const u = db.users.find(x => x.id === userId)
  if (!u) return null
  const members = db.members.filter(m => m.userId === u.id)
  const memberIds = new Set(members.map(m => m.id))
  const sessions = db.sessions.filter(s => s.userId === u.id || (s.memberId && memberIds.has(s.memberId)))
  const tasks = db.tasks.filter(t => t.ownerId === u.id || (t.assigneeId && memberIds.has(t.assigneeId)))
  const series = workSeries(sessions, tasks, days, tz, now)
  const from = now - days * DAY
  const xp = totalXp(sessions, tasks)
  const level = levelInfo(xp)
  const lastSeen = Math.max(0, ...sessions.map(s => s.end || s.start), ...members.map(m => m.lastSeen ?? 0))

  return {
    generatedAt: now,
    user: {
      id: u.id,
      name: u.name,
      email: u.email,
      picture: u.picture,
      type: accountTypeOf(u, members.some(m => m.status === 'activo')) ?? 'none',
      createdAt: u.createdAt,
      disabled: !!u.disabled,
      disabledAt: u.disabledAt,
      emailVerified: u.emailVerified !== false,
      timezone: u.timezone,
      rankingVisibility: u.rankingVisibility,
      dailyGoalMinutes: u.settings?.dailyGoalMinutes ?? DEFAULT_SETTINGS.dailyGoalMinutes,
      pushDevices: db.push.filter(p => p.userId === u.id).length,
    },
    lastActive: lastSeen || undefined,
    allTime: {
      focusSeconds: sessions.reduce((a, s) => a + s.seconds, 0),
      tasksDone: tasks.filter(isCompleted).length,
      xp,
      level: level.level,
      progress: level.progress,
      streak: computeStreak(sessions, tasks, now).streak,
      bestStreak: bestStreak(sessions, tasks),
    },
    period: {
      focusSeconds: series.reduce((a, d) => a + d.focusSeconds, 0),
      tasksDone: series.reduce((a, d) => a + d.tasksDone, 0),
      points: rangeStats(sessions, tasks, from).points,
      activeDays: series.filter(d => d.focusSeconds >= 60 || d.tasksDone > 0).length,
    },
    series,
    categories: categoryBreakdown(sessions.filter(s => s.start >= from)),
    memberships: members.map(m => ({
      orgId: m.orgId,
      orgName: db.orgs.find(o => o.id === m.orgId)?.name ?? '—',
      role: m.role,
      department: m.departmentId ? db.departments.find(d => d.id === m.departmentId)?.name : undefined,
      status: m.status,
      presence: effectivePresence(m, now),
      joinedAt: m.joinedAt,
      lastSeen: m.lastSeen,
    })),
    tasks: tasks.map(t => toPanelTask(db, t)).sort(taskOrder).slice(0, 200),
    recentSessions: [...sessions]
      .sort((a, b) => b.start - a.start)
      .slice(0, 12)
      .map(s => {
        const task = db.tasks.find(t => t.id === s.taskId)
        return {
          id: s.id,
          start: s.start,
          seconds: s.seconds,
          taskTitle: task?.title ?? 'Tarefa apagada',
          orgName: task?.orgId ? db.orgs.find(o => o.id === task.orgId)?.name : undefined,
        }
      }),
  }
}

export function orgDetail(db: DB, orgId: string, days: number, tz: string, now = Date.now()): OrgDetail | null {
  const org = db.orgs.find(o => o.id === orgId)
  if (!org) return null
  const members = db.members.filter(m => m.orgId === org.id)
  const active = members.filter(m => m.status === 'activo')
  const memberIds = new Set(members.map(m => m.id))
  const sessions = db.sessions.filter(s => s.memberId && memberIds.has(s.memberId))
  const tasks = db.tasks.filter(t => t.orgId === org.id)
  const series = workSeries(sessions, tasks, days, tz, now)
  const from = now - days * DAY
  const departments = db.departments.filter(d => d.orgId === org.id)
  const creator = db.users.find(u => u.id === org.createdBy)

  const memberRows = members
    .map(m => {
      const s = rangeStats(sessions.filter(x => x.memberId === m.id), tasks.filter(t => t.assigneeId === m.id), from)
      return {
        id: m.id,
        userId: m.userId,
        name: m.name,
        email: m.email,
        picture: m.picture,
        role: m.role,
        department: m.departmentId ? departments.find(d => d.id === m.departmentId)?.name : undefined,
        jobTitle: m.jobTitle,
        status: m.status,
        presence: effectivePresence(m, now),
        joinedAt: m.joinedAt,
        lastSeen: m.lastSeen,
        focusSeconds: s.seconds,
        tasksDone: s.tasks,
        points: s.points,
      }
    })
    .sort((a, b) => (a.status === b.status ? b.points - a.points : a.status === 'activo' ? -1 : 1))

  const presence = new Map<PresenceStatus, number>()
  active.forEach(m => { const p = effectivePresence(m, now); presence.set(p, (presence.get(p) ?? 0) + 1) })

  return {
    generatedAt: now,
    org: {
      id: org.id,
      name: org.name,
      sector: org.sector,
      size: org.size,
      domain: org.domain,
      inviteCode: org.inviteCode,
      createdAt: org.createdAt,
      createdBy: creator ? { id: creator.id, name: creator.name } : undefined,
      hidden: !!org.hideFromRanking,
    },
    totals: {
      members: active.length,
      pending: members.length - active.length,
      departments: departments.length,
      tasksOpen: tasks.filter(t => !isCompleted(t)).length,
      tasksDone: tasks.filter(isCompleted).length,
      awaitingReview: tasks.filter(t => t.requiresApproval && t.status === 'done' && t.review?.status === 'pending').length,
    },
    period: {
      focusSeconds: series.reduce((a, d) => a + d.focusSeconds, 0),
      tasksDone: series.reduce((a, d) => a + d.tasksDone, 0),
      points: memberRows.reduce((a, m) => a + m.points, 0),
      activeMembers: new Set(sessions.filter(s => s.start >= from).map(s => s.memberId)).size,
    },
    series,
    presenceNow: PRESENCE_STATUSES.map(status => ({ status, count: presence.get(status) ?? 0 })).filter(p => p.count > 0),
    departments: departments.map(d => {
      const list = memberRows.filter(m => m.status === 'activo' && m.department === d.name)
      return {
        id: d.id,
        name: d.name,
        color: d.color,
        members: list.length,
        supervisors: d.supervisorIds.map(id => members.find(m => m.id === id)?.name).filter((x): x is string => !!x),
        focusSeconds: list.reduce((a, m) => a + m.focusSeconds, 0),
        points: list.reduce((a, m) => a + m.points, 0),
      }
    }),
    members: memberRows,
    tasks: tasks.map(t => toPanelTask(db, t)).sort(taskOrder).slice(0, 300),
  }
}
