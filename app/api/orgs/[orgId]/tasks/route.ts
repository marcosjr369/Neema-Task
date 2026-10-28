import { body, canManage, fail, handle, requireMember, taskAccess } from '../../../../lib/server/api'
import { orgScope, scopes } from '../../../../lib/server/scopes'
import { mutate } from '../../../../lib/server/store'
import { buildTask, checkReviewer, cleanTaskFields, pickId, type TaskPatch } from '../../../../lib/server/tasks'
import { isCompanyAccount } from '../../../../lib/org'

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
  return { tasks }
})

export const POST = handle<{ orgId: string }>(async (req, { orgId }) => {
  const { db, org, me } = await requireMember(orgId)
  const input = await body<TaskPatch & { assigneeId?: string; reviewerId?: string | null; id?: string }>(req)
  if (!input.title?.trim()) fail(400, 'Indica o título da tarefa')

  const companyAccount = isCompanyAccount(me, org)
  const assigneeId = input.assigneeId || (companyAccount ? '' : me.id)
  if (!assigneeId) fail(400, 'Escolhe o funcionário responsável')
  const assignee = db.members.find(m => m.id === assigneeId && m.orgId === orgId)
  if (!assignee || isCompanyAccount(assignee, org)) fail(400, 'Funcionário inválido')
  if (assigneeId !== me.id && !canManage(db, me, assignee)) fail(403, 'Só podes atribuir tarefas à tua equipa')
  const reviewerId = input.reviewerId ? checkReviewer(db, org, input.reviewerId, assigneeId) : undefined

  const fields = cleanTaskFields(input)
  // só é preciso confirmar que o id gerado no cliente ainda não existe
  const scope = scopes(orgScope(orgId), async l => { if (input.id) await l.load('tasks', { id: input.id }) })
  return mutate(scope, d => {
    const task = buildTask(pickId(d, input.id), fields, {
      orgId,
      assigneeId,
      createdBy: me.id,
      departmentId: assignee!.departmentId,
      // tarefas atribuídas por outra pessoa precisam de aprovação por omissão
      requiresApproval: fields.requiresApproval ?? assigneeId !== me.id,
      reviewerId,
      requiresAttachment: fields.requiresAttachment ?? false,
      recurrence: fields.recurrence,
      attachments: [],
      comments: [],
    })
    d.tasks.push(task)
    return { task }
  })
})
