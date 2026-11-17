import { body, fail, handle, requireMember } from '../../../../../lib/server/api'
import { mutate, type DB } from '../../../../../lib/server/store'
import type { Role } from '../../../../../types'
import { orgScope, scopes } from '../../../../../lib/server/scopes'
import { isCompanyAccount, isFormer } from '../../../../../lib/org'

type Patch = { name?: string; jobTitle?: string; phone?: string; departmentId?: string | null; role?: Role }

const activeAdmins = (db: DB, orgId: string) =>
  db.members.filter(x => x.orgId === orgId && x.role === 'admin' && x.status === 'activo').length

export const PATCH = handle<{ orgId: string; memberId: string }>(async (req, { orgId, memberId }) => {
  const { me } = await requireMember(orgId)
  const patch = await body<Patch>(req)
  if (me.role !== 'admin' && me.id !== memberId) fail(403, 'Só administradores podem editar funcionários')

  return mutate(orgScope(orgId), db => {
    const m = db.members.find(x => x.id === memberId && x.orgId === orgId) ?? fail(404, 'Funcionário não encontrado')
    if (isFormer(m)) fail(400, 'Esta pessoa já saiu da empresa')
    if (patch.name?.trim()) m.name = patch.name.trim().slice(0, 80)
    if (patch.jobTitle !== undefined) m.jobTitle = patch.jobTitle.trim().slice(0, 60) || undefined
    if (patch.phone !== undefined) m.phone = patch.phone.trim().slice(0, 30) || undefined

    const companyAccount = isCompanyAccount(m, db.orgs.find(o => o.id === orgId))
    if (companyAccount && patch.role && patch.role !== 'admin') fail(400, 'A conta da empresa é sempre administradora')

    if (me.role === 'admin' && !companyAccount) {
      if (patch.departmentId !== undefined) {
        const dept = patch.departmentId ? db.departments.find(d => d.id === patch.departmentId && d.orgId === orgId) : undefined
        if (patch.departmentId && !dept) fail(400, 'Departamento inválido')
        m.departmentId = dept?.id
      }
      if (patch.role && patch.role !== m.role) {
        if (m.role === 'admin' && activeAdmins(db, orgId) <= 1) fail(400, 'A empresa precisa de pelo menos um administrador')
        m.role = patch.role
      }
      db.departments.forEach(d => {
        if (d.orgId !== orgId) return
        if (m.role !== 'supervisor') d.supervisorIds = d.supervisorIds.filter(id => id !== m.id)
        else if (d.id === m.departmentId && !d.supervisorIds.includes(m.id)) d.supervisorIds.push(m.id)
      })
    }
    return { member: m }
  })
})

/**
 * Sair (ou ser removido) da empresa. Um convite por aceitar desaparece; quem já trabalhou na
 * empresa fica marcado como "saiu": perde o acesso, mas as tarefas, o tempo, a presença e as
 * reuniões continuam ligados ao nome dele e a administração continua a vê-los.
 */
export const DELETE = handle<{ orgId: string; memberId: string }>(async (_req, { orgId, memberId }) => {
  const { me } = await requireMember(orgId)
  if (me.role !== 'admin' && me.id !== memberId) fail(403, 'Sem permissão')
  const scope = scopes(orgScope(orgId, { presence: 'open' }), async l => { await l.load('tasks', { assignee_id: memberId }) })
  return mutate(scope, db => {
    const m = db.members.find(x => x.id === memberId && x.orgId === orgId && !isFormer(x)) ?? fail(404, 'Funcionário não encontrado')
    if (m.userId && m.userId === db.orgs.find(o => o.id === orgId)?.createdBy) fail(400, 'A conta que criou a empresa não pode sair nem ser removida')
    if (m.role === 'admin' && activeAdmins(db, orgId) <= 1) fail(400, 'Não podes remover o único administrador')
    db.departments.forEach(d => { d.supervisorIds = d.supervisorIds.filter(id => id !== m.id) })
    // um convite que nunca foi usado e sem tarefas não tem histórico: pode desaparecer
    if (m.status === 'pendente' && !m.joinedAt && !db.tasks.some(t => t.assigneeId === m.id)) {
      db.members = db.members.filter(x => x.id !== m.id)
      return
    }
    const now = Date.now()
    const open = db.presence.find(p => p.memberId === m.id && p.end === null)
    if (open) open.end = now
    m.status = 'saiu'
    m.leftAt = now
    m.presence = 'offline'
    m.lastSeen = undefined
    m.workStart = undefined
  })
})
