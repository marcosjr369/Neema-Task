import type { Department, Member, PresenceStatus, Task } from '../../types'
import { managedDepartments } from './api'
import { newId, type DB } from './store'

/** Sem sinal do cliente há mais do que isto → offline */
export const STALE_MS = 3 * 60 * 1000

export function effectivePresence(m: Member, now = Date.now()): PresenceStatus {
  return m.lastSeen && now - m.lastSeen < STALE_MS ? m.presence : 'offline'
}

/** Fecha o segmento aberto de quem deixou de dar sinal (ex.: fechou o browser) */
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

/** Membros cujos dados de tempo e presença o membro pode ver */
export function visibleMembers(db: DB, me: Member) {
  const scope = managedDepartments(db, me)
  return db.members.filter(
    m =>
      m.orgId === me.orgId &&
      (m.id === me.id || scope === 'all' || (!!m.departmentId && scope.has(m.departmentId))),
  )
}

/** Define os supervisores do departamento e promove-os a supervisor */
export function syncSupervisors(db: DB, dept: Department, ids: string[]) {
  const valid = new Set(db.members.filter(m => m.orgId === dept.orgId).map(m => m.id))
  dept.supervisorIds = [...new Set(ids)].filter(id => valid.has(id))
  db.members.forEach(m => {
    if (dept.supervisorIds.includes(m.id) && m.role === 'membro') m.role = 'supervisor'
  })
}

function shift(ts: number, r: NonNullable<Task['recurrence']>) {
  const d = new Date(ts)
  if (r === 'diaria') d.setDate(d.getDate() + 1)
  else if (r === 'semanal') d.setDate(d.getDate() + 7)
  else d.setMonth(d.getMonth() + 1)
  return d.getTime()
}

/** Tarefa recorrente concluída → cria a próxima ocorrência */
export function spawnNext(db: DB, task: Task) {
  if (!task.recurrence) return
  const now = Date.now()
  let deadline: string | undefined
  if (task.deadline) {
    let next = shift(new Date(task.deadline).getTime(), task.recurrence)
    while (next < now) next = shift(next, task.recurrence)
    deadline = new Date(next).toISOString()
  }
  db.tasks.push({
    ...task,
    id: newId(),
    status: 'todo',
    createdAt: now,
    updatedAt: now,
    completedAt: undefined,
    deadline,
    notified: false,
    review: undefined,
    attachments: [],
    comments: [],
    checklist: task.checklist?.map(c => ({ ...c, id: newId(), done: false })),
  })
}
