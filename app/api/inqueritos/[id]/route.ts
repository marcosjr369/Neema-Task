import { body, fail, handle, requireUser } from '../../../lib/server/api'
import { removeFiles } from '../../../lib/server/files'
import { asPollError, filesOf, findPoll, pollDetail, pollScope, whoIs } from '../../../lib/server/polls'
import { markSeen } from '../../../lib/server/shared'
import { canEdit } from '../../../lib/server/sharing'
import { sendToUser } from '../../../lib/server/push'
import { mutate, read } from '../../../lib/server/store'
import { canUse, deniedText } from '../../../lib/permissions'
import { POLL_LIMITS, TYPE_INFO, cleanFields, cleanSettings, cleanTheme, isClosed, pollImages, readyProblem } from '../../../lib/polls'
import type { PollField, PollSettings, PollStatus, PollTheme } from '../../../types'

export const GET = handle<{ id: string }>(async (_req, { id }) => {
  const user = await requireUser()
  const db = await read(pollScope(id))
  const poll = findPoll(db, id)
  const who = whoIs(db, poll, user)
  if (!who.access) fail(403, 'Não tens acesso a este inquérito')
  if (poll.status === 'draft' && !canEdit(who.access)) fail(403, 'Este inquérito ainda não foi publicado')
  await markSeen(db, poll, user)
  return pollDetail(db, poll, who)
})

/**
 * Quem gere: { title, description, fields, settings } muda o inquérito;
 * { status: 'open' | 'closed' | 'draft' } publica, fecha ou volta a rascunho (sem respostas);
 * { announce: true } ao publicar avisa os colegas.
 */
export const PATCH = handle<{ id: string }>(async (req, { id }) => {
  const user = await requireUser()
  const input = await body<{
    title?: string; description?: string; fields?: PollField[]; settings?: Partial<PollSettings>; theme?: PollTheme; status?: PollStatus; announce?: boolean
  }>(req)

  const result = await mutate(pollScope(id), db => {
    const poll = findPoll(db, id)
    const access = whoIs(db, poll, user).access
    if (!access) fail(403, 'Não tens acesso a este inquérito')
    if (!canEdit(access)) fail(403, 'Só quem gere o inquérito o pode alterar')
    const now = Date.now()

    if (input.title !== undefined) {
      const title = String(input.title).trim().slice(0, POLL_LIMITS.title)
      if (!title) fail(400, 'Dá um nome ao inquérito')
      poll.title = title
    }
    if (input.description !== undefined) poll.description = String(input.description).trim().slice(0, POLL_LIMITS.description) || undefined
    const imagesBefore = pollImages(poll)
    if (input.fields !== undefined) poll.fields = asPollError(() => cleanFields(poll.type, input.fields))
    if (input.theme !== undefined) poll.theme = cleanTheme(poll.type, input.theme)
    // só imagens enviadas para este inquérito (as antigas, sem o id no nome, continuam a valer)
    if (pollImages(poll).some(x => !imagesBefore.includes(x) && !x.startsWith(`pollimg-${poll.id}-`))) fail(400, 'Imagem inválida')
    const imagesAfter = new Set(pollImages(poll))
    const unused = imagesBefore.filter(x => !imagesAfter.has(x))
    if (input.settings !== undefined) {
      const next = cleanSettings(poll.type, input.settings, poll.settings)
      // abrir um inquérito da empresa a pessoas de fora pode estar reservado (Definições → Permissões)
      if (next.publicLink && !poll.settings.publicLink && poll.orgId) {
        const org = db.orgs.find(o => o.id === poll.orgId)
        const me = db.members.find(m => m.orgId === poll.orgId && m.userId === user.id && m.status === 'activo')
        if (!org || !me || !canUse(org.permissions, db.departments.filter(d => d.orgId === org.id), me, 'formulariosPublicos')) fail(403, deniedText('formulariosPublicos'))
      }
      // os códigos de quem já votou dependem disto: mudar a meio misturava votos
      if (next.anonymous !== poll.settings.anonymous && poll.count > 0) fail(400, 'Já há respostas: não dá para mudar o anonimato')
      poll.settings = next
    }

    let announce: string[] = []
    if (input.status !== undefined && input.status !== poll.status) {
      if (input.status === 'open') {
        const problem = readyProblem(poll.type, poll.fields)
        if (problem) fail(400, problem)
        // reabrir: a data de fecho que já passou deixa de contar
        if (poll.settings.closesAt && poll.settings.closesAt <= now) poll.settings.closesAt = undefined
        if (poll.settings.maxResponses && poll.count >= poll.settings.maxResponses) fail(400, 'Já chegou ao limite de respostas: aumenta-o antes de reabrir')
        const first = poll.status === 'draft'
        poll.status = 'open'
        poll.openedAt ??= now
        poll.closedAt = undefined
        if (first && input.announce && poll.orgId && poll.sharing.visibility === 'org') {
          const org = db.orgs.find(o => o.id === poll.orgId)
          announce = db.members
            .filter(m => m.orgId === poll.orgId && m.status === 'activo' && m.userId && m.userId !== user.id && m.userId !== org?.createdBy)
            .map(m => m.userId!)
        }
      } else if (input.status === 'closed') {
        if (poll.status === 'draft') fail(400, 'Publica o inquérito antes de o fechar')
        poll.status = 'closed'
        poll.closedAt = now
      } else if (input.status === 'draft') {
        if (poll.count > 0) fail(400, 'Já há respostas: fecha o inquérito em vez de voltar a rascunho')
        poll.status = 'draft'
      } else fail(400, 'Estado inválido')
    } else if (poll.status === 'open' && isClosed(poll, now) && input.settings?.closesAt !== undefined) {
      // mudou a data de fecho para o passado: fica fechado já
      poll.status = 'closed'
      poll.closedAt = now
    }

    poll.updatedAt = now
    return { detail: pollDetail(db, poll, { user, access }), announce, title: poll.title, type: poll.type, unused }
  })
  // imagens que deixaram de ser usadas (cabeçalho trocado, pergunta apagada…)
  if (result.unused.length) await removeFiles(result.unused).catch(() => undefined)

  for (const userId of result.announce) {
    sendToUser(userId, {
      title: `${TYPE_INFO[result.type].name}: ${result.title}`,
      body: `${user.name} quer a tua opinião. Responde em Inquéritos.`,
      url: `/inqueritos/${id}`,
      tag: `poll-${id}`,
    }).catch(() => undefined)
  }
  return result.detail
})

export const DELETE = handle<{ id: string }>(async (_req, { id }) => {
  const user = await requireUser()
  const files = await mutate(pollScope(id), db => {
    const poll = findPoll(db, id)
    if (whoIs(db, poll, user).access !== 'owner') fail(403, 'Só o dono do inquérito o pode apagar')
    const responses = db.responses.filter(r => r.pollId === poll.id)
    db.polls = db.polls.filter(p => p.id !== poll.id)
    db.responses = db.responses.filter(r => r.pollId !== poll.id)
    db.grants = db.grants.filter(g => g.resourceId !== poll.id)
    return [...responses.flatMap(filesOf), ...pollImages(poll)]
  })
  await removeFiles(files).catch(() => undefined)
  return { ok: true }
})
