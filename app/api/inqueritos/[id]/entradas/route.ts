import { body, fail, handle, requireUser } from '../../../../lib/server/api'
import { removeFiles } from '../../../../lib/server/files'
import { entryLimit } from '../../../../lib/server/pollActions'
import { entryBlock, filesOf, findPoll, pollDetail, pollScope, prepareAnswers, readSubmission, voterKey, whoIs } from '../../../../lib/server/polls'
import { canEdit } from '../../../../lib/server/sharing'
import { mutate, newId, read } from '../../../../lib/server/store'
import { IDEA_STATUS, POLL_LIMITS, isClosed } from '../../../../lib/polls'
import type { IdeaStatus, PollResponse } from '../../../../types'

/** Nova ideia ou candidatura (multipart quando o concurso pede ficheiros) */
export const POST = handle<{ id: string }>(async (req, { id }) => {
  const user = await requireUser()
  const sub = await readSubmission(req)
  const text = String(sub.text ?? '').trim().slice(0, POLL_LIMITS.entryText)
  const details = String(sub.details ?? '').trim().slice(0, POLL_LIMITS.entryDetails) || undefined
  if (!text) fail(400, 'Dá um título à tua proposta')

  const before = await read(pollScope(id))
  const poll0 = findPoll(before, id)
  const who0 = whoIs(before, poll0, user)
  if (!who0.access) fail(403, 'Não tens acesso a este inquérito')
  const block0 = entryBlock(poll0, who0)
  if (block0) fail(400, block0)
  if (poll0.type === 'contest' && poll0.settings.phase === 'vote') fail(400, 'As candidaturas já fecharam: agora é altura de votar')
  // as ideias não têm campos; as candidaturas seguem o formulário do concurso
  const clean = poll0.type === 'contest' ? await prepareAnswers(poll0, sub) : { answers: {}, other: undefined, fileIds: [] as string[] }

  return mutate(pollScope(id), db => {
    const poll = findPoll(db, id)
    const who = whoIs(db, poll, user)
    const block = entryBlock(poll, who)
    if (block) fail(400, block)
    const key = voterKey(poll, user.id)
    const mine = db.responses.filter(r => r.pollId === poll.id && r.kind === 'entry' && r.voter === key).length
    if (mine >= entryLimit(poll)) fail(400, `Já enviaste ${entryLimit(poll)}, o máximo por pessoa`)
    const now = Date.now()
    const entry: PollResponse = {
      id: newId(), pollId: poll.id, kind: 'entry', voter: key,
      text, details, answers: clean.answers, other: clean.other, votes: {},
      status: poll.type === 'ideas' ? 'new' : undefined,
      createdAt: now, updatedAt: now,
    }
    if (!poll.settings.anonymous) { entry.userId = user.id; entry.name = user.name }
    db.responses.push(entry)
    poll.count += 1
    return pollDetail(db, poll, who)
  }).catch(async err => {
    await removeFiles(clean.fileIds).catch(() => undefined)
    throw err
  })
})

/**
 * { entryId, vote: 1 | nota de 1 a 10 | null } vota ou tira o voto;
 * quem gere: { entryId, status } (ideias) e { entryId, hidden } (esconder uma entrada imprópria).
 */
export const PATCH = handle<{ id: string }>(async (req, { id }) => {
  const user = await requireUser()
  const input = await body<{ entryId?: string; vote?: number | null; status?: IdeaStatus; hidden?: boolean }>(req)
  return mutate(pollScope(id), db => {
    const poll = findPoll(db, id)
    const who = whoIs(db, poll, user)
    if (!who.access) fail(403, 'Não tens acesso a este inquérito')
    const entry = db.responses.find(r => r.id === input.entryId && r.pollId === poll.id && r.kind === 'entry') ?? fail(404, 'Entrada não encontrada')
    const manager = canEdit(who.access)

    if (input.vote !== undefined) {
      if (poll.status === 'draft' || isClosed(poll)) fail(400, 'A votação está fechada')
      if (entry.hidden) fail(400, 'Esta entrada foi escondida')
      const jury = poll.type === 'contest' && !!poll.settings.jury?.length
      if (poll.type === 'contest') {
        if (poll.settings.phase !== 'vote') fail(400, 'A votação ainda não começou')
        if (jury && !poll.settings.jury!.includes(user.id)) fail(403, 'Neste concurso só o júri vota')
        if (entry.voter === voterKey(poll, user.id)) fail(400, 'Não podes votar na tua própria candidatura')
      }
      entry.votes ??= {}
      if (input.vote === null) delete entry.votes[user.id]
      else {
        const value = jury ? Math.round(Number(input.vote)) : 1
        if (jury && !(value >= 1 && value <= 10)) fail(400, 'Dá uma nota de 1 a 10')
        const limit = jury ? 0 : poll.settings.votesPerPerson ?? 0
        const used = db.responses.filter(r => r.pollId === poll.id && r.kind === 'entry' && r.id !== entry.id && r.votes?.[user.id] !== undefined).length
        if (limit && used >= limit) fail(400, limit === 1 ? 'Só tens 1 voto: tira-o da outra entrada primeiro' : `Só tens ${limit} votos: tira um de outra entrada primeiro`)
        entry.votes[user.id] = value
      }
    }
    if (input.status !== undefined || input.hidden !== undefined) {
      if (!manager) fail(403, 'Só quem gere o inquérito faz isto')
      if (input.status !== undefined) {
        if (poll.type !== 'ideas' || !Object.hasOwn(IDEA_STATUS, input.status)) fail(400, 'Estado inválido')
        entry.status = input.status
      }
      if (input.hidden !== undefined) entry.hidden = input.hidden || undefined
    }
    entry.updatedAt = Date.now()
    return pollDetail(db, poll, who)
  })
})

/** ?entryId=: apaga uma entrada (a minha, ou qualquer uma para quem gere) */
export const DELETE = handle<{ id: string }>(async (req, { id }) => {
  const user = await requireUser()
  const entryId = new URL(req.url).searchParams.get('entryId')
  let files: string[] = []
  const detail = await mutate(pollScope(id), db => {
    const poll = findPoll(db, id)
    const who = whoIs(db, poll, user)
    if (!who.access) fail(403, 'Não tens acesso a este inquérito')
    const entry = db.responses.find(r => r.id === entryId && r.pollId === poll.id && r.kind === 'entry') ?? fail(404, 'Entrada não encontrada')
    const mine = entry.voter === voterKey(poll, user.id)
    if (!mine && !canEdit(who.access)) fail(403, 'Só podes apagar as tuas entradas')
    if (mine && !canEdit(who.access) && isClosed(poll)) fail(400, 'O inquérito já fechou')
    files = filesOf(entry)
    db.responses = db.responses.filter(r => r.id !== entry.id)
    poll.count = Math.max(0, poll.count - 1)
    return pollDetail(db, poll, who)
  })
  await removeFiles(files).catch(() => undefined)
  return detail
})
