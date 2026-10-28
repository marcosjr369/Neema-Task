import { clerkClient } from '@clerk/nextjs/server'
import { body, fail, handle } from '../../../../lib/server/api'
import { confirmPassword, requirePanel } from '../../../../lib/server/panel'
import { removeFiles } from '../../../../lib/server/files'
import { mutate, read } from '../../../../lib/server/store'
import { userDetail } from '../../../../lib/server/panelDetail'
import { panelQuery } from '../../../../lib/server/panelQuery'
import { accountTypeOf } from '../../../../lib/account'
import { isCompleted } from '../../../../lib/points'
import { ROLE_LABEL, type DeletedUser } from '../../../../types'

/** Ficha de um utilizador: dados, empresas, tarefas, XP e estatísticas */
export const GET = handle<{ userId: string }>(async (req, { userId }) => {
  await requirePanel()
  const { days, tz } = panelQuery(req)
  return userDetail(await read('all'), userId, days, tz) ?? fail(404, 'Utilizador não encontrado')
})

/**
 * Desactivar / reactivar um utilizador (pede outra vez a palavra-passe do painel). Além da marca na nossa base de dados,
 * bloqueia a conta no Clerk (termina as sessões e impede novo login).
 */
export const PATCH = handle<{ userId: string }>(async (req, { userId }) => {
  await requirePanel()
  const { disabled, password } = await body<{ disabled?: boolean; password?: string }>(req)
  if (typeof disabled !== 'boolean') fail(400, 'Pedido inválido')
  await confirmPassword(req, password)

  const user = await mutate(async l => { await l.load('users', { id: userId }) }, db => {
    const u = db.users.find(x => x.id === userId) ?? fail(404, 'Utilizador não encontrado')
    u.disabled = disabled || undefined
    u.disabledAt = disabled ? Date.now() : undefined
    return u
  })

  let clerk: 'ok' | 'sem-conta' | 'falhou' = 'sem-conta'
  if (user.clerkId) {
    try {
      const client = await clerkClient()
      if (disabled) await client.users.banUser(user.clerkId)
      else await client.users.unbanUser(user.clerkId)
      clerk = 'ok'
    } catch (err) {
      console.error('Clerk ban/unban', err)
      clerk = 'falhou'
    }
  }
  return { ok: true, disabled: !!user.disabled, clerk }
})

/**
 * Eliminar um utilizador de vez (pede outra vez a palavra-passe do painel).
 * Apaga a conta, o espaço pessoal, os dispositivos de push e a ligação às empresas:
 *  - empresa em que era a única pessoa → a empresa inteira é apagada (com anexos);
 *  - empresa com mais gente em que era o único administrador → o funcionário mais antigo passa a administrador;
 *  - tarefas de empresa atribuídas a ele ficam sem responsável; o histórico de tempo dele sai.
 * Fica um registo (nome, email, totais, motivo) para a página "Eliminados" do painel.
 * No fim apaga também a conta no Clerk.
 */
export const DELETE = handle<{ userId: string }>(async (req, { userId }) => {
  await requirePanel()
  const { password, reason } = await body<{ password?: string; reason?: string }>(req)
  await confirmPassword(req, password)

  const result = await mutate('all', db => {
    const user = db.users.find(u => u.id === userId) ?? fail(404, 'Utilizador não encontrado')
    const files: string[] = []
    const deletedOrgs: string[] = []
    const promoted: string[] = []

    // registo para a página Eliminados, com os totais de sempre antes de apagar
    const mine = db.members.filter(x => x.userId === userId)
    const memberIds = new Set(mine.map(x => x.id))
    const record: DeletedUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      picture: user.picture,
      type: accountTypeOf(user, mine.some(x => x.status === 'activo')) ?? 'none',
      createdAt: user.createdAt,
      deletedAt: Date.now(),
      reason: reason?.trim().slice(0, 300) || undefined,
      orgs: mine.map(x => `${db.orgs.find(o => o.id === x.orgId)?.name ?? '—'} · ${ROLE_LABEL[x.role]}`),
      deletedOrgs: [],
      focusSeconds: db.sessions.reduce((a, x) => (x.userId === userId || (x.memberId && memberIds.has(x.memberId)) ? a + x.seconds : a), 0),
      tasksDone: db.tasks.filter(t => (t.ownerId === userId || (t.assigneeId && memberIds.has(t.assigneeId))) && isCompleted(t)).length,
    }

    for (const m of db.members.filter(x => x.userId === userId)) {
      const org = db.orgs.find(o => o.id === m.orgId)
      const others = db.members.filter(x => x.orgId === m.orgId && x.id !== m.id && x.status === 'activo')
      if (org && others.length === 0) {
        // era a única pessoa: a empresa vai com ela
        const memberIds = new Set(db.members.filter(x => x.orgId === org.id).map(x => x.id))
        db.tasks.filter(t => t.orgId === org.id).forEach(t => t.attachments?.forEach(a => files.push(a.id)))
        db.tasks = db.tasks.filter(t => t.orgId !== org.id)
        db.sessions = db.sessions.filter(s => !s.memberId || !memberIds.has(s.memberId))
        db.presence = db.presence.filter(p => p.orgId !== org.id)
        db.departments = db.departments.filter(d => d.orgId !== org.id)
        db.members = db.members.filter(x => x.orgId !== org.id)
        db.orgs = db.orgs.filter(o => o.id !== org.id)
        deletedOrgs.push(org.name)
        continue
      }
      if (org && m.role === 'admin' && !others.some(x => x.role === 'admin')) {
        const next = [...others].sort((a, b) => (a.joinedAt ?? 0) - (b.joinedAt ?? 0))[0]
        next.role = 'admin'
        promoted.push(`${next.name} (${org.name})`)
      }
      db.tasks.forEach(t => { if (t.assigneeId === m.id) t.assigneeId = undefined })
      db.departments.forEach(d => { d.supervisorIds = d.supervisorIds.filter(id => id !== m.id) })
      db.sessions = db.sessions.filter(s => s.memberId !== m.id)
      db.presence = db.presence.filter(p => p.memberId !== m.id)
      db.members = db.members.filter(x => x.id !== m.id)
    }

    // espaço pessoal e dispositivos
    db.tasks.filter(t => t.ownerId === userId).forEach(t => t.attachments?.forEach(a => files.push(a.id)))
    db.tasks = db.tasks.filter(t => t.ownerId !== userId)
    db.sessions = db.sessions.filter(s => s.userId !== userId)
    db.push = db.push.filter(p => p.userId !== userId)
    db.users = db.users.filter(u => u.id !== userId)
    record.deletedOrgs = deletedOrgs
    db.deleted.push(record)
    return { clerkId: user.clerkId, name: user.name, files, deletedOrgs, promoted }
  })

  if (result.files.length) await removeFiles(result.files).catch(err => console.error('Anexos', err))
  let clerk: 'ok' | 'sem-conta' | 'falhou' = 'sem-conta'
  if (result.clerkId) {
    try {
      await (await clerkClient()).users.deleteUser(result.clerkId)
      clerk = 'ok'
    } catch (err) {
      console.error('Clerk deleteUser', err)
      clerk = 'falhou'
    }
  }
  return { ok: true, name: result.name, deletedOrgs: result.deletedOrgs, promoted: result.promoted, clerk }
})
