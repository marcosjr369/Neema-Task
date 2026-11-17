import { body, canManage, fail, handle, requireMember, taskAccess } from '../../../../lib/server/api'
import { orgScope, scopes } from '../../../../lib/server/scopes'
import { mutate, newId, read } from '../../../../lib/server/store'
import { buildTask, checkReviewer, cleanTaskFields, pickId, withGroup, type TaskPatch } from '../../../../lib/server/tasks'
import { isCompanyAccount, isFormer } from '../../../../lib/org'
import type { Task } from '../../../../types'

export const GET = handle<{ orgId: string }>(async (req, { orgId }) => {
  const scope = new URL(req.url).searchParams.get('scope') ?? 'mine'
  // "as minhas" (de 30 em 30 s, por pessoa): só carrega as tarefas atribuídas a quem pede
  const { db, me } = await requireMember(orgId, { tasks: scope === 'mine' ? 'mine' : true })
  // tarefas de grupo: o resumo ("3 de 5 entregaram") precisa das tarefas das outras pessoas
  if (scope === 'mine' && db.tasks.some(t => t.groupId)) {
    const all = await read(async l => { await l.load('tasks', { org_id: orgId }) })
    const have = new Set(db.tasks.map(t => t.id))
    db.tasks.push(...all.tasks.filter(t => !have.has(t.id)))
  }
  const tasks = db.tasks.filter(t => {
    if (t.orgId !== orgId) return false
    if (scope === 'mine') return t.assigneeId === me.id
    const access = taskAccess(db, me, t)
    return access.manager || t.createdBy === me.id || t.reviewerId === me.id
  })
  return { tasks: tasks.map(t => withGroup(db, t)) }
})

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
    if (isFormer(a)) fail(400, `${a!.name} já saiu da empresa`)
    if (a!.id !== me.id && !canManage(db, me, a)) fail(403, `Só podes atribuir tarefas à tua equipa (${a!.name})`)
    return a!
  })
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
