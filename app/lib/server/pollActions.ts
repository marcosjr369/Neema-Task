import type { Poll, PollFile, PollResponse, User } from '../../types'
import { POLL_LIMITS, TYPE_INFO } from '../polls'
import { fail } from './api'
import { removeFiles } from './files'
import { answerBlock, filesOf, findPoll, pollDetail, pollScope, prepareAnswers, publicOpen, voterKey, whoIs, type Submission } from './polls'
import { sendToUser } from './push'
import { limitTries } from './sharing'
import { mutate, newId, read } from './store'

/**
 * Responder a um inquérito: com conta (na app) ou sem conta (pelo link público).
 * "viaLink": o pedido veio do link de partilha; quem não tem acesso pela conta só responde se o
 * inquérito aceitar respostas pelo link (ou se acertou na senha, nos pessoais privados).
 */

/** Visitantes sem conta: no máximo 20 respostas a cada 10 minutos por IP e inquérito */
export const visitorLimit = (req: Request, pollId: string) =>
  limitTries(req, 'poll', pollId, 20, 10 * 60 * 1000, 'Demasiadas respostas seguidas. Espera alguns minutos.')

const cleanName = (v: unknown) => (typeof v === 'string' ? v.trim().slice(0, 80) : '') || undefined

export async function submitAnswer(id: string, user: User | null, sub: Submission, opts: { viaLink?: boolean; unlocked?: boolean } = {}) {
  // validar (e gravar os ficheiros) antes de abrir a transacção
  const before = await read(pollScope(id))
  const poll0 = findPoll(before, id)
  const who0 = whoIs(before, poll0, user)
  const allowed = who0.access || (opts.viaLink && (publicOpen(poll0) || opts.unlocked) && poll0.status !== 'draft')
  if (!allowed) fail(403, 'Não tens acesso a este inquérito')
  const block0 = answerBlock(before, poll0, who0)
  if (block0) fail(400, block0)
  // ao mudar a resposta, os ficheiros que a pessoa não trocou ficam (o browser manda o mesmo id)
  const previous = user && poll0.settings.onePerPerson
    ? before.responses.find(r => r.pollId === poll0.id && r.kind === 'answer' && r.voter === voterKey(poll0, user.id))
    : undefined
  const keep: Record<string, PollFile> = {}
  for (const f of poll0.fields) {
    const old = previous?.answers[f.id] as PollFile | undefined
    const sent = sub.answers[f.id] as { id?: string } | undefined
    if (f.kind === 'file' && old?.id && sent?.id === old.id && !sub.files[f.id]) keep[f.id] = old
  }
  const clean = await prepareAnswers(poll0, sub, keep)
  const kept = new Set(Object.values(keep).map(f => f.id))

  let removed: string[] = []
  const result = await mutate(pollScope(id), db => {
    const poll = findPoll(db, id)
    const who = whoIs(db, poll, user)
    const block = answerBlock(db, poll, who)
    if (block) fail(400, block)
    const now = Date.now()
    const key = user ? voterKey(poll, user.id) : undefined
    const existing = key && poll.settings.onePerPerson ? db.responses.find(r => r.pollId === poll.id && r.kind === 'answer' && r.voter === key) : undefined
    if (existing) {
      // mudar a resposta (só chega aqui se o inquérito o permitir)
      removed = filesOf(existing).filter(x => !kept.has(x))
      existing.answers = clean.answers
      existing.other = clean.other
      existing.updatedAt = now
    } else {
      const r: PollResponse = {
        id: newId(),
        pollId: poll.id,
        kind: 'answer',
        voter: key,
        answers: clean.answers,
        other: clean.other,
        createdAt: now,
        updatedAt: now,
      }
      if (!poll.settings.anonymous) {
        if (user) r.userId = user.id
        r.name = user?.name ?? cleanName(sub.name)
      }
      db.responses.push(r)
      poll.count += 1
    }
    return {
      detail: pollDetail(db, poll, who, true),
      notify: !existing && poll.settings.notify && poll.ownerId !== user?.id ? poll.ownerId : undefined,
      poll: { title: poll.title, type: poll.type, anonymous: poll.settings.anonymous },
    }
  }).catch(async err => {
    // a resposta não ficou: os ficheiros também não
    await removeFiles(clean.fileIds).catch(() => undefined)
    throw err
  })
  if (removed.length) await removeFiles(removed).catch(() => undefined)

  if (result.notify) {
    const who = result.poll.anonymous ? 'Alguém' : user?.name ?? cleanName(sub.name) ?? 'Um visitante'
    sendToUser(result.notify, {
      title: `Nova resposta: ${result.poll.title}`,
      body: `${who} respondeu a "${result.poll.title}" (${TYPE_INFO[result.poll.type].name.toLowerCase()}).`,
      url: `/inqueritos/${id}?ver=respostas`,
      tag: `poll-answer-${id}`,
    }).catch(() => undefined)
  }
  return result.detail
}

export const entryLimit = (poll: Poll) => (poll.type === 'contest' ? 5 : POLL_LIMITS.entriesPerPerson)
