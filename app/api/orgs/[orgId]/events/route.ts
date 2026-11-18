import { body, canManage, fail, handle, requireMember } from '../../../../lib/server/api'
import { mutate, newId, read } from '../../../../lib/server/store'
import { checkAttendees, checkRoom, clashText, cleanEvent, notifyMembers, roomClashes, type EventInput } from '../../../../lib/server/events'
import type { CalendarEvent } from '../../../../types'

const DAY = 24 * 3600 * 1000

export const GET = handle<{ orgId: string }>(async (req, { orgId }) => {
  const url = new URL(req.url)
  const now = Date.now()
  const from = Number(url.searchParams.get('from')) || now - 31 * DAY
  const to = Number(url.searchParams.get('to')) || now + 62 * DAY
  // a pertença e os eventos não dependem um do outro: chegam em paralelo.
  // Os eventos duram no máximo um dia: um dia antes apanha os que atravessam o início.
  const [{ db: orgDb, me }, db] = await Promise.all([
    requireMember(orgId),
    read(async l => l.load('events', { org_id: orgId, start_at: { gte: from - DAY, lte: to } })),
  ])
  const sees = (e: CalendarEvent) =>
    e.createdBy === me.id || e.attendeeIds.includes(me.id) || canManage(orgDb, me, orgDb.members.find(m => m.id === e.createdBy))
  const events = db.events.filter(e => e.orgId === orgId && e.end > from && e.start < to && sees(e))
  return { events }
})

export const POST = handle<{ orgId: string }>(async (req, { orgId }) => {
  const { db, org, me, user } = await requireMember(orgId, { users: true })
  const input = await body<EventInput>(req)
  const fields = cleanEvent(input)
  const attendeeIds = checkAttendees(db, org, me, input.attendeeIds)
  const roomId = checkRoom(org, input.roomId)
  const now = Date.now()
  const event = await mutate(async l => {
    // as reuniões à volta (para ver se a sala já está reservada)
    if (roomId) await l.load('events', { org_id: orgId, start_at: { gte: fields.start! - DAY, lte: fields.end! } })
  }, d => {
    if (roomId) {
      const clashes = roomClashes(d.events.filter(e => e.orgId === orgId), roomId, fields.start!, fields.end!)
      if (clashes.length && !input.allowOverlap) fail(409, clashText(org, roomId, clashes, user.timezone))
    }
    const e: CalendarEvent = {
      title: fields.title!,
      kind: fields.kind!,
      start: fields.start!,
      end: fields.end!,
      description: fields.description,
      location: fields.location,
      ...(roomId ? { roomId } : {}),
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
