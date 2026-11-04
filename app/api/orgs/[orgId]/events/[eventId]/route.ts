import { body, fail, handle, requireMember } from '../../../../../lib/server/api'
import { mutate } from '../../../../../lib/server/store'
import { checkAttendees, cleanEvent, notifyMembers, type EventInput } from '../../../../../lib/server/events'
import type { EventResponse } from '../../../../../types'

type Action = { action: 'update'; patch: EventInput } | { action: 'respond'; response: EventResponse }

/** Editar (quem agendou ou um administrador) ou responder ao convite (convidado) */
export const PATCH = handle<{ orgId: string; eventId: string }>(async (req, { orgId, eventId }) => {
  const { db, org, me } = await requireMember(orgId)
  const input = await body<Action>(req)
  let added: string[] = []
  let moved: string[] = []
  const event = await mutate(async l => l.load('events', { id: eventId }), d => {
    const e = d.events.find(x => x.id === eventId && x.orgId === orgId) ?? fail(404, 'Evento não encontrado')
    if (input.action === 'respond') {
      if (!e.attendeeIds.includes(me.id)) fail(403, 'Não foste convidado para este evento')
      if (input.response !== 'sim' && input.response !== 'nao') fail(400, 'Resposta inválida')
      e.responses = { ...e.responses, [me.id]: input.response }
    } else if (input.action === 'update') {
      if (e.createdBy !== me.id && me.role !== 'admin') fail(403, 'Só quem agendou pode alterar')
      const patch = input.patch ?? {}
      const fields = cleanEvent(patch, e)
      const timeChanged = fields.start !== e.start || fields.end !== e.end
      Object.assign(e, fields)
      if (patch.attendeeIds !== undefined) {
        // convidados são de quem agendou (um administrador a editar não se convida a si)
        const owner = db.members.find(m => m.id === e.createdBy) ?? me
        const next = checkAttendees(db, org, owner.id === me.id ? me : { ...owner, role: me.role }, patch.attendeeIds)
        added = next.filter(id => !e.attendeeIds.includes(id))
        e.attendeeIds = next
        e.responses = Object.fromEntries(Object.entries(e.responses ?? {}).filter(([id]) => next.includes(id)))
      }
      if (timeChanged) {
        // nova hora: os avisos voltam a ser enviados e as respostas recomeçam
        e.sentPre = false
        e.sentStart = false
        e.responses = {}
        moved = e.attendeeIds.filter(id => !added.includes(id))
      }
    } else fail(400, 'Acção desconhecida')
    e.updatedAt = Date.now()
    return e
  })
  notifyMembers(db, added, event, () => `Convite de ${me.name}`)
  notifyMembers(db, moved, event, () => 'Evento remarcado')
  return { event }
})

export const DELETE = handle<{ orgId: string; eventId: string }>(async (_req, { orgId, eventId }) => {
  const { db, me } = await requireMember(orgId)
  const event = await mutate(async l => l.load('events', { id: eventId }), d => {
    const e = d.events.find(x => x.id === eventId && x.orgId === orgId) ?? fail(404, 'Evento não encontrado')
    if (e.createdBy !== me.id && me.role !== 'admin') fail(403, 'Só quem agendou pode cancelar')
    d.events = d.events.filter(x => x.id !== eventId)
    return e
  })
  // cancelado antes de acontecer: avisa os convidados
  if (event.end > Date.now()) notifyMembers(db, event.attendeeIds.filter(id => event.responses?.[id] !== 'nao'), event, () => 'Evento cancelado')
})
