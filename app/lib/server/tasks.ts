import { CATEGORY_CONFIG, PRIORITY_CONFIG, type ChecklistItem, type Org, type Priority, type Recurrence, type Session, type Task, type TaskCategory, type TaskComment } from '../../types'
import { isCompleted } from '../points'
import { canSuperviseTask, groupSiblings } from '../org'
import { fail } from './api'
import { newId, type DB } from './store'

export type TaskPatch = Partial<
  Pick<
    Task,
    | 'title' | 'description' | 'category' | 'priority' | 'focusDuration' | 'deadline' | 'tags'
    | 'checklist' | 'requiresApproval' | 'requiresAttachment' | 'recurrence' | 'notified'
  >
> & { deadline?: string | null; recurrence?: Recurrence | null }

const RECURRENCES: Recurrence[] = ['diaria', 'semanal', 'mensal']

export function cleanTaskFields(input: TaskPatch): Partial<Task> {
  const out: Partial<Task> = {}
  if (input.title !== undefined) out.title = String(input.title).trim().slice(0, 120)
  if (input.description !== undefined) out.description = String(input.description).slice(0, 5000)
  if (input.category && CATEGORY_CONFIG[input.category as TaskCategory]) out.category = input.category
  if (input.priority && PRIORITY_CONFIG[input.priority as Priority]) out.priority = input.priority
  if (input.focusDuration !== undefined) out.focusDuration = Math.min(600, Math.max(1, Math.round(Number(input.focusDuration) || 25)))
  if (input.deadline !== undefined) {
    const d = input.deadline ? new Date(input.deadline) : null
    out.deadline = d && !Number.isNaN(d.getTime()) ? d.toISOString() : undefined
  }
  if (Array.isArray(input.tags)) out.tags = input.tags.map(t => String(t).slice(0, 30)).slice(0, 20)
  if (Array.isArray(input.checklist)) {
    out.checklist = input.checklist.slice(0, 100).map((c: ChecklistItem) => ({
      id: c.id || newId(),
      text: String(c.text ?? '').slice(0, 200),
      done: !!c.done,
    }))
  }
  if (input.requiresApproval !== undefined) out.requiresApproval = !!input.requiresApproval
  if (input.requiresAttachment !== undefined) out.requiresAttachment = !!input.requiresAttachment
  if (input.recurrence !== undefined) out.recurrence = input.recurrence && RECURRENCES.includes(input.recurrence) ? input.recurrence : undefined
  if (input.notified !== undefined) out.notified = !!input.notified
  return out
}

export function checkReviewer(db: DB, org: Org, reviewerId: string, assigneeId?: string) {
  const reviewer = db.members.find(m => m.id === reviewerId && m.orgId === org.id)
  if (!reviewer || !canSuperviseTask(reviewer, org)) fail(400, 'Escolhe um supervisor ou administrador para aprovar')
  if (reviewerId === assigneeId) fail(400, 'O supervisor não pode ser o próprio responsável')
  return reviewerId
}

/** O cliente pode gerar o id (actualizações optimistas) */
export function pickId(db: DB, id?: string) {
  return id && /^[\w-]{8,64}$/.test(id) && !db.tasks.some(t => t.id === id) ? id : newId()
}

export function buildTask(id: string, fields: Partial<Task>, extra: Partial<Task>): Task {
  const category = fields.category ?? 'trabalho'
  const now = Date.now()
  return {
    id,
    title: fields.title || 'Sem título',
    description: fields.description ?? '',
    category,
    status: 'todo',
    priority: fields.priority ?? 'media',
    focusDuration: fields.focusDuration ?? CATEGORY_CONFIG[category].defaultFocus,
    deadline: fields.deadline,
    tags: fields.tags ?? [],
    checklist: fields.checklist ?? [],
    createdAt: now,
    updatedAt: now,
    ...extra,
  }
}

export function cleanSessions(db: DB, input: Session[], allowedTasks: Set<string>, owner: Partial<Session>) {
  const known = new Set(db.sessions.map(s => s.id))
  const now = Date.now()
  const out: Session[] = []
  for (const s of input ?? []) {
    if (!s?.id || known.has(String(s.id)) || !allowedTasks.has(s.taskId)) continue
    const start = Number(s.start)
    const end = Math.min(Number(s.end), now + 60 * 1000)
    if (!(start > 0) || !(end > start)) continue
    const task = db.tasks.find(t => t.id === s.taskId)!
    known.add(String(s.id))
    out.push({
      id: String(s.id),
      taskId: s.taskId,
      category: task.category,
      start,
      end,
      seconds: Math.min(Math.round((end - start) / 1000), Math.max(0, Number(s.seconds) || 0)),
      ...owner,
    })
  }
  return out
}

export function addComment(task: Task, author: { id: string; name: string }, text: string, kind: TaskComment['kind']) {
  task.comments = [
    ...(task.comments ?? []),
    { id: newId(), authorId: author.id, authorName: author.name, text: text.slice(0, 2000), at: Date.now(), kind },
  ]
}

export function deleteTask(db: DB, taskId: string) {
  const task = db.tasks.find(t => t.id === taskId)
  db.tasks = db.tasks.filter(t => t.id !== taskId)
  db.sessions = db.sessions.filter(s => s.taskId !== taskId)
  return task?.attachments?.map(a => a.id) ?? []
}

export const SHARED_FIELDS = [
  'title', 'description', 'category', 'priority', 'focusDuration', 'deadline', 'tags',
  'requiresApproval', 'requiresAttachment', 'recurrence',
] as const

export function mergeChecklist(next: ChecklistItem[], current: ChecklistItem[] = []) {
  const done = new Map(current.map(c => [c.id, c.done]))
  return next.map(c => ({ ...c, done: done.get(c.id) ?? false }))
}

export function cloneForAssignee(task: Task, assignee: { id: string; departmentId?: string }, creatorId: string): Task {
  const now = Date.now()
  return {
    ...task,
    id: newId(),
    assigneeId: assignee.id,
    departmentId: assignee.departmentId,
    createdBy: creatorId,
    status: 'todo',
    createdAt: now,
    updatedAt: now,
    completedAt: undefined,
    notified: false,
    review: undefined,
    attachments: [],
    comments: [],
    checklist: task.checklist?.map(c => ({ ...c, done: false })),
    groupSummary: undefined,
  }
}

export function withGroup(db: DB, task: Task): Task {
  if (!task.groupId) return task
  const list = groupSiblings(db.tasks, task)
  return { ...task, groupSummary: { total: list.length, done: list.filter(isCompleted).length } }
}

function shift(ts: number, r: NonNullable<Task['recurrence']>) {
  const d = new Date(ts)
  if (r === 'diaria') d.setDate(d.getDate() + 1)
  else if (r === 'semanal') d.setDate(d.getDate() + 7)
  else d.setMonth(d.getMonth() + 1)
  return d.getTime()
}

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
    // mesmos ids: nas tarefas de grupo, as cópias da repetição seguinte continuam a corresponder
    checklist: task.checklist?.map(c => ({ ...c, done: false })),
    // cada pessoa gera a sua cópia; o grupo da repetição seguinte junta-as pelo número
    occurrence: task.groupId ? (task.occurrence ?? 0) + 1 : undefined,
    groupSummary: undefined,
  })
}
