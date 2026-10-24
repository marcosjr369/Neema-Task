import { body, handle, requireMember } from '../../../../lib/server/api'
import { mutate, type Loader } from '../../../../lib/server/store'
import { visibleMembers } from '../../../../lib/server/org'
import { cleanSessions } from '../../../../lib/server/tasks'
import type { Session } from '../../../../types'

/** ?scope=mine | team, ?from=<ms> */
export const GET = handle<{ orgId: string }>(async (req, { orgId }) => {
  const url = new URL(req.url)
  const from = Number(url.searchParams.get('from')) || 0
  const { db, me } = await requireMember(orgId, { tasks: true, sessions: { since: from } })
  const ids =
    url.searchParams.get('scope') === 'team'
      ? new Set(visibleMembers(db, me).map(m => m.id))
      : new Set([me.id])
  const orgTasks = new Set(db.tasks.filter(t => t.orgId === orgId).map(t => t.id))
  const sessions = db.sessions.filter(s => s.memberId && ids.has(s.memberId) && orgTasks.has(s.taskId) && s.start >= from)
  return { sessions }
})

/** Regista blocos de tempo trabalhado em tarefas atribuídas ao próprio */
export const POST = handle<{ orgId: string }>(async (req, { orgId }) => {
  const { me } = await requireMember(orgId)
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
