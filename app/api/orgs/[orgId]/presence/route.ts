import { body, fail, handle, requireMember, requireUser } from '../../../../lib/server/api'
import { mutate, read, type Loader } from '../../../../lib/server/store'
import { effectivePresence, setPresence, visibleMembers } from '../../../../lib/server/org'
import { isCompanyAccount, isWorking } from '../../../../lib/org'
import { PRESENCE_CONFIG, type PresenceStatus } from '../../../../types'

export const GET = handle<{ orgId: string }>(async (req, { orgId }) => {
  const url = new URL(req.url)
  const now = Date.now()
  const from = Number(url.searchParams.get('from')) || 0
  const only = url.searchParams.get('memberId')
  // o relatório de uma pessoa lê só os segmentos dela (em paralelo com a verificação de acesso)
  const [{ db, me }, mine] = await Promise.all([
    requireMember(orgId, only ? {} : { presence: { since: from } }),
    only
      ? read(async l => {
        await Promise.all([
          l.load('presence', { member_id: only, ...(from ? { end_at: { gte: from } } : {}) }),
          from ? l.load('presence', { member_id: only, end_at: null }) : undefined,
        ])
      })
      : null,
  ])
  if (mine) db.presence = mine.presence.filter(p => p.orgId === orgId)
  const to = Number(url.searchParams.get('to')) || now
  const members = visibleMembers(db, me).filter(m => !only || m.id === only)
  if (only && members.length === 0) fail(403, 'Sem acesso a este funcionário')
  const ids = new Set(members.map(m => m.id))
  const lastSeen = new Map(members.map(m => [m.id, m]))
  const segments = db.presence
    .filter(p => ids.has(p.memberId) && p.start < to && (p.end ?? now) > from)
    .map(p => {
      if (p.end !== null) return p
      const m = lastSeen.get(p.memberId)!
      return effectivePresence(m, now) === 'offline' ? { ...p, end: Math.max(p.start, (m.lastSeen ?? p.start) + 60 * 1000) } : p
    })
  return { segments }
})

/**
 * Estado e sinal de vida (de minuto a minuto por pessoa): é a escrita mais frequente do sistema,
 * por isso carrega só o necessário (a empresa, o próprio membro e os segmentos abertos) numa
 * única transacção, em vez de ler a empresa inteira antes.
 */
export const POST = handle<{ orgId: string }>(async (req, { orgId }) => {
  const user = await requireUser()
  const { status, work, beat } = await body<{ status?: PresenceStatus; work?: 'start' | 'end'; beat?: boolean }>(req)
  if (!work && (!status || !PRESENCE_CONFIG[status])) fail(400, 'Estado inválido')
  const scope = async (l: Loader) => {
    await Promise.all([
      l.load('orgs', { id: orgId }),
      l.load('members', { org_id: orgId, user_id: user.id }),
      l.load('presence', { org_id: orgId, end_at: null }),
    ])
  }
  return mutate(scope, db => {
    const org = db.orgs.find(o => o.id === orgId) ?? fail(404, 'Empresa não encontrada')
    const m = db.members.find(x => x.orgId === orgId && x.userId === user.id && x.status === 'activo') ?? fail(403, 'Não pertences a esta empresa')
    if (isCompanyAccount(m, org)) fail(403, 'A conta da empresa não regista tempo nem estado')
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
