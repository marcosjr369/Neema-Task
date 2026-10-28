import { body, handle, isManager, requireAdmin, requireMember } from '../../../lib/server/api'
import { inviteCode, mutate } from '../../../lib/server/store'
import { effectivePresence } from '../../../lib/server/org'
import { orgScope } from '../../../lib/server/scopes'

/** Dados da empresa: departamentos e lista de funcionários */
export const GET = handle<{ orgId: string }>(async (_req, { orgId }) => {
  const { db, org, me } = await requireMember(orgId)
  const manager = isManager(me)
  const now = Date.now()
  const members = db.members
    .filter(m => m.orgId === orgId)
    .map(m => ({
      ...m,
      presence: effectivePresence(m, now),
      // contactos só para quem gere
      phone: manager || m.id === me.id ? m.phone : undefined,
      email: manager || m.id === me.id ? m.email : '',
    }))
  return {
    org: manager ? org : { ...org, inviteCode: '' },
    me,
    departments: db.departments.filter(d => d.orgId === orgId),
    members,
  }
})

export const PATCH = handle<{ orgId: string }>(async (req, { orgId }) => {
  await requireAdmin(orgId)
  const patch = await body<{ name?: string; sector?: string; size?: string; domain?: string; hideFromRanking?: boolean; regenerateCode?: boolean }>(req)
  return mutate(orgScope(orgId), db => {
    const org = db.orgs.find(o => o.id === orgId)!
    if (patch.name?.trim()) org.name = patch.name.trim().slice(0, 80)
    if (patch.sector !== undefined) org.sector = patch.sector.trim().slice(0, 60)
    if (patch.size !== undefined) org.size = patch.size
    if (patch.domain !== undefined) org.domain = patch.domain.trim().toLowerCase().replace(/^@/, '') || undefined
    if (patch.hideFromRanking !== undefined) org.hideFromRanking = !!patch.hideFromRanking || undefined
    if (patch.regenerateCode) {
      let code = inviteCode()
      while (db.orgs.some(o => o.inviteCode === code)) code = inviteCode()
      org.inviteCode = code
    }
    return { org }
  })
})
