import { body, fail, handle, requireUser } from '../../lib/server/api'
import { inviteCode, mutate, newId } from '../../lib/server/store'
import { DEPT_COLORS } from '../../lib/org'
import type { Department, Member, Org } from '../../types'
import { userScope } from '../../lib/server/scopes'

/** Criar empresa: quem cria fica administrador */
export const POST = handle(async req => {
  const user = await requireUser()
  const input = await body<{ name?: string; sector?: string; size?: string; domain?: string; departments?: string[] }>(req)
  const name = input.name?.trim()
  if (!name) fail(400, 'Indica o nome da empresa')
  return mutate(userScope(user.id), db => {
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
      name: user.name,
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
    return { org, member }
  })
})
