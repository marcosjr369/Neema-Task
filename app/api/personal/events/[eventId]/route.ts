import { body, fail, handle, requirePersonal } from '../../../../lib/server/api'
import { mutate } from '../../../../lib/server/store'
import { cleanEvent, type EventInput } from '../../../../lib/server/events'

export const PATCH = handle<{ eventId: string }>(async (req, { eventId }) => {
  const user = await requirePersonal()
  const input = await body<{ action: 'update'; patch: EventInput }>(req)
  if (input.action !== 'update') fail(400, 'Acção desconhecida')
  const event = await mutate(async l => l.load('events', { id: eventId }), d => {
    const e = d.events.find(x => x.id === eventId && x.ownerId === user.id) ?? fail(404, 'Evento não encontrado')
    const fields = cleanEvent(input.patch ?? {}, e)
    if (fields.start !== e.start) {
      e.sentPre = false
      e.sentStart = false
    }
    Object.assign(e, fields, { updatedAt: Date.now() })
    return e
  })
  return { event }
})

export const DELETE = handle<{ eventId: string }>(async (_req, { eventId }) => {
  const user = await requirePersonal()
  await mutate(async l => l.load('events', { id: eventId }), d => {
    if (!d.events.some(x => x.id === eventId && x.ownerId === user.id)) fail(404, 'Evento não encontrado')
    d.events = d.events.filter(x => x.id !== eventId)
  })
})
