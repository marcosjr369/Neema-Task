import { body, canManage, fail, handle, requireMember, taskAccess } from '../../../../../lib/server/api'
import { orgScope, scopes } from '../../../../../lib/server/scopes'
import { mutate, type DB } from '../../../../../lib/server/store'
import { removeFiles } from '../../../../../lib/server/files'
import {
  addComment, checkReviewer, cleanTaskFields, cloneForAssignee, deleteTask, mergeChecklist, SHARED_FIELDS, spawnNext, withGroup, type TaskPatch,
} from '../../../../../lib/server/tasks'
import { groupKey, groupSiblings, isCompanyAccount } from '../../../../../lib/org'
import type { Member, Org, Task, TaskStatus } from '../../../../../types'

type UpdatePatch = TaskPatch & {
  assigneeId?: string
  reviewerId?: string | null
  assigneeIds?: string[]
  group?: boolean
}

type Action =
  | { action: 'update'; patch: UpdatePatch }
  | { action: 'status'; status: TaskStatus }
  | { action: 'approve'; comment?: string }
  | { action: 'reject'; comment?: string }
  | { action: 'comment'; text?: string }

const OWNER_FIELDS = ['checklist', 'notified', 'focusDuration'] as const

const wantedIds = (patch?: UpdatePatch) =>
  Array.isArray(patch?.assigneeIds) ? [...new Set(patch.assigneeIds.map(String).filter(Boolean))] : null

const canEdit = (db: DB, me: Member, t: Task) => taskAccess(db, me, t).manager || t.createdBy === me.id

function editGroup(db: DB, org: Org, me: Member, task: Task, fields: Partial<Task>, patch: UpdatePatch, files: string[]) {
  const now = Date.now()
  // tarefa simples a passar a grupo: o id dela passa a ser o do grupo
  if (!task.groupId) task.groupId = task.id
  const key = groupKey(task)
  const siblings = groupSiblings(db.tasks, task)
  const reviewerId = patch.reviewerId

  for (const s of siblings.filter(s => canEdit(db, me, s))) {
    const deadlineChanged = fields.deadline !== undefined && fields.deadline !== s.deadline
    for (const k of SHARED_FIELDS) if (k in fields) Object.assign(s, { [k]: fields[k] })
    if (deadlineChanged) s.notified = false
    if (fields.checklist) s.checklist = mergeChecklist(fields.checklist, s.checklist)
    if (reviewerId !== undefined) s.reviewerId = reviewerId ? checkReviewer(db, org, reviewerId, s.assigneeId) : undefined
    s.updatedAt = now
  }

  const wanted = wantedIds(patch)
  if (wanted) {
    if (!wanted.length) fail(400, 'Escolhe pelo menos um funcionário')
    if (wanted.length > 200) fail(400, 'No máximo 200 pessoas por tarefa')
    const current = new Set(siblings.map(s => s.assigneeId))

    for (const id of wanted.filter(id => !current.has(id))) {
      const a = db.members.find(m => m.id === id && m.orgId === org.id)
      if (!a || isCompanyAccount(a, org)) fail(400, 'Funcionário inválido')
      if (a!.id !== me.id && !canManage(db, me, a)) fail(403, `Só podes atribuir tarefas à tua equipa (${a!.name})`)
      if (task.reviewerId === a!.id) fail(400, `${a!.name} é o supervisor desta tarefa e não pode ser também responsável`)
      db.tasks.push(cloneForAssignee(task, a!, me.id))
    }

    // saem: só quem ainda não entregou (o trabalho entregue fica no histórico)
    for (const s of siblings.filter(s => !wanted.includes(s.assigneeId!))) {
      const name = db.members.find(m => m.id === s.assigneeId)?.name ?? 'Esta pessoa'
      if (!canEdit(db, me, s)) fail(403, `Não geres ${name}`)
      if (s.status === 'done') fail(400, `${name} já entregou esta tarefa e não pode ser retirado`)
      files.push(...deleteTask(db, s.id))
    }
  }

  const remaining = db.tasks.filter(t => t.groupId && groupKey(t) === key)
  if (remaining.length === 1) remaining[0].groupId = undefined
  return remaining.find(t => t.id === task.id) ?? remaining[0]
}

