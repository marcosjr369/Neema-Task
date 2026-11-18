import { body, fail, handle, requireMember } from '../../../../../lib/server/api'
import { mutate } from '../../../../../lib/server/store'
import { checkAttendees, checkRoom, clashText, cleanEvent, notifyMembers, roomClashes, type EventInput } from '../../../../../lib/server/events'
import type { AttendanceMode, EventResponse } from '../../../../../types'

const DAY = 24 * 3600 * 1000
/** pode dizer como participa um pouco antes de a reunião começar */
const CHECKIN_EARLY = 10 * 60 * 1000
const MODES: AttendanceMode[] = ['presencial', 'online', 'ausente']

type Action =
  | { action: 'update'; patch: EventInput }
  | { action: 'respond'; response: EventResponse }
  | { action: 'attend'; mode: AttendanceMode }

export const PATCH = handle<{ orgId: string; eventId: string }>(async (req, { orgId, eventId }) => {
  const { db, org, me, user } = await requireMember(orgId, { users: true })
  const input = await body<Action>(req)
  let added: string[] = []
  let moved: string[] = []
  const event = await mutate(async l => {
    await l.load('events', { id: eventId })
    const cur = l.db.events.find(e => e.id === eventId)
    if (cur && input.action === 'update') {
      // as reuniões à volta do novo horário (para ver se a sala já está reservada)
      const start = Number(input.patch?.start ?? cur.start)
      const end = Number(input.patch?.end ?? cur.end)
      if (Number.isFinite(start) && Number.isFinite(end)) await l.load('events', { org_id: orgId, start_at: { gte: start - DAY, lte: end } })
    }
    // quem diz como participa: a reunião fica também na pessoa (o mapa mostra onde está)
    if (input.action === 'attend') await l.load('members', { id: me.id })
  }, d => {
    const e = d.events.find(x => x.id === eventId && x.orgId === orgId) ?? fail(404, 'Evento não encontrado')
    if (input.action === 'respond') {
      if (!e.attendeeIds.includes(me.id)) fail(403, 'Não foste convidado para este evento')
      if (input.response !== 'sim' && input.response !== 'nao') fail(400, 'Resposta inválida')
      e.responses = { ...e.responses, [me.id]: input.response }
    } else if (input.action === 'attend') {
      if (e.createdBy !== me.id && !e.attendeeIds.includes(me.id)) fail(403, 'Não estás nesta reunião')
      if (!MODES.includes(input.mode)) fail(400, 'Resposta inválida')
      const now = Date.now()
      if (now < e.start - CHECKIN_EARLY) fail(400, 'A reunião ainda não começou')
      if (now >= e.end) fail(400, 'A reunião já terminou')
      if (input.mode === 'presencial' && !e.roomId && !e.location) fail(400, 'Esta reunião não tem sala: participa online')
      e.attendance = { ...e.attendance, [me.id]: input.mode }
      const m = d.members.find(x => x.id === me.id)
      if (m) {
        if (input.mode === 'ausente') {
          if (m.meeting?.eventId === e.id) m.meeting = undefined
        } else {
          m.meeting = { eventId: e.id, mode: input.mode, until: e.end, ...(input.mode === 'presencial' && e.roomId ? { roomId: e.roomId } : {}) }
        }
      }
    } else if (input.action === 'update') {
      if (e.createdBy !== me.id && me.role !== 'admin') fail(403, 'Só quem agendou pode alterar')
      const patch = input.patch ?? {}
      const fields = cleanEvent(patch, e)
      const timeChanged = fields.start !== e.start || fields.end !== e.end
      const roomId = patch.roomId !== undefined ? checkRoom(org, patch.roomId) : e.roomId
      if (roomId && (timeChanged || roomId !== e.roomId)) {
        const clashes = roomClashes(d.events.filter(x => x.orgId === orgId), roomId, fields.start!, fields.end!, e.id)
        if (clashes.length && !patch.allowOverlap) fail(409, clashText(org, roomId, clashes, user.timezone))
      }
      Object.assign(e, fields)
      if (roomId) e.roomId = roomId
      else delete e.roomId
      if (patch.attendeeIds !== undefined) {
        const owner = db.members.find(m => m.id === e.createdBy) ?? me
        const next = checkAttendees(db, org, owner.id === me.id ? me : { ...owner, role: me.role }, patch.attendeeIds)
        added = next.filter(id => !e.attendeeIds.includes(id))
        e.attendeeIds = next
        e.responses = Object.fromEntries(Object.entries(e.responses ?? {}).filter(([id]) => next.includes(id)))
      }
      if (timeChanged) {
        e.sentPre = false
        e.sentStart = false
        e.responses = {}
        e.attendance = {}
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
  const { db, me } = await requireMember(orgId, { users: true })
  const event = await mutate(async l => {
    await l.load('events', { id: eventId })
    await l.load('members', { org_id: orgId })
  }, d => {
    const e = d.events.find(x => x.id === eventId && x.orgId === orgId) ?? fail(404, 'Evento não encontrado')
    if (e.createdBy !== me.id && me.role !== 'admin') fail(403, 'Só quem agendou pode cancelar')
    d.events = d.events.filter(x => x.id !== eventId)
    // quem estava nesta reunião volta para o seu lugar
    d.members.forEach(m => { if (m.meeting?.eventId === eventId) m.meeting = undefined })
    return e
  })
  if (event.end > Date.now()) notifyMembers(db, event.attendeeIds.filter(id => event.responses?.[id] !== 'nao'), event, () => 'Evento cancelado')
})
