import { EVENT_KINDS, EVENT_LEAD_MINUTES, type CalendarEvent, type EventKind, type Member, type Org, type User } from '../../types'
import { isCompanyAccount } from '../org'
import { fail } from './api'
import { pushConfigured, sendToUser } from './push'
import { mutate, read, type DB } from './store'

export type EventInput = Partial<Pick<CalendarEvent, 'title' | 'description' | 'kind' | 'start' | 'end' | 'location' | 'attendeeIds' | 'roomId'>> & {
  /** marcar mesmo com a sala já reservada nesse horário (a pessoa foi avisada) */
  allowOverlap?: boolean
}

const DAY = 24 * 3600 * 1000

export function cleanEvent(input: EventInput, current?: CalendarEvent) {
  const out: Partial<CalendarEvent> = {}
  if (input.title !== undefined || !current) {
    const title = String(input.title ?? '').trim().slice(0, 120)
    if (!title) fail(400, 'Indica o título')
    out.title = title
  }
  if (input.description !== undefined) out.description = String(input.description ?? '').slice(0, 2000) || undefined
  if (input.location !== undefined) out.location = String(input.location ?? '').trim().slice(0, 300) || undefined
  if (input.kind !== undefined || !current) {
    const kind = (input.kind ?? 'compromisso') as EventKind
    if (!EVENT_KINDS[kind]) fail(400, 'Tipo inválido')
    out.kind = kind
  }
  const start = input.start !== undefined ? Number(input.start) : current?.start
  const end = input.end !== undefined ? Number(input.end) : current?.end
  if (!Number.isFinite(start) || !Number.isFinite(end)) fail(400, 'Indica a data e a hora')
  if (end! <= start!) fail(400, 'O fim tem de ser depois do início')
  if (end! - start! > DAY) fail(400, 'Um evento dura no máximo 24 horas')
  out.start = start
  out.end = end
  return out
}

/** Data e hora no fuso do utilizador (o servidor pode estar noutro) */
export function whenText(ms: number, timeZone?: string) {
  const opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }
  try {
    return new Intl.DateTimeFormat('pt-PT', { ...opts, timeZone }).format(ms)
  } catch {
    return new Intl.DateTimeFormat('pt-PT', opts).format(ms)
  }
}

export function timeText(ms: number, timeZone?: string) {
  try {
    return new Intl.DateTimeFormat('pt-PT', { hour: '2-digit', minute: '2-digit', timeZone }).format(ms)
  } catch {
    return new Intl.DateTimeFormat('pt-PT', { hour: '2-digit', minute: '2-digit' }).format(ms)
  }
}

export function recipients(db: DB, e: CalendarEvent): string[] {
  if (e.ownerId) return [e.ownerId]
  const ids = [e.createdBy, ...e.attendeeIds.filter(id => e.responses?.[id] !== 'nao')]
  return [...new Set(ids.map(id => db.members.find(m => m.id === id && m.orgId === e.orgId && m.status !== 'saiu')?.userId).filter((x): x is string => !!x))]
}

export function notifyMembers(db: DB, memberIds: string[], e: CalendarEvent, title: (u?: User) => string) {
  if (!pushConfigured() || !memberIds.length) return
  const userIds = [...new Set(memberIds.map(id => db.members.find(m => m.id === id && m.status !== 'saiu')?.userId).filter((x): x is string => !!x))]
  for (const userId of userIds) {
    const user = db.users.find(u => u.id === userId)
    sendToUser(userId, {
      title: title(user),
      body: `${e.title} · ${whenText(e.start, user?.timezone)}${e.location ? ` · ${e.location}` : ''}`,
      url: `/calendario?dia=${e.start}`,
      tag: `event-invite-${e.id}`,
    }).catch(err => console.error('aviso de evento falhou', err))
  }
}

