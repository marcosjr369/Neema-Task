import { body, fail, handle, requireUser } from '../../lib/server/api'
import { inviteCode, mutate, newId } from '../../lib/server/store'
import { DEPT_COLORS } from '../../lib/org'
import type { Department, Member, Org } from '../../types'
import { userScope } from '../../lib/server/scopes'
import { accountTypeOf, businessRoleOf, EMPLOYEE_ONLY, PERSONAL_ONLY } from '../../lib/account'

/**
 * Criar empresa (só contas de empresa). A conta que cria passa a ser a conta da própria
 * empresa: administra tudo, mas não é funcionário (ver isCompanyAccount).
 */
export const POST = handle(async req => {
  const user = await requireUser()
  const input = await body<{ name?: string; sector?: string; size?: string; domain?: string; departments?: string[] }>(req)
  const name = input.name?.trim()
  if (!name) fail(400, 'Indica o nome da empresa')
  return mutate(userScope(user.id, { memberships: true }), db => {
    const me = db.users.find(u => u.id === user.id)!
    const mine = db.members.filter(m => m.userId === me.id && m.status === 'activo')
    if (accountTypeOf(me, mine.length > 0) === 'personal') fail(403, PERSONAL_ONLY)
    // funcionários (mesmo administradores convidados) não criam empresas: só a conta de uma empresa
    const ownsOrg = db.orgs.some(o => o.createdBy === me.id)
    if (businessRoleOf(me, ownsOrg, mine.length > 0) === 'employee') fail(403, EMPLOYEE_ONLY)
    const now = Date.now()
    let code = inviteCode()
    while (db.orgs.some(o => o.inviteCode === code)) code = inviteCode()
    const org: Org = {
      id: newId(),
      name: name!.slice(0, 80),
      sector: input.sector?.trim().slice(0, 60) ?? '',
      size: input.size,
      domain: input.domain?.trim().toLowerCase().replace(/^@/, '') || undefined,
      inviteCode: code,
      createdAt: now,
      createdBy: user.id,
    }
    const member: Member = {
      id: newId(),
      orgId: org.id,
      userId: user.id,
      email: user.email,
      name: org.name,
      picture: user.picture,
      role: 'admin',
      status: 'activo',
      joinedAt: now,
      consentAt: now,
      presence: 'offline',
    }
    const departments: Department[] = (input.departments ?? [])
      .map(d => d.trim())
      .filter(Boolean)
      .slice(0, 30)
      .map((d, i) => ({ id: newId(), orgId: org.id, name: d.slice(0, 60), color: DEPT_COLORS[i % DEPT_COLORS.length], supervisorIds: [] }))
    db.orgs.push(org)
    db.members.push(member)
    db.departments.push(...departments)
    me.accountType = 'business'
    me.businessRole = 'company'
    me.workspace = { kind: 'org', orgId: org.id, memberId: member.id }
    return { org, member }
  })
})
