import { body, fail, handle, requireMember, requirePerson } from '../../../../lib/server/api'
import { mutate, read, type Loader } from '../../../../lib/server/store'
import { visibleMembers } from '../../../../lib/server/org'
import { cleanSessions } from '../../../../lib/server/tasks'
import type { Session } from '../../../../types'

export const GET = handle<{ orgId: string }>(async (req, { orgId }) => {
  const url = new URL(req.url)
  const from = Number(url.searchParams.get('from')) || 0
  const team = url.searchParams.get('scope') === 'team'
  if (!team) {
    // as minhas: só as minhas sessões (o membro é desta empresa e apagar uma tarefa apaga as sessões dela)
    const { db, me } = await requireMember(orgId, { sessions: { since: from, mine: true } })
    return { sessions: db.sessions.filter(s => s.memberId === me.id && s.start >= from) }
  }
  // só se gravam sessões de tarefas da empresa e apagar uma tarefa apaga as sessões dela:
  // não é preciso carregar as tarefas todas para filtrar
  const only = url.searchParams.get('memberId')
  if (only) {
    // o relatório de uma pessoa: só as sessões dela, lidas em paralelo com a verificação de acesso
    const [{ db, me }, s] = await Promise.all([
      requireMember(orgId),
      read(async l => { await l.load('sessions', { member_id: only, ...(from ? { start_at: { gte: from } } : {}) }) }),
    ])
    if (!visibleMembers(db, me).some(m => m.id === only)) fail(403, 'Sem acesso a este funcionário')
    return { sessions: s.sessions.filter(x => x.memberId === only && x.start >= from) }
  }
  const { db, me } = await requireMember(orgId, { sessions: { since: from } })
  const ids = new Set(visibleMembers(db, me).map(m => m.id))
  const sessions = db.sessions.filter(s => s.memberId && ids.has(s.memberId) && s.start >= from)
  return { sessions }
})

export const POST = handle<{ orgId: string }>(async (req, { orgId }) => {
  const { me } = await requirePerson(orgId)
  const { sessions } = await body<{ sessions: Session[] }>(req)
  const ids = (sessions ?? []).map(s => String(s?.id ?? '')).filter(Boolean)
  const scope = async (l: Loader) => {
    await l.load('tasks', { org_id: orgId, assignee_id: me.id })
    // para ignorar sessões que já foram gravadas (reenvios)
    await l.load('sessions', { id: ids })
  }
  return mutate(scope, db => {
    const mine = new Set(db.tasks.filter(t => t.orgId === orgId && t.assigneeId === me.id).map(t => t.id))
    const clean = cleanSessions(db, sessions, mine, { memberId: me.id })
    db.sessions.push(...clean)
    return { saved: clean.length }
  })
})
