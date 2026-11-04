import { EVENT_KINDS, EVENT_LEAD_MINUTES, type CalendarEvent, type EventKind, type Member, type Org, type User } from '../../types'
import { isCompanyAccount } from '../org'
import { fail, isManager } from './api'
import { pushConfigured, sendToUser } from './push'
import { mutate, read, type DB } from './store'

/*
 * Calendário: validação, quem recebe os avisos e o envio dos lembretes push
 * (5 minutos antes e à hora do evento), mesmo com a app fechada.
 */

export type EventInput = Partial<Pick<CalendarEvent, 'title' | 'description' | 'kind' | 'start' | 'end' | 'location' | 'attendeeIds'>>

const DAY = 24 * 3600 * 1000

/** Valida e limpa os campos vindos do cliente; parcial ao editar */
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

/** Utilizadores que recebem os avisos: quem agendou e os convidados que não recusaram */
export function recipients(db: DB, e: CalendarEvent): string[] {
  if (e.ownerId) return [e.ownerId]
  const ids = [e.createdBy, ...e.attendeeIds.filter(id => e.responses?.[id] !== 'nao')]
  return [...new Set(ids.map(id => db.members.find(m => m.id === id && m.orgId === e.orgId)?.userId).filter((x): x is string => !!x))]
}

/** Avisa os convidados (convite novo, alteração ou cancelamento); não espera nem falha o pedido */
export function notifyMembers(db: DB, memberIds: string[], e: CalendarEvent, title: (u?: User) => string) {
  if (!pushConfigured() || !memberIds.length) return
  const userIds = [...new Set(memberIds.map(id => db.members.find(m => m.id === id)?.userId).filter((x): x is string => !!x))]
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

/** Envia os avisos devidos: 5 min antes e à hora (cada um uma só vez) */
export async function runEventReminders(now = Date.now()) {
  if (!pushConfigured()) return { sent: 0 }
  const lead = EVENT_LEAD_MINUTES * 60 * 1000
  // eventos que começaram há pouco ou começam nos próximos minutos
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

/** Verifica os eventos a cada 30 s no próprio servidor Node (ver instrumentation.ts) */
export function startEventLoop() {
  if (g.__neemaEvents || !pushConfigured()) return
  g.__neemaEvents = setInterval(() => {
    runEventReminders().catch(err => console.error('avisos de eventos falharam', err))
  }, LOOP_MS)
}

/** Convidados válidos: pessoas activas da empresa (sem a conta da empresa nem quem agenda) */
export function checkAttendees(db: DB, org: Org, me: Member, ids: unknown): string[] {
  if (!Array.isArray(ids)) return []
  const list = [...new Set(ids.map(String))].filter(id => id !== me.id)
  if (list.length > 300) fail(400, 'No máximo 300 convidados')
  for (const id of list) {
    const m = db.members.find(x => x.id === id && x.orgId === org.id && x.status === 'activo')
    if (!m || isCompanyAccount(m, org)) fail(400, 'Convidado inválido')
  }
  // agendar com outras pessoas: administradores, supervisores e chefes de departamento
  if (list.length && !isManager(me)) fail(403, 'Só administradores e supervisores podem convidar outras pessoas')
  return list
}
