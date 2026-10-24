import { body, handle, requireUser } from '../../../lib/server/api'
import { userScope } from '../../../lib/server/scopes'
import { mutate, read } from '../../../lib/server/store'
import { cleanSessions } from '../../../lib/server/tasks'
import type { Session } from '../../../types'

/** Blocos de tempo do espaço pessoal. ?from=<ms> */
export const GET = handle(async req => {
  const user = await requireUser()
  const from = Number(new URL(req.url).searchParams.get('from')) || 0
  const db = await read(userScope(user.id, { sessions: true }))
  return { sessions: db.sessions.filter(s => s.userId === user.id && s.start >= from) }
})

export const POST = handle(async req => {
  const user = await requireUser()
  const { sessions } = await body<{ sessions: Session[] }>(req)
  return mutate(userScope(user.id, { tasks: true }), db => {
    const mine = new Set(db.tasks.filter(t => t.ownerId === user.id).map(t => t.id))
    const clean = cleanSessions(db, sessions, mine, { userId: user.id })
    db.sessions.push(...clean)
    return { saved: clean.length }
  })
})
