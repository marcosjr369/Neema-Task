import { body, fail, handle, requireUser } from '../../../lib/server/api'
import { mutate } from '../../../lib/server/store'
import { activateMember, loadHistory } from '../../../lib/server/history'
import { accountTypeOf, businessRoleOf, COMPANY_ONLY } from '../../../lib/account'

/**
 * Resposta ao convite de uma empresa (conta que já existia quando foi adicionada).
 * Aceitar: entra na equipa com os pontos e conquistas que já tinha. Recusar: o convite é apagado.
 */
export const POST = handle<{ memberId: string }>(async (req, { memberId }) => {
  const user = await requireUser()
  const { accept, convert } = await body<{ accept?: boolean; convert?: boolean }>(req)
  return mutate(async l => {
    await l.load('users', { id: user.id })
    await loadHistory(l, user.id)
    await l.load('orgs', { id: l.db.members.map(m => m.orgId) })
    const invite = l.db.members.find(m => m.id === memberId)
    if (invite) await l.load('departments', { org_id: invite.orgId })
  }, db => {
    const me = db.users.find(u => u.id === user.id)!
    const invite = db.members.find(m => m.id === memberId && m.userId === me.id && m.status === 'pendente')
    if (!invite) return fail(404, 'Convite não encontrado')
    const org = db.orgs.find(o => o.id === invite.orgId) ?? fail(404, 'Empresa não encontrada')

    if (!accept) {
      db.members = db.members.filter(m => m.id !== invite.id)
      db.departments.forEach(d => { d.supervisorIds = d.supervisorIds.filter(id => id !== invite.id) })
      return { ok: true }
    }

    const hasMembership = db.members.some(m => m.userId === me.id && m.status === 'activo')
    if (businessRoleOf(me, db.orgs.some(o => o.createdBy === me.id), hasMembership) === 'company') fail(403, COMPANY_ONLY)
    if (accountTypeOf(me, hasMembership) === 'personal' && !convert) {
      fail(409, 'Esta conta é pessoal. Confirma que queres passar a conta de empresa.')
    }
    activateMember(db, invite, me.id)
    invite.picture = me.picture ?? invite.picture
    me.accountType = 'business'
    me.businessRole = 'employee'
    me.workspace = { kind: 'org', orgId: org.id, memberId: invite.id }
    return { org, member: invite }
  })
})