export const PATCH = handle<{ orgId: string; taskId: string }>(async (req, { orgId, taskId }) => {
  const { me } = await requireMember(orgId)
  const input = await body<Action>(req)
  const wanted = input.action === 'update' ? wantedIds(input.patch) : null

  const scope = scopes(orgScope(orgId), async l => {
    await l.load('tasks', { id: taskId })
    const t = l.db.tasks.find(x => x.id === taskId)
    if (t?.groupId || (wanted && wanted.length > 1)) {
      await l.load('tasks', { org_id: orgId })
      if (wanted && t) await l.load('sessions', { task_id: groupSiblings(l.db.tasks, t).filter(s => !wanted.includes(s.assigneeId!)).map(s => s.id) })
    }
  })

  const files: string[] = []
  const result = await mutate(scope, db => {
    const org = db.orgs.find(o => o.id === orgId)!
    let task = db.tasks.find(t => t.id === taskId && t.orgId === orgId) ?? fail(404, 'Tarefa não encontrada')
    const access = taskAccess(db, me, task)
    if (!access.view) fail(403, 'Sem acesso a esta tarefa')
    const editor = access.manager || task.createdBy === me.id
    const approved = task.review?.status === 'approved'
    const author = { id: me.id, name: me.name }
    const now = Date.now()

    switch (input.action) {
      case 'update': {
        const fields = cleanTaskFields(input.patch ?? {})
        if (!editor) {
          for (const key of Object.keys(fields) as (keyof typeof fields)[]) {
            if (!(OWNER_FIELDS as readonly string[]).includes(key)) delete fields[key]
          }
        }
        if (fields.title === '') delete fields.title
        if (editor && (input.patch?.group || (wanted && wanted.length > 1))) {
          task = editGroup(db, org, me, task, fields, input.patch, files)
          break
        }
        if (fields.deadline !== undefined && fields.deadline !== task.deadline) fields.notified = false
        Object.assign(task, fields)
        const assigneeId = input.patch?.assigneeId || (wanted?.length === 1 ? wanted[0] : undefined)
        if (editor && assigneeId && assigneeId !== task.assigneeId) {
          const target = db.members.find(m => m.id === assigneeId && m.orgId === orgId)
          if (!target || isCompanyAccount(target, org)) fail(400, 'Funcionário inválido')
          if (target!.id !== me.id && !canManage(db, me, target)) fail(403, 'Só podes atribuir tarefas à tua equipa')
          task.assigneeId = target!.id
          task.departmentId = target!.departmentId
        }
        const reviewerId = input.patch?.reviewerId
        if (editor && reviewerId !== undefined) {
          task.reviewerId = reviewerId ? checkReviewer(db, org, reviewerId, task.assigneeId) : undefined
        } else if (task.reviewerId === task.assigneeId) {
          task.reviewerId = undefined
        }
        break
      }

      case 'status': {
        if (!access.owner && !access.manager) fail(403, 'Só o responsável pode mudar o estado')
        if (approved && !access.manager) fail(400, 'Esta tarefa já foi aprovada')
        const status = input.status
        if (!['todo', 'doing', 'done'].includes(status)) fail(400, 'Estado inválido')
        if (status === task.status) break
        if (status === 'done') {
          if (task.requiresAttachment && !task.attachments?.length) fail(400, 'Anexa um ficheiro que comprove o trabalho antes de concluir')
          task.completedAt = now
          if (task.requiresApproval) {
            task.review = { status: 'pending', rejections: task.review?.rejections ?? 0 }
            addComment(task, author, 'Enviou a tarefa para revisão', 'submitted')
          } else spawnNext(db, task)
        } else {
          task.completedAt = undefined
          if (task.review && task.review.status !== 'rejected') {
            task.review = task.review.rejections ? { status: 'rejected', rejections: task.review.rejections } : undefined
          }
        }
        task.status = status
        break
      }

      case 'approve':
      case 'reject': {
        if (!access.review) fail(403, 'Só o supervisor desta tarefa a pode rever')
        if (task.status !== 'done' || task.review?.status !== 'pending') fail(400, 'A tarefa não está à espera de revisão')
        const comment = input.comment?.trim()
        if (input.action === 'approve') {
          task.review = { status: 'approved', by: me.id, at: now, comment, rejections: task.review!.rejections }
          addComment(task, author, comment || 'Aprovou a tarefa', 'approved')
          spawnNext(db, task)
        } else {
          if (!comment) fail(400, 'Explica o que falta corrigir')
          task.review = { status: 'rejected', by: me.id, at: now, comment, rejections: task.review!.rejections + 1 }
          task.status = 'doing'
          task.completedAt = undefined
          addComment(task, author, comment!, 'rejected')
        }
        break
      }

      case 'comment': {
        const text = input.text?.trim()
        if (!text) fail(400, 'Comentário vazio')
        addComment(task, author, text!, 'comment')
        break
      }

      default:
        fail(400, 'Acção desconhecida')
    }
    task.updatedAt = now
    return { task: withGroup(db, task), tasks: groupSiblings(db.tasks, task).map(t => withGroup(db, t)) }
  })
  await removeFiles(files)
  return result
})

export const DELETE = handle<{ orgId: string; taskId: string }>(async (req, { orgId, taskId }) => {
  const { me } = await requireMember(orgId)
  const whole = new URL(req.url).searchParams.get('group') === '1'
  const scope = scopes(orgScope(orgId), async l => {
    await l.load('tasks', { id: taskId })
    const t = l.db.tasks.find(x => x.id === taskId)
    if (t?.groupId) await l.load('tasks', { org_id: orgId })
    await l.load('sessions', { task_id: t && whole ? groupSiblings(l.db.tasks, t).map(s => s.id) : [taskId] })
  })
  const files = await mutate(scope, db => {
    const task = db.tasks.find(t => t.id === taskId && t.orgId === orgId) ?? fail(404, 'Tarefa não encontrada')
    if (!canEdit(db, me, task)) fail(403, 'Só quem criou a tarefa a pode apagar')
    const targets = whole ? groupSiblings(db.tasks, task).filter(t => canEdit(db, me, t)) : [task]
    const out = targets.flatMap(t => deleteTask(db, t.id))
    const left = task.groupId ? db.tasks.filter(t => t.groupId && groupKey(t) === groupKey(task)) : []
    if (left.length === 1) left[0].groupId = undefined
    return out
  })
  await removeFiles(files)
})
