import { body, fail, handle, requireUser } from '../../../lib/server/api'
import { mutate, newId } from '../../../lib/server/store'
import { accountTypeOf, businessRoleOf, COMPANY_ONLY } from '../../../lib/account'

/**
 * Entrar numa empresa com código de convite ou pelo domínio do email.
 * Uma conta pessoal só entra se confirmar a conversão (convert): passa a conta de empresa
 * e o espaço pessoal deixa de aparecer (os dados ficam guardados, mas sem acesso).
 */
export const POST = handle(async req => {
  const user = await requireUser()
  const { code, orgId, convert } = await body<{ code?: string; orgId?: string; convert?: boolean }>(req)
  const clean = code?.trim().toUpperCase().replace(/^NEEMA-/, '')
  return mutate(async l => {
    await l.load('users', { id: user.id })
    await l.load('members', { user_id: user.id })
    // empresas onde já está (para saber se é a conta de alguma)
    await l.load('orgs', { id: l.db.members.map(m => m.orgId) })
    if (clean) await l.load('orgs', { invite_code: clean })
    else if (orgId) await l.load('orgs', { id: orgId })
    await l.load('members', { org_id: l.db.orgs.map(o => o.id) })
  }, db => {
    const me = db.users.find(u => u.id === user.id)!
    const hasMembership = db.members.some(m => m.userId === me.id && m.status === 'activo')
    if (accountTypeOf(me, hasMembership) === 'personal' && !convert) {
      fail(409, 'Esta conta é pessoal. Confirma que queres passar a conta de empresa.')
    }
    // a conta de uma empresa é a empresa, não um funcionário
    if (businessRoleOf(me, db.orgs.some(o => o.createdBy === me.id), hasMembership) === 'company') fail(403, COMPANY_ONLY)
    const domain = user.email.split('@')[1]
    const org = clean
      ? db.orgs.find(o => o.inviteCode === clean)
      : user.emailVerified !== false
        ? db.orgs.find(o => o.id === orgId && o.domain === domain)
        : undefined
    if (!org) return fail(404, clean ? 'Código inválido' : 'Empresa não encontrada')

    // só ocupa um convite pendente com o mesmo email se o email estiver confirmado
    let member = db.members.find(
      m => m.orgId === org.id && (m.userId === user.id || (user.emailVerified !== false && m.email === user.email)),
    )
    if (member) {
      member.userId = user.id
      if (member.status === 'pendente') {
        member.status = 'activo'
        member.joinedAt = Date.now()
      }
    } else {
      member = {
        id: newId(),
        orgId: org.id,
        userId: user.id,
        email: user.email,
        name: user.name,
        picture: user.picture,
        role: 'membro',
        status: 'activo',
        joinedAt: Date.now(),
        presence: 'offline',
      }
      db.members.push(member)
    }
    me.accountType = 'business'
    me.businessRole = 'employee'
    me.workspace = { kind: 'org', orgId: org.id, memberId: member.id }
    return { org, member }
  })
})
