import { body, handle, requirePersonal } from '../../../lib/server/api'
import { mutate, newId, read } from '../../../lib/server/store'
import { cleanEvent, type EventInput } from '../../../lib/server/events'
import type { CalendarEvent } from '../../../types'

const DAY = 24 * 3600 * 1000

/** Eventos do espaço pessoal: ?from=&to= */
export const GET = handle(async req => {
  const user = await requirePersonal()
  const url = new URL(req.url)
  const now = Date.now()
  const from = Number(url.searchParams.get('from')) || now - 31 * DAY
  const to = Number(url.searchParams.get('to')) || now + 62 * DAY
  const db = await read(async l => l.load('events', { owner_id: user.id, start_at: { gte: from - DAY, lte: to } }))
  return { events: db.events.filter(e => e.ownerId === user.id && e.end > from && e.start < to) }
})

export const POST = handle(async req => {
  const user = await requirePersonal()
  const fields = cleanEvent(await body<EventInput>(req))
  const now = Date.now()
  const event = await mutate(async () => {}, d => {
    const e: CalendarEvent = {
      title: fields.title!,
      kind: fields.kind!,
      start: fields.start!,
      end: fields.end!,
      description: fields.description,
      location: fields.location,
      id: newId(),
      ownerId: user.id,
      createdBy: user.id,
      attendeeIds: [],
      createdAt: now,
      updatedAt: now,
    }
    d.events.push(e)
    return e
  })
  return { event }
})
