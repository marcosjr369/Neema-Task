import { body, handle, requireMember } from '../../../../lib/server/api'
import { mutate, newId, read } from '../../../../lib/server/store'
import { checkAttendees, cleanEvent, notifyMembers, type EventInput } from '../../../../lib/server/events'
import type { CalendarEvent } from '../../../../types'

const DAY = 24 * 3600 * 1000

/** Eventos que agendei ou para os quais fui convidado: ?from=&to= */
export const GET = handle<{ orgId: string }>(async (req, { orgId }) => {
  const url = new URL(req.url)
  const now = Date.now()
  const from = Number(url.searchParams.get('from')) || now - 31 * DAY
  const to = Number(url.searchParams.get('to')) || now + 62 * DAY
  const { me } = await requireMember(orgId)
  // os eventos duram no máximo um dia: um dia antes apanha os que atravessam o início
  const db = await read(async l => l.load('events', { org_id: orgId, start_at: { gte: from - DAY, lte: to } }))
  const events = db.events.filter(e => e.orgId === orgId && e.end > from && e.start < to && (e.createdBy === me.id || e.attendeeIds.includes(me.id)))
  return { events }
})

/** Agenda um evento; com convidados (só quem gere), avisa-os */
export const POST = handle<{ orgId: string }>(async (req, { orgId }) => {
  const { db, org, me } = await requireMember(orgId)
  const input = await body<EventInput>(req)
  const fields = cleanEvent(input)
  const attendeeIds = checkAttendees(db, org, me, input.attendeeIds)
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
      orgId,
      createdBy: me.id,
      attendeeIds,
      responses: {},
      createdAt: now,
      updatedAt: now,
    }
    d.events.push(e)
    return e
  })
  notifyMembers(db, attendeeIds, event, () => `Convite de ${me.name}`)
  return { event }
})
