import { body, fail, handle, isManager, requireAdmin, requireMember } from '../../../lib/server/api'
import { inviteCode, mutate } from '../../../lib/server/store'
import { effectivePresence, visibleMembers } from '../../../lib/server/org'
import { isFormer } from '../../../lib/org'
import { orgScope } from '../../../lib/server/scopes'
import { cleanPermissions } from '../../../lib/permissions'
import type { OrgPermissions } from '../../../types'

export const GET = handle<{ orgId: string }>(async (req, { orgId }) => {
  const { db, org, me } = await requireMember(orgId)
  const manager = isManager(me)
  const now = Date.now()
  const members = db.members
    .filter(m => m.orgId === orgId && !isFormer(m))
    .map(m => ({
      ...m,
      presence: effectivePresence(m, now),
      phone: manager || m.id === me.id ? m.phone : undefined,
      email: manager || m.id === me.id ? m.email : '',
    }))
  // quem já saiu: só para quem gere (histórico das tarefas, do tempo e das reuniões)
  const former = manager ? visibleMembers(db, me).filter(isFormer) : []
  // o mapa do escritório pode ser grande: se o cliente já tem esta versão (?mapa=updatedAt), não vai outra vez
  const known = new URL(req.url).searchParams.get('mapa')
  const sameMap = !!known && !!org.office?.updatedAt && String(org.office.updatedAt) === known
  const { office, ...rest } = org
  const sent = sameMap ? rest : { ...rest, office }
  return {
    org: manager ? sent : { ...sent, inviteCode: '' },
    sameMap,
    me,
    departments: db.departments.filter(d => d.orgId === orgId),
    members,
    former,
  }
})

export const PATCH = handle<{ orgId: string }>(async (req, { orgId }) => {
  await requireAdmin(orgId)
  const patch = await body<{ name?: string; sector?: string; size?: string; domain?: string; hideFromRanking?: boolean; dailyGoalHours?: number; regenerateCode?: boolean; permissions?: OrgPermissions }>(req)
  const goal = patch.dailyGoalHours === undefined ? undefined : Number(patch.dailyGoalHours)
  if (goal !== undefined && (!Number.isFinite(goal) || goal < 1 || goal > 16)) fail(400, 'A meta diária tem de estar entre 1 e 16 horas')
  return mutate(orgScope(orgId), db => {
    const org = db.orgs.find(o => o.id === orgId)!
    if (patch.name?.trim()) org.name = patch.name.trim().slice(0, 80)
    if (patch.sector !== undefined) org.sector = patch.sector.trim().slice(0, 60)
    if (patch.size !== undefined) org.size = patch.size
    if (patch.domain !== undefined) org.domain = patch.domain.trim().toLowerCase().replace(/^@/, '') || undefined
    if (patch.hideFromRanking !== undefined) org.hideFromRanking = !!patch.hideFromRanking || undefined
    if (goal !== undefined) org.dailyGoalHours = Math.round(goal * 2) / 2
    if (patch.permissions !== undefined) {
      const memberIds = new Set(db.members.filter(m => m.orgId === orgId).map(m => m.id))
      const deptIds = new Set(db.departments.filter(d => d.orgId === orgId).map(d => d.id))
      const clean = cleanPermissions(patch.permissions, memberIds, deptIds)
      org.permissions = Object.keys(clean).length ? clean : undefined
    }
    if (patch.regenerateCode) {
      let code = inviteCode()
      while (db.orgs.some(o => o.inviteCode === code)) code = inviteCode()
      org.inviteCode = code
    }
    return { org }
  })
})
