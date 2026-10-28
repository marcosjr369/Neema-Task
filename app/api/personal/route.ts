import { handle, requirePersonal } from '../../lib/server/api'
import { userScope } from '../../lib/server/scopes'
import { mutate } from '../../lib/server/store'

/** Apaga todos os dados do espaço pessoal (tarefas, tempo, definições, cronómetro) */
export const DELETE = handle(async () => {
  const user = await requirePersonal()
  await mutate(userScope(user.id, { tasks: true, sessions: true }), db => {
    const ids = new Set(db.tasks.filter(t => t.ownerId === user.id).map(t => t.id))
    db.tasks = db.tasks.filter(t => !ids.has(t.id))
    db.sessions = db.sessions.filter(s => s.userId !== user.id)
    const u = db.users.find(x => x.id === user.id)!
    u.settings = undefined
    if (u.timers) delete u.timers.personal
  })
})
