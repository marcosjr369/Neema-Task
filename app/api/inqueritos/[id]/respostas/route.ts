import { fail, handle, requireUser } from '../../../../lib/server/api'
import { removeFiles } from '../../../../lib/server/files'
import { submitAnswer } from '../../../../lib/server/pollActions'
import { filesOf, findPoll, pollDetail, pollScope, readSubmission, voterKey, whoIs } from '../../../../lib/server/polls'
import { canEdit } from '../../../../lib/server/sharing'
import { mutate, read } from '../../../../lib/server/store'
import { isClosed } from '../../../../lib/polls'

/** Quem gere: cada resposta (com o nome de quem respondeu, se não for anónimo) */
export const GET = handle<{ id: string }>(async (_req, { id }) => {
  const user = await requireUser()
  const db = await read(pollScope(id))
  const poll = findPoll(db, id)
  if (!canEdit(whoIs(db, poll, user).access)) fail(403, 'Só quem gere o inquérito vê as respostas')
  const responses = db.responses
    .filter(r => r.pollId === poll.id && r.kind === 'answer')
    .sort((a, z) => z.createdAt - a.createdAt)
    .map(r => {
      const u = r.userId ? db.users.find(x => x.id === r.userId) : undefined
      return {
        id: r.id,
        name: poll.settings.anonymous ? undefined : u?.name ?? r.name,
        picture: poll.settings.anonymous ? undefined : u?.picture,
        guest: !r.voter,
        answers: r.answers,
        other: r.other,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      }
    })
  return { responses, anonymous: poll.settings.anonymous }
})

/** Responder (JSON, ou multipart quando há ficheiros) */
export const POST = handle<{ id: string }>(async (req, { id }) => {
  const user = await requireUser()
  return submitAnswer(id, user, await readSubmission(req))
})

/** ?responseId=: quem gere apaga uma resposta; sem nada: retiro a minha (se puder mudá-la) */
export const DELETE = handle<{ id: string }>(async (req, { id }) => {
  const user = await requireUser()
  const responseId = new URL(req.url).searchParams.get('responseId')
  let files: string[] = []
  const detail = await mutate(pollScope(id), db => {
    const poll = findPoll(db, id)
    const who = whoIs(db, poll, user)
    if (!who.access) fail(403, 'Não tens acesso a este inquérito')
    let target
    if (responseId) {
      if (!canEdit(who.access)) fail(403, 'Só quem gere o inquérito apaga respostas')
      target = db.responses.find(r => r.id === responseId && r.pollId === poll.id && r.kind === 'answer') ?? fail(404, 'Resposta não encontrada')
    } else {
      if (!poll.settings.canChange || isClosed(poll)) fail(400, 'Já não podes retirar a tua resposta')
      const key = voterKey(poll, user.id)
      target = db.responses.find(r => r.pollId === poll.id && r.kind === 'answer' && r.voter === key) ?? fail(404, 'Ainda não respondeste')
    }
    files = filesOf(target)
    db.responses = db.responses.filter(r => r.id !== target.id)
    poll.count = Math.max(0, poll.count - 1)
    return pollDetail(db, poll, who)
  })
  await removeFiles(files).catch(() => undefined)
  return detail
})
