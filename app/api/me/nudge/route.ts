import { handle, requireUser } from '../../../lib/server/api'
import { userScope } from '../../../lib/server/scopes'
import { mutate } from '../../../lib/server/store'

/**
 * A app aberta mostrou um lembrete: regista-o para o servidor não repetir por push
 * e devolve quantos já houve seguidos (a frase fica mais triste a cada um).
 */
export const POST = handle(async () => {
  const me = await requireUser()
  return mutate(userScope(me.id, { sessions: 'all' }), db => {
    const u = db.users.find(x => x.id === me.id)!
    const now = Date.now()
    const lastWork = db.sessions.reduce((a, s) => Math.max(a, s.end), 0)
    const count = lastWork > (u.lastNudgeAt ?? 0) ? 0 : u.nudgeCount ?? 0
    u.lastNudgeAt = now
    u.nudgeCount = count + 1
    return { count }
  })
})
