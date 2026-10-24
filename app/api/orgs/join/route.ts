import { body, fail, handle, requireUser } from '../../../lib/server/api'
import { mutate, newId } from '../../../lib/server/store'

/** Entrar numa empresa com código de convite ou pelo domínio do email */
export const POST = handle(async req => {
  const user = await requireUser()
  const { code, orgId } = await body<{ code?: string; orgId?: string }>(req)
  const clean = code?.trim().toUpperCase().replace(/^NEEMA-/, '')
  return mutate(async l => {
    if (clean) await l.load('orgs', { invite_code: clean })
    else if (orgId) await l.load('orgs', { id: orgId })
    await l.load('members', { org_id: l.db.orgs.map(o => o.id) })
  }, db => {
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
    return { org, member }
  })
})
