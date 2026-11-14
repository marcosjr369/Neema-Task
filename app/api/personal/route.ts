import { handle, requirePersonal } from '../../lib/server/api'
import { scopes, userScope } from '../../lib/server/scopes'
import { mutate } from '../../lib/server/store'

export const DELETE = handle(async () => {
  const user = await requirePersonal()
  await mutate(scopes(userScope(user.id, { tasks: true, sessions: true }), async l => { await l.load('plays', { user_id: user.id, org_id: null }) }), db => {
    const ids = new Set(db.tasks.filter(t => t.ownerId === user.id).map(t => t.id))
    db.tasks = db.tasks.filter(t => !ids.has(t.id))
    db.sessions = db.sessions.filter(s => s.userId !== user.id)
    // o tempo nos jogos do espaço pessoal (o da empresa fica com a empresa)
    db.plays = db.plays.filter(p => p.userId !== user.id || !!p.orgId)
    const u = db.users.find(x => x.id === user.id)!
    u.settings = undefined
    if (u.timers) delete u.timers.personal
  })
})
