import { fail, handle } from '../../../../lib/server/api'
import { currentUser } from '../../../../lib/server/auth'
import { submitAnswer, visitorLimit } from '../../../../lib/server/pollActions'
import { readSubmission } from '../../../../lib/server/polls'
import { validKey } from '../../../../lib/server/sharing'
import { read } from '../../../../lib/server/store'
import type { User } from '../../../../types'

/**
 * Responder a um inquérito pelo link de partilha (/p/<token>), com ou sem conta.
 * Os inquéritos pessoais privados com senha aceitam a chave da senha (x-share-key).
 */
export const POST = handle<{ token: string }>(async (req, { token }) => {
  const user = (await currentUser().catch(() => null)) as User | null
  const db = await read(async l => { await l.load('polls', { token }) })
  const poll = db.polls.find(p => p.sharing.token === token) ?? fail(404, 'Este link não existe ou foi desactivado')
  const unlocked = !poll.orgId && poll.sharing.visibility === 'private' && validKey(poll.id, poll.sharing.password, req.headers.get('x-share-key'))
  if (!user) visitorLimit(req, poll.id)
  return submitAnswer(poll.id, user, await readSubmission(req), { viaLink: true, unlocked })
})
