import { body, canManage, fail, handle, requireMember, taskAccess } from '../../../../lib/server/api'
import { orgScope, scopes } from '../../../../lib/server/scopes'
import { mutate, newId } from '../../../../lib/server/store'
import { buildTask, checkReviewer, cleanTaskFields, pickId, withGroup, type TaskPatch } from '../../../../lib/server/tasks'
import { isCompanyAccount } from '../../../../lib/org'
import type { Task } from '../../../../types'

/** ?scope=mine (atribuídas a mim) | team (as que giro ou criei) */
export const GET = handle<{ orgId: string }>(async (req, { orgId }) => {
  const { db, me } = await requireMember(orgId, { tasks: true })
  const scope = new URL(req.url).searchParams.get('scope') ?? 'mine'
  const tasks = db.tasks.filter(t => {
    if (t.orgId !== orgId) return false
    if (scope === 'mine') return t.assigneeId === me.id
    const access = taskAccess(db, me, t)
    return access.manager || t.createdBy === me.id || t.reviewerId === me.id
  })
  return { tasks: tasks.map(t => withGroup(db, t)) }
})

/** Cria a tarefa; com assigneeIds (2+ pessoas) cria uma tarefa de grupo: uma cópia por pessoa */
export const POST = handle<{ orgId: string }>(async (req, { orgId }) => {
  const { db, org, me } = await requireMember(orgId)
  const input = await body<TaskPatch & { assigneeId?: string; assigneeIds?: string[]; reviewerId?: string | null; id?: string }>(req)
  if (!input.title?.trim()) fail(400, 'Indica o título da tarefa')

  const companyAccount = isCompanyAccount(me, org)
  const ids = [...new Set((Array.isArray(input.assigneeIds) && input.assigneeIds.length ? input.assigneeIds : [input.assigneeId || (companyAccount ? '' : me.id)]).map(String))]
    .filter(Boolean)
  if (!ids.length) fail(400, 'Escolhe o funcionário responsável')
  if (ids.length > 200) fail(400, 'No máximo 200 pessoas por tarefa')
  const assignees = ids.map(id => {
    const a = db.members.find(m => m.id === id && m.orgId === orgId)
    if (!a || isCompanyAccount(a, org)) fail(400, 'Funcionário inválido')
    if (a!.id !== me.id && !canManage(db, me, a)) fail(403, `Só podes atribuir tarefas à tua equipa (${a!.name})`)
    return a!
  })
  // o supervisor não pode ser nenhum dos responsáveis
  const reviewerId = input.reviewerId ? ids.map(id => checkReviewer(db, org, input.reviewerId!, id))[0] : undefined

  const fields = cleanTaskFields(input)
  // só é preciso confirmar que o id gerado no cliente ainda não existe
  const scope = scopes(orgScope(orgId), async l => { if (input.id) await l.load('tasks', { id: input.id }) })
  return mutate(scope, d => {
    const firstId = pickId(d, input.id)
    const groupId = assignees.length > 1 ? firstId : undefined
    const tasks: Task[] = assignees.map((assignee, i) =>
      buildTask(i === 0 ? firstId : newId(), fields, {
        orgId,
        assigneeId: assignee.id,
        createdBy: me.id,
        departmentId: assignee.departmentId,
        // tarefas atribuídas por outra pessoa precisam de aprovação por omissão
        requiresApproval: fields.requiresApproval ?? assignee.id !== me.id,
        reviewerId,
        requiresAttachment: fields.requiresAttachment ?? false,
        recurrence: fields.recurrence,
        groupId,
        attachments: [],
        comments: [],
      }),
    )
    d.tasks.push(...tasks)
    return { task: withGroup(d, tasks[0]), tasks: tasks.map(t => withGroup(d, t)) }
  })
})
