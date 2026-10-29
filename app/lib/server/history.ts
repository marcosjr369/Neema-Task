import type { CarriedHistory, Member } from '../../types'
import { achievementProgress, sumSeconds, totalXp } from '../stats'
import type { DB, Loader } from './store'

/**
 * Quem já tinha conta e aceita entrar numa empresa traz o que fez até aí (espaço pessoal e
 * outras empresas). Nada é apagado nem movido: guarda-se um resumo no membro novo, que soma
 * aos pontos e conquistas dele (e da empresa). As tarefas pessoais continuam privadas.
 */

/** Carrega as sessões e tarefas do utilizador (pessoais e das empresas onde já está activo) */
export async function loadHistory(l: Loader, userId: string) {
  await l.load('members', { user_id: userId })
  const ids = l.db.members.filter(m => m.userId === userId && m.status === 'activo').map(m => m.id)
  await l.load('sessions', { user_id: userId })
  await l.load('tasks', { owner_id: userId })
  if (ids.length) {
    await l.load('sessions', { member_id: ids })
    await l.load('tasks', { assignee_id: ids })
  }
}

export function historyOf(db: DB, userId: string, orgId: string, now = Date.now()): CarriedHistory | undefined {
  // só o trabalho próprio de cada empresa (o resumo que lá trouxe já está contado no espaço pessoal)
  const others = new Set(
    db.members.filter(m => m.userId === userId && m.orgId !== orgId && m.status === 'activo').map(m => m.id),
  )
  const sessions = db.sessions.filter(s => (s.memberId ? others.has(s.memberId) : s.userId === userId))
  const tasks = db.tasks.filter(t => (t.orgId ? !!t.assigneeId && others.has(t.assigneeId) : t.ownerId === userId))
  if (sessions.length === 0 && tasks.length === 0) return undefined
  const p = achievementProgress(sessions, tasks)
  return { at: now, xp: totalXp(sessions, tasks), seconds: sumSeconds(sessions), done: p.done, record: p.record, longest: p.longest }
}

/** Activa o membro e junta-lhe o histórico do utilizador */
export function activateMember(db: DB, member: Member, userId: string, now = Date.now()) {
  member.history = historyOf(db, userId, member.orgId, now)
  member.userId = userId
  member.status = 'activo'
  member.joinedAt = now
}
