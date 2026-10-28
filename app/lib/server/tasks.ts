import { CATEGORY_CONFIG, PRIORITY_CONFIG, type ChecklistItem, type Org, type Priority, type Recurrence, type Session, type Task, type TaskCategory, type TaskComment } from '../../types'
import { canSuperviseTask } from '../org'
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

/** Valida e limpa os campos editáveis vindos do cliente */
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

/** Supervisor escolhido para a tarefa: tem de poder aprovar e não pode ser o próprio responsável */
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

/** Constrói uma tarefa nova a partir dos campos já validados */
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

/** Validação de sessões vindas do cliente (sem duplicados, sem tempos impossíveis) */
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

/** Apaga a tarefa, as sessões e devolve os anexos a remover do disco */
export function deleteTask(db: DB, taskId: string) {
  const task = db.tasks.find(t => t.id === taskId)
  db.tasks = db.tasks.filter(t => t.id !== taskId)
  db.sessions = db.sessions.filter(s => s.taskId !== taskId)
  return task?.attachments?.map(a => a.id) ?? []
}
