import { body, fail, handle, requireUser } from '../../../../lib/server/api'
import { userScope } from '../../../../lib/server/scopes'
import { mutate } from '../../../../lib/server/store'
import { cleanTaskFields, deleteTask, type TaskPatch } from '../../../../lib/server/tasks'
import type { TaskStatus } from '../../../../types'

type Action = { action: 'update'; patch: TaskPatch } | { action: 'status'; status: TaskStatus }

export const PATCH = handle<{ taskId: string }>(async (req, { taskId }) => {
  const user = await requireUser()
  const input = await body<Action>(req)
  return mutate(userScope(user.id, { tasks: true }), db => {
    const task = db.tasks.find(t => t.id === taskId && t.ownerId === user.id) ?? fail(404, 'Tarefa não encontrada')
    if (input.action === 'update') {
      const fields = cleanTaskFields(input.patch ?? {})
      if (fields.title === '') delete fields.title
      if (fields.deadline !== undefined && fields.deadline !== task.deadline) fields.notified = false
      Object.assign(task, fields)
    } else if (input.action === 'status') {
      if (!['todo', 'doing', 'done'].includes(input.status)) fail(400, 'Estado inválido')
      task.status = input.status
      task.completedAt = input.status === 'done' ? Date.now() : undefined
    } else fail(400, 'Acção desconhecida')
    task.updatedAt = Date.now()
    return { task }
  })
})

export const DELETE = handle<{ taskId: string }>(async (_req, { taskId }) => {
  const user = await requireUser()
  await mutate(userScope(user.id, { tasks: true, sessions: true }), db => {
    if (!db.tasks.some(t => t.id === taskId && t.ownerId === user.id)) fail(404, 'Tarefa não encontrada')
    deleteTask(db, taskId)
  })
})
