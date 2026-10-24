import { body, canManage, fail, handle, requireMember, taskAccess } from '../../../../../lib/server/api'
import { orgScope, scopes } from '../../../../../lib/server/scopes'
import { mutate } from '../../../../../lib/server/store'
import { removeFiles } from '../../../../../lib/server/files'
import { spawnNext } from '../../../../../lib/server/org'
import { addComment, cleanTaskFields, deleteTask, type TaskPatch } from '../../../../../lib/server/tasks'
import type { TaskStatus } from '../../../../../types'

type Action =
  | { action: 'update'; patch: TaskPatch & { assigneeId?: string } }
  | { action: 'status'; status: TaskStatus }
  | { action: 'approve'; comment?: string }
  | { action: 'reject'; comment?: string }
  | { action: 'comment'; text?: string }

/** Campos que o funcionário pode mudar numa tarefa que lhe foi atribuída */
const OWNER_FIELDS = ['checklist', 'notified', 'focusDuration'] as const

export const PATCH = handle<{ orgId: string; taskId: string }>(async (req, { orgId, taskId }) => {
  const { me } = await requireMember(orgId)
  const input = await body<Action>(req)

  return mutate(scopes(orgScope(orgId), async l => l.load('tasks', { id: taskId })), db => {
    const task = db.tasks.find(t => t.id === taskId && t.orgId === orgId) ?? fail(404, 'Tarefa não encontrada')
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
        if (fields.deadline !== undefined && fields.deadline !== task.deadline) fields.notified = false
        Object.assign(task, fields)
        const assigneeId = input.patch?.assigneeId
        if (editor && assigneeId && assigneeId !== task.assigneeId) {
          const target = db.members.find(m => m.id === assigneeId && m.orgId === orgId)
          if (!target || (target.id !== me.id && !canManage(db, me, target))) fail(403, 'Só podes atribuir tarefas à tua equipa')
          task.assigneeId = target!.id
          task.departmentId = target!.departmentId
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
          // retirada da revisão (ou reaberta pelo supervisor): mantém só o histórico de rejeições
          if (task.review && task.review.status !== 'rejected') {
            task.review = task.review.rejections ? { status: 'rejected', rejections: task.review.rejections } : undefined
          }
        }
        task.status = status
        break
      }

      case 'approve':
      case 'reject': {
        if (!access.manager) fail(403, 'Só o supervisor pode rever esta tarefa')
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
    return { task }
  })
})

export const DELETE = handle<{ orgId: string; taskId: string }>(async (_req, { orgId, taskId }) => {
  const { me } = await requireMember(orgId)
  const scope = scopes(orgScope(orgId), async l => {
    await l.load('tasks', { id: taskId })
    await l.load('sessions', { task_id: taskId })
  })
  const files = await mutate(scope, db => {
    const task = db.tasks.find(t => t.id === taskId && t.orgId === orgId) ?? fail(404, 'Tarefa não encontrada')
    const access = taskAccess(db, me, task)
    if (!access.manager && task.createdBy !== me.id) fail(403, 'Só quem criou a tarefa a pode apagar')
    return deleteTask(db, taskId)
  })
  await removeFiles(files)
})
