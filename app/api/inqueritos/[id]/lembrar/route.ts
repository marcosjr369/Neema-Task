import { fail, handle, requireUser } from '../../../../lib/server/api'
import { findPoll, pollScope, turnout, whoIs } from '../../../../lib/server/polls'
import { sendToUser } from '../../../../lib/server/push'
import { canEdit } from '../../../../lib/server/sharing'
import { read } from '../../../../lib/server/store'
import { isClosed } from '../../../../lib/polls'

const g = globalThis as unknown as { __neemaPollReminders?: Map<string, number> }
const WAIT = 10 * 60 * 1000

/** Avisa (notificação) os colegas que ainda não responderam. No máximo uma vez a cada 10 minutos. */
export const POST = handle<{ id: string }>(async (_req, { id }) => {
  const user = await requireUser()
  const db = await read(pollScope(id))
  const poll = findPoll(db, id)
  if (!canEdit(whoIs(db, poll, user).access)) fail(403, 'Só quem gere o inquérito pode lembrar as pessoas')
  if (poll.status !== 'open' || isClosed(poll)) fail(400, 'O inquérito não está aberto')
  const t = turnout(db, poll) ?? fail(400, 'Só dá para lembrar nos inquéritos abertos a toda a empresa')
  const sent = (g.__neemaPollReminders ??= new Map())
  const last = sent.get(poll.id) ?? 0
  if (Date.now() - last < WAIT) fail(429, `Já lembraste há pouco. Tenta outra vez daqui a ${Math.ceil((WAIT - (Date.now() - last)) / 60000)} min.`)
  sent.set(poll.id, Date.now())
  const people = t.missing.filter(m => m.userId !== user.id)
  await Promise.all(people.map(m => sendToUser(m.userId, {
    title: `Falta a tua resposta: ${poll.title}`,
    body: `${user.name} pede-te que respondas. Leva só um minuto.`,
    url: `/inqueritos/${poll.id}`,
    tag: `poll-${poll.id}`,
  }).catch(() => 0)))
  return { reminded: people.length }
})
