import { body, fail, handle, requireUser } from '../../../lib/server/api'
import { userScope } from '../../../lib/server/scopes'
import { mutate, read } from '../../../lib/server/store'
import { buildTask, cleanTaskFields, pickId, type TaskPatch } from '../../../lib/server/tasks'

/** Tarefas do espaço pessoal */
export const GET = handle(async () => {
  const user = await requireUser()
  const db = await read(userScope(user.id, { tasks: true }))
  return { tasks: db.tasks.filter(t => t.ownerId === user.id && !t.orgId) }
})

export const POST = handle(async req => {
  const user = await requireUser()
  const input = await body<TaskPatch & { id?: string }>(req)
  if (!input.title?.trim()) fail(400, 'Indica o título da tarefa')
  const fields = cleanTaskFields(input)
  return mutate(
    async l => {
      await l.load('users', { id: user.id })
      if (input.id) await l.load('tasks', { id: input.id })
    },
    db => {
    const task = buildTask(pickId(db, input.id), fields, { ownerId: user.id })
    db.tasks.push(task)
    return { task }
  },
  )
})