export async function runEventReminders(now = Date.now()) {
  if (!pushConfigured()) return { sent: 0 }
  const lead = EVENT_LEAD_MINUTES * 60 * 1000
  const db = await read(async l => {
    await l.load('events', { start_at: { gte: now - 10 * 60 * 1000, lte: now + lead + 60 * 1000 } })
    await l.load('members', { org_id: [...new Set(l.db.events.map(e => e.orgId).filter((x): x is string => !!x))] })
    const userIds = [...l.db.members.map(m => m.userId), ...l.db.events.map(e => e.ownerId)].filter((x): x is string => !!x)
    await l.load('users', { id: [...new Set(userIds)] })
  })

  const due: { id: string; stage: 'pre' | 'start' }[] = []
  for (const e of db.events) {
    if (!e.sentStart && now >= e.start && now < e.start + 10 * 60 * 1000) due.push({ id: e.id, stage: 'start' })
    else if (!e.sentPre && !e.sentStart && now >= e.start - lead && now < e.start) due.push({ id: e.id, stage: 'pre' })
  }
  if (!due.length) return { sent: 0 }

  // marca primeiro (outra instância do servidor não repete o aviso)
  const claimed = await mutate(async l => l.load('events', { id: due.map(d => d.id) }), d => {
    const out: typeof due = []
    for (const x of due) {
      const e = d.events.find(ev => ev.id === x.id)
      if (!e) continue
      if (x.stage === 'start' && !e.sentStart) { e.sentStart = true; e.sentPre = true; out.push(x) }
      if (x.stage === 'pre' && !e.sentPre) { e.sentPre = true; out.push(x) }
    }
    return out
  })

  let sent = 0
  for (const x of claimed) {
    const e = db.events.find(ev => ev.id === x.id)!
    const kind = EVENT_KINDS[e.kind].label
    for (const userId of recipients(db, e)) {
      const user = db.users.find(u => u.id === userId)
      if (user?.disabled) continue
      sent += await sendToUser(userId, {
        title: x.stage === 'pre' ? `${kind} daqui a ${EVENT_LEAD_MINUTES} min` : `Está na hora: ${e.title}`,
        body:
          x.stage === 'pre'
            ? `${e.title} às ${timeText(e.start, user?.timezone)}${e.location ? ` · ${e.location}` : ''}`
            : `${kind} das ${timeText(e.start, user?.timezone)}${e.location ? ` · ${e.location}` : ''}`,
        url: `/calendario?dia=${e.start}`,
        tag: `event-${x.stage}-${e.id}`,
      })
    }
  }
  return { sent }
}

const LOOP_MS = 30 * 1000
const g = globalThis as unknown as { __neemaEvents?: ReturnType<typeof setInterval> }

export function startEventLoop() {
  if (g.__neemaEvents || !pushConfigured()) return
  g.__neemaEvents = setInterval(() => {
    runEventReminders().catch(err => console.error('avisos de eventos falharam', err))
  }, LOOP_MS)
}

export function checkAttendees(db: DB, org: Org, me: Member, ids: unknown): string[] {
  if (!Array.isArray(ids)) return []
  const list = [...new Set(ids.map(String))].filter(id => id !== me.id)
  if (list.length > 300) fail(400, 'No máximo 300 convidados')
  for (const id of list) {
    const m = db.members.find(x => x.id === id && x.orgId === org.id && x.status === 'activo')
    if (!m || isCompanyAccount(m, org)) fail(400, 'Convidado inválido')
  }
  return list
}

/* ─── Salas de reunião (as salas do mapa do escritório) ─── */

/** A sala reservada tem de ser uma sala do mapa da empresa */
export function checkRoom(org: Org, roomId: unknown): string | undefined {
  if (roomId === undefined || roomId === null || roomId === '') return undefined
  const room = org.office?.rooms.find(r => r.id === roomId && r.kind === 'sala')
  if (!room) fail(400, 'Esta sala já não existe no mapa do escritório')
  return room!.id
}

/** As reuniões já marcadas na mesma sala que se cruzam com [start, end) */
export function roomClashes(events: CalendarEvent[], roomId: string, start: number, end: number, ignoreId?: string) {
  return events
    .filter(e => e.roomId === roomId && e.id !== ignoreId && e.start < end && e.end > start)
    .sort((a, b) => a.start - b.start)
}

/** Mensagem de sala ocupada (sem detalhes da reunião: só o horário) */
export function clashText(org: Org, roomId: string, clashes: CalendarEvent[], timeZone?: string) {
  const room = org.office?.rooms.find(r => r.id === roomId)?.name ?? 'A sala'
  const when = clashes.map(c => `das ${timeText(c.start, timeZone)} às ${timeText(c.end, timeZone)}`).join(', ')
  return `${room} já está reservada ${when}.`
}

/**
 * Uma reserva de sala vista por qualquer pessoa da empresa: a sala e o horário. O título e as
 * pessoas só aparecem a quem participa (ou marcou) a reunião.
 */
export type RoomBooking = {
  id: string
  roomId: string
  start: number
  end: number
  /** só para quem participa */
  title?: string
  mine: boolean
  /** quantas pessoas estão presencialmente na sala agora */
  present: number
}

export function bookingView(e: CalendarEvent, meId: string): RoomBooking {
  const mine = e.createdBy === meId || e.attendeeIds.includes(meId)
  return {
    id: e.id,
    roomId: e.roomId!,
    start: e.start,
    end: e.end,
    ...(mine ? { title: e.title } : {}),
    mine,
    present: Object.values(e.attendance ?? {}).filter(a => a === 'presencial').length,
  }
}
