import { body, fail, handle, requireMember, requirePerson } from '../../../../lib/server/api'
import { mutate } from '../../../../lib/server/store'
import { orgScope } from '../../../../lib/server/scopes'
import { effectivePresence, setPresence, visibleMembers } from '../../../../lib/server/org'
import { isWorking } from '../../../../lib/org'
import { PRESENCE_CONFIG, type PresenceStatus } from '../../../../types'

/** Segmentos de presença: ?from=&to=&memberId= (equipa visível ao membro) */
export const GET = handle<{ orgId: string }>(async (req, { orgId }) => {
  const url = new URL(req.url)
  const now = Date.now()
  const from = Number(url.searchParams.get('from')) || 0
  const { db, me } = await requireMember(orgId, { presence: { since: from } })
  const to = Number(url.searchParams.get('to')) || now
  const only = url.searchParams.get('memberId')
  const members = visibleMembers(db, me).filter(m => !only || m.id === only)
  if (only && members.length === 0) fail(403, 'Sem acesso a este funcionário')
  const ids = new Set(members.map(m => m.id))
  const lastSeen = new Map(members.map(m => [m.id, m]))
  const segments = db.presence
    .filter(p => ids.has(p.memberId) && p.start < to && (p.end ?? now) > from)
    .map(p => {
      // segmento aberto de quem deixou de dar sinal: termina no último sinal
      if (p.end !== null) return p
      const m = lastSeen.get(p.memberId)!
      return effectivePresence(m, now) === 'offline' ? { ...p, end: Math.max(p.start, (m.lastSeen ?? p.start) + 60 * 1000) } : p
    })
  return { segments }
})

/**
 * Muda o estado do próprio (também serve de sinal periódico).
 * work: 'start' começa o dia de trabalho, 'end' termina-o. Mudar de estado sem ter começado
 * (ex.: iniciar o cronómetro) também começa o dia; o sinal periódico (beat) não, para um
 * separador esquecido não reabrir o dia que já terminou noutro.
 */
export const POST = handle<{ orgId: string }>(async (req, { orgId }) => {
  const { me } = await requirePerson(orgId)
  const { status, work, beat } = await body<{ status?: PresenceStatus; work?: 'start' | 'end'; beat?: boolean }>(req)
  if (!work && (!status || !PRESENCE_CONFIG[status])) fail(400, 'Estado inválido')
  return mutate(orgScope(orgId, { presence: 'open' }), db => {
    const m = db.members.find(x => x.id === me.id)!
    const now = Date.now()
    if (beat && !isWorking(m.workStart, now)) {
      if (m.presence !== 'offline') setPresence(db, m, 'offline', now)
      return { presence: 'offline' as PresenceStatus, workStart: undefined }
    }
    if (work === 'end' || (!work && status === 'offline')) {
      m.workStart = undefined
      setPresence(db, m, 'offline', now)
    } else {
      if (!isWorking(m.workStart, now)) m.workStart = now
      setPresence(db, m, work === 'start' ? 'trabalho' : status!, now)
    }
    return { presence: m.presence, workStart: m.workStart }
  })
})
